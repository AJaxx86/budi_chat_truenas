import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Plus, Trash2, Edit, User, BookOpen, Calculator, Code, Feather,
  Scale, Lightbulb, Sparkles, Beaker, Save, X, Eye
} from 'lucide-react';
import { AuthContext } from '../contexts/AuthContext';

// Icon options for personas
const ICON_OPTIONS = [
  { id: 'User', icon: User, label: 'User' },
  { id: 'BookOpen', icon: BookOpen, label: 'Book' },
  { id: 'Calculator', icon: Calculator, label: 'Calculator' },
  { id: 'Code', icon: Code, label: 'Code' },
  { id: 'Feather', icon: Feather, label: 'Feather' },
  { id: 'Scale', icon: Scale, label: 'Scale' },
  { id: 'Lightbulb', icon: Lightbulb, label: 'Lightbulb' },
  { id: 'Sparkles', icon: Sparkles, label: 'Sparkles' },
  { id: 'Beaker', icon: Beaker, label: 'Beaker' },
];

// Category options
const CATEGORY_OPTIONS = [
  { id: 'general', label: 'General', color: 'text-dark-400' },
  { id: 'education', label: 'Education', color: 'text-blue-400' },
  { id: 'development', label: 'Development', color: 'text-green-400' },
  { id: 'creative', label: 'Creative', color: 'text-purple-400' },
  { id: 'analytical', label: 'Analytical', color: 'text-amber-400' },
];

