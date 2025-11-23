import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { User as UserIcon, LogOut } from 'lucide-react';
import { User } from '../types';
import Avatar from './Avatar';
import DropdownMenu from './DropdownMenu';
import logoImage from '../assets/images/group-R5.svg';
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

  const handleLogout = () => {
    onLogout();
    navigate('/login');
  };

  const handleProfileClick = () => {
    navigate('/profile');
    setIsDropdownOpen(false);
  };

  const dropdownItems = [
    {
      label: 'El meu perfil',
      onClick: handleProfileClick,
      icon: <UserIcon size={16} />
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
    // No tab selected on dashboard
    if (location.pathname === '/dashboard') {
      return null;
    }
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
    // No tab selected for other routes
    return null;
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
              <img
                src={logoImage}
                alt="Logo ICS"
                style={{ height: 32, width: 'auto', display: 'block' }}
              />
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
    </>
  );
};

export default Navigation; 