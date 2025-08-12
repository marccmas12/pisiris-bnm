import React from 'react';
import './Avatar.css';

interface AvatarProps {
  user: {
    name?: string;
    surnames?: string;
    username: string;
  };
  size?: 'small' | 'medium' | 'large';
  onClick?: () => void;
  className?: string;
}

const Avatar: React.FC<AvatarProps> = ({ 
  user, 
  size = 'medium', 
  onClick, 
  className = '' 
}) => {
  const getInitials = () => {
    if (user.name && user.surnames) {
      return `${user.name.charAt(0)}${user.surnames.charAt(0)}`.toUpperCase();
    } else if (user.name) {
      return user.name.charAt(0).toUpperCase();
    } else if (user.surnames) {
      return user.surnames.charAt(0).toUpperCase();
    } else {
      return user.username.charAt(0).toUpperCase();
    }
  };

  const getDisplayName = () => {
    if (user.name && user.surnames) {
      return `${user.name} ${user.surnames}`;
    } else if (user.name) {
      return user.name;
    } else if (user.surnames) {
      return user.surnames;
    } else {
      return user.username;
    }
  };

  return (
    <div 
      className={`avatar avatar-${size} ${onClick ? 'avatar-clickable' : ''} ${className}`}
      onClick={onClick}
      title={getDisplayName()}
    >
      <span className="avatar-initials">{getInitials()}</span>
    </div>
  );
};

export default Avatar; 