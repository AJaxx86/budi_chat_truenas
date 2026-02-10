import React, { useState, useEffect, useRef, useMemo, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Users, Settings, Plus, Trash2, Edit2,
  Save, X, Shield, Key, Eye, EyeOff, CheckCircle, XCircle,
  Zap, Coins, RotateCcw, UserCog, Search, Bot, Loader2, AlertTriangle
} from 'lucide-react';
import { AuthContext } from '../contexts/AuthContext';

function Admin() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [users, setUsers] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(false);
  const [showNewUser, setShowNewUser] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [showDefaultKey, setShowDefaultKey] = useState(false);
  const [defaultApiKey, setDefaultApiKey] = useState('');
  const [showFactoryReset, setShowFactoryReset] = useState(false);
  const [factoryResetConfirm, setFactoryResetConfirm] = useState('');
  const [factoryResetLoading, setFactoryResetLoading] = useState(false);

  const [userForm, setUserForm] = useState({
    email: '',
    password: '',
    name: '',
    user_group: 'user',
    use_default_key: false
  });

  const [titleGenerationModel, setTitleGenerationModel] = useState('google/gemini-2.5-flash-lite');
  const [globalSystemPrompt, setGlobalSystemPrompt] = useState('');
  const [braveSearchApiKey, setBraveSearchApiKey] = useState('');
  const [showBraveKey, setShowBraveKey] = useState(false);

  // Registration setting state
  const [registrationEnabled, setRegistrationEnabled] = useState(false);

  // Guest model whitelist state
  const [guestModelWhitelist, setGuestModelWhitelist] = useState([]);
  const [whitelistSearch, setWhitelistSearch] = useState('');
  const [showWhitelistDropdown, setShowWhitelistDropdown] = useState(false);
  const [availableModels, setAvailableModels] = useState([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const whitelistDropdownRef = useRef(null);

  // Groups state
  const [groups, setGroups] = useState([]);
  const [savingGroups, setSavingGroups] = useState(false);

  useEffect(() => {
    loadUsers();
    loadSettings();
    loadGroups();
    loadModels();
  }, []);

  // Close whitelist dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (whitelistDropdownRef.current && !whitelistDropdownRef.current.contains(event.target)) {
        setShowWhitelistDropdown(false);
        setWhitelistSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadUsers = async () => {
    try {
      const res = await fetch('/api/admin/users', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      setUsers(data);
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  };

  const loadSettings = async () => {
    try {
      const res = await fetch('/api/admin/settings', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      setSettings(data);
      setDefaultApiKey(data.default_openai_api_key || '');
      setTitleGenerationModel(data.title_generation_model || 'google/gemini-2.5-flash-lite');
      setGlobalSystemPrompt(data.global_system_prompt || '');
      setBraveSearchApiKey(data.brave_search_api_key || '');
      // Load registration enabled setting (defaults to false if not set)
      setRegistrationEnabled(data.registration_enabled === 'true');
      // Parse guest model whitelist (stored as JSON string)
      try {
        const whitelist = data.guest_model_whitelist ? JSON.parse(data.guest_model_whitelist) : [];
        setGuestModelWhitelist(Array.isArray(whitelist) ? whitelist : []);
      } catch (e) {
        console.error('Failed to parse guest_model_whitelist:', e);
        setGuestModelWhitelist([]);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const loadGroups = async () => {
    try {
      const res = await fetch('/api/admin/groups', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      // Ensure admin group uses the red color (hotfix until server restart/migration)
      const patchedData = data.map(g => {
        if (g.id === 'admin' && (g.color === '#a855f7' || !g.color)) {
          return { ...g, color: '#ef4444' };
        }
        return g;
      });
      setGroups(patchedData);
    } catch (error) {
      console.error('Failed to load groups:', error);
    }
  };

  const loadModels = async () => {
    setModelsLoading(true);
    try {
      // Check cache first (v3 includes pricing data)
      const MODELS_CACHE_KEY = 'budi_chat_models_cache_v3';
      const MODELS_CACHE_EXPIRY = 24 * 60 * 60 * 1000;
      const cached = localStorage.getItem(MODELS_CACHE_KEY);

      if (cached) {
        try {
          const { models, timestamp } = JSON.parse(cached);
          // Only use cache if not expired AND has pricing data
          if (Date.now() - timestamp < MODELS_CACHE_EXPIRY && models[0]?.pricing !== undefined) {
            setAvailableModels(models);
            setModelsLoading(false);
            return;
          }
        } catch (e) {
          console.error('Failed to parse cached models:', e);
        }
      }

      // Fetch from OpenRouter
      const response = await fetch('https://openrouter.ai/api/v1/models');
      if (!response.ok) throw new Error('Failed to fetch models');

      const data = await response.json();
      const models = data.data
        .filter(model => model.id && model.name)
        .map(model => ({
          id: model.id,
          name: model.name,
          description: model.description || '',
          pricing: model.pricing,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      setAvailableModels(models);

      // Cache the results
      localStorage.setItem(MODELS_CACHE_KEY, JSON.stringify({
        models,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('Failed to load models:', error);
    } finally {
      setModelsLoading(false);
    }
  };

  // Filter models for whitelist search
  const filteredModels = useMemo(() => {
    if (!whitelistSearch.trim()) return availableModels.slice(0, 50); // Show first 50 when no search
    const query = whitelistSearch.toLowerCase();
    return availableModels
      .filter(model =>
        model.id.toLowerCase().includes(query) ||
        model.name.toLowerCase().includes(query)
      )
      .slice(0, 50);
  }, [availableModels, whitelistSearch]);

  // Get model info by ID
  const getModelInfo = (modelId) => {
    return availableModels.find(m => m.id === modelId) || { id: modelId, name: modelId };
  };

  // Save whitelist to server
  const saveWhitelist = async (whitelist) => {
    try {
      await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ guest_model_whitelist: whitelist })
      });
    } catch (error) {
      console.error('Failed to save whitelist:', error);
    }
  };

  // Add model to whitelist
  const addToWhitelist = (modelId) => {
    if (!guestModelWhitelist.includes(modelId)) {
      const newWhitelist = [...guestModelWhitelist, modelId];
      setGuestModelWhitelist(newWhitelist);
      saveWhitelist(newWhitelist);
    }
    setWhitelistSearch('');
    setShowWhitelistDropdown(false);
  };

  // Remove model from whitelist
  const removeFromWhitelist = (modelId) => {
    const newWhitelist = guestModelWhitelist.filter(id => id !== modelId);
    setGuestModelWhitelist(newWhitelist);
    saveWhitelist(newWhitelist);
  };

  const handleSaveSettings = async () => {
    setLoading(true);
    try {
      await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          default_openai_api_key: defaultApiKey,
          title_generation_model: titleGenerationModel,
          global_system_prompt: globalSystemPrompt,
          brave_search_api_key: braveSearchApiKey,
          registration_enabled: registrationEnabled
        })
      });
      alert('Settings saved successfully!');
      loadSettings();
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  const handleUserSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingUser) {
        await fetch(`/api/admin/users/${editingUser.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify(userForm)
        });
      } else {
        await fetch('/api/admin/users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify(userForm)
        });
      }

      setUserForm({
        email: '',
        password: '',
        name: '',
        user_group: 'user',
        use_default_key: false
      });
      setEditingUser(null);
      setShowNewUser(false);
      loadUsers();
    } catch (error) {
      console.error('Failed to save user:', error);
      alert('Failed to save user');
    } finally {
      setLoading(false);
    }
  };

  const handleEditUser = (user) => {
    setUserForm({
      email: user.email,
      password: '',
      name: user.name,
      user_group: user.user_group || (user.is_admin ? 'admin' : 'user'),
      use_default_key: !!user.use_default_key
    });
    setEditingUser(user);
    setShowNewUser(true);
  };

  const handleDeleteUser = async (userId) => {
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
      await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      loadUsers();
    } catch (error) {
      console.error('Failed to delete user:', error);
      alert('Failed to delete user');
    }
  };

  const handleResetUserStats = async (userId, userName) => {
    if (!confirm(`Are you sure you want to reset all stats for ${userName}? This cannot be undone.`)) return;

    try {
      const res = await fetch(`/api/admin/users/${userId}/stats`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!res.ok) {
        throw new Error('Failed to reset stats');
      }
      loadUsers();
    } catch (error) {
      console.error('Failed to reset user stats:', error);
      alert('Failed to reset user stats');
    }
  };

  const cancelUserForm = () => {
    setUserForm({
      email: '',
      password: '',
      name: '',
      user_group: 'user',
      use_default_key: false
    });
    setEditingUser(null);
    setShowNewUser(false);
  };

  return (
    <div className="min-h-screen bg-dark-950 bg-mesh">
      <div className="max-w-6xl mx-auto p-6">
        <button
          onClick={() => navigate('/')}
          className="mb-6 flex items-center gap-2 text-dark-400 hover:text-dark-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Chat
        </button>

        <div className="space-y-6">
          {/* System Settings */}
          <div className="glass-card rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-accent mb-6 flex items-center gap-3 tracking-tight">
              <Settings className="w-7 h-7" />
              System Settings
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  Default OpenRouter API Key
                </label>
                <p className="text-sm text-dark-400 mb-3">
                  Users with "use default key" permission will use this API key. Leave blank to disable.
                </p>
                <div className="relative">
                  <input
                    type={showDefaultKey ? 'text' : 'password'}
                    value={defaultApiKey}
                    onChange={(e) => setDefaultApiKey(e.target.value)}
                    className="w-full px-4 py-3 pr-12 rounded-xl glass-input outline-none font-mono text-sm text-dark-100"
                    placeholder="sk-..."
                  />
                  <button
                    type="button"
                    onClick={() => setShowDefaultKey(!showDefaultKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-dark-200"
                  >
                    {showDefaultKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  Chat Title Generation Model
                </label>
                <p className="text-sm text-dark-400 mb-3">
                  Model used to generate chat titles from the first message. Defaults to Google Gemini 2.5 Flash Lite.
                </p>
                <input
                  type="text"
                  value={titleGenerationModel}
                  onChange={(e) => setTitleGenerationModel(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl glass-input outline-none text-sm text-dark-100"
                  placeholder="google/gemini-2.5-flash-lite"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  Global System Prompt
                </label>
                <p className="text-sm text-dark-400 mb-3">
                  Applied to all chats before any chat-specific system prompt. Useful for setting global behavior guidelines.
                </p>
                <textarea
                  value={globalSystemPrompt}
                  onChange={(e) => setGlobalSystemPrompt(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl glass-input outline-none text-sm text-dark-100 min-h-[120px] resize-y"
                  placeholder="Enter a system prompt that will be applied to all chats..."
                  rows={4}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  Brave Search API Key
                </label>
                <p className="text-sm text-dark-400 mb-3">
                  Required for web search functionality. Get a key from <a href="https://brave.com/search/api/" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Brave Search API</a>.
                </p>
                <div className="relative">
                  <input
                    type={showBraveKey ? 'text' : 'password'}
                    value={braveSearchApiKey}
                    onChange={(e) => setBraveSearchApiKey(e.target.value)}
                    className="w-full px-4 py-3 pr-12 rounded-xl glass-input outline-none font-mono text-sm text-dark-100"
                    placeholder="BSA..."
                  />
                  <button
                    type="button"
                    onClick={() => setShowBraveKey(!showBraveKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-dark-200"
                  >
                    {showBraveKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

            </div>

            <button
              onClick={handleSaveSettings}
              disabled={loading}
              className="btn-primary mt-6 px-6 py-3 rounded-xl font-semibold transition-all duration-200 disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Settings
                </>
              )}
            </button>
          </div>
        </div>

        {/* User Management */}
        <div className="glass-card rounded-2xl p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-accent flex items-center gap-3 tracking-tight">
              <Users className="w-7 h-7" />
              User Management
            </h2>

            {!showNewUser && (
              <button
                onClick={() => setShowNewUser(true)}
                className="btn-primary px-4 py-2.5 rounded-xl font-semibold transition-all duration-200 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add User
              </button>
            )}
          </div>

          {/* New/Edit User Form */}
          {showNewUser && (
            <form onSubmit={handleUserSubmit} className="mb-8 p-6 bg-dark-800/50 rounded-xl border border-dark-700/40">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-lg text-dark-100">
                  {editingUser ? 'Edit User' : 'New User'}
                </h3>
                <button
                  type="button"
                  onClick={cancelUserForm}
                  className="p-1.5 hover:bg-dark-700/50 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-dark-400" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    value={userForm.name}
                    onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl glass-input outline-none text-dark-100"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={userForm.email}
                    onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl glass-input outline-none text-dark-100"
                    required
                    disabled={!!editingUser}
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  Password {editingUser && '(leave blank to keep current)'}
                </label>
                <input
                  type="password"
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl glass-input outline-none text-dark-100"
                  required={!editingUser}
                />
              </div>

              <div className="space-y-3 mb-4">
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    User Group
                  </label>
                  <select
                    value={userForm.user_group}
                    onChange={(e) => setUserForm({ ...userForm, user_group: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl glass-input outline-none text-dark-100"
                  >
                    {groups.map(group => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-dark-500 mt-1">
                    Permissions are controlled by the group settings below
                  </p>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full py-3 rounded-xl font-semibold transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    {editingUser ? 'Update User' : 'Create User'}
                  </>
                )}
              </button>
            </form>
          )}

          {/* Users List */}
          <div className="space-y-3">
            {users.map(user => (
              <div
                key={user.id}
                className="p-5 bg-dark-800/50 border border-dark-700/50 rounded-xl hover:border-dark-600 transition-all duration-200"
              >
                <div className="flex items-center justify-between gap-4">
                  {/* User Info */}
                  <div className="flex-shrink-0 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-lg text-dark-100">{user.name}</h3>
                      {user.user_type === 'master' ? (
                        <span className="flex items-center gap-1 px-2.5 py-1 bg-purple-500/10 text-purple-400 rounded-full text-xs font-medium border border-purple-500/20">
                          <Shield className="w-3 h-3" />
                          Master
                        </span>
                      ) : user.is_admin === 1 ? (
                        <span className="flex items-center gap-1 px-2.5 py-1 bg-red-500/10 text-red-500 rounded-full text-xs font-medium border border-red-500/20">
                          <Shield className="w-3 h-3" />
                          Admin
                        </span>
                      ) : (
                        (() => {
                          const group = groups.find(g => g.id === user.user_group);
                          if (group) {
                            return (
                              <span
                                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border"
                                style={{
                                  backgroundColor: `${group.color}20`,
                                  color: group.color,
                                  borderColor: `${group.color}40`
                                }}
                              >
                                {group.name}
                              </span>
                            );
                          }
                          return null;
                        })()
                      )}
                    </div>
                    <p className="text-sm text-dark-400 mb-2">{user.email}</p>
                    <div className="flex gap-4 text-xs text-dark-500">
                      <span className="flex items-center gap-1">
                        {user.has_api_key ? (
                          <>
                            <CheckCircle className="w-3 h-3 text-green-400" />
                            <span className="text-dark-300">Has API key</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3 text-dark-500" />
                            <span>No API key</span>
                          </>
                        )}
                      </span>
                      <span className="flex items-center gap-1">
                        {user.use_default_key ? (
                          <>
                            <CheckCircle className="w-3 h-3 text-accent" />
                            <span className="text-dark-300">Can use default key</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3 text-dark-500" />
                            <span>Cannot use default key</span>
                          </>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Usage Stats - Lifetime totals with breakdown */}
                  <div className="flex-1 flex flex-col gap-2">
                    {/* Lifetime Stats Row */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex items-center gap-2 px-3 py-2 bg-dark-700/50 rounded-xl border border-dark-600/50">
                        <Zap className="w-4 h-4 text-dark-300 flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="text-[10px] text-dark-500 leading-tight">Lifetime Tokens</div>
                          <div className="text-sm font-semibold text-dark-100 truncate">
                            {user.lifetime_tokens?.toLocaleString() || 0}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-2 bg-dark-700/50 rounded-xl border border-dark-600/50">
                        <Coins className="w-4 h-4 text-dark-300 flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="text-[10px] text-dark-500 leading-tight">Lifetime Cost</div>
                          <div className="text-sm font-semibold text-dark-100 truncate">
                            ${(user.lifetime_cost || 0).toFixed(4)}
                          </div>
                        </div>
                      </div>
                    </div>
                    {/* Breakdown Row - Default Key (accent) vs Personal Key (secondary) */}
                    <div className="grid grid-cols-4 gap-1.5">
                      <div className="flex items-center gap-1.5 px-2 py-1.5 bg-accent/10 rounded-lg border border-accent/20">
                        <div className="min-w-0">
                          <div className="text-[9px] text-dark-500 leading-tight">Default Tokens</div>
                          <div className="text-xs font-medium text-accent truncate">
                            {user.default_key_tokens?.toLocaleString() || 0}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 px-2 py-1.5 bg-accent/10 rounded-lg border border-accent/20">
                        <div className="min-w-0">
                          <div className="text-[9px] text-dark-500 leading-tight">Default Cost</div>
                          <div className="text-xs font-medium text-accent truncate">
                            ${(user.default_key_cost || 0).toFixed(4)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 px-2 py-1.5 bg-secondary-10 rounded-lg border border-secondary-20">
                        <div className="min-w-0">
                          <div className="text-[9px] text-dark-500 leading-tight">Personal Tokens</div>
                          <div className="text-xs font-medium text-secondary truncate">
                            {user.personal_key_tokens?.toLocaleString() || 0}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 px-2 py-1.5 bg-secondary-10 rounded-lg border border-secondary-20">
                        <div className="min-w-0">
                          <div className="text-[9px] text-dark-500 leading-tight">Personal Cost</div>
                          <div className="text-xs font-medium text-secondary truncate">
                            ${(user.personal_key_cost || 0).toFixed(4)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleResetUserStats(user.id, user.name)}
                      className="p-2 hover:bg-orange-500/10 rounded-lg transition-colors"
                      title="Reset Stats"
                    >
                      <RotateCcw className="w-4 h-4 text-orange-400" />
                    </button>
                    <button
                      onClick={() => handleEditUser(user)}
                      className="p-2 hover:bg-accent/10 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4 text-accent" />
                    </button>
                    <button
                      onClick={() => handleDeleteUser(user.id)}
                      className="p-2 hover:bg-red-500/10 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* User Groups Management */}
        <div className="glass-card rounded-2xl p-8">
          <h2 className="text-2xl font-bold text-accent mb-6 flex items-center gap-3 tracking-tight">
            <UserCog className="w-7 h-7" />
            User Groups & Permissions
          </h2>
          <p className="text-sm text-dark-400 mb-6">
            Configure permissions for each user group. Changes are saved automatically.
          </p>

          <div className="space-y-6">
            {groups.map(group => (
              <div
                key={group.id}
                className="p-5 bg-dark-800/50 border border-dark-700/50 rounded-xl"
              >
                <div className="flex items-center gap-3 mb-4">
                  <span
                    className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-bold uppercase tracking-wider"
                    style={{
                      backgroundColor: `${group.color}20`,
                      color: group.color,
                      border: `1px solid ${group.color}40`
                    }}
                  >
                    {group.name}
                  </span>

                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {Object.entries(group.permissions || {}).map(([key, value]) => (
                    <label
                      key={key}
                      className="flex items-center gap-2 p-2 rounded-lg hover:bg-dark-700/30 cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={value}
                        onChange={async (e) => {
                          const newPermissions = { ...group.permissions, [key]: e.target.checked };
                          // Update local state immediately
                          setGroups(groups.map(g =>
                            g.id === group.id ? { ...g, permissions: newPermissions } : g
                          ));
                          // Save to server
                          try {
                            await fetch(`/api/admin/groups/${group.id}`, {
                              method: 'PUT',
                              headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${localStorage.getItem('token')}`
                              },
                              body: JSON.stringify({ permissions: newPermissions })
                            });
                          } catch (error) {
                            console.error('Failed to update group permissions:', error);
                            // Revert on error
                            loadGroups();
                          }
                        }}
                        className="w-4 h-4 rounded accent-accent"
                      />
                      <span className="text-xs text-dark-300">
                        {key.replace(/^can_/, '').replace(/_/g, ' ')}
                      </span>
                    </label>
                  ))}
                </div>

                {/* Guest-specific: Model Whitelist */}
                {group.id === 'guest' && (
                  <div className="mt-6 pt-5 border-t border-dark-700/50">
                    <div className="flex items-center gap-2 mb-3">
                      <Bot className="w-4 h-4 text-dark-400" />
                      <h4 className="text-sm font-semibold text-dark-200">Allowed Models</h4>
                      <span className="text-xs text-dark-500">
                        ({guestModelWhitelist.length === 0 ? 'unrestricted' : `${guestModelWhitelist.length} model${guestModelWhitelist.length !== 1 ? 's' : ''}`})
                      </span>
                    </div>
                    <p className="text-xs text-dark-500 mb-4">
                      Restrict which models guests can use when accessing the default API key. Leave empty for no restrictions.
                    </p>

                    {/* Selected Models as Chips */}
                    {guestModelWhitelist.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-4">
                        {guestModelWhitelist.map(modelId => {
                          const model = getModelInfo(modelId);
                          return (
                            <div
                              key={modelId}
                              className="group flex items-center gap-2 pl-2.5 pr-1.5 py-1 bg-dark-700/60 border border-dark-600/50 rounded-lg text-xs hover:border-dark-500/50 transition-all"
                            >
                              <span className="text-dark-300 font-medium">{model.name}</span>
                              <button
                                type="button"
                                onClick={() => removeFromWhitelist(modelId)}
                                className="p-0.5 rounded hover:bg-red-500/20 transition-colors"
                              >
                                <X className="w-3 h-3 text-dark-500 group-hover:text-red-400" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Model Search/Add */}
                    <div className="relative" ref={whitelistDropdownRef}>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-dark-500" />
                        <input
                          type="text"
                          value={whitelistSearch}
                          onChange={(e) => {
                            setWhitelistSearch(e.target.value);
                            setShowWhitelistDropdown(true);
                          }}
                          onFocus={() => setShowWhitelistDropdown(true)}
                          placeholder="Search models to add..."
                          className="w-full pl-9 pr-4 py-2 rounded-lg bg-dark-900/50 border border-dark-700/50 outline-none text-sm text-dark-200 placeholder-dark-500 focus:border-dark-600 transition-colors"
                        />
                        {modelsLoading && (
                          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-dark-500 animate-spin" />
                        )}
                      </div>

                      {showWhitelistDropdown && (
                        <div className="absolute z-50 w-full mt-1.5 max-h-[240px] overflow-y-auto bg-dark-850 border border-dark-700 rounded-lg shadow-xl">
                          {filteredModels.length === 0 ? (
                            <div className="px-4 py-5 text-center text-dark-500 text-xs">
                              {whitelistSearch ? 'No models found' : 'Type to search...'}
                            </div>
                          ) : (
                            <div className="p-1.5">
                              {filteredModels.map(model => {
                                const isSelected = guestModelWhitelist.includes(model.id);
                                return (
                                  <button
                                    key={model.id}
                                    type="button"
                                    onClick={() => !isSelected && addToWhitelist(model.id)}
                                    disabled={isSelected}
                                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left transition-colors ${isSelected
                                      ? 'bg-dark-700/30 cursor-default'
                                      : 'hover:bg-dark-700/50'
                                      }`}
                                  >
                                    <div className="flex-1 min-w-0">
                                      <p className={`text-xs font-medium truncate ${isSelected ? 'text-dark-400' : 'text-dark-200'}`}>
                                        {model.name}
                                      </p>
                                      <p className="text-[10px] text-dark-600 truncate">
                                        {model.id}
                                        {model.pricing && (
                                          <span className="ml-1.5 text-emerald-500/70">
                                            • ${(parseFloat(model.pricing.prompt) * 1000000).toFixed(2)} / ${(parseFloat(model.pricing.completion) * 1000000).toFixed(2)}
                                          </span>
                                        )}
                                      </p>
                                    </div>
                                    {isSelected && (
                                      <CheckCircle className="w-3.5 h-3.5 text-green-500/70 flex-shrink-0" />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Registration Settings */}
        <div className="glass-card rounded-2xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center">
              <UserCog className="w-6 h-6 text-accent" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-accent flex items-center gap-3 tracking-tight">
                User Registration
              </h2>
              <p className="text-dark-400 text-sm mt-1">Control new user sign-ups</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-dark-800/50 border border-dark-700/50 rounded-xl">
              <div>
                <label className="block text-sm font-medium text-dark-200 mb-1">
                  Allow New User Registrations
                </label>
                <p className="text-sm text-dark-400">
                  When disabled, new users cannot sign up. Existing users can still log in.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={registrationEnabled}
                  onChange={(e) => setRegistrationEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-dark-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-accent/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
              </label>
            </div>

            <div className={`p-4 rounded-xl border ${registrationEnabled ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
              <p className={`text-sm ${registrationEnabled ? 'text-green-400' : 'text-red-400'}`}>
                {registrationEnabled 
                  ? '✓ New users can register and create accounts' 
                  : '✗ New user registration is currently disabled'}
              </p>
            </div>
          </div>
        </div>

        {/* Factory Reset - Master Only */}
        {user?.user_type === 'master' && (
          <div className="glass-card rounded-2xl p-8 border-red-500/20">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-red-400 flex items-center gap-3 tracking-tight">
                  Factory Reset
                </h2>
                <p className="text-dark-400 text-sm mt-1">Danger Zone - This action cannot be undone</p>
              </div>
            </div>

            {!showFactoryReset ? (
              <div className="space-y-4">
                <p className="text-dark-300">
                  Reset Budi Chat to its initial state. This will permanently delete:
                </p>
                <ul className="list-disc list-inside text-dark-400 space-y-1 ml-2">
                  <li>All user accounts and data</li>
                  <li>All chats, messages, and workspaces</li>
                  <li>All memories and personas</li>
                  <li>All settings and API keys</li>
                </ul>
                <p className="text-dark-300 mt-4">
                  After reset, you'll be redirected to the setup page to create a new master account.
                </p>
                <button
                  onClick={() => setShowFactoryReset(true)}
                  className="mt-6 px-6 py-3 bg-red-500/10 border border-red-500/50 text-red-400 hover:bg-red-500/20 rounded-xl font-semibold transition-all duration-200 flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Initiate Factory Reset
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                  <p className="text-red-300 font-medium mb-2">Are you absolutely sure?</p>
                  <p className="text-dark-400 text-sm">
                    This will delete all data permanently. Type <strong className="text-red-300">RESET</strong> to confirm:
                  </p>
                </div>
                <input
                  type="text"
                  value={factoryResetConfirm}
                  onChange={(e) => setFactoryResetConfirm(e.target.value)}
                  placeholder="Type RESET to confirm"
                  className="w-full px-4 py-3 rounded-xl bg-dark-900/50 border border-red-500/30 outline-none text-dark-100 placeholder-dark-600 focus:border-red-500/50 transition-colors"
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowFactoryReset(false);
                      setFactoryResetConfirm('');
                    }}
                    className="flex-1 px-6 py-3 rounded-xl bg-dark-800 text-dark-300 hover:bg-dark-700 font-semibold transition-all duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      if (factoryResetConfirm !== 'RESET') return;
                      setFactoryResetLoading(true);
                      try {
                        const res = await fetch('/api/admin/factory-reset', {
                          method: 'POST',
                          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                        });
                        if (res.ok) {
                          localStorage.removeItem('token');
                          localStorage.removeItem('budi_accent_color_v2');
                          window.location.href = '/setup';
                        } else {
                          const data = await res.json();
                          alert(data.error || 'Factory reset failed');
                          setFactoryResetLoading(false);
                        }
                      } catch (error) {
                        console.error('Factory reset error:', error);
                        alert('Failed to perform factory reset');
                        setFactoryResetLoading(false);
                      }
                    }}
                    disabled={factoryResetConfirm !== 'RESET' || factoryResetLoading}
                    className="flex-1 px-6 py-3 bg-red-500 hover:bg-red-600 disabled:bg-red-500/50 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2"
                  >
                    {factoryResetLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                        Resetting...
                      </>
                    ) : (
                      <>
                        <RotateCcw className="w-4 h-4" />
                        Confirm Reset
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default Admin;
