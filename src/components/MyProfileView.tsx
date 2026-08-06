import React from 'react';
import { User, Mail, Shield, Calendar, CheckSquare, Clock, AlertCircle, TrendingUp, Sun, Moon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { useTheme } from '../context/ThemeContext';

export const MyProfileView: React.FC = () => {
  const { currentUserId, currentUser } = useAuth();
  const { tasks, members } = useWorkspace();
  const { theme, toggleTheme } = useTheme();

  const getUserName = (userVal: string | null) => {
    if (!userVal) return 'Employee';
    if (userVal.includes('@')) {
      const prefix = userVal.split('@')[0];
      return prefix
        .split('.')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
    }
    return userVal;
  };

  const currentUserName = getUserName(currentUser);
  
  // Resolve member profile
  const member = members.find(m => m.id === currentUserId) || 
                 members.find(m => m.name.toLowerCase() === currentUserName.toLowerCase());
  
  const userRole = member ? member.role.replace('_', ' ') : 'Employee';
  const avatarBg = member ? member.avatarColor : '#3b82f6';
  const initials = currentUserName.split(/\s+/).map(n => n[0]).join('').toUpperCase().slice(0, 2);

  // Stats Calculations
  const userTasks = tasks.filter(t => {
    const assigneeMatch = t.assignee && t.assignee.toLowerCase() === currentUserName.toLowerCase();
    const ownerMatch = t.owner && t.owner.toLowerCase().includes(currentUserName.toLowerCase());
    return assigneeMatch || ownerMatch;
  });

  const completedTasks = userTasks.filter(t => t.status === 'DONE');
  const pendingTasks = userTasks.filter(t => t.status !== 'DONE');
  const completionRate = userTasks.length > 0 ? Math.round((completedTasks.length / userTasks.length) * 100) : 0;
  const currentWorkloadHours = pendingTasks.reduce((acc, t) => acc + (t.timeEstimated || 0), 0);

  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return { backgroundColor: 'var(--priority-critical-bg)', color: 'var(--priority-critical-text)', border: '1px solid var(--priority-critical-text)' };
      case 'HIGH':
        return { backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' };
      case 'MEDIUM':
        return { backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.2)' };
      default:
        return { backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.2)' };
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DONE':
        return '#10b981';
      case 'IN_PROGRESS':
        return '#f97316';
      case 'IN_REVIEW':
        return '#a855f7';
      case 'TODO':
        return '#3b82f6';
      default:
        return '#64748b';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1100px', margin: '0 auto' }}>
      
      {/* Profile Overview Card */}
      <div className="stat-card" style={{
        display: 'grid',
        gridTemplateColumns: '1.2fr 2fr',
        gap: '2rem',
        padding: '2rem',
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        boxShadow: 'var(--shadow-md)',
        backdropFilter: 'blur(20px)',
        alignItems: 'center'
      }}>
        
        {/* User Card Info */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: '1rem',
          borderRight: '1px solid var(--border-color)',
          paddingRight: '2rem'
        }}>
          <div style={{
            width: '90px',
            height: '90px',
            borderRadius: '50%',
            backgroundColor: avatarBg,
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: '2.5rem',
            boxShadow: 'var(--shadow-lg)'
          }}>
            {initials}
          </div>
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.25rem 0' }}>
              {currentUserName}
            </h2>
            <span style={{
              display: 'inline-block',
              padding: '0.25rem 0.65rem',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              color: 'var(--color-primary)',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              {userRole}
            </span>
          </div>
        </div>

        {/* Info Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <User size={18} style={{ color: 'var(--color-primary)' }} /> Member Profile
          </h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem 1.5rem', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Mail size={16} style={{ color: 'var(--text-muted)' }} />
              <div>
                <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>Company Email</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{currentUser}</span>
              </div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Shield size={16} style={{ color: 'var(--text-muted)' }} />
              <div>
                <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>Workspace Permissions</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Logmark Internal Access</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Calendar size={16} style={{ color: 'var(--text-muted)' }} />
              <div>
                <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>Date Joined</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>July 2026</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Shield size={16} style={{ color: 'var(--text-muted)' }} />
              <div>
                <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>Current Workspace</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Logmark AI</span>
              </div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', display: 'flex', justifySelf: 'start', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Appearance Theme:</span>
            <button 
              type="button"
              onClick={toggleTheme} 
              className="btn btn-secondary" 
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.85rem', fontSize: '0.8rem' }}
            >
              {theme === 'light' ? (
                <>
                  <Moon size={14} /> <span>Dark Theme</span>
                </>
              ) : (
                <>
                  <Sun size={14} /> <span>Light Theme</span>
                </>
              )}
            </button>
          </div>

        </div>

      </div>

      {/* Workspace Statistics Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem' }}>
        
        <div className="stat-card" style={{ padding: '1.25rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <CheckSquare size={20} style={{ color: 'var(--color-primary)' }} />
          <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>{userTasks.length}</span>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Total Assigned</span>
        </div>

        <div className="stat-card" style={{ padding: '1.25rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <CheckSquare size={20} style={{ color: 'var(--status-done-text)' }} />
          <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>{completedTasks.length}</span>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Completed</span>
        </div>

        <div className="stat-card" style={{ padding: '1.25rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <Clock size={20} style={{ color: 'var(--status-progress-text)' }} />
          <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>{pendingTasks.length}</span>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Pending</span>
        </div>

        <div className="stat-card" style={{ padding: '1.25rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <TrendingUp size={20} style={{ color: '#10b981' }} />
          <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>{completionRate}%</span>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Completion %</span>
        </div>

        <div className="stat-card" style={{ padding: '1.25rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <AlertCircle size={20} style={{ color: '#f59e0b' }} />
          <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>{currentWorkloadHours}h</span>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Current Workload</span>
        </div>

      </div>

      {/* Assigned Tasks Card */}
      <div className="stat-card" style={{
        padding: '1.5rem',
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CheckSquare size={18} style={{ color: 'var(--color-primary)' }} /> Assigned Work Items ({userTasks.length})
        </h3>

        {userTasks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
            <CheckSquare size={36} style={{ marginBottom: '0.5rem', opacity: 0.4 }} />
            <p style={{ margin: 0, fontSize: '0.9rem' }}>No assigned work yet.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '350px', overflowY: 'auto', paddingRight: '0.25rem' }}>
            {userTasks.map(t => (
              <div 
                key={t.id} 
                className="task-card"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-app)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: getStatusColor(t.status)
                  }} />
                  <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-muted)' }}>{t.id}</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '400px' }}>
                    {t.title}
                  </span>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                  {t.module && (
                    <span style={{ fontSize: '0.65rem', backgroundColor: 'var(--border-color)', color: 'var(--text-secondary)', padding: '0.15rem 0.4rem', borderRadius: '4px', fontWeight: 600 }}>
                      {t.module}
                    </span>
                  )}
                  <span style={{
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    padding: '0.15rem 0.4rem',
                    borderRadius: '4px',
                    ...getPriorityStyle(t.priority)
                  }}>
                    {t.priority}
                  </span>
                  {t.timeEstimated > 0 && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                      {t.timeEstimated}h
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>

    </div>
  );
};
