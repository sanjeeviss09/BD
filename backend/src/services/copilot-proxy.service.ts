import { logger } from '../utils/logger';

export interface DiscoveredModel {
  id: string;
  created?: number;
  owned_by?: string;
}

export interface VerifiedCapabilities {
  chat: boolean;
  embeddings: boolean;
  structuredOutput: boolean;
  embeddingDimensions?: number;
  testedModel: string;
  testedAt: string;
}

export interface CopilotProxyConfig {
  baseUrl?: string;
  apiKey?: string;
  modelName?: string;
  timeoutMs?: number;
  maxTokens?: number;
  temperature?: number;
}

export class CopilotProxyService {
  private static readonly DEFAULT_BASE_URL = 'http://127.0.0.1:4141/v1';
  private static readonly DEFAULT_TIMEOUT_MS = 15000;
  private static readonly MAX_REQUEST_PAYLOAD_BYTES = 32768; // 32KB payload limit
  private static readonly MAX_CONCURRENT_REQUESTS = 2;

  private static activeInFlightRequests = 0;

  /**
   * Helper to redact sensitive tokens from logs, errors and messages
   */
  public static redactSecrets(message: string): string {
    if (!message || typeof message !== 'string') return '';
    return message
      .replace(/(ghu_[A-Za-z0-9_]{10,})/g, 'ghu_***[REDACTED]***')
      .replace(/(ghp_[A-Za-z0-9_]{10,})/g, 'ghp_***[REDACTED]***')
      .replace(/(github_pat_[A-Za-z0-9_]{10,})/g, 'github_pat_***[REDACTED]***')
      .replace(/(sk-[A-Za-z0-9_-]{10,})/g, 'sk-***[REDACTED]***')
      .replace(/(Bearer\s+)[A-Za-z0-9_.-]+/gi, '$1***[REDACTED]***');
  }

  /**
   * Resolves the effective base URL strictly server-side
   */
  public static resolveBaseUrl(customUrl?: string | null): string {
    let url = customUrl?.trim() || process.env.COPILOT_PROXY_URL || CopilotProxyService.DEFAULT_BASE_URL;
    // Strip trailing slashes
    url = url.replace(/\/+$/, '');
    // If not ending in /v1, ensure consistent pathing
    if (!url.endsWith('/v1')) {
      url = `${url}/v1`;
    }
    return url;
  }

