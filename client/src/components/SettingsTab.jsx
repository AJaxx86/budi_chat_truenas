import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Key, Eye, EyeOff, Trash2, AlertTriangle, Shield, Save, ExternalLink } from 'lucide-react';

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

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      setHasApiKey(!!data.has_api_key);
    } catch (error) {
      console.error('Failed to load user data:', error);
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
        <h2 className="text-2xl font-bold text-dark-100 mb-2">Settings</h2>
        <p className="text-dark-400 mb-6">Manage your API key and account</p>
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-500/30 text-red-300 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-500/20 border border-green-500/30 text-green-300 px-4 py-3 rounded-lg">
          {success}
        </div>
      )}

      {/* API Key Section */}
      <section className="border-b border-dark-700/50 pb-8">
        <h3 className="text-xl font-semibold mb-4 flex items-center gap-2 text-dark-100">
          <Key className="w-5 h-5 text-accent-400" />
          OpenRouter API Key
        </h3>

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

        <form onSubmit={handleSaveApiKey} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-200 mb-2">
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
            <p className="text-xs text-dark-500 mt-2 flex items-center gap-1">
              Get your API key at{' '}
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-400 hover:underline inline-flex items-center gap-1"
              >
                OpenRouter
                <ExternalLink className="w-3 h-3" />
              </a>
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || !apiKey.trim()}
            className="gradient-primary text-white px-6 py-3 rounded-lg font-medium hover:shadow-glow transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
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

        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6">
          <h4 className="font-semibold text-red-300 mb-2">Delete Account</h4>
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
              className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg font-medium transition-colors flex items-center gap-2"
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
          <div className="glass-card rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
            <h3 className="text-xl font-bold text-red-400 mb-2 flex items-center gap-2">
              <AlertTriangle className="w-6 h-6" />
              Confirm Account Deletion
            </h3>
            <p className="text-dark-300 mb-6">
              Please enter your password to confirm. This action is irreversible and will delete all your data.
            </p>

            {deleteError && (
              <div className="bg-red-500/20 border border-red-500/30 text-red-300 px-4 py-3 rounded-lg mb-4 text-sm">
                {deleteError}
              </div>
            )}

            <input
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full px-4 py-3 rounded-lg glass-input outline-none text-dark-100 bg-dark-800/50 mb-4"
              autoFocus
            />

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeletePassword('');
                  setDeleteError('');
                }}
                className="flex-1 px-4 py-3 glass-button rounded-lg text-dark-300 hover:text-dark-100 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={!deletePassword || deleteLoading}
                className="flex-1 px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
