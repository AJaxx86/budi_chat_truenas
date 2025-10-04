import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Users, Settings, Plus, Trash2, Edit2, 
  Save, X, Shield, Key, Eye, EyeOff, CheckCircle, XCircle 
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
          default_openai_api_key: defaultApiKey
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
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-50">
      <div className="max-w-6xl mx-auto p-6">
        <button
          onClick={() => navigate('/')}
          className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Chat
        </button>

        <div className="space-y-6">
          {/* System Settings */}
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h2 className="text-2xl font-bold gradient-text mb-6 flex items-center gap-3">
              <Settings className="w-7 h-7" />
              System Settings
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Default OpenAI API Key
                </label>
                <p className="text-sm text-gray-600 mb-3">
                  Users with "use default key" permission will use this API key. Leave blank to disable.
                </p>
                <div className="relative">
                  <input
                    type={showDefaultKey ? 'text' : 'password'}
                    value={defaultApiKey}
                    onChange={(e) => setDefaultApiKey(e.target.value)}
                    className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none font-mono text-sm"
                    placeholder="sk-..."
                  />
                  <button
                    type="button"
                    onClick={() => setShowDefaultKey(!showDefaultKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showDefaultKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button
                onClick={handleSaveSettings}
                disabled={loading}
                className="gradient-primary text-white px-6 py-3 rounded-lg font-medium hover:shadow-lg hover:shadow-primary-500/30 transition-all disabled:opacity-50 flex items-center gap-2"
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
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold gradient-text flex items-center gap-3">
                <Users className="w-7 h-7" />
                User Management
              </h2>

              {!showNewUser && (
                <button
                  onClick={() => setShowNewUser(true)}
                  className="px-4 py-2 gradient-primary text-white rounded-lg font-medium hover:shadow-lg hover:shadow-primary-500/30 transition-all flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add User
                </button>
              )}
            </div>

            {/* New/Edit User Form */}
            {showNewUser && (
              <form onSubmit={handleUserSubmit} className="mb-8 p-6 bg-gradient-to-r from-primary-50 to-accent-50 rounded-xl border border-primary-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-lg">
                    {editingUser ? 'Edit User' : 'New User'}
                  </h3>
                  <button
                    type="button"
                    onClick={cancelUserForm}
                    className="p-1 hover:bg-white rounded transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Name
                    </label>
                    <input
                      type="text"
                      value={userForm.name}
                      onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
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
                      value={userForm.email}
                      onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                      required
                      disabled={!!editingUser}
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Password {editingUser && '(leave blank to keep current)'}
                  </label>
                  <input
                    type="password"
                    value={userForm.password}
                    onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                    required={!editingUser}
                  />
                </div>

                <div className="space-y-3 mb-4">
                  <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-white transition-colors">
                    <input
                      type="checkbox"
                      checked={userForm.is_admin}
                      onChange={(e) => setUserForm({ ...userForm, is_admin: e.target.checked })}
                      className="w-4 h-4 text-primary-600 rounded focus:ring-2 focus:ring-primary-500"
                    />
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-accent-500" />
                      <span className="text-sm font-medium text-gray-700">Admin Privileges</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-white transition-colors">
                    <input
                      type="checkbox"
                      checked={userForm.use_default_key}
                      onChange={(e) => setUserForm({ ...userForm, use_default_key: e.target.checked })}
                      className="w-4 h-4 text-primary-600 rounded focus:ring-2 focus:ring-primary-500"
                    />
                    <div className="flex items-center gap-2">
                      <Key className="w-4 h-4 text-primary-500" />
                      <span className="text-sm font-medium text-gray-700">Can Use Default API Key</span>
                    </div>
                  </label>
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
                  className="p-5 border border-gray-200 rounded-xl hover:border-primary-200 hover:shadow-md transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-lg">{user.name}</h3>
                        {user.is_admin === 1 && (
                          <span className="flex items-center gap-1 px-2.5 py-1 bg-accent-100 text-accent-700 rounded-full text-xs font-medium">
                            <Shield className="w-3 h-3" />
                            Admin
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{user.email}</p>
                      <div className="flex gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          {user.has_api_key ? (
                            <>
                              <CheckCircle className="w-3 h-3 text-green-500" />
                              Has API key
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3 text-gray-400" />
                              No API key
                            </>
                          )}
                        </span>
                        <span className="flex items-center gap-1">
                          {user.use_default_key ? (
                            <>
                              <CheckCircle className="w-3 h-3 text-primary-500" />
                              Can use default key
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3 text-gray-400" />
                              Cannot use default key
                            </>
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditUser(user)}
                        className="p-2 hover:bg-primary-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4 text-primary-600" />
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
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
