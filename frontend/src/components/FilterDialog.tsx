import React, { useState, useEffect } from 'react';
import { X, Filter } from 'lucide-react';
import { Status, Crit, Center, Tool } from '../types';
import { referenceAPI } from '../services/api';
import './FilterDialog.css';

export interface FilterValues {
  status_id?: number;
  crit_id?: number;
  tool_id?: number;
  center_id?: number;
  date_from?: string;
  date_to?: string;
}

interface FilterDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyFilters: (filters: FilterValues) => void;
  currentFilters: FilterValues;
}

const FilterDialog: React.FC<FilterDialogProps> = ({
  isOpen,
  onClose,
  onApplyFilters,
  currentFilters
}) => {
  const [filters, setFilters] = useState<FilterValues>(currentFilters);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [crits, setCrits] = useState<Crit[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadReferenceData();
      setFilters(currentFilters);
    }
  }, [isOpen, currentFilters]);

  const loadReferenceData = async () => {
    try {
      setLoading(true);
      const [statusesData, critsData, centersData, toolsData] = await Promise.all([
        referenceAPI.getStatuses(),
        referenceAPI.getCrits(),
        referenceAPI.getCenters(),
        referenceAPI.getTools(),
      ]);
      setStatuses(statusesData);
      setCrits(critsData);
      setCenters(centersData);
      setTools(toolsData);
    } catch (err) {
      console.error('Error loading reference data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field: keyof FilterValues, value: string | number | undefined) => {
    setFilters(prev => ({
      ...prev,
      [field]: value === '' ? undefined : value
    }));
  };

  const handleApplyFilters = () => {
    onApplyFilters(filters);
    onClose();
  };

  const handleClearFilters = () => {
    const emptyFilters: FilterValues = {};
    setFilters(emptyFilters);
    onApplyFilters(emptyFilters);
    onClose();
  };

  const handleResetFilters = () => {
    setFilters(currentFilters);
  };

  if (!isOpen) return null;

  return (
    <div className="filter-dialog-overlay">
      <div className="filter-dialog">
        <div className="filter-dialog-header">
          <div className="filter-dialog-title">
            <Filter size={20} />
            <h3>Filtres</h3>
          </div>
          <button className="close-button" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="filter-dialog-content">
          {loading ? (
            <div className="loading">Carregant dades...</div>
          ) : (
            <>
              <div className="filter-section">
                <h4>Estat</h4>
                <select
                  value={filters.status_id || ''}
                  onChange={(e) => handleFilterChange('status_id', e.target.value ? parseInt(e.target.value) : undefined)}
                >
                  <option value="">Tots els estats</option>
                  {statuses.map(status => (
                    <option key={status.id} value={status.id}>
                      {status.desc}
                    </option>
                  ))}
                </select>
              </div>

              <div className="filter-section">
                <h4>Prioritat</h4>
                <select
                  value={filters.crit_id || ''}
                  onChange={(e) => handleFilterChange('crit_id', e.target.value ? parseInt(e.target.value) : undefined)}
                >
                  <option value="">Totes les prioritats</option>
                  {crits.map(crit => (
                    <option key={crit.id} value={crit.id}>
                      {crit.desc}
                    </option>
                  ))}
                </select>
              </div>

              <div className="filter-section">
                <h4>Eina</h4>
                <select
                  value={filters.tool_id || ''}
                  onChange={(e) => handleFilterChange('tool_id', e.target.value ? parseInt(e.target.value) : undefined)}
                >
                  <option value="">Totes les eines</option>
                  {tools.map(tool => (
                    <option key={tool.id} value={tool.id}>
                      {tool.desc}
                    </option>
                  ))}
                </select>
              </div>

              <div className="filter-section">
                <h4>Centre</h4>
                <select
                  value={filters.center_id || ''}
                  onChange={(e) => handleFilterChange('center_id', e.target.value ? parseInt(e.target.value) : undefined)}
                >
                  <option value="">Tots els centres</option>
                  {centers.map(center => (
                    <option key={center.id} value={center.id}>
                      {center.desc}
                    </option>
                  ))}
                </select>
              </div>

              <div className="filter-section">
                <h4>Interval de dates</h4>
                <div className="date-inputs">
                  <div className="date-input">
                    <label>Des de:</label>
                    <input
                      type="date"
                      value={filters.date_from || ''}
                      onChange={(e) => handleFilterChange('date_from', e.target.value || undefined)}
                    />
                  </div>
                  <div className="date-input">
                    <label>Fins a:</label>
                    <input
                      type="date"
                      value={filters.date_to || ''}
                      onChange={(e) => handleFilterChange('date_to', e.target.value || undefined)}
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="filter-dialog-footer">
          <button className="reset-button" onClick={handleResetFilters}>
            Restaurar
          </button>
          <div className="action-buttons">
            <button className="clear-button" onClick={handleClearFilters}>
              Netejar filtres
            </button>
            <button className="apply-button" onClick={handleApplyFilters}>
              Aplicar filtres
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FilterDialog; 