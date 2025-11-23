import React from 'react';
import { Star } from 'lucide-react';
import './StarRating.css';

export interface StarRatingProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  label?: string;
}

const StarRating: React.FC<StarRatingProps> = ({
  value,
  onChange,
  disabled = false,
  label,
}) => {
  const handleStarClick = (starValue: number) => {
    if (!disabled) {
      onChange(starValue);
    }
  };

  const getLabel = (starValue: number): string => {
    switch (starValue) {
      case 1:
        return 'Baixa';
      case 2:
        return 'Mitja';
      case 3:
        return 'Alta';
      case 4:
        return 'Crítica';
      default:
        return '';
    }
  };

  return (
    <div className="star-rating-container">
      {label && <label className="star-rating-label">{label}</label>}
      <div className="star-rating-wrapper">
        <div className="star-rating-stars">
          {[1, 2, 3, 4].map((starValue) => (
            <button
              key={starValue}
              type="button"
              className={`star-button ${value >= starValue ? 'active' : ''}`}
              onClick={() => handleStarClick(starValue)}
              disabled={disabled}
              title={`${starValue} estrella${starValue > 1 ? 's' : ''} - ${getLabel(starValue)}`}
            >
              <Star
                size={32}
                fill={value >= starValue ? '#fbbf24' : 'none'}
                stroke={value >= starValue ? '#fbbf24' : '#d1d5db'}
              />
            </button>
          ))}
        </div>
        <span className="star-rating-label-text">
          {value > 0 ? getLabel(value) : 'Selecciona prioritat'}
        </span>
      </div>
      <small className="star-rating-help">
        1 estrella = Baixa criticitat | 4 estrelles = Crítica
      </small>
    </div>
  );
};

export default StarRating;

