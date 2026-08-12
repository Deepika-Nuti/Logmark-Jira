import React, { useState } from 'react';
import { Calendar, Trash2, Edit3, ClipboardList, ChevronDown, ChevronRight, Tag } from 'lucide-react';
import type { Task } from '../types';
import { HIERARCHY_ENABLED } from '../config';
import { useAuth } from '../context/AuthContext';

interface BacklogViewProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onDeleteTask: (id: string) => void;
}

export const BacklogView: React.FC<BacklogViewProps> = ({
  tasks,
  onTaskClick,
  onDeleteTask,
}) => {
  const { currentUser } = useAuth();
  const isEmployee = false;

  // Derive display name from email
  const getCurrentUserName = (email: string | null) => {
    if (!email) return '';
    if (email.includes('@')) {
      const prefix = email.split('@')[0];
      return prefix.split('.').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
    }
    return email;
  };
  const currentUserName = getCurrentUserName(currentUser);

  // Filter tasks for employees: only show their own tasks
  const visibleTasks = isEmployee
    ? tasks.filter(t => {
        const name = currentUserName.toLowerCase();
        if (!name) return false;
        return (
          (t.assignee && t.assignee.toLowerCase() === name) ||
          (t.reporter && t.reporter.toLowerCase() === name) ||
          (t.owner && t.owner.toLowerCase().includes(name)) ||
          (t.createdBy && t.createdBy.toLowerCase() === name)
        );
      })
    : tasks;

  // Collapse state tracking
  const [collapsedFeatures, setCollapsedFeatures] = useState<Record<string, boolean>>({});

  const toggleFeature = (id: string) => {
    setCollapsedFeatures(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return { backgroundColor: 'var(--priority-critical-bg)', color: 'var(--priority-critical-text)' };
      case 'HIGH':
        return { backgroundColor: 'var(--priority-high-bg)', color: 'var(--priority-high-text)' };
      case 'MEDIUM':
        return { backgroundColor: 'var(--priority-medium-bg)', color: 'var(--priority-medium-text)' };
      default:
        return { backgroundColor: 'var(--priority-low-bg)', color: 'var(--priority-low-text)' };
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'BACKLOG':
        return { backgroundColor: 'var(--status-backlog-pill)', color: 'var(--status-backlog-text)' };
      case 'TODO':
        return { backgroundColor: 'var(--status-todo-pill)', color: 'var(--status-todo-text)' };
      case 'IN_PROGRESS':
        return { backgroundColor: 'var(--status-progress-pill)', color: 'var(--status-progress-text)' };
      case 'IN_REVIEW':
        return { backgroundColor: 'var(--status-review-pill)', color: 'var(--status-review-text)' };
      default:
        return { backgroundColor: 'var(--status-done-pill)', color: 'var(--status-done-text)' };
    }
  };

  const isOverdue = (dateStr: string) => {
    if (!dateStr) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(dateStr);
    dueDate.setHours(0, 0, 0, 0);
    return dueDate < today;
  };

  // Filter lists from visibleTasks (role-filtered)
  const features = visibleTasks.filter(t => t.type === 'FEATURE');
  const nonFeatures = visibleTasks.filter(t => t.type !== 'FEATURE');
  const orphans = nonFeatures.filter(t => !t.parentFeatureId || !features.some(f => f.id === t.parentFeatureId));

  const getInitials = (name: string) => {
    if (!name) return '?';
    return name.trim().split(/\s+/).map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getAvatarColor = (name: string) => {
    if (!name) return '#94a3b8';
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#ef4444', '#14b8a6'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash % colors.length);
    return colors[index];
  };

  const renderBacklogItem = (task: Task, isChild = false) => {
    const overdue = isOverdue(task.dueDate) && task.status !== 'DONE';

    return (
      <div
        key={task.id}
        className={`backlog-item ${isChild ? 'backlog-child-item' : ''}`}
        style={{
          marginLeft: isChild ? '1.5rem' : '0',
          borderLeft: isChild ? '2px solid var(--type-feature-color)' : 'none',
          paddingLeft: isChild ? '1rem' : '0.75rem',
          backgroundColor: 'var(--bg-card)',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
          padding: '0.75rem 1rem',
          marginBottom: '0.35rem',
          display: 'grid',
          gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 100px',
          alignItems: 'center',
          gap: '1rem',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          boxShadow: 'var(--shadow-sm)'
        }}
        onClick={() => onTaskClick(task)}
      >
        {/* Col 1: Title */}
        <div className="backlog-title-section" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
          {isChild && <span style={{ color: 'var(--text-muted)', fontWeight: 'bold', fontSize: '0.85rem' }}>↳</span>}
          <span style={{ 
            display: 'inline-block',
            width: '8px', 
            height: '8px', 
            borderRadius: '2.5px', 
            backgroundColor: `var(--type-${(task.type || 'task').toLowerCase()}-color)`,
            flexShrink: 0
          }} />
          <span style={{ fontWeight: 700, color: 'var(--text-muted)', flexShrink: 0, fontSize: '0.8rem' }}>{task.id}</span>
          <span className="backlog-title" style={{
            textDecoration: task.status === 'DONE' ? 'line-through' : 'none',
            color: task.status === 'DONE' ? 'var(--text-muted)' : 'var(--text-primary)',
            textOverflow: 'ellipsis',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            fontWeight: 600,
            fontSize: '0.85rem'
          }}>{task.title}</span>
          
          {task.module && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', fontSize: '0.65rem', color: 'var(--text-muted)', backgroundColor: 'var(--bg-hover)', padding: '0.15rem 0.35rem', borderRadius: '4px', border: '1px solid var(--border-color)', fontWeight: 600 }}>
              <Tag size={8} />
              {task.module}
            </span>
          )}
        </div>

        {/* Col 2: Status */}
        <div>
          <span className="backlog-status" style={{ ...getStatusStyle(task.status), padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', display: 'inline-block' }}>
            {task.status.replace('_', ' ')}
          </span>
        </div>

        {/* Col 3: Priority */}
        <div>
          <span className="card-priority" style={{ ...getPriorityStyle(task.priority), padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, display: 'inline-block' }}>
            {task.priority}
          </span>
        </div>

        {/* Col 4: Assignee */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem' }}>
          {task.assignee ? (
            <>
              <div style={{
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                backgroundColor: getAvatarColor(task.assignee),
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.6rem',
                fontWeight: 700
              }}>
                {getInitials(task.assignee)}
              </div>
              <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '80px', fontWeight: 500 }}>
                {task.assignee}
              </span>
            </>
          ) : (
            <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Unassigned</span>
          )}
        </div>

        {/* Col 5: Due Date */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: overdue ? 'var(--color-danger)' : 'var(--text-secondary)' }}>
          <Calendar size={12} style={{ color: 'var(--text-muted)' }} />
          <span style={{ fontWeight: overdue ? 700 : 400 }}>{task.dueDate || 'No Date'}</span>
        </div>

        {/* Col 6: Actions */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.35rem',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="btn btn-secondary"
            style={{ padding: '0.3rem' }}
            onClick={() => onTaskClick(task)}
            title="Edit"
          >
            <Edit3 size={12} />
          </button>
          <button
            className="btn btn-danger"
            style={{ padding: '0.3rem', backgroundColor: 'rgba(239, 68, 68, 0.08)', color: '#ef4444', borderColor: 'transparent' }}
            onClick={() => onDeleteTask(task.id)}
            title="Delete"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    );
  };

  if (!HIERARCHY_ENABLED) {
    return (
      <div className="backlog-view" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div className="backlog-header" style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 100px',
          gap: '1rem',
          padding: '0.75rem 1rem',
          borderBottom: '1px solid var(--border-color)',
          fontWeight: 800,
          textTransform: 'uppercase',
          fontSize: '0.75rem',
          letterSpacing: '0.05em',
          color: 'var(--text-secondary)',
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: 'var(--bg-app)'
        }}>
          <div>Title & Summary</div>
          <div>Status</div>
          <div>Priority</div>
          <div>Owner</div>
          <div>Due Date</div>
          <div style={{ textAlign: 'right' }}>Actions</div>
        </div>

        <div style={{ padding: '0.5rem 0', overflowY: 'auto', flex: 1 }}>
          {tasks.length === 0 ? (
            <div className="empty-state" style={{ padding: '4rem 1rem' }}>
              <ClipboardList className="empty-state-icon" />
              <h3>No tasks found</h3>
              <p>Create a task or import data to populate the backlog checklist.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {tasks.map(task => renderBacklogItem(task, false))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="backlog-view" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="backlog-header" style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 100px',
        gap: '1rem',
        padding: '0.75rem 1rem',
        borderBottom: '1px solid var(--border-color)',
        fontWeight: 800,
        textTransform: 'uppercase',
        fontSize: '0.75rem',
        letterSpacing: '0.05em',
        color: 'var(--text-secondary)',
        position: 'sticky',
        top: 0,
        zIndex: 10,
        background: 'var(--bg-app)'
      }}>
        <div>Title & Summary</div>
        <div>Status</div>
        <div>Priority</div>
        <div>Owner</div>
        <div>Due Date / Progress</div>
        <div style={{ textAlign: 'right' }}>Actions</div>
      </div>

      <div style={{ padding: '0.5rem 0', overflowY: 'auto', flex: 1 }}>
        {features.length === 0 && orphans.length === 0 ? (
          <div className="empty-state" style={{ padding: '4rem 1rem' }}>
            <ClipboardList className="empty-state-icon" />
            <h3>No tasks found</h3>
            <p>Create a task or import data to populate the backlog checklist.</p>
          </div>
        ) : (
          features.map((feature) => {
            const children = nonFeatures.filter(t => t.parentFeatureId === feature.id);
            const completed = children.filter(c => c.status === 'DONE').length;
            const progress = children.length > 0 ? Math.round((completed / children.length) * 100) : 0;
            const isCollapsed = !!collapsedFeatures[feature.id];

            return (
              <div key={feature.id} className="backlog-feature-group" style={{ marginBottom: '0.75rem', border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden', backgroundColor: 'var(--bg-card)', boxShadow: 'var(--shadow-sm)' }}>
                
                {/* Feature Row */}
                <div 
                  className="backlog-item backlog-feature-header-row" 
                  style={{ 
                    display: 'grid',
                    gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 100px',
                    alignItems: 'center',
                    gap: '1rem',
                    padding: '0.85rem 1rem',
                    backgroundColor: 'rgba(139, 92, 246, 0.05)', 
                    cursor: 'pointer',
                    fontWeight: 700,
                    borderLeft: '4px solid var(--type-feature-color)'
                  }}
                  onClick={() => toggleFeature(feature.id)}
                >
                  {/* Col 1: Title & Chevron */}
                  <div className="backlog-title-section" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                    {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                    <span style={{ 
                      padding: '0.15rem 0.35rem',
                      borderRadius: '4px',
                      fontSize: '0.6rem',
                      fontWeight: 800,
                      backgroundColor: 'var(--type-feature-color)',
                      color: '#ffffff',
                      display: 'inline-block',
                      flexShrink: 0
                    }}>FEATURE</span>
                    <span style={{ color: 'var(--text-secondary)', flexShrink: 0, fontSize: '0.8rem' }}>{feature.id}</span>
                    <span className="backlog-title" style={{
                      textOverflow: 'ellipsis',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      color: 'var(--text-primary)',
                      fontSize: '0.9rem'
                    }}>{feature.title}</span>
                  </div>
                  
                  {/* Col 2: Status */}
                  <div>
                    <span className="backlog-status" style={{ ...getStatusStyle(feature.status), padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', display: 'inline-block' }}>
                      {feature.status.replace('_', ' ')}
                    </span>
                  </div>

                  {/* Col 3: Priority */}
                  <div>
                    <span className="card-priority" style={{ ...getPriorityStyle(feature.priority), padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, display: 'inline-block' }}>
                      {feature.priority}
                    </span>
                  </div>

                  {/* Col 4: Assignee */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem' }}>
                    {feature.assignee ? (
                      <>
                        <div style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          backgroundColor: getAvatarColor(feature.assignee),
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.6rem',
                          fontWeight: 700
                        }}>
                          {getInitials(feature.assignee)}
                        </div>
                        <span style={{ fontWeight: 500 }}>{feature.assignee}</span>
                      </>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Unassigned</span>
                    )}
                  </div>

                  {/* Col 5: Progress Bar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ flex: 1, height: '6px', background: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden', minWidth: '80px' }}>
                      <div style={{ width: `${progress}%`, height: '100%', backgroundColor: 'var(--type-feature-color)', borderRadius: '3px' }} />
                    </div>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', fontWeight: 600 }}>
                      {completed}/{children.length} ({progress}%)
                    </span>
                  </div>

                  {/* Col 6: Actions */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'flex-end',
                      gap: '0.35rem',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '0.3rem' }}
                      onClick={() => onTaskClick(feature)}
                      title="Edit Feature"
                    >
                      <Edit3 size={12} />
                    </button>
                    <button
                      className="btn btn-danger"
                      style={{ padding: '0.3rem', backgroundColor: 'rgba(239, 68, 68, 0.08)', color: '#ef4444', borderColor: 'transparent' }}
                      onClick={() => onDeleteTask(feature.id)}
                      title="Delete Feature"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                {/* Collapsed children items nested block */}
                {!isCollapsed && (
                  <div className="backlog-feature-children-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: '0.5rem 0.5rem 0.5rem 1rem', backgroundColor: 'rgba(0, 0, 0, 0.02)' }}>
                    {children.length === 0 ? (
                      <div style={{ marginLeft: '1.5rem', padding: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        No child tasks linked.
                      </div>
                    ) : (
                      children.map(child => renderBacklogItem(child, true))
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Render Unassigned / Orphan tasks section */}
        {orphans.length > 0 && (
          <div className="backlog-unassigned-section" style={{ marginTop: '1.5rem' }}>
            <div 
              className="backlog-section-title" 
              style={{ 
                fontSize: '0.8rem', 
                fontWeight: 800, 
                color: 'var(--text-secondary)', 
                textTransform: 'uppercase', 
                marginBottom: '0.5rem', 
                paddingLeft: '0.5rem', 
                borderLeft: '4px solid var(--text-muted)' 
              }}
            >
              Unassigned / Orphan Work Items ({orphans.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {orphans.map(orphan => renderBacklogItem(orphan, false))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
