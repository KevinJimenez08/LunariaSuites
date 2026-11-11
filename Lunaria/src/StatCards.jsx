import 'react';
import { Users, CheckCircle2, Ban, ShieldAlert } from 'lucide-react';

export default function StatCards({ roles, filtroActivo, onSelectFiltro }) {
  const totalRoles = roles.length;
  const activeRoles = roles.filter((r) => r.estado === 'Activo').length;
  const inactiveRoles = roles.filter((r) => r.estado === 'Inactivo').length;
  const criticalRoles = roles.filter((r) => r.permisos && r.permisos.trim() !== '').length;

  return (
    <div className="stats-container">
      {/* 1. Todos los Roles */}
      <div 
        className={`stat-card ${filtroActivo === 'todos' ? 'active-filter' : ''}`}
        onClick={() => onSelectFiltro('todos')}
        style={{ cursor: 'pointer' }}
      >
        <div className="stat-icon">
          <Users size={22} color="#555" />
        </div>
        <div className="stat-info">
          <span className="stat-label">Total Roles:</span>
          <span className="stat-value">{totalRoles}</span>
        </div>
      </div>

      {/* 2. Roles Activos */}
      <div 
        className={`stat-card ${filtroActivo === 'activos' ? 'active-filter' : ''}`}
        onClick={() => onSelectFiltro('activos')}
        style={{ cursor: 'pointer' }}
      >
        <div className="stat-icon" style={{ backgroundColor: '#e2f0d9' }}>
          <CheckCircle2 size={22} color="#2e7d32" />
        </div>
        <div className="stat-info">
          <span className="stat-label">Active Roles:</span>
          <span className="stat-value">{activeRoles}</span>
        </div>
      </div>

      {/* 3. Roles Inactivos */}
      <div 
        className={`stat-card ${filtroActivo === 'inactivos' ? 'active-filter' : ''}`}
        onClick={() => onSelectFiltro('inactivos')}
        style={{ cursor: 'pointer' }}
      >
        <div className="stat-icon" style={{ backgroundColor: '#fce4d6' }}>
          <Ban size={22} color="#c62828" />
        </div>
        <div className="stat-info">
          <span className="stat-label">Inactive Roles:</span>
          <span className="stat-value">{inactiveRoles}</span>
        </div>
      </div>

      {/* 4. Roles Críticos */}
      <div 
        className={`stat-card ${filtroActivo === 'criticos' ? 'active-filter' : ''}`}
        onClick={() => onSelectFiltro('criticos')}
        style={{ cursor: 'pointer' }}
      >
        <div className="stat-icon" style={{ backgroundColor: '#fff2cc' }}>
          <ShieldAlert size={22} color="#b78103" />
        </div>
        <div className="stat-info">
          <span className="stat-label">Roles con permisos críticos:</span>
          <span className="stat-value">{criticalRoles}</span>
        </div>
      </div>
    </div>
  );
}