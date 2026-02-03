import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Key, Eye, EyeOff, Trash2, AlertTriangle, Shield, Save, ExternalLink, Palette, User, ChevronRight } from 'lucide-react';

const ACCENT_PRESETS = [
  { id: 'amber', name: 'Amber', color: 'hsl(38, 92%, 50%)' },
  { id: 'blue', name: 'Blue', color: 'hsl(217, 91%, 60%)' },
  { id: 'green', name: 'Green', color: 'hsl(142, 71%, 45%)' },
  { id: 'purple', name: 'Purple', color: 'hsl(262, 83%, 58%)' },
  { id: 'rose', name: 'Rose', color: 'hsl(350, 89%, 60%)' },
  { id: 'cyan', name: 'Cyan', color: 'hsl(186, 94%, 42%)' },
];

function SettingsTab({ user, logout }) {
  const navigate = useNavigate();
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [accentColor, setAccentColor] = useState(user?.accent_color || 'amber');
  const [showRecentPersonas, setShowRecentPersonas] = useState(user?.show_recent_personas || false);

  useEffect(() => {
    loadUserData();
    // Apply accent color from user data on mount
    if (user?.accent_color) {
      document.documentElement.setAttribute('data-accent', user.accent_color);
    }
  }, [user]);

  const loadUserData = async () => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      setHasApiKey(!!data.has_api_key);
      if (data.accent_color) {
        setAccentColor(data.accent_color);
      }
      setShowRecentPersonas(!!data.show_recent_personas);
    } catch (error) {
      console.error('Failed to load user data:', error);
    }
  };

  const handleAccentChange = async (presetId) => {
    setAccentColor(presetId);
    document.documentElement.setAttribute('data-accent', presetId);
    // Cache to localStorage for instant apply on page load
    localStorage.setItem('budi_accent_color_v2', presetId);

    try {
      await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ accent_color: presetId })
      });
    } catch (error) {
      console.error('Failed to save accent color:', error);
    }
  };

  const handleShowRecentPersonasChange = async (enabled) => {
    setShowRecentPersonas(enabled);

    try {
      await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ show_recent_personas: enabled })
      });
    } catch (error) {
      console.error('Failed to save personas setting:', error);
    }
  };

  const handleSaveApiKey = async (e) => {
    e.preventDefault();
    if (!apiKey.trim()) return;

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ openai_api_key: apiKey })
      });

      if (!res.ok) {
        throw new Error('Failed to save API key');
      }

      setSuccess('API key saved successfully!');
      setApiKey('');
      setHasApiKey(true);
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

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      setDeleteError('Please enter your password');
      return;
    }

    setDeleteLoading(true);
    setDeleteError('');

    try {
      const res = await fetch('/api/auth/profile', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ password: deletePassword })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete account');
      }

      logout();
      navigate('/login');
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-dark-100 mb-2 tracking-tight">Settings</h2>
        <p className="text-dark-400 mb-6">Manage your preferences and account</p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-500/10 border border-green-500/20 text-green-400 px-4 py-3 rounded-xl text-sm">
          {success}
        </div>
      )}

      {/* Visuals Section */}
      <section className="border-b border-dark-700/50 pb-8">
        <h3 className="text-xl font-semibold mb-4 flex items-center gap-2 text-dark-100">
          <Palette className="w-5 h-5 text-dark-400" />
          Visuals
        </h3>

        <div>
          <label className="block text-sm font-medium text-dark-300 mb-3">
            Accent Color
          </label>
          <div className="flex flex-wrap gap-3">
            {ACCENT_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => handleAccentChange(preset.id)}
                className={`group relative flex flex-col items-center gap-2 p-3 rounded-lg transition-all duration-200 ${accentColor === preset.id
                    ? 'bg-dark-700/60 ring-1 ring-dark-600'
                    : 'hover:bg-dark-800/40'
                  }`}
              >
                <div
                  className={`w-8 h-8 rounded-full transition-transform duration-200 ${accentColor === preset.id ? 'scale-110' : 'group-hover:scale-105'
                    }`}
                  style={{ backgroundColor: preset.color }}
                />
                <span className={`text-xs font-medium ${accentColor === preset.id ? 'text-dark-200' : 'text-dark-500'
                  }`}>
                  {preset.name}
                </span>
              </button>
            ))}
          </div>
          <p className="text-xs text-dark-600 mt-3">
            Changes the accent color used for buttons and highlights
          </p>
        </div>
      </section>

      {/* Personas Section */}
      <section className="border-b border-dark-700/50 pb-8">
        <h3 className="text-xl font-semibold mb-4 flex items-center gap-2 text-dark-100">
          <User className="w-5 h-5 text-dark-400" />
          Personas
        </h3>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-dark-300">
                Show Recent Personas
              </label>
              <p className="text-xs text-dark-500 mt-1">
                Display recently used personas at the top of the selector
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleShowRecentPersonasChange(!showRecentPersonas)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                showRecentPersonas ? 'bg-accent' : 'bg-dark-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  showRecentPersonas ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <Link
            to="/personas"
            className="flex items-center justify-between px-4 py-3 rounded-xl glass-button text-dark-300 hover:text-dark-100 transition-colors"
          >
            <span className="font-medium">Manage Personas</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* API Key Section */}
      <section className="border-b border-dark-700/50 pb-8">
        <h3 className="text-xl font-semibold mb-4 flex items-center gap-2 text-dark-100">
          <Key className="w-5 h-5 text-dark-400" />
          OpenRouter API Key
        </h3>

        {user?.use_default_key ? (
          <div className="bg-dark-800/40 border border-dark-700/40 rounded-xl p-4 mb-4">
            <p className="text-dark-400 text-sm">
              You are currently using the default API key set by the administrator.
              You can still set your own API key to override this.
            </p>
          </div>
        ) : (
          <div className="bg-dark-800/40 border border-dark-700/40 rounded-xl p-4 mb-4">
            <p className="text-dark-400 text-sm">
              You need to set your own API key or ask an administrator to enable the default key for you.
            </p>
          </div>
        )}

        {hasApiKey && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between">
              <p className="text-green-400 text-sm">
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

        <form onSubmit={handleSaveApiKey} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">
              {hasApiKey ? 'Update API Key' : 'Set API Key'}
            </label>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full px-4 py-3 pr-12 rounded-xl glass-input outline-none font-mono text-sm text-dark-100"
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
            <p className="text-xs text-dark-500 mt-2 flex items-center gap-1">
              Get your API key at{' '}
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-dark-400 hover:text-dark-300 underline inline-flex items-center gap-1"
              >
                OpenRouter
                <ExternalLink className="w-3 h-3" />
              </a>
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || !apiKey.trim()}
            className="btn-primary px-6 py-3 rounded-xl font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-current border-t-transparent"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Save API Key
              </>
            )}
          </button>
        </form>
      </section>

      {/* Danger Zone */}
      <section>
        <h3 className="text-xl font-semibold mb-4 flex items-center gap-2 text-red-400">
          <AlertTriangle className="w-5 h-5" />
          Danger Zone
        </h3>

        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6">
          <h4 className="font-semibold text-red-400 mb-2">Delete Account</h4>
          <p className="text-sm text-dark-400 mb-4">
            This action cannot be undone. All your chats, messages, and memories will be permanently deleted.
          </p>

          {user?.is_admin ? (
            <div className="flex items-center gap-2 text-sm text-dark-400 bg-dark-800/50 p-3 rounded-lg">
              <Shield className="w-4 h-4" />
              Admin accounts cannot be deleted
            </div>
          ) : (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl font-medium transition-colors flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Delete Account
            </button>
          )}
        </div>
      </section>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-dark-950/80 backdrop-blur-md flex items-center justify-center z-50 scale-in">
          <div className="glass-modal rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
            <h3 className="text-xl font-bold text-red-400 mb-2 flex items-center gap-2">
              <AlertTriangle className="w-6 h-6" />
              Confirm Account Deletion
            </h3>
            <p className="text-dark-400 mb-6">
              Please enter your password to confirm. This action is irreversible and will delete all your data.
            </p>

            {deleteError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl mb-4 text-sm">
                {deleteError}
              </div>
            )}

            <input
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full px-4 py-3 rounded-xl glass-input outline-none text-dark-100 mb-4"
              autoFocus
            />

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeletePassword('');
                  setDeleteError('');
                }}
                className="flex-1 px-4 py-3 glass-button rounded-xl text-dark-300 hover:text-dark-100 font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={!deletePassword || deleteLoading}
                className="flex-1 px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {deleteLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete Forever
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SettingsTab;

