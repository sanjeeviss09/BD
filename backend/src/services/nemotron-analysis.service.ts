import { logger } from '../utils/logger';

export interface NemotronChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface NemotronInferenceOptions {
  temperature?: number;
  max_tokens?: number;
  timeout_ms?: number;
  response_format?: { type: 'json_object' };
}

export class NemotronAnalysisService {
  private apiKey: string;
  private endpoint: string;
  private modelName: string;

  constructor(
    apiKey?: string,
    endpoint?: string,
    modelName = 'nvidia/nemotron-3-ultra-550b-a55b'
  ) {
    this.apiKey = apiKey || process.env.NVIDIA_API_KEY || '';
    this.endpoint = endpoint || `${process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1'}/chat/completions`;
    this.modelName = modelName;
  }

  /**
   * Health check / ping test for Nemotron 3 Ultra 550B
   */
  async testConnection(): Promise<{ success: boolean; message: string; latencyMs: number }> {
    const startTime = Date.now();
    try {
      if (!this.apiKey) {
        return { success: false, message: 'NVIDIA API key is not configured.', latencyMs: 0 };
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.modelName,
          messages: [{ role: 'user', content: 'Connection test. Reply with OK.' }],
          max_tokens: 16,
          temperature: 0.1,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          message: `NVIDIA API error (${response.status}): ${errorText.slice(0, 150)}`,
          latencyMs,
        };
      }

      return {
        success: true,
        message: `Connected successfully to Nemotron 3 Ultra 550B (${this.modelName}) in ${latencyMs}ms.`,
        latencyMs,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Network or timeout error contacting Nemotron 3 Ultra: ${err.message}`,
        latencyMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Complex reasoning & synthesis request with structured schema enforcement
   */
  async chatCompletion(
    messages: NemotronChatMessage[],
    options: NemotronInferenceOptions = {}
  ): Promise<{ content: string; latencyMs: number; usage?: any }> {
    const startTime = Date.now();
    const timeoutMs = options.timeout_ms || 30000;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.modelName,
          messages,
          temperature: options.temperature ?? 0.2,
          max_tokens: options.max_tokens ?? 2500,
          ...(options.response_format ? { response_format: options.response_format } : {}),
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Nemotron 3 Ultra call failed [${response.status}]: ${errText}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';

      return {
        content,
        latencyMs,
        usage: data.usage,
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      logger.error('NemotronAnalysisService chatCompletion error', { error: err.message });
      throw err;
    }
  }

  /**
   * CDMO Production Feasibility Reasoning
   */
  async generateFeasibilityAnalysis(groundedFacts: string): Promise<any> {
    const systemPrompt = `You are NVIDIA Nemotron 3 Ultra 550B acting as an expert pharmaceutical CDMO Principal Process Architect.
You must analyze the deterministic manufacturing facts and evidence provided below.
Rules:
1. NEVER alter, hallucinate, or recalculate the deterministic numbers.
2. Formulate strategic explanations of equipment capability, cycle constraints, cleanroom utilization, and regulatory compliance.
3. Distinguish VERIFIED FACTS, RETRIEVED EVIDENCE, and FLAGGED UNRESOLVED GAPS.
4. Return ONLY a valid JSON object matching the requested schema.

Output Schema:
{
  "executiveSummary": "string",
  "feasibilityConclusion": "FEASIBLE" | "CONDITIONALLY_FEASIBLE" | "CAPACITY_CONSTRAINED" | "NOT_FEASIBLE" | "DATA_INSUFFICIENT",
  "keySupportingEvidence": ["string"],
  "criticalConstraints": ["string"],
  "capacityBottlenecks": ["string"],
  "missingInformation": ["string"],
  "qualityAndRegulatoryConcerns": ["string"],
  "recommendedNextActions": [
    { "action": "string", "responsibleDepartment": "string", "priority": "HIGH" | "MEDIUM" | "LOW" }
  ],
  "confidenceExplanation": "string"
}`;

    const userPrompt = `Evaluate the following deterministic CDMO evaluation facts:\n${groundedFacts}`;

    const { content } = await this.chatCompletion([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ], { temperature: 0.15, max_tokens: 3000, response_format: { type: 'json_object' } });

    return NemotronAnalysisService.parseStructuredResponse(content);
  }

  /**
   * Safe parser for structured model responses with fallback guardrails
   */
  static parseStructuredResponse(content: string): any {
    try {
      return JSON.parse(content);
    } catch {
      try {
        const firstBrace = content.indexOf('{');
        const lastBrace = content.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          const jsonSubstring = content.substring(firstBrace, lastBrace + 1);
          return JSON.parse(jsonSubstring);
        }
      } catch {
        // Fallback
      }
      return {
        executiveSummary: content.slice(0, 500),
        feasibilityConclusion: 'DATA_INSUFFICIENT',
        keySupportingEvidence: [],
        criticalConstraints: [],
        capacityBottlenecks: [],
        missingInformation: ['Response was not formatted as strict JSON'],
        qualityAndRegulatoryConcerns: [],
        recommendedNextActions: [],
        confidenceExplanation: 'Fallback parsed from model raw text response.',
      };
    }
  }
}
