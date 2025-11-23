import React from 'react';
import './Toggle.css';

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  id?: string;
}

const Toggle: React.FC<ToggleProps> = ({
  checked,
  onChange,
  label,
  disabled = false,
  id,
}) => {
  return (
    <div className="toggle-container">
      <label htmlFor={id} className="toggle-label">
        <span className="toggle-text">{label}</span>
        <div className="toggle-switch-wrapper">
          <input
            type="checkbox"
            id={id}
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            disabled={disabled}
            className="toggle-input"
          />
          <span className={`toggle-slider ${checked ? 'checked' : ''}`}></span>
        </div>
      </label>
    </div>
  );
};

export default Toggle;