function Personas() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [personas, setPersonas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPersona, setEditingPersona] = useState(null);
  const [viewingPersona, setViewingPersona] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    system_prompt: '',
    icon: 'User',
    category: 'general',
    creativity: 'balanced',
    depth: 'standard',
    tone: 'professional'
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    loadPersonas();
  }, []);

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
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.system_prompt.trim()) {
      setError('Name and system prompt are required');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const url = editingPersona
        ? `/api/personas/${editingPersona.id}`
        : '/api/personas';
      const method = editingPersona ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(formData)
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save persona');
      }

      await loadPersonas();
      resetForm();
    } catch (error) {
      setError(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (persona) => {
    setEditingPersona(persona);
    setFormData({
      name: persona.name,
      description: persona.description || '',
      system_prompt: persona.system_prompt,
      icon: persona.icon || 'User',
      category: persona.category || 'general',
      creativity: persona.creativity || 'balanced',
      depth: persona.depth || 'standard',
      tone: persona.tone || 'professional'
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`/api/personas/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete persona');
      }

      await loadPersonas();
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingPersona(null);
    setFormData({
      name: '',
      description: '',
      system_prompt: '',
      icon: 'User',
      category: 'general',
      creativity: 'balanced',
      depth: 'standard',
      tone: 'professional'
    });
    setError('');
  };

  const getIcon = (iconId) => {
    const iconOption = ICON_OPTIONS.find(opt => opt.id === iconId);
    return iconOption?.icon || User;
  };

  const getCategoryColor = (categoryId) => {
    const cat = CATEGORY_OPTIONS.find(opt => opt.id === categoryId);
    return cat?.color || 'text-dark-400';
  };

  const userPersonas = personas.filter(p => !p.is_default);
  const defaultPersonas = personas.filter(p => p.is_default);

  if (loading) {
    return (
<div className="min-h-screen-safe bg-dark-950 bg-mesh flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen-safe bg-dark-950 bg-mesh">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="p-2 rounded-lg glass-button text-dark-400 hover:text-dark-200 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-dark-100">Personas</h1>
              <p className="text-dark-500 text-sm">Manage AI personalities and system prompts</p>
            </div>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary px-4 py-2.5 rounded-xl font-medium flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Persona
          </button>
        </div>

        {/* Your Personas */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-dark-200 mb-4">Your Personas</h2>
          {userPersonas.length === 0 ? (
            <div className="bg-dark-900/50 border border-dark-800/50 rounded-xl p-8 text-center">
              <User className="w-12 h-12 text-dark-600 mx-auto mb-3" />
              <p className="text-dark-400 mb-4">You haven't created any personas yet</p>
              <button
                onClick={() => setShowForm(true)}
                className="text-accent hover:text-accent/80 font-medium text-sm"
              >
                Create your first persona
              </button>
            </div>
          ) : (
            <div className="grid gap-3">
              {userPersonas.map(persona => {
                const Icon = getIcon(persona.icon);
                return (
                  <div
                    key={persona.id}
                    className="bg-dark-900/50 border border-dark-800/50 rounded-xl p-4 flex items-start gap-4"
                  >
                    <div className="p-2.5 rounded-lg bg-dark-800/50 text-dark-400">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-dark-100">{persona.name}</h3>
                        <span className={`text-xs ${getCategoryColor(persona.category)}`}>
                          {CATEGORY_OPTIONS.find(c => c.id === persona.category)?.label || 'General'}
                        </span>
                      </div>
                      {persona.description && (
                        <p className="text-sm text-dark-500 mt-1">{persona.description}</p>
                      )}
                      <p className="text-xs text-dark-600 mt-2">
                        Used {persona.usage_count || 0} times
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setViewingPersona(persona)}
                        className="p-2 rounded-lg hover:bg-dark-800/50 text-dark-500 hover:text-dark-300 transition-colors"
                        title="View"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEdit(persona)}
                        className="p-2 rounded-lg hover:bg-dark-800/50 text-dark-500 hover:text-dark-300 transition-colors"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(persona.id)}
                        className="p-2 rounded-lg hover:bg-red-500/10 text-dark-500 hover:text-red-400 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Default Personas */}
        <section>
          <h2 className="text-lg font-semibold text-dark-200 mb-4">Default Personas</h2>
          <p className="text-dark-500 text-sm mb-4">
            Built-in personas available to all users. These cannot be edited or deleted.
          </p>
          <div className="grid gap-3">
            {defaultPersonas.map(persona => {
              const Icon = getIcon(persona.icon);
              return (
                <div
                  key={persona.id}
                  className="bg-dark-900/30 border border-dark-800/30 rounded-xl p-4 flex items-start gap-4"
                >
                  <div className="p-2.5 rounded-lg bg-dark-800/30 text-dark-500">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-dark-300">{persona.name}</h3>
                      <span className={`text-xs ${getCategoryColor(persona.category)}`}>
                        {CATEGORY_OPTIONS.find(c => c.id === persona.category)?.label || 'General'}
                      </span>
                    </div>
                    {persona.description && (
                      <p className="text-sm text-dark-500 mt-1">{persona.description}</p>
                    )}
                  </div>
                  <button
                    onClick={() => setViewingPersona(persona)}
                    className="p-2 rounded-lg hover:bg-dark-800/50 text-dark-500 hover:text-dark-300 transition-colors"
                    title="View"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* Create/Edit Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-dark-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <div className="glass-modal rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-dark-100">
                    {editingPersona ? 'Edit Persona' : 'Create Persona'}
                  </h3>
                  <button
                    onClick={resetForm}
                    className="p-2 rounded-lg hover:bg-dark-800/50 text-dark-500 hover:text-dark-300"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl mb-4 text-sm">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">
                      Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl glass-input outline-none text-dark-100"
                      placeholder="e.g., Code Reviewer"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">
                      Description
                    </label>
                    <input
                      type="text"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl glass-input outline-none text-dark-100"
                      placeholder="Short description of what this persona does"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-dark-300 mb-2">
                        Icon
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {ICON_OPTIONS.map(option => {
                          const Icon = option.icon;
                          return (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => setFormData({ ...formData, icon: option.id })}
                              className={`p-2.5 rounded-lg transition-colors ${formData.icon === option.id
                                ? 'bg-accent/20 text-accent'
                                : 'bg-dark-800/50 text-dark-400 hover:text-dark-300'
                                }`}
                              title={option.label}
                            >
                              <Icon className="w-4 h-4" />
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-dark-300 mb-2">
                        Category
                      </label>
                      <select
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl glass-input outline-none text-dark-100"
                      >
                        {CATEGORY_OPTIONS.map(option => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-dark-300 mb-2">
                        Creativity
                      </label>
                      <select
                        value={formData.creativity}
                        onChange={(e) => setFormData({ ...formData, creativity: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl glass-input outline-none text-dark-100 capitalize"
                      >
                        <option value="precise">Precise</option>
                        <option value="balanced">Balanced</option>
                        <option value="imaginative">Imaginative</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-dark-300 mb-2">
                        Depth
                      </label>
                      <select
                        value={formData.depth}
                        onChange={(e) => setFormData({ ...formData, depth: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl glass-input outline-none text-dark-100 capitalize"
                      >
                        <option value="concise">Concise</option>
                        <option value="standard">Standard</option>
                        <option value="detailed">Detailed</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-dark-300 mb-2">
                        Tone
                      </label>
                      <select
                        value={formData.tone}
                        onChange={(e) => setFormData({ ...formData, tone: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl glass-input outline-none text-dark-100 capitalize"
                      >
                        <option value="professional">Professional</option>
                        <option value="friendly">Friendly</option>
                        <option value="enthusiastic">Enthusiastic</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">
                      System Prompt *
                    </label>
                    <textarea
                      value={formData.system_prompt}
                      onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl glass-input outline-none text-dark-100 resize-none font-mono text-sm"
                      rows="6"
                      placeholder="Define the AI's personality, behavior, and instructions..."
                      required
                    />
                    <p className="text-xs text-dark-600 mt-1">
                      This will be used as the system prompt when this persona is selected.
                    </p>
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    <button
                      type="button"
                      onClick={resetForm}
                      className="px-4 py-2.5 glass-button rounded-xl text-dark-300 hover:text-dark-100 font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="btn-primary px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 disabled:opacity-50"
                    >
                      {saving ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent"></div>
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          {editingPersona ? 'Update' : 'Create'}
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* View Persona Modal */}
        {viewingPersona && (
          <div className="fixed inset-0 bg-dark-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <div className="glass-modal rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    {React.createElement(getIcon(viewingPersona.icon), { className: "w-5 h-5 text-accent" })}
                    <h3 className="text-xl font-bold text-dark-100">{viewingPersona.name}</h3>
                  </div>
                  <button
                    onClick={() => setViewingPersona(null)}
                    className="p-2 rounded-lg hover:bg-dark-800/50 text-dark-500 hover:text-dark-300"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {viewingPersona.description && (
                  <p className="text-dark-400 mb-4">{viewingPersona.description}</p>
                )}

                <div className="mb-4">
                  <span className={`text-xs font-medium ${getCategoryColor(viewingPersona.category)}`}>
                    {CATEGORY_OPTIONS.find(c => c.id === viewingPersona.category)?.label || 'General'}
                  </span>
                  {viewingPersona.is_default && (
                    <span className="ml-2 text-xs text-dark-500">(Default)</span>
                  )}
                </div>

                <div className="flex gap-2 mt-4 flex-wrap">
                  <span className="px-2 py-1 rounded-md bg-dark-800 text-xs text-dark-400 border border-dark-700">
                    Creativity: <span className="text-dark-200 capitalize">{viewingPersona.creativity || 'Balanced'}</span>
                  </span>
                  <span className="px-2 py-1 rounded-md bg-dark-800 text-xs text-dark-400 border border-dark-700">
                    Depth: <span className="text-dark-200 capitalize">{viewingPersona.depth || 'Standard'}</span>
                  </span>
                  <span className="px-2 py-1 rounded-md bg-dark-800 text-xs text-dark-400 border border-dark-700">
                    Tone: <span className="text-dark-200 capitalize">{viewingPersona.tone || 'Professional'}</span>
                  </span>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-dark-300 mb-2">
                    System Prompt
                  </label>
                  <div className="p-4 rounded-xl bg-dark-800/50 border border-dark-700/50 font-mono text-sm text-dark-300 whitespace-pre-wrap max-h-64 overflow-y-auto">
                    {viewingPersona.system_prompt}
                  </div>
                </div>

                <div className="flex justify-end mt-6">
                  <button
                    onClick={() => setViewingPersona(null)}
                    className="px-4 py-2.5 glass-button rounded-xl text-dark-300 hover:text-dark-100 font-medium"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-dark-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <div className="glass-modal rounded-2xl w-full max-w-sm p-6">
              <h3 className="text-xl font-bold text-dark-100 mb-2">Delete Persona</h3>
              <p className="text-dark-400 mb-6">
                Are you sure you want to delete this persona? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="px-4 py-2.5 glass-button rounded-xl text-dark-300 hover:text-dark-100 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirm)}
                  className="px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Personas;
