import React, { useState } from 'react';
import { 
  Calendar, 
  HelpCircle, 
  Circle, 
  Play, 
  Eye, 
  CheckCircle2, 
  FolderKanban,
  Tag
} from 'lucide-react';
import type { Task, TaskStatus, BoardColumn } from '../types';
import { HIERARCHY_ENABLED } from '../config';
import { useAuth } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';

interface KanbanBoardProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  allTasks: Task[];
}

const COLUMNS: BoardColumn[] = [
  { id: 'BACKLOG', title: 'Backlog', color: 'var(--status-backlog-text)' },
  { id: 'TODO', title: 'To Do', color: 'var(--status-todo-text)' },
  { id: 'IN_PROGRESS', title: 'In Progress', color: 'var(--status-progress-text)' },
  { id: 'IN_REVIEW', title: 'In Review', color: 'var(--status-review-text)' },
  { id: 'DONE', title: 'Done', color: 'var(--status-done-text)' },
];

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  tasks,
  onTaskClick,
  onStatusChange,
  allTasks,
}) => {
  const { currentUser } = useAuth();
  const { userRole } = useWorkspace();
  const [draggedOverColumn, setDraggedOverColumn] = useState<TaskStatus | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [showFeatures, setShowFeatures] = useState(false);

  // Derive current user's display name from email
  const getCurrentUserName = (email: string | null) => {
    if (!email) return '';
    if (email.includes('@')) {
      const prefix = email.split('@')[0];
      return prefix.split('.').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
    }
    return email;
  };
  const currentUserName = getCurrentUserName(currentUser);

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

  const getPriorityStripeColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL': return '#ef4444';
      case 'HIGH': return '#f97316';
      case 'MEDIUM': return '#3b82f6';
      default: return '#94a3b8';
    }
  };

  const getPriorityBadgeStyle = (priority: string) => {
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

  const getStatusIcon = (status: TaskStatus, color: string) => {
    switch (status) {
      case 'BACKLOG':
        return <HelpCircle size={14} style={{ color }} />;
      case 'TODO':
        return <Circle size={14} style={{ color }} />;
      case 'IN_PROGRESS':
        return <Play size={14} style={{ color, fill: color }} />;
      case 'IN_REVIEW':
        return <Eye size={14} style={{ color }} />;
      default:
        return <CheckCircle2 size={14} style={{ color }} />;
    }
  };

  const getColumnStyle = (columnId: TaskStatus) => {
    switch (columnId) {
      case 'BACKLOG':
        return {
          bg: 'var(--status-backlog-bg)',
          border: 'var(--status-backlog-border)',
          text: 'var(--status-backlog-text)',
          pill: 'var(--status-backlog-pill)',
          topBorder: '#64748b'
        };
      case 'TODO':
        return {
          bg: 'var(--status-todo-bg)',
          border: 'var(--status-todo-border)',
          text: 'var(--status-todo-text)',
          pill: 'var(--status-todo-pill)',
          topBorder: '#3b82f6'
        };
      case 'IN_PROGRESS':
        return {
          bg: 'var(--status-progress-bg)',
          border: 'var(--status-progress-border)',
          text: 'var(--status-progress-text)',
          pill: 'var(--status-progress-pill)',
          topBorder: '#f97316'
        };
      case 'IN_REVIEW':
        return {
          bg: 'var(--status-review-bg)',
          border: 'var(--status-review-border)',
          text: 'var(--status-review-text)',
          pill: 'var(--status-review-pill)',
          topBorder: '#a855f7'
        };
      default:
        return {
          bg: 'var(--status-done-bg)',
          border: 'var(--status-done-border)',
          text: 'var(--status-done-text)',
          pill: 'var(--status-done-pill)',
          topBorder: '#10b981'
        };
    }
  };

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId);
  };

  const handleDragOver = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    setDraggedOverColumn(status);
  };

  const handleDragLeave = () => {
    setDraggedOverColumn(null);
  };

  const handleDrop = (e: React.DragEvent, targetStatus: TaskStatus) => {
    e.preventDefault();
    setDraggedOverColumn(null);
    setDraggedTaskId(null);
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId) {
      onStatusChange(taskId, targetStatus);
    }
  };

  const getProgressBarText = (percent: number) => {
    const totalBlocks = 10;
    const filledBlocks = Math.min(totalBlocks, Math.round(percent / 10));
    const emptyBlocks = Math.max(0, totalBlocks - filledBlocks);
    return '█'.repeat(filledBlocks) + '░'.repeat(emptyBlocks);
  };

  const getParentFeature = (task: Task) => {
    if (!task.parentFeatureId) return null;
    return allTasks.find(t => t.id === task.parentFeatureId && t.type === 'FEATURE');
  };

  if (tasks.length === 0) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        padding: '6rem 2rem',
        textAlign: 'center',
        color: 'var(--text-muted)',
        backgroundColor: 'var(--bg-card)',
        borderRadius: '16px',
        border: '1px solid var(--border-color)',
        width: '100%',
        marginTop: '1rem'
      }}>
        <span style={{ fontSize: '3rem' }}>📋</span>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>No work items</h3>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', maxWidth: '400px', margin: 0 }}>
          Create one to get started.
        </p>
      </div>
    );
  }

  // Apply visibility filter: EMPLOYEEs only see their own tasks
  const applyRoleVisibility = (taskList: Task[]) => {
    if (userRole !== 'EMPLOYEE') return taskList;
    return taskList.filter(t => {
      const name = currentUserName.toLowerCase();
      if (!name) return false;
      const assigneeMatch = t.assignee && t.assignee.toLowerCase() === name;
      const reporterMatch = t.reporter && t.reporter.toLowerCase() === name;
      const ownerMatch = t.owner && t.owner.toLowerCase().includes(name);
      const createdByMatch = t.createdBy && t.createdBy.toLowerCase() === name;
      return assigneeMatch || reporterMatch || ownerMatch || createdByMatch;
    });
  };

  const visibleTasks = applyRoleVisibility(
    HIERARCHY_ENABLED 
      ? (showFeatures ? tasks : tasks.filter(t => t.type !== 'FEATURE'))
      : tasks
  );

  return (
    <div className="kanban-board-container" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
      
      {/* Show Features Toggle Switch */}
      {HIERARCHY_ENABLED && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingRight: '0.5rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={showFeatures}
              onChange={(e) => setShowFeatures(e.target.checked)}
              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
            />
            Show Features
          </label>
        </div>
      )}

      <div className="kanban-board">
        {COLUMNS.map((column) => {
          const columnTasks = visibleTasks.filter((t) => t.status === column.id);
          const colStyle = getColumnStyle(column.id);
          const isDraggingOver = draggedOverColumn === column.id;
          const share = visibleTasks.length > 0 ? (columnTasks.length / visibleTasks.length) * 100 : 0;

          return (
            <div
              key={column.id}
              className={`board-column ${isDraggingOver ? 'drag-over' : ''}`}
              style={{
                borderTop: `4px solid ${colStyle.topBorder}`,
              }}
              onDragOver={(e) => handleDragOver(e, column.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, column.id)}
            >
              
              {/* Sticky Headers Redesign */}
              <div
                className="column-header"
                style={{
                  borderBottom: `1px solid var(--border-color)`,
                  color: colStyle.text,
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: '0.25rem',
                  padding: '1rem 1.25rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                  <div className="column-title" style={{ fontWeight: 800 }}>
                    {getStatusIcon(column.id, colStyle.topBorder)}
                    <span>{column.title}</span>
                  </div>
                  <div
                    className="column-count"
                    style={{
                      backgroundColor: colStyle.pill,
                      color: colStyle.text,
                      fontSize: '0.7rem',
                      fontWeight: 700
                    }}
                  >
                    {columnTasks.length} {columnTasks.length === 1 ? 'Task' : 'Tasks'}
                  </div>
                </div>
                <div style={{ fontSize: '0.75rem', color: colStyle.text, fontFamily: 'monospace', letterSpacing: '1px', userSelect: 'none', marginTop: '0.1rem' }} title={`Share: ${Math.round(share)}%`}>
                  {getProgressBarText(share)}
                </div>
              </div>

              <div className="cards-container">
                {columnTasks.length === 0 ? (
                  /* Empty state placeholder illustration */
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    padding: '2.5rem 1rem',
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                    border: '1.5px dashed var(--border-color)',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(255, 255, 255, 0.01)',
                    margin: '1rem 0'
                  }}>
                    <span style={{ fontSize: '1.5rem' }}>✨</span>
                    <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>No work items here</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                      Drag work items here<br />or create a new one.
                    </div>
                  </div>
                ) : (
                  columnTasks.map((task) => {
                    const parentFeature = getParentFeature(task);

                    return (
                      <div
                        key={task.id}
                        className={`task-card ${draggedTaskId === task.id ? 'dragging' : ''}`}
                        style={{
                          borderLeft: `4px solid ${getPriorityStripeColor(task.priority)}`
                        }}
                        draggable
                        onDragStart={(e) => { handleDragStart(e, task.id); setDraggedTaskId(task.id); }}
                        onDragEnd={() => setDraggedTaskId(null)}
                        onClick={() => onTaskClick(task)}
                      >
                        {/* Header: Task ID, Priority, status badge */}
                        <div className="card-header" style={{ marginBottom: '0.5rem' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{task.id}</span>
                          <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                            <span
                              className="card-priority"
                              style={{
                                fontSize: '0.6rem',
                                fontWeight: 800,
                                padding: '0.1rem 0.35rem',
                                borderRadius: '4px',
                                ...getPriorityBadgeStyle(task.priority)
                              }}
                            >
                              {task.priority}
                            </span>
                            <span style={{
                              fontSize: '0.6rem',
                              fontWeight: 800,
                              padding: '0.1rem 0.35rem',
                              borderRadius: '4px',
                              backgroundColor: colStyle.pill,
                              color: colStyle.text
                            }}>
                              {task.type}
                            </span>
                          </div>
                        </div>

                        {/* Title */}
                        <div className="card-title" style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem', lineHeight: '1.4' }}>
                          {task.title}
                        </div>

                        {/* Parent Rollup Link */}
                        {parentFeature && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.65rem', color: 'var(--type-feature-color)', marginBottom: '0.5rem', fontWeight: 600, textTransform: 'uppercase' }}>
                            <FolderKanban size={10} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {parentFeature.title}
                            </span>
                          </div>
                        )}

                        {/* Footer: Module, Due Date, Assignee Initials */}
                        <div className="card-footer" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem', marginTop: '0.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                            {task.dueDate && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', color: 'var(--text-secondary)', fontSize: '0.65rem', fontWeight: 600 }}>
                                <Calendar size={10} />
                                <span>
                                  {new Date(task.dueDate).toLocaleDateString(undefined, {
                                    month: 'short',
                                    day: 'numeric',
                                  })}
                                </span>
                              </div>
                            )}
                            {task.module && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '2px', color: 'var(--text-muted)', background: 'var(--bg-hover)', padding: '0.1rem 0.3rem', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '0.65rem', fontWeight: 600 }}>
                                <Tag size={8} />
                                <span>{task.module}</span>
                              </div>
                            )}
                          </div>

                          {/* Assignee Avatar */}
                          {task.assignee && (
                            <div style={{ display: 'flex', alignItems: 'center' }} title={`Assignee: ${task.assignee}`}>
                              <div style={{
                                width: '20px',
                                height: '20px',
                                borderRadius: '50%',
                                backgroundColor: getAvatarColor(task.assignee),
                                color: '#fff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.65rem',
                                fontWeight: 800,
                                border: '1px solid var(--bg-card)'
                              }}>
                                {getInitials(task.assignee)}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
