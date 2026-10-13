/**
 * Deterministic, rule-based Meeting Quick Note Capture Service.
 * Extracts potential action items, departments, and due dates from live notes.
 * No AI/LLM - purely deterministic and fast for enterprise resilience.
 */

export interface QuickCaptureSuggestion {
  originalText: string;
  suggestedAction: string;
  suggestedDepartment: string | null;
  suggestedDueDate: string | null; // ISO YYYY-MM-DD
  datePrecision: 'EXACT' | 'RELATIVE' | 'APPROXIMATE' | 'AMBIGUOUS' | 'NONE';
  confidenceScore: number; // 0 to 100
  requiresConfirmation: boolean;
}

export class MeetingQuickCaptureService {
  private static DEPARTMENT_PATTERNS: Array<{ name: string; aliases: RegExp }> = [
    { name: 'R&D', aliases: /\b(r&d|research\s+and\s+development|formulation|analytical\s+dev)\b/i },
    { name: 'Regulatory Affairs', aliases: /\b(ra|regulatory|dossier|compliance|filing)\b/i },
    { name: 'Production & Manufacturing', aliases: /\b(production|manufacturing|plant|facility|scale-up|batch)\b/i },
    { name: 'Quality Assurance', aliases: /\b(qa|qc|quality|audit|validation)\b/i },
    { name: 'Commercial & BD', aliases: /\b(bd|business\s+dev|commercial|sales|pricing|quotation)\b/i },
    { name: 'Supply Chain', aliases: /\b(supply\s+chain|scm|procurement|logistics|materials|vendor)\b/i },
    { name: 'Clinical', aliases: /\b(clinical|trials|pk\/pd|bioequivalence)\b/i },
    { name: 'Legal', aliases: /\b(legal|counsel|contract|ip|patent)\b/i }
  ];

  private static MONTHS: { [key: string]: number } = {
    january: 0, jan: 0,
    february: 1, feb: 1,
    march: 2, mar: 2,
    april: 3, apr: 3,
    may: 4,
    june: 5, jun: 5,
    july: 6, jul: 6,
    august: 7, aug: 7,
    september: 8, sep: 8, sept: 8,
    october: 9, oct: 9,
    november: 10, nov: 10,
    december: 11, dec: 11
  };

  /**
   * Parses live note text into structured suggestions.
   */
  public static parseNote(text: string, referenceDate: Date = new Date()): QuickCaptureSuggestion {
    const trimmed = (text || '').trim();
    if (!trimmed) {
      return {
        originalText: '',
        suggestedAction: '',
        suggestedDepartment: null,
        suggestedDueDate: null,
        datePrecision: 'NONE',
        confidenceScore: 0,
        requiresConfirmation: true
      };
    }

    let detectedDepartment: string | null = null;
    let confidence = 40;

    // 1. Detect Department
    for (const dept of this.DEPARTMENT_PATTERNS) {
      if (dept.aliases.test(trimmed)) {
        detectedDepartment = dept.name;
        confidence += 25;
        break;
      }
    }

    // 2. Detect Due Date
    const { detectedDate, precision } = this.extractDueDate(trimmed, referenceDate);
    if (detectedDate) {
      confidence += 25;
    }

    // 3. Detect Action Phrase
    const suggestedAction = this.extractActionPhrase(trimmed);
    if (suggestedAction && suggestedAction !== trimmed) {
      confidence += 10;
    }

    return {
      originalText: trimmed,
      suggestedAction: suggestedAction || trimmed,
      suggestedDepartment: detectedDepartment,
      suggestedDueDate: detectedDate,
      datePrecision: precision,
      confidenceScore: Math.min(confidence, 95),
      requiresConfirmation: true // User must always confirm before committing
    };
  }

