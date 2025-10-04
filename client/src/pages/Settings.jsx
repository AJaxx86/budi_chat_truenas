import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Key, User, Save, Eye, EyeOff } from 'lucide-react';
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

  useEffect(() => {
    loadUserData();
  }, []);

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
          <h1 className="text-3xl font-bold gradient-text mb-2">Settings</h1>
          <p className="text-gray-600 mb-8">Manage your profile and API configuration</p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6">
              {success}
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-6">
            {/* Profile Section */}
            <div className="border-b border-gray-200 pb-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-primary-500" />
                Profile Information
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={user?.email}
                    disabled
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">Email cannot be changed</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                    placeholder="Leave blank to keep current password"
                  />
                </div>
              </div>
            </div>

            {/* API Key Section */}
            <div className="pb-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Key className="w-5 h-5 text-accent-500" />
                OpenRouter API Key
              </h2>

              {user?.use_default_key ? (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-blue-800 text-sm">
                    ✨ You are currently using the default API key set by the administrator.
                    You can still set your own API key to override this.
                  </p>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                  <p className="text-amber-800 text-sm">
                    ⚠️ You need to set your own API key or ask an administrator to enable the default key for you.
                  </p>
                </div>
              )}

              {hasApiKey && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between">
                    <p className="text-green-800 text-sm">
                      ✅ You have configured your personal API key
                    </p>
                    <button
                      type="button"
                      onClick={removeApiKey}
                      className="text-sm text-red-600 hover:text-red-700 font-medium"
                    >
                      Remove Key
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  {hasApiKey ? 'Update API Key' : 'Set API Key'}
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none font-mono text-sm"
                    placeholder="sk-..."
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showApiKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  Your API key is stored securely and encrypted. Get one at{' '}
                  <a
                    href="https://openrouter.ai/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-600 hover:underline"
                  >
                    OpenRouter
                  </a>
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full gradient-primary text-white py-3 rounded-lg font-medium hover:shadow-lg hover:shadow-primary-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
