import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Bot, ChevronDown, Check, Search, Clock, Loader2, X } from 'lucide-react';

const DEFAULT_MODEL = 'moonshotai/kimi-k2-thinking';
const RECENT_MODELS_KEY = 'budi_chat_recent_models';
const MODELS_CACHE_KEY = 'budi_chat_models_cache';
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

  // Filter models based on search query
  const filteredModels = useMemo(() => {
    if (!searchQuery.trim()) return models;
    const query = searchQuery.toLowerCase();
    return models.filter(model =>
      model.id.toLowerCase().includes(query) ||
      model.name.toLowerCase().includes(query) ||
      (model.description && model.description.toLowerCase().includes(query))
    );
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
    if (model) return model.name;
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
        className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl transition-all duration-200 text-sm ${
          isOpen
            ? 'bg-primary-500/10 border border-primary-500/20 shadow-lg'
            : 'glass-button'
        }`}
      >
        <div className="w-6 h-6 rounded-lg gradient-primary flex items-center justify-center flex-shrink-0">
          <Bot className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="text-dark-200 font-medium max-w-[180px] truncate">
          {getModelDisplayName(selectedModel)}
        </span>
        <ChevronDown className={`w-4 h-4 text-dark-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-[420px] bg-dark-900 border border-dark-700 rounded-2xl z-[100] overflow-hidden shadow-2xl scale-in">
          {/* Search Bar */}
          <div className="p-3 border-b border-dark-700 bg-dark-800">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search models..."
                className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-dark-800 border border-dark-600 outline-none text-dark-100 placeholder-dark-500 text-sm focus:border-primary-500/50"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 hover:bg-white/[0.05] rounded-lg transition-colors"
                >
                  <X className="w-3.5 h-3.5 text-dark-400" />
                </button>
              )}
            </div>
          </div>

          <div className="max-h-[400px] overflow-y-auto bg-dark-900">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-primary-400 animate-spin" />
                <span className="ml-3 text-dark-400 text-sm">Loading models...</span>
              </div>
            ) : (
              <>
                {/* Recently Used Section */}
                {!searchQuery && recentModelsData.length > 0 && (
                  <div className="p-2 border-b border-dark-700 bg-dark-900">
                    <div className="flex items-center gap-2 px-3 py-2 text-[11px] font-semibold text-dark-500 uppercase tracking-wider">
                      <Clock className="w-3 h-3" />
                      Recently Used
                    </div>
                    {recentModelsData.map(model => (
                      <button
                        key={`recent-${model.id}`}
                        onClick={() => handleSelect(model.id)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-150 text-left group ${
                          selectedModel === model.id
                            ? 'bg-primary-500/15 border border-primary-500/25'
                            : 'hover:bg-white/[0.03] border border-transparent'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate ${selectedModel === model.id ? 'text-dark-50' : 'text-dark-200 group-hover:text-dark-100'}`}>{model.name}</p>
                          <p className="text-xs text-dark-500 truncate">{getProvider(model.id)}</p>
                        </div>
                        {selectedModel === model.id && (
                          <div className="w-5 h-5 rounded-md gradient-primary flex items-center justify-center flex-shrink-0 ml-2">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {/* All Models Section */}
                <div className="p-2 bg-dark-900">
                  {!searchQuery && (
                    <div className="px-3 py-2 text-[11px] font-semibold text-dark-500 uppercase tracking-wider">
                      All Models <span className="text-dark-600">({filteredModels.length})</span>
                    </div>
                  )}
                  {searchQuery && (
                    <div className="px-3 py-2 text-xs text-dark-400">
                      {filteredModels.length} result{filteredModels.length !== 1 ? 's' : ''} for "<span className="text-primary-400">{searchQuery}</span>"
                    </div>
                  )}

                  {filteredModels.length === 0 ? (
                    <div className="py-12 text-center">
                      <div className="w-12 h-12 rounded-xl bg-dark-800/50 flex items-center justify-center mx-auto mb-3">
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
                          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-150 text-left group ${
                            selectedModel === model.id
                              ? 'bg-primary-500/15 border border-primary-500/25'
                              : 'hover:bg-white/[0.03] border border-transparent'
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium truncate ${selectedModel === model.id ? 'text-dark-50' : 'text-dark-200 group-hover:text-dark-100'}`}>{model.name}</p>
                            <p className="text-xs text-dark-500 truncate">
                              {getProvider(model.id)}
                              {model.contextLength && (
                                <span className="ml-1.5 text-dark-600">• {Math.round(model.contextLength / 1000)}k</span>
                              )}
                            </p>
                          </div>
                          {selectedModel === model.id && (
                            <div className="w-5 h-5 rounded-md gradient-primary flex items-center justify-center flex-shrink-0 ml-2">
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
export { DEFAULT_MODEL, RECENT_MODELS_KEY, MODELS_CACHE_KEY };