  /**
   * Extracts due date from phrases like "by 15 October", "by 2026-10-20", "by next Friday", etc.
   */
  private static extractDueDate(
    text: string,
    ref: Date
  ): { detectedDate: string | null; precision: 'EXACT' | 'RELATIVE' | 'APPROXIMATE' | 'AMBIGUOUS' | 'NONE' } {
    // 1. ISO format: 2026-10-15 or 2026/10/15
    const isoMatch = text.match(/\b(20\d\d)[-/](0[1-9]|1[0-2])[-/](0[1-9]|[12]\d|3[01])\b/);
    if (isoMatch) {
      return {
        detectedDate: `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`,
        precision: 'EXACT'
      };
    }

    // 2. Month name + day: e.g. "by 15 October" or "by 15th Oct" or "October 15, 2026"
    const monthDayMatch = text.match(
      /(?:by|due|before|on)?\s*(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)(?:\s+(\d{4}))?/i
    );

    if (monthDayMatch) {
      const day = parseInt(monthDayMatch[1], 10);
      const monthStr = monthDayMatch[2].toLowerCase();
      const month = this.MONTHS[monthStr];
      const year = monthDayMatch[3] ? parseInt(monthDayMatch[3], 10) : ref.getFullYear();

      if (month !== undefined && day >= 1 && day <= 31) {
        const d = new Date(year, month, day);
        // If year was not specified and date has passed this year, take current or next year
        const yyyy = d.getFullYear().toString();
        const mm = (d.getMonth() + 1).toString().padStart(2, '0');
        const dd = d.getDate().toString().padStart(2, '0');
        return {
          detectedDate: `${yyyy}-${mm}-${dd}`,
          precision: monthDayMatch[3] ? 'EXACT' : 'APPROXIMATE'
        };
      }
    }

    // 3. Day + Month: e.g. "October 15"
    const dayMonthMatch = text.match(
      /(?:by|due|before|on)?\s*(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s*,?\s*(\d{4}))?/i
    );

    if (dayMonthMatch) {
      const monthStr = dayMonthMatch[1].toLowerCase();
      const day = parseInt(dayMonthMatch[2], 10);
      const month = this.MONTHS[monthStr];
      const year = dayMonthMatch[3] ? parseInt(dayMonthMatch[3], 10) : ref.getFullYear();

      if (month !== undefined && day >= 1 && day <= 31) {
        const d = new Date(year, month, day);
        const yyyy = d.getFullYear().toString();
        const mm = (d.getMonth() + 1).toString().padStart(2, '0');
        const dd = d.getDate().toString().padStart(2, '0');
        return {
          detectedDate: `${yyyy}-${mm}-${dd}`,
          precision: dayMonthMatch[3] ? 'EXACT' : 'APPROXIMATE'
        };
      }
    }

    // Helper to format local date
    const formatDate = (date: Date) => {
      const y = date.getFullYear();
      const m = (date.getMonth() + 1).toString().padStart(2, '0');
      const d = date.getDate().toString().padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

    // 4. Relative keywords: "tomorrow", "in 2 days", "next week", "end of week"
    if (/\btomorrow\b/i.test(text)) {
      const d = new Date(ref);
      d.setDate(d.getDate() + 1);
      return {
        detectedDate: formatDate(d),
        precision: 'RELATIVE'
      };
    }

    if (/\bnext\s+week\b/i.test(text)) {
      const d = new Date(ref);
      d.setDate(d.getDate() + 7);
      return {
        detectedDate: formatDate(d),
        precision: 'RELATIVE'
      };
    }

    if (/\bend\s+of\s+week\b/i.test(text)) {
      const d = new Date(ref);
      const day = d.getDay();
      const diff = (5 - day + 7) % 7 || 7; // Friday
      d.setDate(d.getDate() + diff);
      return {
        detectedDate: formatDate(d),
        precision: 'RELATIVE'
      };
    }

    const inDaysMatch = text.match(/\bin\s+(\d+)\s+days?\b/i);
    if (inDaysMatch) {
      const addDays = parseInt(inDaysMatch[1], 10);
      const d = new Date(ref);
      d.setDate(d.getDate() + addDays);
      return {
        detectedDate: formatDate(d),
        precision: 'RELATIVE'
      };
    }

    return { detectedDate: null, precision: 'NONE' };
  }

  /**
   * Cleans text to extract the central action directive.
   */
  private static extractActionPhrase(text: string): string {
    // Look for phrases after modal verbs: "will confirm...", "must deliver...", "to complete..."
    const actionMatch = text.match(
      /(?:will|must|should|to|agreed\s+to|assigned\s+to|needs?\s+to)\s+([a-zA-Z0-9\s,._-]{5,100}?)(?:\s+(?:by|before|on|due|until|prior\s+to)\s+|$|\.)/i
    );

    if (actionMatch && actionMatch[1]) {
      const cleaned = actionMatch[1].trim();
      return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }

    // If text starts with an action verb (e.g. "Confirm formulation feasibility")
    const words = text.split(/\s+/);
    if (words.length > 2) {
      return text.replace(/^(?:action:?|todo:?|task:?)\s*/i, '').trim();
    }

    return text;
  }
}
