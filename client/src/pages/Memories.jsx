import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Brain, Plus, Trash2, Edit2, Save, X, Star } from 'lucide-react';

function Memories() {
  const navigate = useNavigate();
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showNewMemory, setShowNewMemory] = useState(false);
  const [formData, setFormData] = useState({
    content: '',
    category: 'general',
    importance: 1
  });

  useEffect(() => {
    loadMemories();
  }, []);

  const loadMemories = async () => {
    try {
      const res = await fetch('/api/memories', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      setMemories(data);
    } catch (error) {
      console.error('Failed to load memories:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingId) {
        await fetch(`/api/memories/${editingId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify(formData)
        });
      } else {
        await fetch('/api/memories', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify(formData)
        });
      }

      setFormData({ content: '', category: 'general', importance: 1 });
      setEditingId(null);
      setShowNewMemory(false);
      loadMemories();
    } catch (error) {
      console.error('Failed to save memory:', error);
      alert('Failed to save memory');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (memory) => {
    setFormData({
      content: memory.content,
      category: memory.category,
      importance: memory.importance
    });
    setEditingId(memory.id);
    setShowNewMemory(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this memory?')) return;

    try {
      await fetch(`/api/memories/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      loadMemories();
    } catch (error) {
      console.error('Failed to delete memory:', error);
    }
  };

  const cancelEdit = () => {
    setFormData({ content: '', category: 'general', importance: 1 });
    setEditingId(null);
    setShowNewMemory(false);
  };

  const getCategoryColor = (category) => {
    const colors = {
      general: 'bg-gray-100 text-gray-700',
      personal: 'bg-primary-100 text-primary-700',
      work: 'bg-accent-100 text-accent-700',
      preferences: 'bg-purple-100 text-purple-700'
    };
    return colors[category] || colors.general;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-50">
      <div className="max-w-4xl mx-auto p-6">
        <button
          onClick={() => navigate('/')}
          className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Chat
        </button>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold gradient-text mb-2 flex items-center gap-3">
                <Brain className="w-8 h-8" />
                Memories
              </h1>
              <p className="text-gray-600">
                Store important context that the AI can reference in conversations
              </p>
            </div>

            {!showNewMemory && (
              <button
                onClick={() => setShowNewMemory(true)}
                className="px-4 py-2 gradient-primary text-white rounded-lg font-medium hover:shadow-lg hover:shadow-primary-500/30 transition-all flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Memory
              </button>
            )}
          </div>

          {/* New/Edit Memory Form */}
          {showNewMemory && (
            <form onSubmit={handleSubmit} className="mb-8 p-6 bg-gradient-to-r from-primary-50 to-accent-50 rounded-xl border border-primary-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-lg">
                  {editingId ? 'Edit Memory' : 'New Memory'}
                </h3>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="p-1 hover:bg-white rounded transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Content
                  </label>
                  <textarea
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none"
                    rows="4"
                    placeholder="What should the AI remember about you?"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Category
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                    >
                      <option value="general">General</option>
                      <option value="personal">Personal</option>
                      <option value="work">Work</option>
                      <option value="preferences">Preferences</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Importance: {formData.importance}
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      value={formData.importance}
                      onChange={(e) => setFormData({ ...formData, importance: parseInt(e.target.value) })}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>Low</span>
                      <span>High</span>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full gradient-primary text-white py-3 rounded-lg font-medium hover:shadow-lg hover:shadow-primary-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      {editingId ? 'Update Memory' : 'Save Memory'}
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Memories List */}
          <div className="space-y-4">
            {memories.length === 0 ? (
              <div className="text-center py-12">
                <Brain className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No memories yet. Add your first memory to help the AI remember important context.</p>
              </div>
            ) : (
              memories.map(memory => (
                <div
                  key={memory.id}
                  className="p-5 border border-gray-200 rounded-xl hover:border-primary-200 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getCategoryColor(memory.category)}`}>
                          {memory.category}
                        </span>
                        <div className="flex items-center gap-0.5">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`w-3 h-3 ${
                                i < memory.importance
                                  ? 'text-yellow-400 fill-yellow-400'
                                  : 'text-gray-300'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      <p className="text-gray-800 whitespace-pre-wrap">{memory.content}</p>
                      <p className="text-xs text-gray-500 mt-2">
                        Created {new Date(memory.created_at).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(memory)}
                        className="p-2 hover:bg-primary-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4 text-primary-600" />
                      </button>
                      <button
                        onClick={() => handleDelete(memory.id)}
                        className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Memories;
