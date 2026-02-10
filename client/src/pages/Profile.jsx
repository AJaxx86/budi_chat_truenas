import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, BarChart2, Settings } from 'lucide-react';
import { AuthContext } from '../contexts/AuthContext';
import ProfileTab from '../components/ProfileTab';
import StatsTab from '../components/StatsTab';
import SettingsTab from '../components/SettingsTab';

function Profile() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('profile');

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'stats', label: 'Stats', icon: BarChart2 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen min-h-[100dvh] bg-dark-950 bg-mesh">
      <div className="max-w-6xl mx-auto p-6">
        <button
          onClick={() => navigate('/')}
          className="mb-6 flex items-center gap-2 text-dark-400 hover:text-dark-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Chat
        </button>

        <div className="flex gap-6">
          {/* Sidebar */}
          <div className="w-56 shrink-0">
            <div className="glass-card rounded-2xl p-4 sticky top-6">
              <h1 className="text-xl font-bold text-accent mb-4 px-2 tracking-tight">Account</h1>
              <nav className="space-y-1">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${activeTab === tab.id
                          ? 'bg-accent text-white'
                          : 'text-dark-300 hover:text-dark-100 hover:bg-dark-700/50'
                        }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="font-medium">{tab.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 min-w-0">
            <div className="glass-card rounded-2xl p-8">
              {activeTab === 'profile' && <ProfileTab user={user} />}
              {activeTab === 'stats' && <StatsTab />}
              {activeTab === 'settings' && <SettingsTab user={user} logout={logout} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Profile;
