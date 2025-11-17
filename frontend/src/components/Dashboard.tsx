import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { FileText, Unlock, Users, TrendingUp } from 'lucide-react';
import { dashboardAPI, DashboardStatistics } from '../services/api';
import './Dashboard.css';

const Dashboard: React.FC = () => {
  const [statistics, setStatistics] = useState<DashboardStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStatistics();
  }, []);

  const loadStatistics = async () => {
    try {
      setLoading(true);
      const data = await dashboardAPI.getStatistics();
      setStatistics(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Error loading dashboard statistics');
      console.error('Error loading dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  // Color palette for charts (minimalistic and professional)
  const COLORS = {
    primary: '#3b82f6',
    secondary: '#10b981',
    accent: '#f59e0b',
    danger: '#ef4444',
    purple: '#8b5cf6',
    teal: '#14b8a6',
    pink: '#ec4899',
    gray: '#6b7280',
  };

  // Prepare data for charts
  const preparePieData = (data: { [key: string]: number }) => {
    return Object.entries(data).map(([name, value]) => ({
      name,
      value
    }));
  };

  // Prepare criticality data with colors
  const getCriticalityColor = (name: string) => {
    const colors: { [key: string]: string } = {
      'Crítica': COLORS.danger,
      'Alta': COLORS.accent,
      'Mitja': COLORS.primary,
      'Baixa': COLORS.secondary,
    };
    return colors[name] || COLORS.gray;
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="dashboard-loading">
          <div className="loading-spinner"></div>
          <p>Carregant tauler de control...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-container">
        <div className="dashboard-error">
          <p>Error: {error}</p>
          <button onClick={loadStatistics} className="retry-button">
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (!statistics) {
    return null;
  }

  // Prepare chart data
  const criticalityData = preparePieData(statistics.tickets_by_criticality);
  const statusData = preparePieData(statistics.tickets_by_status);
  const centerData = preparePieData(statistics.tickets_by_center);
  
  // Format type data with better labels
  const typeData = Object.entries(statistics.tickets_by_type).map(([name, value]) => ({
    name: name === 'incidence' ? 'Incidència' : name === 'suggestion' ? 'Suggeriment' : name,
    value
  }));
  
  const toolData = preparePieData(statistics.tickets_by_tool);

  // Format trend data for line chart
  const trendData = statistics.tickets_trend.map(item => ({
    date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    count: item.count
  }));

  return (
    <div className="dashboard-container">

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon" style={{ backgroundColor: `${COLORS.primary}20`, color: COLORS.primary }}>
            <FileText size={24} />
          </div>
          <div className="kpi-content">
            <h3 className="kpi-label">Total de Tickets</h3>
            <p className="kpi-value">{statistics.total_tickets}</p>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon" style={{ backgroundColor: `${COLORS.accent}20`, color: COLORS.accent }}>
            <Unlock size={24} />
          </div>
          <div className="kpi-content">
            <h3 className="kpi-label">Tickets Oberts</h3>
            <p className="kpi-value">{statistics.open_tickets}</p>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon" style={{ backgroundColor: `${COLORS.secondary}20`, color: COLORS.secondary }}>
            <Users size={24} />
          </div>
          <div className="kpi-content">
            <h3 className="kpi-label">Usuaris Actius</h3>
            <p className="kpi-value">{statistics.active_users}</p>
            <p className="kpi-sublabel">de {statistics.total_users} totals</p>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon" style={{ backgroundColor: `${COLORS.purple}20`, color: COLORS.purple }}>
            <TrendingUp size={24} />
          </div>
          <div className="kpi-content">
            <h3 className="kpi-label">Taxa de Resolució</h3>
            <p className="kpi-value">
              {statistics.total_tickets > 0
                ? Math.round(((statistics.total_tickets - statistics.open_tickets) / statistics.total_tickets) * 100)
                : 0}%
            </p>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="charts-grid">
        {/* Tickets Trend - Line Chart */}
        <div className="chart-card">
          <h2 className="chart-title">Tickets Creats (Últims 30 Dies)</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                }}
              />
              <Line
                type="monotone"
                dataKey="count"
                stroke={COLORS.primary}
                strokeWidth={2}
                dot={{ fill: COLORS.primary, r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Criticality Distribution - Pie Chart */}
        <div className="chart-card">
          <h2 className="chart-title">Tickets per Criticitat</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={criticalityData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${percent ? (percent * 100).toFixed(0) : 0}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {criticalityData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getCriticalityColor(entry.name)} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Status Distribution - Bar Chart */}
        <div className="chart-card">
          <h2 className="chart-title">Tickets per Estat</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={statusData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                }}
              />
              <Bar dataKey="value" fill={COLORS.primary} radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Center Distribution - Bar Chart */}
        <div className="chart-card">
          <h2 className="chart-title">Tickets per Centre</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={centerData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" stroke="#6b7280" />
              <YAxis dataKey="name" type="category" stroke="#6b7280" width={150} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                }}
              />
              <Bar dataKey="value" fill={COLORS.secondary} radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Type Distribution - Pie Chart */}
        <div className="chart-card">
          <h2 className="chart-title">Tickets per Tipus</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={typeData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${percent ? (percent * 100).toFixed(0) : 0}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {typeData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={index === 0 ? COLORS.primary : COLORS.teal}
                  />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Top Tools - Bar Chart */}
        {Object.keys(toolData).length > 0 && (
          <div className="chart-card">
            <h2 className="chart-title">Eines Principals</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={toolData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" stroke="#6b7280" angle={-45} textAnchor="end" height={100} />
                <YAxis stroke="#6b7280" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Bar dataKey="value" fill={COLORS.purple} radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;