  /**
   * Discovers available models from the proxy's /v1/models endpoint
   */
  async discoverModels(
    apiKey: string,
    customBaseUrl?: string
  ): Promise<{ success: boolean; models: string[]; rawModels?: DiscoveredModel[]; error?: string }> {
    if (!apiKey || apiKey.trim().length === 0) {
      return { success: false, models: [], error: 'GitHub / Copilot access token is required for model discovery.' };
    }

    const baseUrl = CopilotProxyService.resolveBaseUrl(customBaseUrl);
    const endpoint = `${baseUrl}/models`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(endpoint, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const statusText = res.statusText || 'Unknown Error';
        let detail = '';
        try {
          const body = await res.json();
          detail = body?.error?.message || body?.message || '';
        } catch {
          detail = await res.text().catch(() => '');
        }
        return {
          success: false,
          models: [],
          error: CopilotProxyService.redactSecrets(`Model discovery failed [HTTP ${res.status}]: ${detail || statusText}`),
        };
      }

      const json = await res.json();
      const data = json?.data || json?.models || (Array.isArray(json) ? json : []);
      
      const modelNames: string[] = [];
      const rawList: DiscoveredModel[] = [];

      if (Array.isArray(data)) {
        for (const item of data) {
          const id = typeof item === 'string' ? item : item?.id;
          if (id && typeof id === 'string') {
            modelNames.push(id);
            rawList.push(typeof item === 'object' ? item : { id });
          }
        }
      }

      // Sort models logically
      modelNames.sort();

      return {
        success: true,
        models: modelNames,
        rawModels: rawList,
      };
    } catch (err: any) {
      const isAbort = err?.name === 'AbortError';
      const isConnRefused = err?.code === 'ECONNREFUSED' || err?.message?.includes('fetch failed');
      
      let errMsg = err?.message || 'Connection to proxy failed';
      if (isAbort) errMsg = 'Model discovery timed out after 10s. Verify proxy responsiveness.';
      if (isConnRefused) {
        errMsg = `Copilot API proxy is unreachable at ${baseUrl}. Ensure the copilot-api proxy server is started (e.g. npx copilot-api start).`;
      }

      return {
        success: false,
        models: [],
        error: CopilotProxyService.redactSecrets(errMsg),
      };
    }
  }

  /**
   * Runtime probing of active capabilities for a specific model:
   * Probes Chat, Structured Output (JSON mode), and Embeddings
   */
  async verifyCapabilities(
    apiKey: string,
    modelName: string,
    customBaseUrl?: string
  ): Promise<{ success: boolean; capabilities: VerifiedCapabilities; message: string }> {
    const baseUrl = CopilotProxyService.resolveBaseUrl(customBaseUrl);
    
    const result: VerifiedCapabilities = {
      chat: false,
      embeddings: false,
      structuredOutput: false,
      testedModel: modelName,
      testedAt: new Date().toISOString(),
    };

    if (!apiKey || !modelName) {
      return {
        success: false,
        capabilities: result,
        message: 'API Key and Model Name are both required for capability probing.',
      };
    }

    // 1. Probe Chat & Structured Output
    try {
      const probeRes = await this.executeChatCompletionInternal(
        apiKey,
        modelName,
        [
          { role: 'system', content: 'Respond with valid JSON: {"ping": "pong", "verified": true}' },
          { role: 'user', content: 'Probe capability.' },
        ],
        {
          baseUrl,
          temperature: 0.1,
          maxTokens: 50,
          jsonMode: true,
          timeoutMs: 12000,
        }
      );

      if (probeRes?.content) {
        result.chat = true;
        try {
          const parsed = JSON.parse(probeRes.content);
          if (parsed && typeof parsed === 'object') {
            result.structuredOutput = true;
          }
        } catch {
          // Model returned text but not strict JSON
          result.structuredOutput = false;
        }
      }
    } catch (err: any) {
      logger.warn('Copilot Proxy chat probe error:', { message: CopilotProxyService.redactSecrets(err.message) });
      result.chat = false;
    }

    // 2. Probe Embeddings
    try {
      const embRes = await this.probeEmbeddingsEndpoint(apiKey, baseUrl, modelName);
      if (embRes && embRes.dimensions > 0) {
        result.embeddings = true;
        result.embeddingDimensions = embRes.dimensions;
      }
    } catch (err: any) {
      // Embeddings probe failed; strictly mark false without breaking chat
      result.embeddings = false;
    }

    const isHealthy = result.chat;
    let message = isHealthy
      ? `Successfully connected to ${modelName} via Copilot API Proxy. Chat: OK, Structured JSON: ${result.structuredOutput ? 'OK' : 'PARTIAL'}, Embeddings: ${result.embeddings ? `OK (${result.embeddingDimensions}d)` : 'NOT_SUPPORTED'}.`
      : `Failed to verify chat capability on model ${modelName}. Ensure the proxy is active and the model is accessible on your account.`;

    return {
      success: isHealthy,
      capabilities: result,
      message,
    };
  }

  /**
   * Executes a bounded, safe chat completion with rate-limit and transient failure management.
   * Supports both object payload and positional arguments.
   */
  async chatCompletion(
    paramsOrApiKey:
      | string
      | {
          apiKey?: string;
          model?: string;
          modelName?: string;
          messages: Array<{ role: string; content: string }>;
          temperature?: number;
          max_tokens?: number;
          maxTokens?: number;
          response_format?: { type: string };
          jsonMode?: boolean;
          apiEndpoint?: string;
          baseUrl?: string;
          timeoutMs?: number;
        },
    modelNameArg?: string,
    messagesArg?: Array<{ role: string; content: string }>,
    optionsArg: {
      temperature?: number;
      maxTokens?: number;
      jsonMode?: boolean;
      baseUrl?: string;
      timeoutMs?: number;
    } = {}
  ): Promise<any> {
    let apiKey: string;
    let modelName: string;
    let messages: Array<{ role: string; content: string }>;
    let options: {
      temperature?: number;
      maxTokens?: number;
      jsonMode?: boolean;
      baseUrl?: string;
      timeoutMs?: number;
    };
    let returnTextOnly = false;

    if (typeof paramsOrApiKey === 'object' && paramsOrApiKey !== null) {
      returnTextOnly = true;
      apiKey = paramsOrApiKey.apiKey || '';
      modelName = paramsOrApiKey.model || paramsOrApiKey.modelName || 'gpt-4o';
      messages = paramsOrApiKey.messages || [];
      options = {
        temperature: paramsOrApiKey.temperature,
        maxTokens: paramsOrApiKey.maxTokens ?? paramsOrApiKey.max_tokens,
        jsonMode: Boolean(paramsOrApiKey.jsonMode || paramsOrApiKey.response_format?.type === 'json_object'),
        baseUrl: paramsOrApiKey.baseUrl || paramsOrApiKey.apiEndpoint,
        timeoutMs: paramsOrApiKey.timeoutMs,
      };
    } else {
      apiKey = paramsOrApiKey;
      modelName = modelNameArg || 'gpt-4o';
      messages = messagesArg || [];
      options = optionsArg;
    }

    // Concurrency control: prevent overwhelming local proxy
    if (CopilotProxyService.activeInFlightRequests >= CopilotProxyService.MAX_CONCURRENT_REQUESTS) {
      // Brief wait before proceeding
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    CopilotProxyService.activeInFlightRequests++;
    try {
      const res = await this.executeChatCompletionInternal(apiKey, modelName, messages, options);
      return returnTextOnly ? res.content : res;
    } finally {
      CopilotProxyService.activeInFlightRequests = Math.max(0, CopilotProxyService.activeInFlightRequests - 1);
    }
  }

  /**
   * Internal implementation of chat completions with strict timeout and single transient retry
   */
  private async executeChatCompletionInternal(
    apiKey: string,
    modelName: string,
    messages: Array<{ role: string; content: string }>,
    options: {
      temperature?: number;
      maxTokens?: number;
      jsonMode?: boolean;
      baseUrl?: string;
      timeoutMs?: number;
      isRetry?: boolean;
    } = {}
  ): Promise<{ content: string; model: string; usage?: any }> {
    const baseUrl = CopilotProxyService.resolveBaseUrl(options.baseUrl);
    const endpoint = `${baseUrl}/chat/completions`;
    const timeoutMs = options.timeoutMs || CopilotProxyService.DEFAULT_TIMEOUT_MS;

    // Enforce request size bound
    const payloadBody = JSON.stringify({
      model: modelName,
      messages,
      temperature: options.temperature ?? 0.2,
      max_tokens: options.maxTokens ?? 3000,
      ...(options.jsonMode ? { response_format: { type: 'json_object' } } : {}),
    });

    if (Buffer.byteLength(payloadBody, 'utf8') > CopilotProxyService.MAX_REQUEST_PAYLOAD_BYTES) {
      throw new Error(`Request payload exceeds maximum allowed size of ${CopilotProxyService.MAX_REQUEST_PAYLOAD_BYTES} bytes.`);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey.trim()}`,
        },
        body: payloadBody,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle transient errors (429 Rate Limit or 503 Unavailable) with max 1 safe retry
      if ((response.status === 429 || response.status === 503) && !options.isRetry) {
        logger.warn(`Copilot Proxy transient ${response.status} status, applying single 1000ms backoff retry...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return this.executeChatCompletionInternal(apiKey, modelName, messages, {
          ...options,
          isRetry: true,
        });
      }

      if (!response.ok) {
        let errMessage = `HTTP error ${response.status}: ${response.statusText}`;
        try {
          const errBody = await response.json();
          errMessage = errBody?.error?.message || errBody?.message || errMessage;
        } catch {
          const raw = await response.text().catch(() => '');
          if (raw) errMessage = raw;
        }
        throw new Error(CopilotProxyService.redactSecrets(errMessage));
      }

      const json = await response.json();
      const content = json?.choices?.[0]?.message?.content;

      if (typeof content !== 'string') {
        throw new Error('Copilot Proxy returned an unexpected response structure without choices[0].message.content');
      }

      return {
        content,
        model: json?.model || modelName,
        usage: json?.usage,
      };
    } catch (err: any) {
      clearTimeout(timeoutId);

      const isAbort = err?.name === 'AbortError';
      const isConnRefused = err?.code === 'ECONNREFUSED' || err?.message?.includes('fetch failed');

      let msg = err?.message || 'Chat request failed';
      if (isAbort) msg = `Copilot Proxy request timed out after ${timeoutMs}ms.`;
      if (isConnRefused) {
        msg = `Copilot Proxy service unavailable at ${baseUrl}. Ensure the proxy is running.`;
      }

      throw new Error(CopilotProxyService.redactSecrets(msg));
    }
  }

  /**
   * Generates a vector embedding using the proxy's /v1/embeddings endpoint if supported
   */
  async generateEmbedding(
    apiKey: string,
    text: string,
    options: {
      modelName?: string;
      baseUrl?: string;
      expectedDimensions?: number;
    } = {}
  ): Promise<{ embedding: number[]; dimensions: number } | null> {
    if (!apiKey || !text || text.trim().length === 0) return null;

    const baseUrl = CopilotProxyService.resolveBaseUrl(options.baseUrl);
    const endpoint = `${baseUrl}/embeddings`;
    const model = options.modelName || 'text-embedding-3-small';

    // Bound input text to safe size (8000 chars)
    const sanitizedText = text.slice(0, 8000);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey.trim()}`,
        },
        body: JSON.stringify({
          model,
          input: sanitizedText,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return null; // Gracefully signal unverified embeddings
      }

      const json = await response.json();
      const emb = json?.data?.[0]?.embedding;

      if (!Array.isArray(emb) || emb.length === 0) {
        return null;
      }

      // Check dimensions consistency if expected dimension was verified
      if (options.expectedDimensions && emb.length !== options.expectedDimensions) {
        logger.warn('Embedding dimension mismatch from proxy', {
          expected: options.expectedDimensions,
          received: emb.length,
        });
        return null;
      }

      return {
        embedding: emb,
        dimensions: emb.length,
      };
    } catch {
      clearTimeout(timeoutId);
      return null;
    }
  }

  /**
   * Internal probe for embeddings endpoint
   */
  private async probeEmbeddingsEndpoint(
    apiKey: string,
    baseUrl: string,
    modelName: string
  ): Promise<{ dimensions: number } | null> {
    const endpoint = `${baseUrl}/embeddings`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey.trim()}`,
        },
        body: JSON.stringify({
          model: modelName.includes('embed') ? modelName : 'text-embedding-3-small',
          input: 'BDIQ capability probe',
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) return null;

      const json = await response.json();
      const emb = json?.data?.[0]?.embedding;

      if (Array.isArray(emb) && emb.length > 0) {
        return { dimensions: emb.length };
      }
      return null;
    } catch {
      clearTimeout(timeoutId);
      return null;
    }
  }
}
