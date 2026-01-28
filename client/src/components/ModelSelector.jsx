import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Bot, ChevronDown, Check, Search, Clock, Loader2, X, Brain, Wrench, Eye } from 'lucide-react';

const DEFAULT_MODEL = 'moonshotai/kimi-k2-thinking';
const RECENT_MODELS_KEY = 'budi_chat_recent_models';
const MODELS_CACHE_KEY = 'budi_chat_models_cache_v2';
const MODELS_CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours
const MAX_RECENT_MODELS = 5;

// Fallback models in case API fails
const FALLBACK_MODELS = [
  { id: 'moonshotai/kimi-k2-thinking', name: 'Kimi K2 Thinking', description: 'Moonshot AI reasoning model' },
  { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4', description: 'Anthropic Claude Sonnet 4' },
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', description: 'Anthropic Claude 3.5 Sonnet' },
  { id: 'openai/gpt-4o', name: 'GPT-4o', description: 'OpenAI GPT-4o' },
  { id: 'openai/gpt-4-turbo', name: 'GPT-4 Turbo', description: 'OpenAI GPT-4 Turbo' },
  { id: 'google/gemini-2.5-pro-preview', name: 'Gemini 2.5 Pro', description: 'Google Gemini 2.5 Pro' },
  { id: 'google/gemini-2.5-flash-preview', name: 'Gemini 2.5 Flash', description: 'Google Gemini 2.5 Flash' },
  { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', description: 'DeepSeek R1 reasoning model' },
  { id: 'deepseek/deepseek-chat', name: 'DeepSeek Chat', description: 'DeepSeek Chat model' },
  { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B', description: 'Meta Llama 3.3 70B' },
  { id: 'qwen/qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B', description: 'Alibaba Qwen 2.5 72B' },
  { id: 'mistralai/mistral-large-2411', name: 'Mistral Large', description: 'Mistral Large 2411' },
];

// Helper to compute capabilities directly from model data (fast, no lookups)
const getModelCapabilitiesFromData = (model) => {
  if (!model) return { reasoning: false, tools: false, vision: false };

  const params = model.supportedParameters || [];
  const id = (model.id || '').toLowerCase();

  // Check for vision-related parameters or model naming patterns
  const hasVisionParams = params.includes('vision') || params.includes('image_input');
  const isVisionModel = id.includes('vision') || id.includes('-4o') || id.includes('gpt-4o') ||
    id.includes('claude-3') || id.includes('gemini') || id.includes('llava') ||
    id.includes('pixtral') || id.includes('qwen-vl') || id.includes('llama-3.2');

  return {
    reasoning: params.includes('reasoning'),
    tools: params.includes('tools'),
    vision: hasVisionParams || isVisionModel,
  };
};

// Helper to check if a model supports reasoning/thinking mode (for external use with modelId)
const modelSupportsReasoning = (modelId) => {
  try {
    const cached = localStorage.getItem(MODELS_CACHE_KEY);
    if (cached) {
      const { models } = JSON.parse(cached);
      const model = models.find(m => m.id === modelId);
      return model?.supportedParameters?.includes('reasoning') ?? false;
    }
  } catch (e) {
    console.error('Failed to check model reasoning support:', e);
  }
  return false;
};

// Helper to check if a model supports tool calling (for external use with modelId)
const modelSupportsTools = (modelId) => {
  try {
    const cached = localStorage.getItem(MODELS_CACHE_KEY);
    if (cached) {
      const { models } = JSON.parse(cached);
      const model = models.find(m => m.id === modelId);
      return model?.supportedParameters?.includes('tools') ?? false;
    }
  } catch (e) {
    console.error('Failed to check model tool support:', e);
  }
  return false;
};

// Helper to check if a model supports vision/image input (for external use with modelId)
const modelSupportsVision = (modelId) => {
  try {
    const cached = localStorage.getItem(MODELS_CACHE_KEY);
    if (cached) {
      const { models } = JSON.parse(cached);
      const model = models.find(m => m.id === modelId);
      return getModelCapabilitiesFromData(model).vision;
    }
  } catch (e) {
    console.error('Failed to check model vision support:', e);
  }
  return false;
};

// Get all capabilities for a model by ID (for external use, does localStorage lookup)
const getModelCapabilities = (modelId) => {
  try {
    const cached = localStorage.getItem(MODELS_CACHE_KEY);
    if (cached) {
      const { models } = JSON.parse(cached);
      const model = models.find(m => m.id === modelId);
      return getModelCapabilitiesFromData(model);
    }
  } catch (e) {
    console.error('Failed to get model capabilities:', e);
  }
  return { reasoning: false, tools: false, vision: false };
};

// Feature badges component for displaying model capabilities
// Accepts either model object directly (fast) or falls back to modelId lookup (slower)
const ModelFeatureBadges = ({ model, modelId, className = '' }) => {
  // Use model data directly if provided, otherwise fall back to lookup
  const caps = model ? getModelCapabilitiesFromData(model) : getModelCapabilities(modelId);

  if (!caps.reasoning && !caps.tools && !caps.vision) return null;

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {caps.reasoning && (
        <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-amber-500/15" title="Reasoning/Thinking">
          <Brain className="w-2.5 h-2.5 text-amber-500/80" />
        </span>
      )}
      {caps.tools && (
        <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-blue-500/15" title="Tool Calling (Web Search, etc.)">
          <Wrench className="w-2.5 h-2.5 text-blue-500/80" />
        </span>
      )}
      {caps.vision && (
        <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-emerald-500/15" title="Vision/Image Input">
          <Eye className="w-2.5 h-2.5 text-emerald-500/80" />
        </span>
      )}
    </div>
  );
};

function ModelSelector({ selectedModel, onModelChange, isDropdown = true }) {
  const [isOpen, setIsOpen] = useState(false);
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [recentModels, setRecentModels] = useState([]);
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  // Load recent models from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(RECENT_MODELS_KEY);
    if (stored) {
      try {
        setRecentModels(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse recent models:', e);
      }
    }
  }, []);

  // Fetch models from OpenRouter or cache
  useEffect(() => {
    const fetchModels = async () => {
      // Check cache first
      const cached = localStorage.getItem(MODELS_CACHE_KEY);
      if (cached) {
        try {
          const { models: cachedModels, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < MODELS_CACHE_EXPIRY) {
            setModels(cachedModels);
            setLoading(false);
            return;
          }
        } catch (e) {
          console.error('Failed to parse cached models:', e);
        }
      }

      // Fetch from OpenRouter
      try {
        const response = await fetch('https://openrouter.ai/api/v1/models');
        if (!response.ok) throw new Error('Failed to fetch models');

        const data = await response.json();
        const fetchedModels = data.data
          .filter(model => model.id && model.name)
          .map(model => ({
            id: model.id,
            name: model.name,
            description: model.description || '',
            contextLength: model.context_length,
            pricing: model.pricing,
            supportedParameters: model.supported_parameters || [],
          }))
          .sort((a, b) => a.name.localeCompare(b.name));

        setModels(fetchedModels);

        // Cache the results
        localStorage.setItem(MODELS_CACHE_KEY, JSON.stringify({
          models: fetchedModels,
          timestamp: Date.now()
        }));
      } catch (error) {
        console.error('Failed to fetch models from OpenRouter:', error);
        setModels(FALLBACK_MODELS);
      } finally {
        setLoading(false);
      }
    };

    fetchModels();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Add model to recent list
  const addToRecentModels = (modelId) => {
    const updated = [modelId, ...recentModels.filter(id => id !== modelId)].slice(0, MAX_RECENT_MODELS);
    setRecentModels(updated);
    localStorage.setItem(RECENT_MODELS_KEY, JSON.stringify(updated));
  };

  // Handle model selection
  const handleSelect = (modelId) => {
    addToRecentModels(modelId);
    onModelChange(modelId);
    setIsOpen(false);
    setSearchQuery('');
  };

  // Filter and rank models based on search query
  const filteredModels = useMemo(() => {
    if (!searchQuery.trim()) return models;
    const query = searchQuery.toLowerCase();

    // Filter matching models
    const matches = models.filter(model =>
      model.id.toLowerCase().includes(query) ||
      model.name.toLowerCase().includes(query) ||
      (model.description && model.description.toLowerCase().includes(query))
    );

    // Rank by relevance: name match > ID match > description match
    return matches.sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();
      const aId = a.id.toLowerCase();
      const bId = b.id.toLowerCase();

      // Exact name starts with query
      const aNameStarts = aName.startsWith(query) ? 3 : (aName.includes(query) ? 2 : 0);
      const bNameStarts = bName.startsWith(query) ? 3 : (bName.includes(query) ? 2 : 0);
      if (aNameStarts !== bNameStarts) return bNameStarts - aNameStarts;

      // ID contains query
      const aIdMatch = aId.includes(query) ? 1 : 0;
      const bIdMatch = bId.includes(query) ? 1 : 0;
      if (aIdMatch !== bIdMatch) return bIdMatch - aIdMatch;

      // Alphabetical fallback
      return aName.localeCompare(bName);
    });
  }, [models, searchQuery]);

  // Get recent models data
  const recentModelsData = useMemo(() => {
    return recentModels
      .map(id => models.find(m => m.id === id))
      .filter(Boolean);
  }, [recentModels, models]);

  // Get the display name for current model
  const getModelDisplayName = (modelId) => {
    const model = models.find(m => m.id === modelId);
    if (model) {
      // Strip provider prefix if present (e.g. "Google: Gemini 2.5 Flash" -> "Gemini 2.5 Flash")
      if (model.name.includes(': ')) {
        return model.name.split(': ')[1];
      }
      return model.name;
    }
    // Extract a readable name from the ID
    const parts = modelId.split('/');
    return parts[parts.length - 1].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // Get provider from model ID
  const getProvider = (modelId) => {
    const parts = modelId.split('/');
    if (parts.length > 1) {
      return parts[0].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
    return '';
  };

  if (!isDropdown) {
    // Render as a regular select for settings panel
    return (
      <select
        value={selectedModel}
        onChange={(e) => {
          addToRecentModels(e.target.value);
          onModelChange(e.target.value);
        }}
        className="w-full px-3 py-2 rounded-lg glass-input outline-none text-dark-100 bg-dark-800"
        disabled={loading}
      >
        {loading ? (
          <option>Loading models...</option>
        ) : (
          <>
            {recentModelsData.length > 0 && (
              <optgroup label="Recently Used">
                {recentModelsData.map(model => (
                  <option key={`recent-${model.id}`} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label="All Models">
              {models.map(model => (
                <option key={model.id} value={model.id}>
                  {model.name} ({getProvider(model.id)})
                </option>
              ))}
            </optgroup>
          </>
        )}
      </select>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl transition-all duration-200 text-sm ${isOpen
          ? 'bg-accent/10 border border-accent/20'
          : 'glass-button'
          }`}
      >
        <div className="w-6 h-6 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
          <Bot className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="text-dark-200 font-medium max-w-[180px] truncate">
          {getModelDisplayName(selectedModel)}
        </span>
        <ChevronDown className={`w-4 h-4 text-dark-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-1/2 mt-2 w-[380px] glass-dropdown rounded-2xl z-[100] overflow-hidden shadow-2xl scale-in-centered">
          {/* Search Bar */}
          <div className="p-3 border-b border-dark-700/50 bg-dark-850">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search models..."
                className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-dark-800 border border-dark-700 outline-none text-dark-100 placeholder-dark-500 text-sm focus:border-accent/50"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 hover:bg-dark-700/50 rounded-lg transition-colors"
                >
                  <X className="w-3.5 h-3.5 text-dark-400" />
                </button>
              )}
            </div>
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-accent animate-spin" />
                <span className="ml-3 text-dark-400 text-sm">Loading models...</span>
              </div>
            ) : (
              <>
                {/* Recently Used Section */}
                {!searchQuery && recentModelsData.length > 0 && (
                  <div className="p-2 border-b border-dark-700/50">
                    <div className="flex items-center gap-2 px-3 py-2 text-[11px] font-semibold text-dark-500 uppercase tracking-wider">
                      <Clock className="w-3 h-3" />
                      Recently Used
                    </div>
                    {recentModelsData.map(model => (
                      <button
                        key={`recent-${model.id}`}
                        onClick={() => handleSelect(model.id)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-150 text-left group ${selectedModel === model.id
                          ? 'bg-accent/10 border border-accent/20'
                          : 'hover:bg-dark-700/50 border border-transparent'
                          }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className={`text-sm font-medium truncate ${selectedModel === model.id ? 'text-dark-50' : 'text-dark-200 group-hover:text-dark-100'}`}>{model.name}</p>
                            <ModelFeatureBadges model={model} />
                          </div>
                          <p className="text-xs text-dark-500 truncate">
                            {getProvider(model.id)}
                            {model.contextLength && (
                              <span className="ml-1.5 text-dark-600">• {Math.round(model.contextLength / 1000)}k</span>
                            )}
                            {model.pricing && (
                              <span className="ml-1.5 text-green-500/80">
                                • ${(parseFloat(model.pricing.prompt) * 1000000).toFixed(2)} / ${(parseFloat(model.pricing.completion) * 1000000).toFixed(2)}
                              </span>
                            )}
                          </p>
                        </div>
                        {selectedModel === model.id && (
                          <div className="w-5 h-5 rounded-md bg-accent flex items-center justify-center flex-shrink-0 ml-2">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {/* All Models Section */}
                <div className="p-2">
                  {!searchQuery && (
                    <div className="px-3 py-2 text-[11px] font-semibold text-dark-500 uppercase tracking-wider">
                      All Models <span className="text-dark-600">({filteredModels.length})</span>
                    </div>
                  )}
                  {searchQuery && (
                    <div className="px-3 py-2 text-xs text-dark-400">
                      {filteredModels.length} result{filteredModels.length !== 1 ? 's' : ''} for "<span className="text-accent">{searchQuery}</span>"
                    </div>
                  )}

                  {filteredModels.length === 0 ? (
                    <div className="py-12 text-center">
                      <div className="w-12 h-12 rounded-xl bg-dark-800 flex items-center justify-center mx-auto mb-3">
                        <Search className="w-6 h-6 text-dark-500" />
                      </div>
                      <p className="text-dark-400 font-medium">No models found</p>
                      <p className="text-xs text-dark-500 mt-1">Try a different search term</p>
                    </div>
                  ) : (
                    <div className="space-y-0.5">
                      {filteredModels.map(model => (
                        <button
                          key={model.id}
                          onClick={() => handleSelect(model.id)}
                          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-150 text-left group ${selectedModel === model.id
                            ? 'bg-accent/10 border border-accent/20'
                            : 'hover:bg-dark-700/50 border border-transparent'
                            }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className={`text-sm font-medium truncate ${selectedModel === model.id ? 'text-dark-50' : 'text-dark-200 group-hover:text-dark-100'}`}>{model.name}</p>
                              <ModelFeatureBadges model={model} />
                            </div>
                            <p className="text-xs text-dark-500 truncate">
                              {getProvider(model.id)}
                              {model.contextLength && (
                                <span className="ml-1.5 text-dark-600">• {Math.round(model.contextLength / 1000)}k</span>
                              )}
                              {model.pricing && (
                                <span className="ml-1.5 text-green-500/80">
                                  • ${(parseFloat(model.pricing.prompt) * 1000000).toFixed(2)} / ${(parseFloat(model.pricing.completion) * 1000000).toFixed(2)}
                                </span>
                              )}
                            </p>
                          </div>
                          {selectedModel === model.id && (
                            <div className="w-5 h-5 rounded-md bg-accent flex items-center justify-center flex-shrink-0 ml-2">
                              <Check className="w-3 h-3 text-white" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ModelSelector;
export { DEFAULT_MODEL, RECENT_MODELS_KEY, MODELS_CACHE_KEY, modelSupportsReasoning, modelSupportsTools, modelSupportsVision, getModelCapabilities, ModelFeatureBadges };
