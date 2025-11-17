import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Settings, LogOut, LayoutGrid } from 'lucide-react';
import { User } from '../types';
import Avatar from './Avatar';
import DropdownMenu from './DropdownMenu';
import UserConfigModal from './UserConfigModal';
import './Navigation.css';

interface NavigationProps {
  user: User;
  onLogout: () => void;
  onUserUpdated?: (updatedUser: User) => void;
}

const Navigation: React.FC<NavigationProps> = ({ user, onLogout, onUserUpdated }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

  const handleLogout = () => {
    onLogout();
    navigate('/login');
  };

  const handleConfigClick = () => {
    setIsConfigModalOpen(true);
    setIsDropdownOpen(false);
  };

  const handleUserUpdated = (updatedUser: User) => {
    if (onUserUpdated) {
      onUserUpdated(updatedUser);
    }
  };

  const dropdownItems = [
    {
      label: 'Configuració',
      onClick: handleConfigClick,
      icon: <Settings size={16} />
    },
    {
      label: 'Sortir',
      onClick: handleLogout,
      icon: <LogOut size={16} />,
      danger: true
    }
  ];

  // Determine active tab based on current route
  const getActiveTab = () => {
    if (location.pathname.startsWith('/users')) {
      return 'users';
    }
    // For ticket routes, check the type parameter
    if (location.pathname.startsWith('/tickets')) {
      const searchParams = new URLSearchParams(location.search);
      const type = searchParams.get('type');
      if (type === 'suggestion') {
        return 'suggestions';
      }
      return 'incidences';
    }
    // Default to incidences
    return 'incidences';
  };

  const activeTab = getActiveTab();

  const handleTabClick = (tab: 'incidences' | 'suggestions' | 'users') => {
    if (tab === 'users') {
      navigate('/users');
    } else {
      // Preserve existing query parameters when switching tabs
      const searchParams = new URLSearchParams(location.search);
      searchParams.set('type', tab === 'incidences' ? 'incidence' : 'suggestion');
      // Reset to page 1 when switching tabs
      searchParams.delete('page');
      navigate(`/tickets?${searchParams.toString()}`);
    }
  };

  return (
    <>
      <nav className="navigation">
        <div className="nav-container">
          <div className="nav-brand">
            <div className="brand-icon" onClick={() => navigate('/dashboard')}>
              <LayoutGrid size={24} />
            </div>
            <div className="nav-tabs">
              <button
                className={`nav-tab ${activeTab === 'incidences' ? 'active' : ''}`}
                onClick={() => handleTabClick('incidences')}
              >
                Incidències
              </button>
              <button
                className={`nav-tab ${activeTab === 'suggestions' ? 'active' : ''}`}
                onClick={() => handleTabClick('suggestions')}
              >
                Suggeriments
              </button>
              {user.permission_level === 1 && (
                <button
                  className={`nav-tab ${activeTab === 'users' ? 'active' : ''}`}
                  onClick={() => handleTabClick('users')}
                >
                  Usuaris
                </button>
              )}
            </div>
          </div>

          <div className="nav-user">
            <div className="user-greeting">
              <span className="greeting-text">Hola, {user.username}</span>
            </div>

            <DropdownMenu
              trigger={
                <div className="user-avatar-container">
                  <Avatar user={user} size="medium" />
                </div>
              }
              items={dropdownItems}
              isOpen={isDropdownOpen}
              onToggle={() => setIsDropdownOpen(!isDropdownOpen)}
              className="user-dropdown"
            />
          </div>
        </div>
      </nav>

      <UserConfigModal
        user={user}
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        onUserUpdated={handleUserUpdated}
      />
    </>
  );
};

export default Navigation; 