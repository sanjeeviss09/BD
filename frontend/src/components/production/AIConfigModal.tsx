import { useState, useEffect } from 'react';
import {
  Sparkles,
  Key,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  X,
  Lock,
  Save,
  Globe
} from 'lucide-react';
import type { AIProviderConfig } from '@/types/production-feasibility';

interface AIConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  getHeaders: () => Record<string, string>;
  onConfigSaved?: () => void;
}

export default function AIConfigModal({ isOpen, onClose, getHeaders, onConfigSaved }: AIConfigModalProps) {
  const [config, setConfig] = useState<AIProviderConfig>({
    provider_name: 'OPENAI',
    provider_display_name: 'OpenAI GPT-4o Engine',
    model_name: 'gpt-4o',
    is_default: true,
    is_enabled: true,
    max_output_tokens: 4000,
    temperature: 0.2,
    last_test_status: 'NOT_TESTED',
    usage_count: 0
  });

  const [apiKeyInput, setApiKeyInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [discoveringModels, setDiscoveringModels] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; details?: any } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    fetchConfig();
  }, [isOpen]);

  const fetchConfig = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('http://localhost:4000/api/production-feasibility/ai-config', {
        headers: getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
      }
    } catch (err: any) {
      setErrorMsg('Failed to load AI configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleDiscoverModels = async () => {
    setDiscoveringModels(true);
    setErrorMsg('');
    try {
      const endpoint = config.api_endpoint ? `&api_endpoint=${encodeURIComponent(config.api_endpoint)}` : '';
      const res = await fetch(
        `http://localhost:4000/api/production-feasibility/ai-config/models?provider_name=${config.provider_name}${endpoint}`,
        {
          headers: getHeaders(),
        }
      );
      const data = await res.json();
      if (data.success && data.models) {
        setConfig(prev => ({ ...prev, discovered_models: data.models }));
        setSuccessMsg(`Discovered ${data.models.length} model(s) from ${config.provider_name}`);
        if (data.models.length > 0 && !config.model_name) {
          setConfig(prev => ({ ...prev, model_name: data.models[0] }));
        }
      } else {
        setErrorMsg(data.error || 'Failed to discover models from provider');
      }
    } catch (err: any) {
      setErrorMsg('Model discovery request failed');
    } finally {
      setDiscoveringModels(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(false);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      setSaving(true);
      const payload: any = {
        ...config,
      };
      if (apiKeyInput.trim()) {
        payload.api_key = apiKeyInput.trim();
      }

      const res = await fetch('http://localhost:4000/api/production-feasibility/ai-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getHeaders(),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to save configuration');
      }

      const updated = await res.json();
      setConfig(updated);
      setApiKeyInput('');
      setSuccessMsg('AI Provider configuration saved securely on server.');
      if (onConfigSaved) onConfigSaved();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    setErrorMsg('');
    try {
      const res = await fetch('http://localhost:4000/api/production-feasibility/ai-config/test', {
        method: 'POST',
        headers: getHeaders(),
      });
      const data = await res.json();
      setTestResult(data);
      if (data.success) {
        setConfig(prev => ({
          ...prev,
          last_test_status: 'SUCCESS',
          discovered_models: data.details?.models || prev.discovered_models,
          verified_capabilities: data.details?.verifiedCapabilities || prev.verified_capabilities,
          embedding_dimensions: data.details?.verifiedCapabilities?.embeddingDimensions || prev.embedding_dimensions,
        }));
      } else {
        setConfig(prev => ({ ...prev, last_test_status: 'FAILED' }));
      }
    } catch (err: any) {
      setTestResult({ success: false, message: 'Connection test request failed' });
    } finally {
      setTesting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-foreground text-background flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-sm">Enterprise AI Provider Configuration</h3>
              <p className="text-[11px] text-muted-foreground">
                Grounded CDMO intelligence, meeting automation, and proxy orchestration
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="p-12 text-center text-muted-foreground text-xs flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Loading AI Provider settings...
          </div>
        ) : (
          <form onSubmit={handleSave} className="p-6 space-y-5">
            {errorMsg && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-600 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {errorMsg}
              </div>
            )}
            {successMsg && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-600 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                {successMsg}
              </div>
            )}

            {/* Provider Enable / Disable Toggle */}
            <div className="flex items-center justify-between p-3.5 bg-muted/40 border border-border rounded-lg">
              <div>
                <span className="text-xs font-semibold text-foreground">Enable AI Capabilities</span>
                <p className="text-[11px] text-muted-foreground">
                  When disabled, BDIQ operates in deterministic, verified calculation mode.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.is_enabled}
                  onChange={e => setConfig(prev => ({ ...prev, is_enabled: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-foreground"></div>
              </label>
            </div>

            {/* Provider Selection */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  AI Provider Architecture
                </label>
                <select
                  value={config.provider_name}
                  onChange={e => {
                    const p = e.target.value as any;
                    let defaultModel = 'gpt-4o';
                    let defaultEndpoint = '';
                    if (p === 'COPILOT_PROXY') {
                      defaultModel = 'gpt-4o';
                      defaultEndpoint = 'http://127.0.0.1:4141/v1';
                    } else if (p === 'NVIDIA') {
                      defaultModel = 'nvidia/nemotron-3-ultra-550b-a55b';
                      defaultEndpoint = 'https://integrate.api.nvidia.com/v1/chat/completions';
                    } else if (p === 'ANTHROPIC') {
                      defaultModel = 'claude-3-5-sonnet-20241022';
                    } else if (p === 'GEMINI') {
                      defaultModel = 'gemini-1.5-pro';
                    }
                    setConfig(prev => ({
                      ...prev,
                      provider_name: p,
                      provider_display_name:
                        p === 'COPILOT_PROXY'
                          ? 'GitHub Copilot API Proxy (Local Gateway)'
                          : p === 'NVIDIA'
                          ? 'NVIDIA Enterprise AI (Nemotron 3 Ultra + Parse + Retriever)'
                          : `${p} Cognitive Engine`,
                      model_name: defaultModel,
                      api_endpoint: defaultEndpoint || prev.api_endpoint,
                      // Disable by default if switching to Copilot Proxy until tested
                      is_enabled: p === 'COPILOT_PROXY' ? false : prev.is_enabled,
                    }));
                  }}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
                >
                  <option value="COPILOT_PROXY">GitHub Copilot API Proxy (ericc-ch/copilot-api)</option>
                  <option value="NVIDIA">NVIDIA Enterprise AI (Nemotron 3 Ultra + Parse + Retriever)</option>
                  <option value="OPENAI">OpenAI (GPT-4o / O3)</option>
                  <option value="ANTHROPIC">Anthropic (Claude 3.5 Sonnet)</option>
                  <option value="GEMINI">Google DeepMind (Gemini 1.5 Pro)</option>
                  <option value="AZURE_OPENAI">Azure OpenAI Service</option>
                  <option value="CUSTOM_LLM">Private / On-Premise Enterprise LLM</option>
                  <option value="LOCAL">Local / Deterministic Mode</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-foreground">
                    Model Identifier
                  </label>
                  {config.provider_name === 'COPILOT_PROXY' && (
                    <button
                      type="button"
                      onClick={handleDiscoverModels}
                      disabled={discoveringModels}
                      className="text-[10px] text-foreground hover:underline inline-flex items-center gap-1 disabled:opacity-50"
                    >
                      <RefreshCw className={`w-2.5 h-2.5 ${discoveringModels ? 'animate-spin' : ''}`} />
                      Discover Models
                    </button>
                  )}
                </div>

                {config.discovered_models && config.discovered_models.length > 0 ? (
                  <select
                    value={config.model_name}
                    onChange={e => setConfig(prev => ({ ...prev, model_name: e.target.value }))}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-foreground font-mono"
                  >
                    {config.discovered_models.map(m => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={config.model_name}
                    onChange={e => setConfig(prev => ({ ...prev, model_name: e.target.value }))}
                    placeholder="e.g. gpt-4o"
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-foreground font-mono"
                    required
                  />
                )}
              </div>
            </div>

            {config.provider_name === 'COPILOT_PROXY' && (
              <div className="p-3.5 bg-blue-500/5 border border-blue-500/20 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-blue-800 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> Copilot API Proxy Architecture
                  </span>
                  <span className="text-[10px] bg-blue-500/20 text-blue-800 dark:text-blue-300 font-medium px-2 py-0.5 rounded-full">
                    Self-Hosted / Gateway Mode
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[11px]">
                  <div className="bg-background/80 p-2 rounded border border-border">
                    <p className="font-semibold text-foreground">Chat & Reasoning</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {config.verified_capabilities?.chat ? '✓ Verified Compatible' : 'Probed on test'}
                    </p>
                  </div>
                  <div className="bg-background/80 p-2 rounded border border-border">
                    <p className="font-semibold text-foreground">Structured JSON</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {config.verified_capabilities?.structuredOutput ? '✓ Verified Schema' : 'Probed on test'}
                    </p>
                  </div>
                  <div className="bg-background/80 p-2 rounded border border-border">
                    <p className="font-semibold text-foreground">Vector Embeddings</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {config.verified_capabilities?.embeddings
                        ? `✓ ${config.verified_capabilities.embeddingDimensions || 1536} dims`
                        : 'Keyword Fallback Active'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {config.provider_name === 'NVIDIA' && (
              <div className="p-3.5 bg-emerald-500/5 border border-emerald-500/20 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> NVIDIA Enterprise Tri-Engine Active
                  </span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-medium px-2 py-0.5 rounded-full">
                    Production Integrated
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[11px]">
                  <div className="bg-background/80 p-2 rounded border border-border">
                    <p className="font-semibold text-foreground">Nemotron 3 Ultra 550B</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">A55B Reasoning & CDMO Synthesis</p>
                  </div>
                  <div className="bg-background/80 p-2 rounded border border-border">
                    <p className="font-semibold text-foreground">Nemotron Parse</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Visual Layout & Table Parser</p>
                  </div>
                  <div className="bg-background/80 p-2 rounded border border-border">
                    <p className="font-semibold text-foreground">NeMo Retriever</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Semantic Knowledge & Evidence</p>
                  </div>
                </div>
              </div>
            )}

            {/* Custom Endpoint (Optional) */}
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">
                API Endpoint URL (Optional Override)
              </label>
              <div className="relative">
                <Globe className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={config.api_endpoint || ''}
                  onChange={e => setConfig(prev => ({ ...prev, api_endpoint: e.target.value }))}
                  placeholder="Leave empty for official cloud default"
                  className="w-full pl-8 pr-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-foreground font-mono"
                />
              </div>
            </div>

            {/* Secure API Key Management */}
            <div className="p-4 bg-muted/30 border border-border rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                  <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                  Server-Side Encrypted API Key
                </div>
                {config.api_key_masked && (
                  <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-muted border border-border text-foreground">
                    Current: {config.api_key_masked}
                  </span>
                )}
              </div>

              <div className="relative">
                <Key className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-2.5" />
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={e => setApiKeyInput(e.target.value)}
                  placeholder={config.api_key_masked ? 'Enter new key to replace existing secret...' : 'Enter your provider secret key (sk-...)'}
                  className="w-full pl-8 pr-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-foreground font-mono"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                Keys are encrypted with AES-256-GCM before storage. They are never sent to browser clients or recorded in audit logs.
              </p>
            </div>

            {/* Hyperparameters */}
            <div className="grid grid-cols-2 gap-4 pt-1">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Max Output Tokens: {config.max_output_tokens}
                </label>
                <input
                  type="number"
                  min={500}
                  max={16000}
                  step={500}
                  value={config.max_output_tokens}
                  onChange={e => setConfig(prev => ({ ...prev, max_output_tokens: parseInt(e.target.value, 10) || 4000 }))}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Temperature: {config.temperature} (Low for Factual Determinism)
                </label>
                <input
                  type="range"
                  min={0.0}
                  max={1.0}
                  step={0.05}
                  value={config.temperature}
                  onChange={e => setConfig(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                  className="w-full mt-2 accent-foreground"
                />
              </div>
            </div>

            {/* Test Connection Banner */}
            <div className="pt-2 flex items-center justify-between border-t border-border">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testing}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-lg bg-card text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
                  Test Connection
                </button>

                {config.last_test_status === 'SUCCESS' && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    <CheckCircle2 className="w-3 h-3" /> Connection Verified
                  </span>
                )}
                {config.last_test_status === 'FAILED' && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-red-600 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
                    <XCircle className="w-3 h-3" /> Connection Failed
                  </span>
                )}
                {config.last_test_status === 'NOT_TESTED' && (
                  <span className="text-[11px] text-muted-foreground">Not tested recently</span>
                )}
              </div>

              <div className="text-[11px] text-muted-foreground">
                Usage: <span className="font-mono font-medium text-foreground">{config.usage_count}</span> queries
              </div>
            </div>

            {testResult && (
              <div className={`p-3 rounded-lg text-xs border ${testResult.success ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700' : 'bg-red-500/10 border-red-500/20 text-red-700'}`}>
                {testResult.message}
              </div>
            )}

            {/* Footer Actions */}
            <div className="pt-3 border-t border-border flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium border border-border rounded-lg bg-card text-foreground hover:bg-muted transition-colors"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-foreground text-background hover:bg-foreground/90 transition-colors disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
