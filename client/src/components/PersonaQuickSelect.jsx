import React, { useState, useEffect, useRef } from 'react';
import {
    User, Search, Clock, BookOpen, Calculator, Code, Feather,
    Scale, Lightbulb, Sparkles, Beaker, Check, X
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
    education: { label: 'Education', color: 'text-blue-400', bgColor: 'bg-blue-400/10', hoverBg: 'hover:bg-blue-400/20' },
    development: { label: 'Development', color: 'text-green-400', bgColor: 'bg-green-400/10', hoverBg: 'hover:bg-green-400/20' },
    creative: { label: 'Creative', color: 'text-purple-400', bgColor: 'bg-purple-400/10', hoverBg: 'hover:bg-purple-400/20' },
    analytical: { label: 'Analytical', color: 'text-amber-400', bgColor: 'bg-amber-400/10', hoverBg: 'hover:bg-amber-400/20' },
    general: { label: 'General', color: 'text-dark-400', bgColor: 'bg-dark-400/10', hoverBg: 'hover:bg-dark-400/20' },
};

function PersonaQuickSelect({ selectedPersona, onSelect, showRecent = true }) {
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
                // Refresh recents after use
                loadRecentPersonas();
            } catch (error) {
                console.error('Failed to track persona usage:', error);
            }
        }

        onSelect(persona);
        setIsOpen(false);
        setSearchQuery('');
    };

    const getIcon = (iconName) => ICON_MAP[iconName] || User;

    // Filter personas logic
    const filteredPersonas = personas.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const groupedPersonas = filteredPersonas.reduce((acc, persona) => {
        const category = persona.category || 'general';
        if (!acc[category]) acc[category] = [];
        acc[category].push(persona);
        return acc;
    }, {});

    const SelectedIcon = selectedPersona ? getIcon(selectedPersona.icon) : User;

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Trigger Button - Icon only with hover tooltip */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-200 group relative ${selectedPersona
                    ? `${CATEGORIES[selectedPersona.category]?.bgColor || 'bg-accent/10'} ${CATEGORIES[selectedPersona.category]?.color || 'text-accent'} ${CATEGORIES[selectedPersona.category]?.hoverBg || 'hover:bg-accent/20'}`
                    : 'bg-dark-700 text-dark-400 hover:bg-dark-600 hover:text-dark-200'
                    }`}
                title={selectedPersona ? selectedPersona.name : "Select Persona"}
            >
                <SelectedIcon className="w-4 h-4" />

                {/* Active Indicator dot if selected */}
                {selectedPersona && (
                    <span className={`absolute top-1 right-1 w-1.5 h-1.5 rounded-full border border-dark-900 ${selectedPersona.category === 'education' ? 'bg-blue-400' :
                            selectedPersona.category === 'development' ? 'bg-green-400' :
                                selectedPersona.category === 'creative' ? 'bg-purple-400' :
                                    selectedPersona.category === 'analytical' ? 'bg-amber-400' :
                                        'bg-dark-400'
                        }`} />
                )}
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute bottom-full left-0 mb-2 w-80 bg-dark-850 border border-dark-700/50 rounded-xl shadow-xl z-50 overflow-hidden scale-in origin-bottom-left">
                    {/* Header & Search */}
                    <div className="p-3 border-b border-dark-700/50 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-dark-400 uppercase tracking-wider">
                                Select Persona
                            </span>
                            {selectedPersona && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleSelect(null);
                                    }}
                                    className="text-xs text-red-400 hover:text-red-300 transition-colors flex items-center gap-1"
                                >
                                    <X className="w-3 h-3" />
                                    Clear
                                </button>
                            )}
                        </div>

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

                    <div className="max-h-80 overflow-y-auto custom-scrollbar">
                        {loading ? (
                            <div className="p-8 text-center text-dark-500 text-sm">Loading...</div>
                        ) : (
                            <>
                                {/* Recent / Suggested Carousel */}
                                {!searchQuery && (recentPersonas.length > 0 || personas.some(p => p.is_default === 1)) && (
                                    <div className="p-3 border-b border-dark-700/30">
                                        <div className="flex items-center gap-2 mb-2 text-xs text-dark-500 font-medium uppercase tracking-wider">
                                            <Clock className="w-3 h-3" />
                                            {recentPersonas.length > 0 ? 'Recently Used' : 'Suggested'}
                                        </div>

                                        {/* Horizontal Scroll Container */}
                                        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
                                            {(recentPersonas.length > 0 ? recentPersonas : personas.filter(p => p.is_default === 1).slice(0, 5)).map(persona => {
                                                const Icon = getIcon(persona.icon);
                                                const isSelected = selectedPersona?.id === persona.id;
                                                return (
                                                    <button
                                                        key={`quick-${persona.id}`}
                                                        onClick={() => handleSelect(persona)}
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

                                {/* Main List */}
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
                                                            onClick={() => handleSelect(persona)}
                                                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${isSelected ? 'bg-accent/10' : 'hover:bg-dark-800/50'
                                                                }`}
                                                        >
                                                            <Icon className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-accent' : 'text-dark-400'}`} />
                                                            <div className="flex-1 min-w-0">
                                                                <div className={`text-sm font-medium truncate ${isSelected ? 'text-accent' : 'text-dark-200'}`}>
                                                                    {persona.name}
                                                                    {persona.is_default === 1 && (
                                                                        <span className="ml-2 text-[10px] text-dark-500 font-normal opacity-70">(Default)</span>
                                                                    )}
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
                                        <div className="p-4 text-center text-dark-500 text-sm">
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

export default PersonaQuickSelect;
