import React, { useState, useEffect } from 'react';
import { User, Mail, Lock, Save } from 'lucide-react';

function ProfileTab({ user }) {
  const [name, setName] = useState(user?.name || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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
    } catch (error) {
      console.error('Failed to load user data:', error);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password && password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      const updates = { name };

      if (password) {
        updates.password = password;
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
      setConfirmPassword('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-dark-100 mb-2 tracking-tight">Profile Information</h2>
      <p className="text-dark-400 mb-6">Update your personal information and password</p>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl mb-6 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-500/10 border border-green-500/20 text-green-400 px-4 py-3 rounded-xl mb-6 text-sm">
          {success}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-dark-300 mb-2 flex items-center gap-2">
            <User className="w-4 h-4 text-accent" />
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-3 rounded-xl glass-input outline-none text-dark-100"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-dark-300 mb-2 flex items-center gap-2">
            <Mail className="w-4 h-4 text-accent" />
            Email
          </label>
          <input
            type="email"
            value={user?.email || ''}
            disabled
            className="w-full px-4 py-3 rounded-xl bg-dark-800/30 border border-dark-700/50 text-dark-500"
          />
          <p className="mt-1.5 text-xs text-dark-500">Email cannot be changed</p>
        </div>

        <div className="border-t border-dark-700/50 pt-6">
          <h3 className="text-lg font-semibold text-dark-100 mb-4 flex items-center gap-2">
            <Lock className="w-4 h-4 text-accent-400" />
            Change Password
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">
                New Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl glass-input outline-none text-dark-100"
                placeholder="Leave blank to keep current password"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl glass-input outline-none text-dark-100"
                placeholder="Confirm new password"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full py-3 rounded-xl font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
  );
}

export default ProfileTab;
