import { MeetingService } from '../src/services/meeting.service';
import { createSupabaseClientForUser } from '../src/db/supabase';
import * as fs from 'fs';
import * as path from 'path';

describe('Phase 3: BDIQ Meeting AI Intelligence & Live Companion Workflows', () => {
  const orgId = '11111111-1111-1111-1111-111111111111';
  const userId = '22222222-2222-2222-2222-222222222222';
  const supabase = createSupabaseClientForUser({} as any);
  const service = new MeetingService(supabase, orgId, userId);

  let testMeeting: any;

  beforeAll(async () => {
    // Create test meeting for intelligence suite
    testMeeting = await service.createMeeting({
      title: 'Phase 3 CDMO Batch Formulation & Regulatory Scale-Up',
      meeting_type: 'TECHNICAL_FEASIBILITY',
      meeting_date: new Date().toISOString().split('T')[0],
      meeting_time: '14:00:00',
      end_time: '15:00:00',
      location_or_link: 'https://meet.google.com/cbo-puuz-zgb',
      platform: 'GOOGLE_MEET',
      objective: 'Validate formulation parameters, agree on 500L pilot batch schedule, and identify QA risks.',
      agenda: '1. Formulation Feasibility & Excipient Stability\n2. Pilot Batch Scaling 500L\n3. Commercial Packaging & Pricing\n4. Environmental Control Compliance'
    });
  });

  describe('1. Migration 031 Governance & Schema Integrity', () => {
    const migrationPath = path.resolve(__dirname, '../supabase/migrations/031_meeting_ai_intelligence_live_companion.sql');

    test('migration 031 file exists with non-destructive changes', () => {
      expect(fs.existsSync(migrationPath)).toBe(true);
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      expect(sql).toContain('is_ai_suggested');
      expect(sql).toContain('ai_confidence');
      expect(sql).not.toContain('DROP TABLE');
      expect(sql).not.toContain('TRUNCATE');
    });
  });

  describe('2. Grounded AI Note Summarisation & Agenda Item Mapping', () => {
    test('strictly ingests captured notes and flags undiscussed agenda topics explicitly', async () => {
      // Add real notes covering topic 1 and topic 2 only
      await service.createNote(testMeeting.id, {
        content: 'Formulation Feasibility: Reviewed excipient compatibility. API shows stable dissolution at pH 4.5.',
        note_type: 'NOTE'
      });
      await service.createNote(testMeeting.id, {
        content: '[ACTION] Dr. Aris will submit the revised 500L pilot batch protocol to QA by Friday.',
        note_type: 'NOTE'
      });
      await service.createNote(testMeeting.id, {
        content: '[DECISION] Agreed that batch scaling will commence at Facility Line 2 with 500L vessel capacity.',
        note_type: 'NOTE'
      });
      await service.createNote(testMeeting.id, {
        content: '[RISK] Potential supply bottleneck for sterile glass vials could delay delivery by 14 days.',
        note_type: 'NOTE'
      });

      const intel = await service.generateAIMeetingIntelligence(testMeeting.id);

      expect(intel).toBeDefined();
      expect(intel.executiveSummary).toContain(testMeeting.meeting_code);
      expect(intel.agendaDiscussions).toBeDefined();
      expect(Array.isArray(intel.agendaDiscussions)).toBe(true);

      // Verify that undiscussed topics are explicitly identified
      const undiscussed = intel.agendaDiscussions.filter((a: any) => !a.wasDiscussed);
      expect(undiscussed.length).toBeGreaterThan(0);
      const undiscussedTopics = undiscussed.map((u: any) => u.agendaTopic);
      // "Commercial Packaging & Pricing" or "Environmental Control Compliance" were not discussed
      expect(
        undiscussedTopics.some((t: string) => t.includes('Packaging') || t.includes('Environmental'))
      ).toBe(true);

      const packagingTopic = intel.agendaDiscussions.find((a: any) => a.agendaTopic.includes('Packaging'));
      if (packagingTopic) {
        expect(packagingTopic.wasDiscussed).toBe(false);
        expect(packagingTopic.discussionSummary).toContain('Topic was not addressed during this recorded session.');
      }
    });
  });

  describe('3. Suggestion-First Action Items & Decisions Extraction', () => {
    test('extracts action items as PROPOSED suggestions with is_ai_suggested: true', async () => {
      const intel = await service.generateAIMeetingIntelligence(testMeeting.id);

      expect(intel.suggestedActionItems.length).toBeGreaterThan(0);
      const firstAction = intel.suggestedActionItems[0];
      expect(firstAction.status).toBe('PROPOSED');
      expect(firstAction.is_ai_suggested).toBe(true);
      expect(firstAction.confidence).toBeGreaterThanOrEqual(0.8);
      expect(firstAction.title.toLowerCase()).toContain('pilot batch protocol');
    });

    test('extracts decisions with impact and rationale as is_ai_suggested: true', async () => {
      const intel = await service.generateAIMeetingIntelligence(testMeeting.id);

      expect(intel.suggestedDecisions.length).toBeGreaterThan(0);
      const firstDec = intel.suggestedDecisions[0];
      expect(firstDec.is_ai_suggested).toBe(true);
      expect(firstDec.title.toLowerCase()).toContain('batch scaling');
      expect(firstDec.impact).toBeDefined();
    });

    test('extracts identified risks with severity', async () => {
      const intel = await service.generateAIMeetingIntelligence(testMeeting.id);

      expect(intel.identifiedRisks.length).toBeGreaterThan(0);
      const firstRisk = intel.identifiedRisks[0];
      expect(firstRisk.title.toLowerCase()).toContain('sterile glass vials');
      expect(['HIGH', 'CRITICAL', 'MEDIUM']).toContain(firstRisk.severity);
    });
  });

  describe('4. Suggestion Confirmation & Deduplicated Task Conversion', () => {
    test('applies confirmed action item suggestion and creates linked task without duplication', async () => {
      const intel = await service.generateAIMeetingIntelligence(testMeeting.id);
      const targetAction = intel.suggestedActionItems[0];

      // User confirms action item and requests task conversion
      const applied = await service.applyAISuggestions(testMeeting.id, {
        points: [
          {
            title: targetAction.title,
            category: 'ACTION',
            priority: targetAction.priority,
            due_date: targetAction.suggestedDueDate,
            create_task: true
          }
        ]
      });

      expect(applied.success).toBe(true);
      expect(applied.createdPoints.length).toBe(1);
      const createdPt = applied.createdPoints[0];
      expect(createdPt.is_ai_suggested).toBe(true);

      // Verify task was created
      expect(applied.createdTasks.length).toBe(1);
      const createdTask = applied.createdTasks[0];
      expect(createdTask).toBeDefined();

      // Deduplication test: re-calling convertPointToTask on same point returns existing task without duplicate
      const duplicateAttempt = await service.convertPointToTask(createdPt.id, {
        title: targetAction.title
      });
      expect(duplicateAttempt.id).toBe(createdTask.id);
    });

    test('applies confirmed decision and stores formal decision record', async () => {
      const intel = await service.generateAIMeetingIntelligence(testMeeting.id);
      const targetDec = intel.suggestedDecisions[0];

      const applied = await service.applyAISuggestions(testMeeting.id, {
        decisions: [
          {
            title: targetDec.title,
            rationale: targetDec.rationale,
            impact: targetDec.impact
          }
        ]
      });

      expect(applied.success).toBe(true);
      expect(applied.createdDecisions.length).toBe(1);
      const confirmedDec = applied.createdDecisions[0];
      expect(confirmedDec.is_confirmed).toBe(true);
      expect(confirmedDec.title).toBe(targetDec.title);
    });
  });

  describe('5. Live Copilot Query Assistant with Note Grounding', () => {
    test('answers user query grounded in session notes and cites matching lines', async () => {
      const queryResult = await service.queryCopilot(testMeeting.id, 'What is the pH stability for the API?');

      expect(queryResult).toBeDefined();
      expect(queryResult.answer).toBeDefined();
      expect(queryResult.citations.length).toBeGreaterThan(0);
      expect(queryResult.citations.some((c: string) => c.includes('pH 4.5'))).toBe(true);
    });

    test('honestly responds when query is not mentioned in notes instead of hallucinating', async () => {
      const queryResult = await service.queryCopilot(testMeeting.id, 'What were the clinical trial oncology phase 3 results?');

      expect(queryResult).toBeDefined();
      expect(queryResult.answer.toLowerCase()).toContain('no direct reference');
    });
  });
});
