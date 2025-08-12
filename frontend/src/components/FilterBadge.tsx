import React from 'react';
import { X } from 'lucide-react';
import { FilterValues } from './FilterDialog';
import { Status, Crit, Center, Tool } from '../types';
import './FilterBadge.css';

interface FilterBadgeProps {
  filters: FilterValues;
  referenceData: {
    statuses: Status[];
    crits: Crit[];
    centers: Center[];
    tools: Tool[];
  };
  onRemoveFilter: (filterKey: keyof FilterValues) => void;
  onClearAll: () => void;
}

const FilterBadge: React.FC<FilterBadgeProps> = ({
  filters,
  referenceData,
  onRemoveFilter,
  onClearAll
}) => {
  const getFilterLabel = (key: keyof FilterValues, value: any): string => {
    switch (key) {
      case 'status_id':
        const status = referenceData.statuses.find(s => s.id === value);
        return `Estat: ${status?.desc || 'Desconegut'}`;
      case 'crit_id':
        const crit = referenceData.crits.find(c => c.id === value);
        return `Prioritat: ${crit?.desc || 'Desconegut'}`;
      case 'tool_id':
        const tool = referenceData.tools.find(t => t.id === value);
        return `Eina: ${tool?.desc || 'Desconegut'}`;
      case 'center_id':
        const center = referenceData.centers.find(c => c.id === value);
        return `Centre: ${center?.desc || 'Desconegut'}`;
      case 'date_from':
        return `Des de: ${new Date(value).toLocaleDateString()}`;
      case 'date_to':
        return `Fins a: ${new Date(value).toLocaleDateString()}`;
      default:
        return `${key}: ${value}`;
    }
  };

  const activeFilters = Object.entries(filters).filter(([_, value]) => value !== undefined);

  if (activeFilters.length === 0) {
    return null;
  }

  return (
    <div className="filter-badges-container">
      <div className="filter-badges">
        {activeFilters.map(([key, value]) => (
          <div key={key} className="filter-badge">
            <span className="filter-badge-text">
              {getFilterLabel(key as keyof FilterValues, value)}
            </span>
            <button
              className="filter-badge-remove"
              onClick={() => onRemoveFilter(key as keyof FilterValues)}
              title="Eliminar filtre"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
      <button className="clear-filters-button" onClick={onClearAll}>
        Netejar tots
      </button>
    </div>
  );
};

export default FilterBadge; 