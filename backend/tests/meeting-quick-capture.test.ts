import { MeetingQuickCaptureService } from '../src/services/meeting-quick-capture.service';

describe('Meeting Quick Capture Extraction Service', () => {
  const mockRefDate = new Date(2026, 9, 1); // 1 October 2026

  it('correctly parses prompt scenario: "R&D will confirm formulation feasibility by 15 October."', () => {
    const text = 'R&D will confirm formulation feasibility by 15 October.';
    const result = MeetingQuickCaptureService.parseNote(text, mockRefDate);

    expect(result.suggestedDepartment).toBe('R&D');
    expect(result.suggestedDueDate).toBe('2026-10-15');
    expect(result.suggestedAction.toLowerCase()).toContain('confirm formulation feasibility');
    expect(result.confidenceScore).toBeGreaterThanOrEqual(80);
    expect(result.requiresConfirmation).toBe(true);
  });

  it('detects Regulatory Affairs and relative date "tomorrow"', () => {
    const text = 'Regulatory must review dossier variations tomorrow.';
    const result = MeetingQuickCaptureService.parseNote(text, mockRefDate);

    expect(result.suggestedDepartment).toBe('Regulatory Affairs');
    expect(result.suggestedDueDate).toBe('2026-10-02');
    expect(result.suggestedAction.toLowerCase()).toContain('review dossier variations');
    expect(result.requiresConfirmation).toBe(true);
  });

  it('handles notes without explicit dates or departments safely', () => {
    const text = 'Discussed general customer impressions regarding packaging color.';
    const result = MeetingQuickCaptureService.parseNote(text, mockRefDate);

    expect(result.suggestedDepartment).toBeNull();
    expect(result.suggestedDueDate).toBeNull();
    expect(result.datePrecision).toBe('NONE');
    expect(result.requiresConfirmation).toBe(true);
  });
});
