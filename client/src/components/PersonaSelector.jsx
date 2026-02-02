import React, { useState, useEffect, useRef } from 'react';
import {
  User, ChevronDown, Search, X, Clock, BookOpen, Calculator, Code, Feather,
  Scale, Lightbulb, Sparkles, Beaker, Check
} from 'lucide-react';

// Icon mapping
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

// Category configuration
const CATEGORIES = {
  education: { label: 'Education', color: 'text-blue-400' },
  development: { label: 'Development', color: 'text-green-400' },
  creative: { label: 'Creative', color: 'text-purple-400' },
  analytical: { label: 'Analytical', color: 'text-amber-400' },
  general: { label: 'General', color: 'text-dark-400' },
};

function PersonaSelector({ selectedPersona, onSelect, showRecent = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [personas, setPersonas] = useState([]);
  const [recentPersonas, setRecentPersonas] = useState([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    loadPersonas();
    if (showRecent) {
      loadRecentPersonas();
    }
  }, [showRecent]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const loadPersonas = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/personas', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPersonas(data);
      }
    } catch (error) {
      console.error('Failed to load personas:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRecentPersonas = async () => {
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

  const handleSelect = async (persona) => {
    // Track usage
    if (persona) {
      try {
        await fetch(`/api/personas/${persona.id}/use`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
      } catch (error) {
        console.error('Failed to track persona usage:', error);
      }
    }

    onSelect(persona);
    setIsOpen(false);
    setSearchQuery('');
  };

  const getIcon = (iconName) => {
    const IconComponent = ICON_MAP[iconName] || User;
    return IconComponent;
  };

  // Filter personas by search query
  const filteredPersonas = personas.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Group by category
  const groupedPersonas = filteredPersonas.reduce((acc, persona) => {
    const category = persona.category || 'general';
    if (!acc[category]) acc[category] = [];
    acc[category].push(persona);
    return acc;
  }, {});

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl glass-input text-left text-dark-100"
      >
        <div className="flex items-center gap-3">
          {selectedPersona ? (
            <>
              {React.createElement(getIcon(selectedPersona.icon), {
                className: `w-4 h-4 ${CATEGORIES[selectedPersona.category]?.color || 'text-accent'}`
              })}
              <span className="truncate">{selectedPersona.name}</span>
            </>
          ) : (
            <>
              <User className="w-4 h-4 text-dark-500" />
              <span className="text-dark-500">No persona selected</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {selectedPersona && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleSelect(null);
              }}
              className="p-1 hover:bg-dark-700/50 rounded-lg text-dark-500 hover:text-dark-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <ChevronDown className={`w-4 h-4 text-dark-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-dark-850 border border-dark-700/50 rounded-xl shadow-xl z-50 overflow-hidden">
          {/* Search */}
          <div className="p-3 border-b border-dark-700/50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search personas..."
                className="w-full pl-10 pr-4 py-2 rounded-lg bg-dark-800/50 border border-dark-700/50 text-dark-100 text-sm placeholder-dark-500 outline-none focus:border-dark-600"
                autoFocus
              />
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-dark-500">
                Loading...
              </div>
            ) : (
              <>
                {/* Recent section - show recents if available, or defaults as fallback */}
                {!!showRecent && !searchQuery && (() => {
                  const hasRecents = recentPersonas.length > 0;
                  const displayPersonas = hasRecents
                    ? recentPersonas
                    : personas.filter(p => p.is_default === 1).slice(0, 5);

                  if (displayPersonas.length === 0) return null;

                  return (
                    <div className="p-2 border-b border-dark-700/50">
                      <div className="flex items-center gap-2 px-2 py-1 text-xs text-dark-500 font-medium uppercase tracking-wider">
                        <Clock className="w-3 h-3" />
                        {hasRecents ? 'Recently Used' : 'Suggested'}
                      </div>
                      {displayPersonas.map(persona => {
                        const Icon = getIcon(persona.icon);
                        const isSelected = selectedPersona?.id === persona.id;
                        return (
                          <button
                            key={`recent-${persona.id}`}
                            type="button"
                            onClick={() => handleSelect(persona)}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${isSelected
                              ? 'bg-accent/10 text-accent'
                              : 'hover:bg-dark-800/50 text-dark-200'
                              }`}
                          >
                            <Icon className="w-4 h-4 flex-shrink-0" />
                            <span className="truncate text-sm">{persona.name}</span>
                            {isSelected && <Check className="w-4 h-4 ml-auto" />}
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* Categorized personas */}
                {Object.entries(groupedPersonas).map(([category, categoryPersonas]) => (
                  <div key={category} className="p-2">
                    <div className={`px-2 py-1 text-xs font-medium uppercase tracking-wider ${CATEGORIES[category]?.color || 'text-dark-500'}`}>
                      {CATEGORIES[category]?.label || category}
                    </div>
                    {categoryPersonas.map(persona => {
                      const Icon = getIcon(persona.icon);
                      const isSelected = selectedPersona?.id === persona.id;
                      return (
                        <button
                          key={persona.id}
                          type="button"
                          onClick={() => handleSelect(persona)}
                          className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${isSelected
                            ? 'bg-accent/10'
                            : 'hover:bg-dark-800/50'
                            }`}
                        >
                          <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${isSelected ? 'text-accent' : 'text-dark-400'}`} />
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm font-medium truncate ${isSelected ? 'text-accent' : 'text-dark-200'}`}>
                              {persona.name}
                              {persona.is_default === 1 && (
                                <span className="ml-2 text-xs text-dark-500 font-normal">(Default)</span>
                              )}
                            </div>
                            {persona.description && (
                              <div className="text-xs text-dark-500 truncate mt-0.5">
                                {persona.description}
                              </div>
                            )}
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />}
                        </button>
                      );
                    })}
                  </div>
                ))}

                {filteredPersonas.length === 0 && (
                  <div className="p-4 text-center text-dark-500 text-sm">
                    No personas found
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default PersonaSelector;
