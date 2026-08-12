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

interface KanbanBoardProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  allTasks: Task[];
}

const COLUMNS: BoardColumn[] = [
  { id: 'BACKLOG',     title: 'Backlog',      color: 'var(--status-backlog-text)' },
  { id: 'TODO',        title: 'To Do',        color: 'var(--status-todo-text)' },
  { id: 'IN_PROGRESS', title: 'In Progress',  color: 'var(--status-progress-text)' },
  { id: 'IN_REVIEW',   title: 'In Review',    color: 'var(--status-review-text)' },
  { id: 'DONE',        title: 'Done',         color: 'var(--status-done-text)' },
];

// Accent colour per column — used only for the top border and header icon
const COLUMN_ACCENT: Record<string, string> = {
  BACKLOG:     '#64748b',
  TODO:        '#3b82f6',
  IN_PROGRESS: '#f97316',
  IN_REVIEW:   '#a855f7',
  DONE:        '#10b981',
};

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  tasks,
  onTaskClick,
  onStatusChange,
  allTasks,
}) => {
  const [draggedOverColumn, setDraggedOverColumn] = useState<TaskStatus | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [showFeatures, setShowFeatures] = useState(false);

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
    return colors[Math.abs(hash % colors.length)];
  };

  const getPriorityStripeColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL': return '#ef4444';
      case 'HIGH':     return '#f97316';
      case 'MEDIUM':   return '#3b82f6';
      default:         return '#94a3b8';
    }
  };

  const getPriorityBadgeStyle = (priority: string) => {
    switch (priority) {
      case 'CRITICAL': return { backgroundColor: 'var(--priority-critical-bg)', color: 'var(--priority-critical-text)' };
      case 'HIGH':     return { backgroundColor: 'var(--priority-high-bg)',     color: 'var(--priority-high-text)' };
      case 'MEDIUM':   return { backgroundColor: 'var(--priority-medium-bg)',   color: 'var(--priority-medium-text)' };
      default:         return { backgroundColor: 'var(--priority-low-bg)',      color: 'var(--priority-low-text)' };
    }
  };

  const getStatusIcon = (status: TaskStatus, color: string) => {
    const props = { size: 13, style: { color, flexShrink: 0 } };
    switch (status) {
      case 'BACKLOG':     return <HelpCircle {...props} />;
      case 'TODO':        return <Circle {...props} />;
      case 'IN_PROGRESS': return <Play {...props} style={{ ...props.style, fill: color }} />;
      case 'IN_REVIEW':   return <Eye {...props} />;
      default:            return <CheckCircle2 {...props} />;
    }
  };

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId);
  };

  const handleDragOver = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    setDraggedOverColumn(status);
  };

  const handleDragLeave = () => setDraggedOverColumn(null);

  const handleDrop = (e: React.DragEvent, targetStatus: TaskStatus) => {
    e.preventDefault();
    setDraggedOverColumn(null);
    setDraggedTaskId(null);
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId) onStatusChange(taskId, targetStatus);
  };

  const getParentFeature = (task: Task) => {
    if (!task.parentFeatureId) return null;
    return allTasks.find(t => t.id === task.parentFeatureId && t.type === 'FEATURE');
  };

  // Format due date compactly
  const formatDue = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  const isOverdue = (dateStr: string) =>
    dateStr && new Date(dateStr) < new Date() ? true : false;

  if (tasks.length === 0) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: '1rem', padding: '5rem 2rem',
        textAlign: 'center', color: 'var(--text-muted)',
        backgroundColor: 'var(--bg-card)', borderRadius: '16px',
        border: '1px solid var(--border-color)', width: '100%', marginTop: '1rem'
      }}>
        <span style={{ fontSize: '2.5rem' }}>📋</span>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>No work items</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '360px', margin: 0 }}>
          Create one to get started.
        </p>
      </div>
    );
  }

  // All authenticated users see complete Kanban board
  const applyRoleVisibility = (taskList: Task[]) => taskList;

  const visibleTasks = applyRoleVisibility(
    HIERARCHY_ENABLED
      ? (showFeatures ? tasks : tasks.filter(t => t.type !== 'FEATURE'))
      : tasks
  );

  return (
    <div className="kanban-board-container" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%' }}>

      {/* Show Features Toggle */}
      {HIERARCHY_ENABLED && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingRight: '0.25rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', userSelect: 'none', color: 'var(--text-secondary)' }}>
            <input
              type="checkbox"
              checked={showFeatures}
              onChange={(e) => setShowFeatures(e.target.checked)}
              style={{ width: '14px', height: '14px', cursor: 'pointer', accentColor: 'var(--color-primary)' }}
            />
            Show Features
          </label>
        </div>
      )}

      <div className="kanban-board">
        {COLUMNS.map((column) => {
          const columnTasks = visibleTasks.filter(t => t.status === column.id);
          const accent = COLUMN_ACCENT[column.id];
          const isDraggingOver = draggedOverColumn === column.id;

          return (
            <div
              key={column.id}
              className={`board-column ${isDraggingOver ? 'drag-over' : ''}`}
              style={{ borderTop: `3px solid ${accent}` }}
              onDragOver={(e) => handleDragOver(e, column.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, column.id)}
            >
              {/* ── Column Header ── */}
              <div className="column-header" style={{ padding: '0.75rem 1rem' }}>
                <div className="column-title" style={{ fontWeight: 700, fontSize: '0.82rem' }}>
                  {getStatusIcon(column.id, accent)}
                  <span style={{ color: 'var(--text-primary)' }}>{column.title}</span>
                </div>
                <div
                  className="column-count"
                  style={{
                    fontSize: '0.7rem', fontWeight: 700,
                    padding: '0.1rem 0.45rem', borderRadius: '10px',
                    backgroundColor: 'var(--bg-hover)',
                    color: columnTasks.length > 0 ? accent : 'var(--text-muted)',
                    border: `1px solid ${columnTasks.length > 0 ? accent + '55' : 'var(--border-color)'}`,
                  }}
                >
                  {columnTasks.length}
                </div>
              </div>

              {/* ── Cards Container ── */}
              <div className="cards-container" style={{ gap: '0.5rem', padding: '0.75rem' }}>
                {columnTasks.length === 0 ? (
                  <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    gap: '0.4rem', padding: '2rem 1rem', textAlign: 'center',
                    color: 'var(--text-muted)', border: '1.5px dashed var(--border-color)',
                    borderRadius: '10px', margin: '0.25rem 0',
                  }}>
                    <span style={{ fontSize: '1.25rem', opacity: 0.5 }}>⬡</span>
                    <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>Drop items here</div>
                  </div>
                ) : (
                  columnTasks.map((task) => {
                    const parentFeature = getParentFeature(task);
                    const overdue = task.dueDate && isOverdue(task.dueDate) && task.status !== 'DONE';

                    return (
                      <div
                        key={task.id}
                        className={`task-card ${draggedTaskId === task.id ? 'dragging' : ''}`}
                        style={{ borderLeft: `3px solid ${getPriorityStripeColor(task.priority)}` }}
                        draggable
                        onDragStart={(e) => { handleDragStart(e, task.id); setDraggedTaskId(task.id); }}
                        onDragEnd={() => setDraggedTaskId(null)}
                        onClick={() => onTaskClick(task)}
                      >
                        {/* Row 1: ID + priority badge */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                          <span style={{
                            fontSize: '0.68rem', fontWeight: 700,
                            color: 'var(--text-muted)', fontFamily: 'monospace', letterSpacing: '0.02em'
                          }}>
                            {task.id}
                          </span>
                          <div style={{ display: 'flex', gap: '0.2rem', alignItems: 'center' }}>
                            {task.deletionRequested && (
                              <span title={`Deletion requested by ${task.deletionRequestedBy}`} style={{
                                fontSize: '0.58rem', fontWeight: 800, padding: '0.08rem 0.3rem',
                                borderRadius: '4px', backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444',
                                border: '1px solid rgba(239,68,68,0.25)'
                              }}>⏳ DEL</span>
                            )}
                            <span style={{
                              fontSize: '0.58rem', fontWeight: 800,
                              padding: '0.08rem 0.3rem', borderRadius: '4px',
                              letterSpacing: '0.03em', textTransform: 'uppercase',
                              ...getPriorityBadgeStyle(task.priority)
                            }}>
                              {task.priority === 'CRITICAL' ? '🔴' : task.priority === 'HIGH' ? '🟠' : task.priority === 'MEDIUM' ? '🔵' : '⚪'} {task.priority}
                            </span>
                          </div>
                        </div>

                        {/* Row 2: Title */}
                        <div style={{
                          fontSize: '0.82rem', fontWeight: 650, color: 'var(--text-primary)',
                          lineHeight: '1.35', marginBottom: '0.4rem',
                          display: '-webkit-box', WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical', overflow: 'hidden'
                        }}>
                          {task.title}
                        </div>

                        {/* Row 3: Parent feature link (if any) */}
                        {parentFeature && (
                          <div style={{
                            display: 'flex', alignItems: 'center', gap: '0.2rem',
                            fontSize: '0.62rem', color: 'var(--type-feature-color)',
                            marginBottom: '0.4rem', fontWeight: 600,
                            overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis'
                          }}>
                            <FolderKanban size={9} style={{ flexShrink: 0 }} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {parentFeature.title}
                            </span>
                          </div>
                        )}

                        {/* Row 4: Footer — type chip, module, due date, avatar */}
                        <div style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          paddingTop: '0.4rem', borderTop: '1px solid var(--border-color)',
                          gap: '0.35rem'
                        }}>
                          {/* Left: type + module + due */}
                          <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center', flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
                            {/* Type chip */}
                            <span style={{
                              fontSize: '0.58rem', fontWeight: 700, padding: '0.08rem 0.3rem',
                              borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.03em',
                              backgroundColor: 'var(--bg-hover)', color: 'var(--text-muted)',
                              border: '1px solid var(--border-color)', flexShrink: 0
                            }}>
                              {task.type === 'FEATURE' ? '⬡' : task.type === 'BUG' ? '🐛' : task.type === 'IMPROVEMENT' ? '↑' : '◻'} {task.type}
                            </span>

                            {/* Module */}
                            {task.module && (
                              <div style={{
                                display: 'flex', alignItems: 'center', gap: '2px',
                                color: 'var(--text-muted)', fontSize: '0.6rem', fontWeight: 600,
                                background: 'var(--bg-hover)', padding: '0.08rem 0.3rem',
                                borderRadius: '4px', border: '1px solid var(--border-color)',
                                maxWidth: '70px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                              }}>
                                <Tag size={7} style={{ flexShrink: 0 }} />
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{task.module}</span>
                              </div>
                            )}

                            {/* Due date */}
                            {task.dueDate && (
                              <div style={{
                                display: 'flex', alignItems: 'center', gap: '0.15rem',
                                fontSize: '0.6rem', fontWeight: 600, flexShrink: 0,
                                color: overdue ? '#ef4444' : 'var(--text-muted)',
                              }}>
                                <Calendar size={9} style={{ flexShrink: 0 }} />
                                <span>{formatDue(task.dueDate)}</span>
                              </div>
                            )}
                          </div>

                          {/* Right: Assignee avatar */}
                          {task.assignee && (
                            <div
                              title={`Assignee: ${task.assignee}`}
                              style={{
                                width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
                                backgroundColor: getAvatarColor(task.assignee),
                                color: '#fff', display: 'flex', alignItems: 'center',
                                justifyContent: 'center', fontSize: '0.6rem', fontWeight: 800,
                                border: '1.5px solid var(--bg-card)', boxShadow: '0 1px 3px rgba(0,0,0,0.15)'
                              }}
                            >
                              {getInitials(task.assignee)}
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
