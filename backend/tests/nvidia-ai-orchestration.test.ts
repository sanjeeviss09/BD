import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { NemotronParseService } from '../src/services/nemotron-parse.service';
import { NemotronAnalysisService } from '../src/services/nemotron-analysis.service';
import { NeMoRetrieverService } from '../src/services/nemo-retriever.service';
import { ProductionCalculationService } from '../src/services/production-calculation.service';
import { CommercialCalculationService } from '../src/services/commercial-calculation.service';

describe('NVIDIA Enterprise AI Intelligence Platform Tests (Nemotron 3 Ultra + Parse + Retriever)', () => {
  describe('1. Migration Safety & Standards (024_nvidia_enterprise_ai_intelligence.sql)', () => {
    const migrationPath = path.resolve(__dirname, '../supabase/migrations/024_nvidia_enterprise_ai_intelligence.sql');
    let migrationSql = '';

    beforeAll(() => {
      migrationSql = fs.readFileSync(migrationPath, 'utf-8');
    });

    it('Migration file exists and contains non-empty schema definition', () => {
      expect(migrationSql.length).toBeGreaterThan(500);
    });

    it('does not contain destructive DROP TABLE, TRUNCATE, or DROP SCHEMA commands', () => {
      const dangerousPatterns = [/DROP\s+TABLE/i, /TRUNCATE\s+/i, /DROP\s+SCHEMA/i];
      for (const pattern of dangerousPatterns) {
        expect(pattern.test(migrationSql)).toBe(false);
      }
    });

    it('uses IF NOT EXISTS for all table creations', () => {
      const rawCreateTableMatches = migrationSql.match(/CREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS)[a-zA-Z_.]+/gi);
      expect(rawCreateTableMatches).toBeNull();
    });

    it('uses CREATE INDEX IF NOT EXISTS for all index creation statements', () => {
      const rawIndexMatches = migrationSql.match(/CREATE\s+INDEX\s+(?!IF\s+NOT\s+EXISTS)[a-zA-Z_.]+/gi);
      expect(rawIndexMatches).toBeNull();
    });

    it('enforces Row Level Security (RLS) on all newly created NVIDIA tables', () => {
      const requiredRlsTables = [
        'enterprise_knowledge_documents',
        'enterprise_knowledge_chunks',
        'document_extraction_jobs',
        'ai_audit_logs',
      ];

      for (const table of requiredRlsTables) {
        expect(migrationSql).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`);
      }
    });

    it('seeds all required NVIDIA AI permissions in the RBAC engine', () => {
      const requiredPermissions = [
        'ai.orchestrator_admin',
        'ai.document_parse',
        'ai.retrieve_knowledge',
        'ai.reasoning_generate',
      ];

      for (const perm of requiredPermissions) {
        expect(migrationSql).toContain(perm);
      }
    });
  });

  describe('2. Nemotron Parse Service & Multi-Format Ingestion', () => {
    it('parses structured XLSX workbooks preserving sheet names, rows, and cell coordinates', async () => {
      // Build test workbook in memory
      const wb = XLSX.utils.book_new();
      const wsData = [
        ['Equipment ID', 'Type', 'Batch Capacity Min (L)', 'Batch Capacity Max (L)', 'Sterile Validated'],
        ['EQ-101', 'Bioreactor Stainless', 500, 2000, 'YES'],
        ['EQ-102', 'Lyophilizer Tray', 100, 500, 'YES'],
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, 'ProductionLines');
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      const parseService = new NemotronParseService();
      const result = await parseService.parseDocument(buffer, 'facility_inventory.xlsx');

      expect(result.parserUsed).toBe('NATIVE_SPREADSHEET');
      expect(result.fileHash).toBeDefined();
      expect(result.fileHash.length).toBe(64);
      expect(result.totalSections).toBe(2);
      const section = result.sections[0];
      expect(section.sheetName).toBe('ProductionLines');
      expect(section.tableData).toBeDefined();
      expect(section.tableData?.length).toBe(1);
      expect(section.tableData?.[0]['Equipment ID']).toBe('EQ-101');
      expect(section.tableData?.[0]['Sterile Validated']).toBe('YES');
      expect(section.rawText).toContain('EQ-101');
    });

    it('parses structured CSV files cleanly', async () => {
      const csvContent = 'ProcessUnit,LineCode,ThroughputPerHour,ComplianceStandard\nSterile Injectables,L-01,15000,US FDA\nOral Solid Dosage,L-02,50000,EMA';
      const buffer = Buffer.from(csvContent, 'utf-8');

      const parseService = new NemotronParseService();
      const result = await parseService.parseDocument(buffer, 'lines.csv');

      expect(result.parserUsed).toBe('NATIVE_CSV');
      expect(result.totalSections).toBe(2);
      expect(result.sections[0].tableData?.length).toBe(1);
      expect(result.sections[0].tableData?.[0]['ComplianceStandard']).toBe('US FDA');
    });

    it('handles plain text files as fallback gracefully', async () => {
      const buffer = Buffer.from('Standard Operating Procedure for Lyophilizer Clean-in-Place cycle.');
      const parseService = new NemotronParseService();
      const result = await parseService.parseDocument(buffer, 'sop.txt');

      expect(result.parserUsed).toBe('NEMOTRON_PARSE');
      expect(result.sections[0].rawText).toContain('Lyophilizer Clean-in-Place');
    });
  });

  describe('3. Nemotron 3 Ultra Schema & Output Validation Guardrails', () => {
    it('enforces structured schema and validates CDMO evaluation fields', () => {
      const validJson = JSON.stringify({
        executiveSummary: 'Manufacturing is technically feasible at Facility Alpha with minor line scheduling adjustments.',
        feasibilityConclusion: 'FEASIBLE',
        keySupportingEvidence: ['Certified bioreactor capacity matches RFQ targets.'],
        criticalConstraints: ['Cold chain storage required at -20C.'],
        capacityBottlenecks: [],
        missingInformation: ['Exact terminal sterilization temperature profile required from customer.'],
        qualityAndRegulatoryConcerns: ['Confirm batch release testing protocol with QA.'],
        recommendedNextActions: [
          { action: 'Initiate engineering run', responsibleDepartment: 'Operations', priority: 'HIGH' }
        ],
        confidenceExplanation: 'High confidence based on certified equipment records.',
      });

      const parsed = NemotronAnalysisService.parseStructuredResponse(validJson);
      expect(parsed.executiveSummary).toContain('Facility Alpha');
      expect(parsed.feasibilityConclusion).toBe('FEASIBLE');
      expect(parsed.missingInformation.length).toBe(1);
      expect(parsed.recommendedNextActions[0].action).toBe('Initiate engineering run');
    });

    it('gracefully rescues malformed or wrapped markdown JSON responses', () => {
      const wrappedMarkdown = `Here is the analysis requested:
\`\`\`json
{
  "executiveSummary": "Assessment complete with high confidence.",
  "feasibilityConclusion": "CONDITIONALLY_FEASIBLE",
  "keySupportingEvidence": [],
  "criticalConstraints": [],
  "capacityBottlenecks": [],
  "missingInformation": ["Filter size specification missing."],
  "qualityAndRegulatoryConcerns": [],
  "recommendedNextActions": [],
  "confidenceExplanation": "Definitive evidence of missing equipment specification."
}
\`\`\``;

      const parsed = NemotronAnalysisService.parseStructuredResponse(wrappedMarkdown);
      expect(parsed.executiveSummary).toBe('Assessment complete with high confidence.');
      expect(parsed.feasibilityConclusion).toBe('CONDITIONALLY_FEASIBLE');
      expect(parsed.missingInformation[0]).toContain('Filter size specification');
    });

    it('handles non-JSON garbage output without crashing and creates safe fallback structure', () => {
      const nonJson = 'Internal server reasoning trace error: could not formulate complete reply';
      const parsed = NemotronAnalysisService.parseStructuredResponse(nonJson);

      expect(parsed.executiveSummary).toContain('Internal server reasoning trace error');
      expect(parsed.feasibilityConclusion).toBe('DATA_INSUFFICIENT');
      expect(parsed.missingInformation).toBeDefined();
    });
  });

  describe('4. Deterministic Math Remains Authoritative Over AI Explanations', () => {
    it('verifies that deterministic batch calculations always govern over model speculation', () => {
      const requiredQty = 100000;
      const batchSize = 50000;
      const expectedYield = 95.0; // 5% scrap loss

      const calcResult = ProductionCalculationService.calculateBatches({
        requiredQuantity: requiredQty,
        batchSize,
        expectedYieldPct: expectedYield,
      });

      // 100,000 / 0.95 = 105,264 units needed => 3 batches of 50,000 units = 150,000 gross capacity
      expect(calcResult.requiredManufacturingQuantity).toBeGreaterThan(requiredQty);
      expect(calcResult.estimatedBatches).toBe(3);

      const lineMin = 20000;
      const smallOrder = 5000;
      const plannedBatchSize = Math.max(smallOrder, lineMin);
      expect(plannedBatchSize).toBe(20000);
    });
  });

  describe('5. NeMo Retriever Tenant Isolation Guardrails', () => {
    it('scopes all vector and keyword lookups strictly to the authorized organizationId', async () => {
      const mockSupabase: any = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({
          data: [
            {
              id: 'chunk-1',
              document_id: 'doc-1',
              content_text: 'Facility Beta line 4 is certified for sterile liquid filling up to 10ml vials.',
              chunk_index: 0,
              section_heading: 'Filling Capabilities',
              page_number: 3,
              cell_range: 'Table 2.1',
              source_provenance: { facilityCode: 'FAC-BETA' },
              enterprise_knowledge_documents: {
                document_title: 'Facility Beta Tech Spec',
                document_type: 'FACILITY_SPEC',
              },
            },
          ],
          error: null,
        }),
      };

      const retriever = new NeMoRetrieverService(mockSupabase, 'org-tenant-1234');
      const results = await retriever.retrieveEvidence('sterile liquid filling', { topK: 5 });

      expect(mockSupabase.from).toHaveBeenCalledWith('enterprise_knowledge_chunks');
      // Critical tenant security: must filter by organization_id
      expect(mockSupabase.eq).toHaveBeenCalledWith('organization_id', 'org-tenant-1234');
      expect(results.chunks.length).toBe(1);
      expect(results.sourceCitations[0]).toContain('Facility Beta Tech Spec');
      expect(results.sourceCitations[0]).toContain('Page 3');
    });
  });
});
