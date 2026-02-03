import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Bot, ChevronDown, Check, Search, Clock, Loader2, X, Brain, Wrench, Eye,
  User, BookOpen, Calculator, Code, Feather, Scale, Lightbulb, Sparkles, Beaker
} from 'lucide-react';

const DEFAULT_MODEL = 'moonshotai/kimi-k2-thinking';
const RECENT_MODELS_KEY = 'budi_chat_recent_models';
const MODELS_CACHE_KEY = 'budi_chat_models_cache_v3';
const MODELS_CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours
const MAX_RECENT_MODELS = 5;

// Persona Constants
const ICON_MAP = {
  User: User,
  BookOpen: BookOpen,
  Calculator: Calculator,
  Code: Code,
  Feather: Feather,
  Scale: Scale,
  Lightbulb: Lightbulb,
  Sparkles: Sparkles,
  Beaker: Beaker,
};

const CATEGORIES = {
  education: { label: 'Education', color: 'text-blue-400', bgColor: 'bg-blue-400/10', hoverBg: 'hover:bg-blue-400/20' },
  development: { label: 'Development', color: 'text-green-400', bgColor: 'bg-green-400/10', hoverBg: 'hover:bg-green-400/20' },
  creative: { label: 'Creative', color: 'text-purple-400', bgColor: 'bg-purple-400/10', hoverBg: 'hover:bg-purple-400/20' },
  analytical: { label: 'Analytical', color: 'text-amber-400', bgColor: 'bg-amber-400/10', hoverBg: 'hover:bg-amber-400/20' },
  general: { label: 'General', color: 'text-dark-400', bgColor: 'bg-dark-400/10', hoverBg: 'hover:bg-dark-400/20' },
};

// Fallback models in case API fails
const FALLBACK_MODELS = [
  {
    id: 'moonshotai/kimi-k2-thinking',
    name: 'Kimi K2 Thinking',
    description: 'Moonshot AI reasoning model',
    supportedParameters: ['reasoning', 'tools'],
    contextLength: 128000,
    pricing: { prompt: '0', completion: '0' }
  },
  {
    id: 'anthropic/claude-sonnet-4',
    name: 'Claude Sonnet 4',
    description: 'Anthropic Claude Sonnet 4',
    supportedParameters: ['reasoning', 'tools'],
    contextLength: 200000,
    pricing: { prompt: '0.000003', completion: '0.000015' }
  },
  {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    description: 'Anthropic Claude 3.5 Sonnet',
    supportedParameters: ['tools'],
    contextLength: 200000,
    pricing: { prompt: '0.000003', completion: '0.000015' }
  },
  {
    id: 'openai/gpt-4o',
    name: 'GPT-4o',
    description: 'OpenAI GPT-4o',
    supportedParameters: ['tools'],
    contextLength: 128000,
    pricing: { prompt: '0.0000025', completion: '0.00001' }
  },
  {
    id: 'openai/gpt-4-turbo',
    name: 'GPT-4 Turbo',
    description: 'OpenAI GPT-4 Turbo',
    supportedParameters: ['tools'],
    contextLength: 128000,
    pricing: { prompt: '0.00001', completion: '0.00003' }
  },
  {
    id: 'google/gemini-2.5-pro-preview',
    name: 'Gemini 2.5 Pro',
    description: 'Google Gemini 2.5 Pro',
    supportedParameters: ['reasoning', 'tools'],
    contextLength: 2000000,
    pricing: { prompt: '0.00000125', completion: '0.000005' }
  },
  {
    id: 'google/gemini-2.5-flash-preview',
    name: 'Gemini 2.5 Flash',
    description: 'Google Gemini 2.5 Flash',
    supportedParameters: ['reasoning', 'tools'],
    contextLength: 1000000,
    pricing: { prompt: '0.000000075', completion: '0.0000003' }
  },
  {
    id: 'deepseek/deepseek-r1',
    name: 'DeepSeek R1',
    description: 'DeepSeek R1 reasoning model',
    supportedParameters: ['reasoning', 'tools'],
    contextLength: 64000,
    pricing: { prompt: '0.00000055', completion: '0.00000219' }
  },
  {
    id: 'deepseek/deepseek-chat',
    name: 'DeepSeek Chat',
    description: 'DeepSeek Chat model',
    supportedParameters: ['tools'],
    contextLength: 64000,
    pricing: { prompt: '0.00000014', completion: '0.00000028' }
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct',
    name: 'Llama 3.3 70B',
    description: 'Meta Llama 3.3 70B',
    supportedParameters: ['tools'],
    contextLength: 128000,
    pricing: { prompt: '0.00000023', completion: '0.0000004' }
  },
  {
    id: 'qwen/qwen-2.5-72b-instruct',
    name: 'Qwen 2.5 72B',
    description: 'Alibaba Qwen 2.5 72B',
    supportedParameters: ['tools'],
    contextLength: 32000,
    pricing: { prompt: '0.00000035', completion: '0.0000004' }
  },
  {
    id: 'mistralai/mistral-large-2411',
    name: 'Mistral Large',
    description: 'Mistral Large 2411',
    supportedParameters: ['tools'],
    contextLength: 128000,
    pricing: { prompt: '0.000002', completion: '0.000006' }
  },
];

