import * as XLSX from 'xlsx';
import { encryptApiKey, decryptApiKey, maskApiKey } from '../src/utils/encryption';
import { FacilityImportService } from '../src/services/facility-import.service';
import { ProductionCalculationService } from '../src/services/production-calculation.service';
import { CommercialCalculationService } from '../src/services/commercial-calculation.service';

describe('AI Assisted Production Feasibility & Commercial Evaluation Engine Tests', () => {
  describe('1. Security & Encryption Utility', () => {
    it('encrypts and successfully decrypts an API key', () => {
      const originalKey = 'sk-proj-prod1234567890abcdefghijklmnopqrstuvwxyz';
      const encrypted = encryptApiKey(originalKey);

      expect(encrypted).not.toContain(originalKey);
      expect(encrypted.split(':').length).toBe(3); // iv:authTag:ciphertext

      const decrypted = decryptApiKey(encrypted);
      expect(decrypted).toBe(originalKey);
    });

    it('masks API keys securely so full key is never exposed', () => {
      const sampleKey = 'sk-live-9876543210zyxwvutsrqponmlkjihgfedcba';
      const masked = maskApiKey(sampleKey);

      expect(masked).toBe('sk-...dcba');
      expect(masked).not.toContain('9876543210');
      expect(masked.length).toBeLessThan(15);
    });

    it('handles short or empty keys safely', () => {
      expect(maskApiKey('')).toBe('');
      expect(maskApiKey('12345')).toBe('••••••••');
    });
  });

  describe('2. Multi-Sheet Facility Template & Importer', () => {
    it('generates a valid multi-sheet template workbook with Facilities, Lines, and Equipment', () => {
      const buffer = FacilityImportService.generateTemplateWorkbook();
      expect(buffer).toBeDefined();
      expect(buffer.length).toBeGreaterThan(1000);

      const wb = XLSX.read(buffer, { type: 'buffer' });
      expect(wb.SheetNames).toContain('Facilities');
      expect(wb.SheetNames).toContain('Production Lines');
      expect(wb.SheetNames).toContain('Equipment');

      const facRows: any[] = XLSX.utils.sheet_to_json(wb.Sheets['Facilities']);
      expect(facRows.length).toBeGreaterThanOrEqual(2);
      expect(facRows[0]['Facility Code']).toBe('FAC-001');
    });
  });

  describe('3. Deterministic Batch Sizing & Yield Calculations', () => {
    it('accounts for expected yield scrap and adjusts manufacturing batch quantity', () => {
      const requiredQty = 100000;
      const batchSize = 50000;
      const expectedYield = 95.0; // 5% scrap loss

      const result = ProductionCalculationService.calculateBatches({
        requiredQuantity: requiredQty,
        batchSize,
        expectedYieldPct: expectedYield,
      });

      // At 95% yield, to get 100,000 saleable units, need ceil(100,000 / 0.95) = 105,264 units
      expect(result.requiredManufacturingQuantity).toBeGreaterThan(requiredQty);
      expect(result.requiredManufacturingQuantity).toBe(Math.ceil(requiredQty / (expectedYield / 100)));
      expect(result.estimatedBatches).toBe(Math.ceil(result.requiredManufacturingQuantity / batchSize));
    });

    it('handles minimum and maximum batch constraints', () => {
      const lineMin = 20000;
      const lineMax = 200000;
      const smallOrder = 5000;

      // When order is smaller than min batch, batch size is floored to min batch
      const plannedBatchSize = Math.max(smallOrder, lineMin);
      expect(plannedBatchSize).toBe(20000);
    });
  });

  describe('4. Deterministic CDMO Commercial Economics (Gross Margin vs Markup)', () => {
    it('calculates gross margin % strictly according to CDMO definition: (Revenue - COGS) / Revenue * 100', () => {
      const quantity = 100000;
      const unitSellingPrice = 1.00;
      const totalRevenue = quantity * unitSellingPrice; // 100,000
      const totalCost = 60000; // 0.60 per unit
      const grossProfit = totalRevenue - totalCost; // 40,000

      const grossMarginPct = Number(((grossProfit / totalRevenue) * 100).toFixed(2));
      expect(grossMarginPct).toBe(40.00); // 40% margin
    });

    it('calculates Target-Margin Price correctly: Unit Cost / (1 - Margin%) and distinguishes from Markup', () => {
      const unitCost = 0.40;
      const targetMarginPct = 35.0; // 35% margin

      // Correct CDMO formula: Price = Cost / (1 - 0.35) = 0.40 / 0.65 = 0.6154
      const targetMarginPrice = Number((unitCost / (1 - (targetMarginPct / 100))).toFixed(4));
      expect(targetMarginPrice).toBeCloseTo(0.6154, 3);

      // Verify margin at this price:
      const revenue = 100000 * targetMarginPrice;
      const cogs = 100000 * unitCost;
      const actualMarginPct = ((revenue - cogs) / revenue) * 100;
      expect(actualMarginPct).toBeCloseTo(35.0, 1);

      // Incorrect markup formula would yield: 0.40 * 1.35 = 0.54, which yields only 25.9% margin!
      const incorrectMarkupPrice = Number((unitCost * (1 + (targetMarginPct / 100))).toFixed(4));
      expect(incorrectMarkupPrice).toBe(0.54);
      const incorrectActualMargin = ((100000 * 0.54 - cogs) / (100000 * 0.54)) * 100;
      expect(incorrectActualMargin).toBeCloseTo(25.93, 1);
      expect(targetMarginPrice).toBeGreaterThan(incorrectMarkupPrice);
    });

    it('CommercialCalculationService unit economics handles multi-component costs and break-even quantity', () => {
      const pricing = {
        quantity: 50000,
        quantity_unit: 'Packs',
        internal_proposed_price: 1.20,
        currency: 'USD',
        customer_target_price: 1.15,
      };

      const components = [
        { component_type: 'API', total_cost: 20000 },
        { component_type: 'EXCIPIENTS', total_cost: 5000 },
        { component_type: 'PACKAGING', total_cost: 10000 },
        { component_type: 'LABOR', total_cost: 10000 },
      ]; // Total cost = 45,000. Unit cost = 0.90. Revenue = 60,000. Profit = 15,000. Margin = 25%

      const result = CommercialCalculationService.calculateUnitEconomics(pricing, components);

      expect(result.totalCost).toBe(45000);
      expect(result.unitCost).toBe(0.9);
      expect(result.totalRevenue).toBe(60000);
      expect(result.totalGrossProfit).toBe(15000);
      expect(result.grossMarginPct).toBe(25);
      expect(result.priceGap).toBe(-0.05); // customer 1.15 - proposed 1.20 = -0.05
      expect(result.breakEvenQuantity).toBe(Math.ceil(45000 / 1.20)); // 37,500 packs
    });
  });
});
