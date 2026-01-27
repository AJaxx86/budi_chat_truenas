import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Users, Settings, Plus, Trash2, Edit2,
  Save, X, Shield, Key, Eye, EyeOff, CheckCircle, XCircle,
  Zap, Coins, RotateCcw
} from 'lucide-react';

function Admin() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(false);
  const [showNewUser, setShowNewUser] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [showDefaultKey, setShowDefaultKey] = useState(false);
  const [defaultApiKey, setDefaultApiKey] = useState('');

  const [userForm, setUserForm] = useState({
    email: '',
    password: '',
    name: '',
    is_admin: false,
    use_default_key: false
  });

  const [titleGenerationModel, setTitleGenerationModel] = useState('google/gemini-2.5-flash-lite');
  const [globalSystemPrompt, setGlobalSystemPrompt] = useState('');

  useEffect(() => {
    loadUsers();
    loadSettings();
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
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
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
          global_system_prompt: globalSystemPrompt
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
        is_admin: false,
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
      is_admin: !!user.is_admin,
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
      is_admin: false,
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

              <button
                onClick={handleSaveSettings}
                disabled={loading}
                className="btn-primary px-6 py-3 rounded-xl font-semibold transition-all duration-200 disabled:opacity-50 flex items-center gap-2"
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
                  <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl hover:bg-dark-700/30 transition-colors">
                    <input
                      type="checkbox"
                      checked={userForm.is_admin}
                      onChange={(e) => setUserForm({ ...userForm, is_admin: e.target.checked })}
                      className="w-4 h-4 rounded"
                    />
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-secondary" />
                      <span className="text-sm font-medium text-dark-200">Admin Privileges</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl hover:bg-dark-700/30 transition-colors">
                    <input
                      type="checkbox"
                      checked={userForm.use_default_key}
                      onChange={(e) => setUserForm({ ...userForm, use_default_key: e.target.checked })}
                      className="w-4 h-4 rounded"
                    />
                    <div className="flex items-center gap-2">
                      <Key className="w-4 h-4 text-dark-400" />
                      <span className="text-sm font-medium text-dark-200">Can Use Default API Key</span>
                    </div>
                  </label>
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
                        {user.is_admin === 1 && (
                          <span className="flex items-center gap-1 px-2.5 py-1 bg-secondary-10 text-secondary rounded-full text-xs font-medium border border-secondary-20">
                            <Shield className="w-3 h-3" />
                            Admin
                          </span>
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
        </div>
      </div>
    </div>
  );
}

export default Admin;
