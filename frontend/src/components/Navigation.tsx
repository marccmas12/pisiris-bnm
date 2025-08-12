import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, LogOut } from 'lucide-react';
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

  return (
    <>
      <nav className="navigation">
        <div className="nav-container">
          <div className="nav-brand">
            <h1 onClick={() => navigate('/tickets')} className="brand-title">
              Gestor d'incidències i suggeriments
            </h1>
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