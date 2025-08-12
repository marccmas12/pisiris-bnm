import React, { useRef, useEffect } from 'react';
import './DropdownMenu.css';

interface DropdownMenuItem {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  danger?: boolean;
}

interface DropdownMenuProps {
  trigger: React.ReactNode;
  items: DropdownMenuItem[];
  isOpen: boolean;
  onToggle: () => void;
  className?: string;
}

const DropdownMenu: React.FC<DropdownMenuProps> = ({
  trigger,
  items,
  isOpen,
  onToggle,
  className = ''
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onToggle();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onToggle]);

  const handleItemClick = (item: DropdownMenuItem) => {
    item.onClick();
    onToggle();
  };

  return (
    <div className={`dropdown-menu ${className}`} ref={dropdownRef}>
      <div className="dropdown-trigger" onClick={onToggle}>
        {trigger}
      </div>
      
      {isOpen && (
        <div className="dropdown-content">
          {items.map((item, index) => (
            <div
              key={index}
              className={`dropdown-item ${item.danger ? 'dropdown-item-danger' : ''}`}
              onClick={() => handleItemClick(item)}
            >
              {item.icon && <span className="dropdown-item-icon">{item.icon}</span>}
              <span className="dropdown-item-label">{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DropdownMenu; 