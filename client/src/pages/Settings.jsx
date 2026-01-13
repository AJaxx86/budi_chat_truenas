import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Key, User, Save, Eye, EyeOff, BarChart2, Coins, Zap, Calendar, TrendingUp } from 'lucide-react';
import { AuthContext } from '../contexts/AuthContext';

function Settings() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [name, setName] = useState(user?.name || '');
  const [password, setPassword] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [stats, setStats] = useState(null);

  useEffect(() => {
    loadUserData();
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const res = await fetch('/api/stats', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const loadUserData = async () => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      setName(data.name);
      setHasApiKey(!!data.has_api_key);
    } catch (error) {
      console.error('Failed to load user data:', error);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const updates = { name };

      if (password) {
        updates.password = password;
      }

      if (apiKey) {
        updates.openai_api_key = apiKey;
      }

      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(updates)
      });

      if (!res.ok) {
        throw new Error('Failed to update profile');
      }

      setSuccess('Profile updated successfully!');
      setPassword('');
      setApiKey('');
      if (apiKey) {
        setHasApiKey(true);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const removeApiKey = async () => {
    if (!confirm('Are you sure you want to remove your API key?')) return;

    try {
      await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ openai_api_key: null })
      });
      setHasApiKey(false);
      setSuccess('API key removed successfully');
    } catch (error) {
      setError('Failed to remove API key');
    }
  };

  return (
    <div className="min-h-screen bg-dark-950 bg-mesh">
      <div className="max-w-4xl mx-auto p-6">
        <button
          onClick={() => navigate('/')}
          className="mb-6 flex items-center gap-2 text-dark-400 hover:text-dark-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Chat
        </button>

        <div className="glass-card rounded-2xl p-8">
          <h1 className="text-3xl font-bold gradient-text mb-2">Settings</h1>
          <p className="text-dark-400 mb-8">Manage your profile and API configuration</p>

          {error && (
            <div className="bg-red-500/20 border border-red-500/30 text-red-300 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-500/20 border border-green-500/30 text-green-300 px-4 py-3 rounded-lg mb-6">
              {success}
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-6">
            {/* Profile Section */}
            <div className="border-b border-dark-700/50 pb-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-dark-100">
                <User className="w-5 h-5 text-primary-400" />
                Profile Information
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg glass-input outline-none text-dark-100 bg-dark-800/50"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={user?.email}
                    disabled
                    className="w-full px-4 py-3 rounded-lg bg-dark-800/30 border border-dark-700/50 text-dark-500"
                  />
                  <p className="mt-1 text-xs text-dark-500">Email cannot be changed</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg glass-input outline-none text-dark-100 bg-dark-800/50"
                    placeholder="Leave blank to keep current password"
                  />
                </div>
              </div>
            </div>

            {/* API Key Section */}
            <div className="pb-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-dark-100">
                <Key className="w-5 h-5 text-accent-400" />
                OpenRouter API Key
              </h2>

              {user?.use_default_key ? (
                <div className="bg-primary-500/20 border border-primary-500/30 rounded-lg p-4 mb-4">
                  <p className="text-primary-300 text-sm">
                    You are currently using the default API key set by the administrator.
                    You can still set your own API key to override this.
                  </p>
                </div>
              ) : (
                <div className="bg-amber-500/20 border border-amber-500/30 rounded-lg p-4 mb-4">
                  <p className="text-amber-300 text-sm">
                    You need to set your own API key or ask an administrator to enable the default key for you.
                  </p>
                </div>
              )}

              {hasApiKey && (
                <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between">
                    <p className="text-green-300 text-sm">
                      You have configured your personal API key
                    </p>
                    <button
                      type="button"
                      onClick={removeApiKey}
                      className="text-sm text-red-400 hover:text-red-300 font-medium"
                    >
                      Remove Key
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="block text-sm font-medium text-dark-200">
                  {hasApiKey ? 'Update API Key' : 'Set API Key'}
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="w-full px-4 py-3 pr-12 rounded-lg glass-input outline-none font-mono text-sm text-dark-100 bg-dark-800/50"
                    placeholder="sk-..."
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-dark-200"
                  >
                    {showApiKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <p className="text-xs text-dark-500">
                  Your API key is stored securely and encrypted. Get one at{' '}
                  <a
                    href="https://openrouter.ai/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-400 hover:underline"
                  >
                    OpenRouter
                  </a>
                </p>
              </div>
            </div>

            {/* Statistics Section */}
            {stats && (
              <div className="pb-6">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-dark-100">
                  <BarChart2 className="w-5 h-5 text-secondary-400" />
                  Usage Statistics
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <div className="bg-dark-800/50 p-4 rounded-lg border border-dark-700/50">
                    <div className="flex items-center gap-2 text-dark-400 mb-1 text-sm">
                      <Zap className="w-4 h-4" />
                      Total Tokens
                    </div>
                    <div className="text-2xl font-bold text-dark-100">
                      {stats.totals.total_tokens.toLocaleString()}
                    </div>
                    <div className="text-xs text-dark-500 mt-1">
                      {stats.totals.prompt_tokens.toLocaleString()} in / {stats.totals.completion_tokens.toLocaleString()} out
                    </div>
                  </div>

                  <div className="bg-dark-800/50 p-4 rounded-lg border border-dark-700/50">
                    <div className="flex items-center gap-2 text-dark-400 mb-1 text-sm">
                      <Coins className="w-4 h-4" />
                      Total Cost
                    </div>
                    <div className="text-2xl font-bold text-dark-100">
                      ${stats.totals.cost.toFixed(4)}
                    </div>
                    <div className="text-xs text-dark-500 mt-1">
                      Based on model pricing
                    </div>
                  </div>

                  <div className="bg-dark-800/50 p-4 rounded-lg border border-dark-700/50">
                    <div className="flex items-center gap-2 text-dark-400 mb-1 text-sm">
                      <Calendar className="w-4 h-4" />
                      Chattiest Day
                    </div>
                    <div className="text-xl font-bold text-dark-100 truncate">
                      {stats.fun_stats.chattiest_day ? new Date(stats.fun_stats.chattiest_day.date).toLocaleDateString() : 'N/A'}
                    </div>
                    <div className="text-xs text-dark-500 mt-1">
                      {stats.fun_stats.chattiest_day ? `${stats.fun_stats.chattiest_day.count} messages` : 'No messages yet'}
                    </div>
                  </div>

                  <div className="bg-dark-800/50 p-4 rounded-lg border border-dark-700/50">
                    <div className="flex items-center gap-2 text-dark-400 mb-1 text-sm">
                      <TrendingUp className="w-4 h-4" />
                      Avg Response
                    </div>
                    <div className="text-2xl font-bold text-dark-100">
                      {stats.totals.avg_response_time_ms}ms
                    </div>
                    <div className="text-xs text-dark-500 mt-1">
                      Per message
                    </div>
                  </div>
                </div>

                {stats.top_models.length > 0 && (
                  <div className="bg-dark-800/30 rounded-lg p-4 border border-dark-700/30">
                    <h3 className="text-sm font-medium text-dark-300 mb-3">Top Models</h3>
                    <div className="space-y-3">
                      {stats.top_models.map((model, idx) => (
                        <div key={model.model} className="flex items-center gap-3">
                          <div className="text-xs font-mono text-dark-500 w-4">{idx + 1}</div>
                          <div className="flex-1">
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-dark-200">{model.model}</span>
                              <span className="text-dark-400">{model.usage_count} uses</span>
                            </div>
                            <div className="h-1.5 bg-dark-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary-500/50 rounded-full"
                                style={{ width: `${(model.usage_count / stats.top_models[0].usage_count) * 100}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full gradient-primary text-white py-3 rounded-lg font-medium hover:shadow-glow transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Save Changes
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Settings;
