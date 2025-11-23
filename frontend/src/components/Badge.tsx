import React from 'react';
import { X } from 'lucide-react';
import './Badge.css';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'solid' | 'outlined';
  color?: 'gray' | 'blue' | 'green' | 'red' | 'purple' | 'magenta' | 'yellow' | 'orange' | 'black' | string;
  size?: 'sm' | 'md' | 'lg';
  onRemove?: () => void;
  className?: string;
  // Convenience props for common badge types
  type?: 'status' | 'permission' | 'user-status' | 'ticket-type' | 'criticity';
  value?: string | number; // For type-based auto-configuration
}

const Badge: React.FC<BadgeProps> = ({
  children,
  variant,
  color,
  size = 'md',
  onRemove,
  className = '',
  type,
  value,
}) => {
  // Auto-configure variant and color based on type and value
  const getTypeConfig = (): { variant: 'solid' | 'outlined'; color: string } => {
    if (type === 'status') {
      const statusValue = String(value || '').toLowerCase();
      let variant: 'solid' | 'outlined' = 'outlined';
      let color = 'gray';
      
      if (statusValue === 'created' || statusValue === 'reviewed' || statusValue === 'reopened') {
        color = 'gray';
      } else if (statusValue === 'notified' || statusValue === 'resolving') {
        color = 'blue';
      } else if (statusValue === 'solved') {
        color = 'green';
      } else if (statusValue === 'closed') {
        color = 'black';
        variant = 'solid';
      } else if (statusValue === 'deleted' || statusValue === 'discarted') {
        color = 'red';
      } else if (statusValue === 'on_hold') {
        color = 'yellow';
      }
      
      return { variant, color };
    }
    
    if (type === 'permission') {
      const level = Number(value);
      const variant = 'solid';
      let color = 'gray';
      
      if (level === 1) color = 'purple';
      else if (level === 2) color = 'magenta';
      else if (level === 3) color = 'blue';
      else if (level === 4) color = 'gray';
      
      return { variant, color };
    }
    
    if (type === 'user-status') {
      const statusValue = String(value || '').toLowerCase();
      const variant = 'solid';
      let color = statusValue === 'active' ? 'green' : 'red';
      return { variant, color };
    }
    
    if (type === 'ticket-type') {
      const typeValue = String(value || '').toLowerCase();
      const variant = 'solid';
      let color = typeValue === 'incidence' ? 'red' : 'blue';
      return { variant, color };
    }
    
    if (type === 'criticity') {
      const critValue = String(value || '').toLowerCase();
      const variant = 'outlined';
      let color = 'gray';
      
      if (critValue === 'low') color = 'gray';
      else if (critValue === 'mid') color = 'yellow';
      else if (critValue === 'high') color = 'orange';
      else if (critValue === 'critical') color = 'red';
      
      return { variant, color };
    }
    
    // Default
    return { variant: 'outlined', color: 'gray' };
  };

  // Use type-based config if type is provided, otherwise use explicit props
  const typeConfig = type ? getTypeConfig() : null;
  const finalVariant = variant || typeConfig?.variant || 'outlined';
  const finalColor = color || typeConfig?.color || 'gray';

  // Check if color is a custom hex color
  const isCustomColor = finalColor && !['gray', 'blue', 'green', 'red', 'purple', 'magenta', 'yellow', 'orange', 'black'].includes(finalColor);

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onRemove) {
      onRemove();
    }
  };

  const badgeClasses = [
    'badge',
    `badge-${finalVariant}`,
    `badge-${size}`,
    isCustomColor ? 'badge-custom' : `badge-${finalColor}`,
    className,
  ].filter(Boolean).join(' ');

  const customColorStyle = isCustomColor ? {
    '--badge-color': finalColor,
  } as React.CSSProperties : {};

  return (
    <span className={badgeClasses} style={customColorStyle}>
      <span className="badge-content">{children}</span>
      {onRemove && (
        <button
          type="button"
          className="badge-remove"
          onClick={handleRemove}
          aria-label="Remove"
          title="Eliminar"
        >
          <X size={12} />
        </button>
      )}
    </span>
  );
};

export default Badge;

