import React, { useState, useEffect } from 'react';
import {
    X, Folder, Code, BookOpen, Briefcase, Palette, Music,
    Gamepad2, Camera, Coffee, Star, Heart, Zap, Globe,
    FileText, MessageSquare, Settings, GraduationCap,
    User, Calculator, Feather, Scale, Lightbulb, Sparkles, Beaker
} from 'lucide-react';

const WORKSPACE_ICONS = [
    { name: 'Folder', icon: Folder },
    { name: 'Code', icon: Code },
    { name: 'BookOpen', icon: BookOpen },
    { name: 'Briefcase', icon: Briefcase },
    { name: 'Palette', icon: Palette },
    { name: 'Music', icon: Music },
    { name: 'Gamepad2', icon: Gamepad2 },
    { name: 'Camera', icon: Camera },
    { name: 'Coffee', icon: Coffee },
    { name: 'Star', icon: Star },
    { name: 'Heart', icon: Heart },
    { name: 'Zap', icon: Zap },
    { name: 'Globe', icon: Globe },
    { name: 'FileText', icon: FileText },
    { name: 'MessageSquare', icon: MessageSquare },
    { name: 'Settings', icon: Settings },
    { name: 'GraduationCap', icon: GraduationCap },
];

const WORKSPACE_COLORS = [
    '#f59e0b', // amber
    '#06b6d4', // cyan
    '#10b981', // emerald
    '#8b5cf6', // violet
    '#f43f5e', // rose
    '#3b82f6', // blue
    '#f97316', // orange
    '#84cc16', // lime
];

const PERSONA_ICON_MAP = {
    User, BookOpen, Calculator, Code, Feather, Scale, Lightbulb, Sparkles, Beaker
};

export const getIconComponent = (iconName) => {
    const iconData = WORKSPACE_ICONS.find(i => i.name === iconName);
    return iconData?.icon || Folder;
};

export default function WorkspaceModal({
    isOpen,
    onClose,
    onSave,
    workspace = null,
}) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [icon, setIcon] = useState('Folder');
    const [color, setColor] = useState('#f59e0b');
    const [defaultPersonaId, setDefaultPersonaId] = useState('');
    const [defaultSystemPrompt, setDefaultSystemPrompt] = useState('');
    const [personas, setPersonas] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadPersonas();
        }
    }, [isOpen]);

    useEffect(() => {
        if (workspace) {
            setName(workspace.name || '');
            setDescription(workspace.description || '');
            setIcon(workspace.icon || 'Folder');
            setColor(workspace.color || '#f59e0b');
            setDefaultPersonaId(workspace.default_persona_id || '');
            setDefaultSystemPrompt(workspace.default_system_prompt || '');
        } else {
            setName('');
            setDescription('');
            setIcon('Folder');
            setColor('#f59e0b');
            setDefaultPersonaId('');
            setDefaultSystemPrompt('');
        }
    }, [workspace, isOpen]);

    const loadPersonas = async () => {
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

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim()) return;

        setLoading(true);
        try {
            await onSave({
                id: workspace?.id,
                name: name.trim(),
                description: description.trim() || null,
                icon,
                color,
                default_persona_id: defaultPersonaId || null,
                default_system_prompt: defaultSystemPrompt.trim() || null,
            });
            onClose();
        } catch (error) {
            console.error('Failed to save workspace:', error);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const IconComponent = getIconComponent(icon);

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="glass-modal rounded-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col scale-in">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-dark-700/40">
                    <div className="flex items-center gap-3">
                        <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: `${color}20`, color }}
                        >
                            <IconComponent className="w-5 h-5" />
                        </div>
                        <h2 className="text-lg font-medium text-dark-50">
                            {workspace ? 'Edit Workspace' : 'Create Workspace'}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-dark-700/40 text-dark-400 hover:text-dark-200 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
                    {/* Name */}
                    <div>
                        <label className="block text-sm font-medium text-dark-300 mb-1.5">
                            Name
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="My Workspace"
                            className="w-full px-3 py-2 glass-input rounded-lg text-dark-100 placeholder-dark-500"
                            required
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-medium text-dark-300 mb-1.5">
                            Description <span className="text-dark-500">(optional)</span>
                        </label>
                        <input
                            type="text"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="A brief description of this workspace"
                            className="w-full px-3 py-2 glass-input rounded-lg text-dark-100 placeholder-dark-500"
                        />
                    </div>

                    {/* Icon & Color Row */}
                    <div className="grid grid-cols-2 gap-4">
                        {/* Icon */}
                        <div>
                            <label className="block text-sm font-medium text-dark-300 mb-1.5">
                                Icon
                            </label>
                            <div className="grid grid-cols-6 gap-1 p-2 glass-card rounded-lg">
                                {WORKSPACE_ICONS.map(({ name: iconName, icon: IconComp }) => (
                                    <button
                                        key={iconName}
                                        type="button"
                                        onClick={() => setIcon(iconName)}
                                        className={`p-1.5 rounded-md transition-all ${icon === iconName
                                                ? 'bg-accent/20 text-accent'
                                                : 'hover:bg-dark-700/40 text-dark-400'
                                            }`}
                                    >
                                        <IconComp className="w-4 h-4" />
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Color */}
                        <div>
                            <label className="block text-sm font-medium text-dark-300 mb-1.5">
                                Color
                            </label>
                            <div className="grid grid-cols-4 gap-1.5 p-2 glass-card rounded-lg">
                                {WORKSPACE_COLORS.map((c) => (
                                    <button
                                        key={c}
                                        type="button"
                                        onClick={() => setColor(c)}
                                        className={`w-7 h-7 rounded-full transition-all ${color === c ? 'ring-2 ring-white/50 scale-110' : 'hover:scale-105'
                                            }`}
                                        style={{ backgroundColor: c }}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Default Persona */}
                    <div>
                        <label className="block text-sm font-medium text-dark-300 mb-1.5">
                            Default Persona <span className="text-dark-500">(optional)</span>
                        </label>
                        <select
                            value={defaultPersonaId}
                            onChange={(e) => setDefaultPersonaId(e.target.value)}
                            className="w-full px-3 py-2 glass-input rounded-lg text-dark-100"
                        >
                            <option value="">Default Assistant</option>
                            {personas.map((persona) => {
                                const PersonaIcon = PERSONA_ICON_MAP[persona.icon] || User;
                                return (
                                    <option key={persona.id} value={persona.id}>
                                        {persona.name}
                                    </option>
                                );
                            })}
                        </select>
                    </div>

                    {/* Default System Prompt */}
                    <div>
                        <label className="block text-sm font-medium text-dark-300 mb-1.5">
                            Default System Prompt <span className="text-dark-500">(optional)</span>
                        </label>
                        <textarea
                            value={defaultSystemPrompt}
                            onChange={(e) => setDefaultSystemPrompt(e.target.value)}
                            placeholder="Custom instructions for all chats in this workspace..."
                            rows={3}
                            className="w-full px-3 py-2 glass-input rounded-lg text-dark-100 placeholder-dark-500 resize-none"
                        />
                    </div>
                </form>

                {/* Footer */}
                <div className="flex justify-end gap-2 p-4 border-t border-dark-700/40">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-dark-300 hover:text-dark-100 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!name.trim() || loading}
                        className="px-4 py-2 text-sm btn-primary rounded-lg disabled:opacity-50"
                    >
                        {loading ? 'Saving...' : workspace ? 'Save Changes' : 'Create Workspace'}
                    </button>
                </div>
            </div>
        </div>
    );
}