// Helper to compute capabilities directly from model data (fast, no lookups)
const getModelCapabilitiesFromData = (model) => {
  if (!model) return { reasoning: false, tools: false, vision: false };

  const params = model.supportedParameters || [];
  const id = (model.id || '').toLowerCase();

  // Check for reasoning-related parameters or model naming patterns
  const hasReasoningParams = params.includes('reasoning') || params.includes('include_reasoning');
  const isReasoningModel = id.includes('thinking') || id.includes('-r1') || id.includes('deepseek-r1') ||
    id.includes('qwq') || id.includes('o1-') || id.includes('o3-') || id.includes('o4-');

  // Check for vision-related parameters or model naming patterns
  const hasVisionParams = params.includes('vision') || params.includes('image_input');
  const isVisionModel = id.includes('vision') || id.includes('-4o') || id.includes('gpt-4o') ||
    id.includes('claude-3') || id.includes('gemini') || id.includes('llava') ||
    id.includes('pixtral') || id.includes('qwen-vl') || id.includes('llama-3.2');

  return {
    reasoning: hasReasoningParams || isReasoningModel,
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
      return getModelCapabilitiesFromData(model).reasoning;
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
      return getModelCapabilitiesFromData(model).tools;
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

function ModelSelector({
  selectedModel,
  onModelChange,
  isDropdown = true,
  guestWhitelist = [],
  isGuestUsingDefaultKey = false,
  selectedPersona,
  onPersonaChange
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('model'); // 'model' or 'persona'
  const [models, setModels] = useState([]);
  const [personas, setPersonas] = useState([]);
  const [recentPersonas, setRecentPersonas] = useState([]);
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

      // Fetch from local proxy
      try {
        const response = await fetch('/api/models');
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

  // Fetch Personas
  useEffect(() => {
    const fetchPersonas = async () => {
      try {
        const res = await fetch('/api/personas', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (res.ok) {
          const data = await res.json();
          setPersonas(data);
        }
      } catch (error) {
        console.error('Failed to load personas:', error);
      }
    };

    const fetchRecentPersonas = async () => {
      try {
        const res = await fetch('/api/personas/recent', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (res.ok) {
          const data = await res.json();
          setRecentPersonas(data);
        }
      } catch (error) {
        console.error('Failed to load recent personas:', error);
      }
    };

    fetchPersonas();
    fetchRecentPersonas();
  }, [isOpen]); // Reload when dropdown opens to get fresh recent data

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchQuery('');
        setActiveTab('model'); // Reset tab on close
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
  const handleModelSelect = (modelId) => {
    addToRecentModels(modelId);
    onModelChange(modelId);
    setIsOpen(false);
    setSearchQuery('');
  };

  // Handle persona selection
  const handlePersonaSelect = async (persona) => {
    if (persona) {
      // Track usage
      try {
        await fetch(`/api/personas/${persona.id}/use`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
      } catch (error) {
        console.error('Failed to track persona usage:', error);
      }
    }

    // Call the parent handler
    if (onPersonaChange) {
      onPersonaChange(persona);
    }

    setIsOpen(false);
    setSearchQuery('');
  };

  // Check if guest whitelist restrictions apply
  const hasWhitelistRestriction = isGuestUsingDefaultKey;

  // Filter models by guest whitelist first if applicable
  const whitelistedModels = useMemo(() => {
    if (!hasWhitelistRestriction) return models;
    return models.filter(model => guestWhitelist.includes(model.id));
  }, [models, guestWhitelist, hasWhitelistRestriction]);

  // Filter and rank models based on search query
  const filteredModels = useMemo(() => {
    const baseModels = whitelistedModels;
    if (!searchQuery.trim()) return baseModels;
    const query = searchQuery.toLowerCase();

    // Filter matching models
    const matches = baseModels.filter(model =>
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
  }, [whitelistedModels, searchQuery]);

  // Filter Personas based on search
  const filteredPersonas = useMemo(() => {
    if (!searchQuery.trim()) return personas;
    const query = searchQuery.toLowerCase();

    return personas.filter(p =>
      p.name.toLowerCase().includes(query) ||
      (p.description && p.description.toLowerCase().includes(query))
    );
  }, [personas, searchQuery]);

  // Group Personas by category
  const groupedPersonas = useMemo(() => {
    return filteredPersonas.reduce((acc, persona) => {
      const category = persona.category || 'general';
      if (!acc[category]) acc[category] = [];
      acc[category].push(persona);
      return acc;
    }, {});
  }, [filteredPersonas]);

  // Get recent models data (filtered by whitelist if applicable)
  const recentModelsData = useMemo(() => {
    const baseModels = hasWhitelistRestriction ? whitelistedModels : models;
    return recentModels
      .map(id => baseModels.find(m => m.id === id))
      .filter(Boolean);
  }, [recentModels, models, whitelistedModels, hasWhitelistRestriction]);

  // Get the display name for current model
  const getModelDisplayName = (modelId) => {
    const model = models.find(m => m.id === modelId);
    if (model) {
      if (model.name.includes(': ')) {
        return model.name.split(': ')[1];
      }
      return model.name;
    }
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

  const getIcon = (iconName) => ICON_MAP[iconName] || User;

  if (!isDropdown) {
    // Render as a regular select for settings panel
    const selectModels = hasWhitelistRestriction ? whitelistedModels : models;

    if (hasWhitelistRestriction && whitelistedModels.length === 0) {
      return (
        <a href="/settings" className="block w-full px-3 py-2 rounded-lg glass-input text-amber-500 text-sm hover:bg-amber-500/10 transition-colors text-center font-medium">
          Add API Key to select models
        </a>
      );
    }

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
            <optgroup label={hasWhitelistRestriction ? "Available Models" : "All Models"}>
              {selectModels.map(model => (
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

  // Active Persona Icon
  const ActivePersonaIcon = selectedPersona ? getIcon(selectedPersona.icon) : Bot;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 text-sm ${isOpen
          ? 'bg-accent/10 border border-accent/20'
          : 'glass-button'
          }`}
      >
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${selectedPersona
            ? (CATEGORIES[selectedPersona.category]?.bgColor || 'bg-accent/20') + ' ' + (CATEGORIES[selectedPersona.category]?.color || 'text-accent')
            : 'bg-accent text-white'
          }`}>
          <ActivePersonaIcon className="w-4 h-4" />
        </div>

        <div className="flex flex-col items-start min-w-0">
          <span className={`text-xs font-semibold uppercase tracking-wide truncate max-w-[150px] ${selectedPersona ? (CATEGORIES[selectedPersona.category]?.color || 'text-accent') : 'text-accent'
            }`}>
            {selectedPersona ? selectedPersona.name : 'Assistant'}
          </span>
          <span className="text-[11px] text-dark-400 truncate max-w-[150px]">
            {hasWhitelistRestriction && whitelistedModels.length === 0
              ? 'Add API Key'
              : getModelDisplayName(selectedModel)
            }
          </span>
        </div>

        <ChevronDown className={`w-4 h-4 text-dark-400 transition-transform duration-200 ml-1 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-1/2 mt-2 w-[400px] max-w-[calc(100vw-32px)] glass-dropdown rounded-2xl z-[100] overflow-hidden shadow-2xl scale-in-centered sm:left-1/2 sm:-translate-x-1/2 max-sm:left-0 max-sm:right-0 max-sm:translate-x-0 max-sm:fixed max-sm:top-auto max-sm:mt-0 max-sm:w-auto max-sm:mx-4">

          {/* Tabs */}
          <div className="flex items-center p-1 bg-dark-800/50 border-b border-dark-700/50">
            <button
              onClick={() => setActiveTab('model')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-medium transition-all ${activeTab === 'model'
                  ? 'bg-dark-700 text-white shadow-sm'
                  : 'text-dark-400 hover:text-dark-200 hover:bg-dark-800'
                }`}
            >
              <Bot className="w-3.5 h-3.5" />
              Models
            </button>
            <button
              onClick={() => setActiveTab('persona')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-medium transition-all ${activeTab === 'persona'
                  ? 'bg-dark-700 text-white shadow-sm'
                  : 'text-dark-400 hover:text-dark-200 hover:bg-dark-800'
                }`}
            >
              <User className="w-3.5 h-3.5" />
              Personas
            </button>
          </div>

          {/* Search Bar */}
          <div className="p-3 border-b border-dark-700/50 bg-dark-850">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={activeTab === 'model' ? "Search models..." : "Search personas..."}
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
            {/* MODEL TAB CONTENT */}
            {activeTab === 'model' && (
              loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 text-accent animate-spin" />
                  <span className="ml-3 text-dark-400 text-sm">Loading models...</span>
                </div>
              ) : hasWhitelistRestriction && whitelistedModels.length === 0 ? (
                <div className="py-12 text-center px-4">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center mx-auto mb-3">
                    <Bot className="w-6 h-6 text-amber-500" />
                  </div>
                  <p className="text-dark-200 font-medium">No models available</p>
                  <p className="text-xs text-dark-400 mt-1 mb-4">You need to add your own API key to use the chat.</p>
                  <a
                    href="/settings"
                    className="inline-flex items-center px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg transition-colors"
                  >
                    Add API Key
                  </a>
                </div>
              ) : (
                <>
                  {/* Recently Used Models */}
                  {!searchQuery && recentModelsData.length > 0 && (
                    <div className="p-2 border-b border-dark-700/50">
                      <div className="flex items-center gap-2 px-3 py-2 text-[11px] font-semibold text-dark-500 uppercase tracking-wider">
                        <Clock className="w-3 h-3" />
                        Recently Used
                      </div>
                      {recentModelsData.map(model => (
                        <button
                          key={`recent-${model.id}`}
                          onClick={() => handleModelSelect(model.id)}
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

                  {/* All Models */}
                  <div className="p-2">
                    {!searchQuery && (
                      <div className="px-3 py-2 text-[11px] font-semibold text-dark-500 uppercase tracking-wider">
                        {hasWhitelistRestriction ? 'Available Models' : 'All Models'} <span className="text-dark-600">({filteredModels.length})</span>
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
                            onClick={() => handleModelSelect(model.id)}
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
              )
            )}

            {/* PERSONA TAB CONTENT */}
            {activeTab === 'persona' && (
              <>
                {/* Default/Reset */}
                <div className="p-2 border-b border-dark-700/30">
                  <button
                    onClick={() => handlePersonaSelect(null)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${!selectedPersona ? 'bg-accent/10 border border-accent/20' : 'hover:bg-dark-800/50 border border-transparent'}`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${!selectedPersona ? 'bg-accent text-white' : 'bg-dark-700 text-dark-300'}`}>
                      <Bot className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${!selectedPersona ? 'text-accent' : 'text-dark-200'}`}>Default Assistant</p>
                      <p className="text-xs text-dark-500">Standard behavior</p>
                    </div>
                    {!selectedPersona && <Check className="w-3.5 h-3.5 text-accent" />}
                  </button>
                </div>

                {/* Recent Personas */}
                {!searchQuery && recentPersonas.length > 0 && (
                  <div className="p-2 border-b border-dark-700/30">
                    <div className="flex items-center gap-2 px-3 py-2 text-[11px] font-semibold text-dark-500 uppercase tracking-wider">
                      <Clock className="w-3 h-3" />
                      Recently Used
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-3">
                      {recentPersonas.map(persona => {
                        const Icon = getIcon(persona.icon);
                        const isSelected = selectedPersona?.id === persona.id;
                        return (
                          <button
                            key={`quick-${persona.id}`}
                            onClick={() => handlePersonaSelect(persona)}
                            className={`flex flex-col items-center gap-1.5 min-w-[72px] p-2 rounded-xl border transition-all ${isSelected
                              ? 'bg-accent/10 border-accent/20'
                              : 'bg-dark-800/50 border-dark-700/50 hover:bg-dark-700 hover:border-dark-600'
                              }`}
                          >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isSelected ? 'bg-accent/20 text-accent' : 'bg-dark-700 text-dark-400'
                              }`}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <span className={`text-[10px] text-center truncate w-full ${isSelected ? 'text-accent font-medium' : 'text-dark-300'
                              }`}>
                              {persona.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* All Personas Grouped */}
                <div className="p-2">
                  {Object.entries(groupedPersonas).map(([category, categoryPersonas]) => (
                    <div key={category} className="mb-3 last:mb-0">
                      <div className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider mb-1 ${CATEGORIES[category]?.color || 'text-dark-500'}`}>
                        {CATEGORIES[category]?.label || category}
                      </div>
                      <div className="space-y-0.5">
                        {categoryPersonas.map(persona => {
                          const Icon = getIcon(persona.icon);
                          const isSelected = selectedPersona?.id === persona.id;
                          return (
                            <button
                              key={persona.id}
                              onClick={() => handlePersonaSelect(persona)}
                              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${isSelected ? 'bg-accent/10' : 'hover:bg-dark-800/50'
                                }`}
                            >
                              <Icon className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-accent' : 'text-dark-400'}`} />
                              <div className="flex-1 min-w-0">
                                <div className={`text-sm font-medium truncate ${isSelected ? 'text-accent' : 'text-dark-200'}`}>
                                  {persona.name}
                                </div>
                                {persona.description && (
                                  <div className="text-xs text-dark-500 truncate">{persona.description}</div>
                                )}
                              </div>
                              {isSelected && <Check className="w-3.5 h-3.5 text-accent" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  {filteredPersonas.length === 0 && (
                    <div className="p-8 text-center text-dark-500 text-sm">
                      No personas found matching "{searchQuery}"
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
