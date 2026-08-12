import React from 'react';
import {
  Users,
  Plus,
  Upload,
  User,
  Calendar,
  Activity,
  Wifi,
  WifiOff,
} from 'lucide-react';
import type { Task, Member, ProjectStats } from '../types';
import { useAuth } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';

interface DashboardViewProps {
  tasks: Task[];
  members: Member[];
  stats: ProjectStats;
  onCreateWorkItem: () => void;
  onImportSpreadsheet: () => void;
  onNavigate: (view: any) => void;
  onDeleteTask?: (id: string) => void;
  onRestoreTask?: (id: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  tasks,
  members,
  stats: _stats,
  onCreateWorkItem,
  onImportSpreadsheet,
  onNavigate: _onNavigate,
}) => {
  const { currentUserId, currentUser } = useAuth();
  const { userRole: effectiveRole } = useWorkspace();

  const getUserName = (userVal: string | null) => {
    if (!userVal) return 'User';
    if (userVal.includes('@')) {
      const prefix = userVal.split('@')[0];
      return prefix.split('.').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
    }
    return userVal;
  };

  const currentUserName = getUserName(currentUser);
  const member = members.find(m => m.id === currentUserId) ||
    (currentUser && members.find(m => m.email?.toLowerCase() === currentUser.toLowerCase())) ||
    members.find(m => m.name.toLowerCase() === currentUserName.toLowerCase());

  const userRoleDisplay = member
    ? (member.role === 'PRODUCT_MANAGER' ? 'Product Manager' : 'Intern')
    : effectiveRole.replace('_', ' ');

  const currentDate = new Date().toLocaleDateString(undefined, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isOnline = navigator.onLine;

  // === My Tasks ===
  const myTasks = tasks.filter(t => {
    const userName = (member?.name || currentUserName).toLowerCase();
    const userEmail = (member?.email || currentUser || '').toLowerCase();
    const firstName = userName.split(' ')[0];
    const assigneeMatch = t.assignee && (
      t.assignee.toLowerCase() === userName ||
      t.assignee.toLowerCase() === firstName ||
      (userEmail && t.assignee.toLowerCase() === userEmail)
    );
    const ownerMatch = t.owner && t.owner.split(/[,/]+/).map(o => o.trim().toLowerCase())
      .some(o => o === userName || o === firstName || (userEmail && o === userEmail));
    const reporterMatch = t.reporter && (
      t.reporter.toLowerCase() === userName ||
      t.reporter.toLowerCase() === firstName ||
      (userEmail && t.reporter.toLowerCase() === userEmail)
    );
    const createdByMatch = t.createdBy && (
      t.createdBy.toLowerCase() === userName ||
      t.createdBy.toLowerCase() === firstName ||
      (currentUserId && t.createdBy === currentUserId) ||
      (userEmail && t.createdBy.toLowerCase() === userEmail)
    );
    return assigneeMatch || ownerMatch || reporterMatch || createdByMatch;
  });

  const myOpen = myTasks.filter(t => t.status !== 'DONE');
  const myDone = myTasks.filter(t => t.status === 'DONE');
  const myOverdue = myOpen.filter(t => {
    if (!t.dueDate) return false;
    const d = new Date(t.dueDate);
    d.setHours(0, 0, 0, 0);
    return d < today;
  });

  // === Team Workload (always from full tasks, never from filtered set) ===
  const memberWorkload = members.map(m => {
    const assigned = tasks.filter(t => {
      const aMatch =
        (t.assignee && t.assignee.toLowerCase() === m.name.toLowerCase()) ||
        (t.assignee && m.email && t.assignee.toLowerCase() === m.email.toLowerCase()) ||
        (!t.assignee && t.owner && (
          t.owner.toLowerCase().includes(m.name.toLowerCase()) ||
          (m.email && t.owner.toLowerCase().includes(m.email.toLowerCase()))
        ));
      return aMatch;
    });

    const done = assigned.filter(t => t.status === 'DONE').length;
    const inProgress = assigned.filter(t => t.status === 'IN_PROGRESS').length;
    const inReview = assigned.filter(t => t.status === 'IN_REVIEW').length;
    const todo = assigned.filter(t => t.status === 'TODO').length;
    const backlog = assigned.filter(t => t.status === 'BACKLOG').length;
    const overdue = assigned.filter(t => {
      if (!t.dueDate || t.status === 'DONE') return false;
      const d = new Date(t.dueDate);
      d.setHours(0, 0, 0, 0);
      return d < today;
    }).length;
    const estimatedHours = assigned.reduce((s, t) => s + (t.timeEstimated || 0), 0);
    const loggedHours = assigned.reduce((s, t) => s + (t.timeLogged || 0), 0);
    const completionPct = assigned.length > 0 ? Math.round((done / assigned.length) * 100) : 0;

    return { ...m, assigned: assigned.length, done, inProgress, inReview, todo, backlog, overdue, estimatedHours, loggedHours, completionPct };
  });

  // === Activity ===
  const allActivities = tasks
    .flatMap(t => (t.activities || []).map(a => ({ ...a, taskTitle: t.title, taskId: t.id })))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 12);

  // === Project stats ===
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter(t => t.status === 'DONE').length;
  const inProgressTasks = tasks.filter(t => t.status === 'IN_PROGRESS' || t.status === 'IN_REVIEW').length;
  const overdueTasks = tasks.filter(t => {
    if (!t.dueDate || t.status === 'DONE') return false;
    const d = new Date(t.dueDate);
    d.setHours(0, 0, 0, 0);
    return d < today;
  }).length;
  const completionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const getRoleBadgeClass = (role: string) =>
    role === 'PRODUCT_MANAGER' ? 'role-badge role-badge-pm' : 'role-badge role-badge-intern';

  const getRoleLabel = (role: string) =>
    role === 'PRODUCT_MANAGER' ? 'PM' : 'Intern';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* ── 1. Welcome Bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: '0.75rem',
        padding: '0.875rem 1.25rem',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-xs)',
      }}>
        <div>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Welcome back, {member ? member.name : currentUserName}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.15rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              {userRoleDisplay} · Logmark AI Workspace
            </span>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
              fontSize: '0.7rem', fontWeight: 600,
              color: isOnline ? 'var(--status-done-text)' : 'var(--priority-critical-text)',
            }}>
              {isOnline ? <Wifi size={11} /> : <WifiOff size={11} />}
              {isOnline ? 'Connected' : 'Offline'}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <Calendar size={13} />
          <span>{currentDate}</span>
        </div>
      </div>

      {/* ── 2. Quick Actions ── */}
      <div className="quick-actions-row">
        <button className="quick-action-btn primary" onClick={onCreateWorkItem} id="dashboard-create-btn">
          <Plus size={14} /> Create Work Item
        </button>
        <button className="quick-action-btn" onClick={onImportSpreadsheet} id="dashboard-import-btn">
          <Upload size={14} /> Import Sheet
        </button>
      </div>

      {/* ── 3. Overview Metrics ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '0.6rem' }}>
        {[
          { label: 'Total Tasks',  value: totalTasks,       color: 'var(--text-primary)' },
          { label: 'Done',         value: doneTasks,         color: 'var(--status-done-text)' },
          { label: 'In Progress',  value: inProgressTasks,   color: 'var(--status-progress-text)' },
          { label: 'Overdue',      value: overdueTasks,      color: overdueTasks > 0 ? 'var(--priority-critical-text)' : 'var(--text-muted)' },
          { label: 'Completion',   value: `${completionRate}%`, color: 'var(--color-primary)' },
          { label: 'My Open',      value: myOpen.length,     color: 'var(--text-primary)' },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ padding: '0.65rem 0.875rem' }}>
            <span style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>
              {s.label}
            </span>
            <span style={{ fontSize: '1.35rem', fontWeight: 800, color: s.color, lineHeight: 1, display: 'block' }}>
              {s.value}
            </span>
          </div>
        ))}
      </div>

      {/* ── 4. My Workspace — full width, compact ── */}
      <div className="stat-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{
          padding: '0.7rem 1rem', borderBottom: '1px solid var(--border-color)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0 }}>
            <User size={15} style={{ color: 'var(--color-primary)' }} /> My Workspace
          </h3>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            {myTasks.length} work item{myTasks.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div style={{ padding: '0.75rem 1rem' }}>
          {/* Mini stat pills */}
          <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.65rem', flexWrap: 'wrap' }}>
            {[
              { label: 'Open',    value: myOpen.length,    color: 'var(--status-todo-text)' },
              { label: 'Done',    value: myDone.length,    color: 'var(--status-done-text)' },
              { label: 'Overdue', value: myOverdue.length, color: myOverdue.length > 0 ? 'var(--priority-critical-text)' : 'var(--text-muted)' },
              { label: 'Total',   value: myTasks.length,   color: 'var(--text-primary)' },
            ].map(s => (
              <div key={s.label} style={{
                display: 'flex', alignItems: 'baseline', gap: '0.25rem',
                padding: '0.3rem 0.55rem',
                background: 'var(--bg-hover)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
              }}>
                <span style={{ fontSize: '0.95rem', fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</span>
                <span style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>{s.label}</span>
              </div>
            ))}
          </div>

          {/* Task grid — responsive auto-fill */}
          {myTasks.length === 0 ? (
            <div style={{
              padding: '0.875rem', textAlign: 'center',
              color: 'var(--text-muted)', fontSize: '0.78rem',
              border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-sm)',
            }}>
              No work items assigned to you yet.
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: '0.3rem',
            }}>
              {myTasks.slice(0, 12).map(t => (
                <div key={t.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '0.35rem 0.55rem',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.78rem', gap: '0.5rem',
                  background: 'var(--bg-hover)',
                  overflow: 'hidden',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', minWidth: 0, flex: 1 }}>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.65rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                      {t.id}
                    </span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.title}
                    </span>
                  </div>
                  <StatusBadge status={t.status} />
                </div>
              ))}
              {myTasks.length > 12 && (
                <div style={{
                  padding: '0.35rem 0.55rem', fontSize: '0.7rem', color: 'var(--text-muted)',
                  border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-sm)',
                  textAlign: 'center', background: 'var(--bg-hover)',
                }}>
                  +{myTasks.length - 12} more — use Backlog to see all
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── 5. Team Workload & Allocation — FULL WIDTH ── */}
      <div className="stat-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{
          padding: '0.7rem 1rem', borderBottom: '1px solid var(--border-color)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0 }}>
            <Users size={15} style={{ color: 'var(--color-primary)' }} /> Team Workload &amp; Allocation
          </h3>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            {members.length} members
          </span>
        </div>

        {memberWorkload.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
            No team members found.
          </div>
        ) : (
          /* overflow-x: auto allows horizontal scroll on narrow screens */
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' as any }}>
            <table className="workload-table" style={{ minWidth: '820px', width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ position: 'sticky', left: 0, background: 'var(--bg-card)', zIndex: 2, minWidth: '140px' }}>Member</th>
                  <th style={{ minWidth: '85px' }}>Role</th>
                  <th style={{ textAlign: 'right', minWidth: '72px' }}>Assigned</th>
                  <th style={{ textAlign: 'right', minWidth: '58px' }}>To Do</th>
                  <th style={{ textAlign: 'right', minWidth: '82px' }}>In Progress</th>
                  <th style={{ textAlign: 'right', minWidth: '62px' }}>Review</th>
                  <th style={{ textAlign: 'right', minWidth: '55px' }}>Done</th>
                  <th style={{ textAlign: 'right', minWidth: '65px' }}>Overdue</th>
                  <th style={{ textAlign: 'right', minWidth: '68px' }}>Est. Hrs</th>
                  <th style={{ textAlign: 'right', minWidth: '65px' }}>Logged</th>
                  <th style={{ minWidth: '130px' }}>Progress</th>
                </tr>
              </thead>
              <tbody>
                {memberWorkload.map(m => (
                  <tr key={m.id}>
                    <td style={{ position: 'sticky', left: 0, background: 'var(--bg-card)', zIndex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div className="avatar" style={{ backgroundColor: m.avatarColor || '#3b82f6', flexShrink: 0 }}>
                          {m.name.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                          {m.name}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className={getRoleBadgeClass(m.role)}>
                        {getRoleLabel(m.role)}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>{m.assigned}</td>
                    <td style={{ textAlign: 'right', color: 'var(--status-todo-text)' }}>{m.todo}</td>
                    <td style={{ textAlign: 'right', color: 'var(--status-progress-text)' }}>{m.inProgress}</td>
                    <td style={{ textAlign: 'right', color: 'var(--status-review-text)' }}>{m.inReview}</td>
                    <td style={{ textAlign: 'right', color: 'var(--status-done-text)' }}>{m.done}</td>
                    <td style={{ textAlign: 'right', color: m.overdue > 0 ? 'var(--priority-critical-text)' : 'var(--text-muted)', fontWeight: m.overdue > 0 ? 700 : 400 }}>
                      {m.overdue}
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--text-secondary)', fontSize: '0.78rem' }}>{m.estimatedHours}h</td>
                    <td style={{ textAlign: 'right', color: 'var(--text-secondary)', fontSize: '0.78rem' }}>{m.loggedHours}h</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <div className="progress-bar-track" style={{ flex: 1, minWidth: '65px' }}>
                          <div
                            className={`progress-bar-fill${m.completionPct === 100 ? ' complete' : ''}`}
                            style={{ width: `${m.completionPct}%` }}
                          />
                        </div>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap', minWidth: '32px', textAlign: 'right' }}>
                          {m.completionPct}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── 6. Recent Activity — full width ── */}
      <div className="stat-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '0.7rem 1rem', borderBottom: '1px solid var(--border-color)' }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0 }}>
            <Activity size={15} style={{ color: 'var(--color-primary)' }} /> Recent Activity
          </h3>
        </div>
        <div style={{ padding: '0.75rem 1rem' }}>
          {allActivities.length === 0 ? (
            <div style={{
              padding: '1rem', textAlign: 'center',
              color: 'var(--text-muted)', fontSize: '0.78rem',
              border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-sm)',
            }}>
              No activity logged yet.
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: '0',
            }}>
              {allActivities.map((act, i) => (
                <div key={act.id} style={{
                  display: 'flex', gap: '0.55rem',
                  padding: '0.45rem 0.35rem',
                  borderBottom: i < allActivities.length - 1 ? '1px solid var(--border-color)' : 'none',
                }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: 'var(--color-primary)',
                    marginTop: '0.4rem', flexShrink: 0,
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.4rem', alignItems: 'baseline' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {act.user}
                      </span>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                        {getRelativeTime(act.timestamp)}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: '0.1rem 0 0', lineHeight: 1.35 }}>
                      {act.action}
                    </p>
                    <span style={{ fontSize: '0.63rem', color: 'var(--color-primary)', fontFamily: 'monospace' }}>
                      {act.taskId}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

// ── Helper sub-components ─────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    BACKLOG:     { bg: 'var(--status-backlog-pill)',  text: 'var(--status-backlog-text)',  label: 'Backlog'     },
    TODO:        { bg: 'var(--status-todo-pill)',     text: 'var(--status-todo-text)',     label: 'To Do'       },
    IN_PROGRESS: { bg: 'var(--status-progress-pill)', text: 'var(--status-progress-text)', label: 'In Progress' },
    IN_REVIEW:   { bg: 'var(--status-review-pill)',  text: 'var(--status-review-text)',   label: 'Review'      },
    DONE:        { bg: 'var(--status-done-pill)',     text: 'var(--status-done-text)',     label: 'Done'        },
  };
  const s = map[status] || map.TODO;
  return (
    <span style={{
      fontSize: '0.62rem', fontWeight: 700,
      padding: '0.1rem 0.32rem',
      borderRadius: 4,
      background: s.bg,
      color: s.text,
      flexShrink: 0,
      whiteSpace: 'nowrap',
    }}>
      {s.label}
    </span>
  );
}

function getRelativeTime(isoString: string): string {
  if (!isoString) return '';
  const diff = Date.now() - new Date(isoString).getTime();
  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hr  = Math.floor(min / 60);
  const day = Math.floor(hr  / 24);
  if (sec < 60) return 'Just now';
  if (min < 60) return `${min}m ago`;
  if (hr  < 24) return `${hr}h ago`;
  if (day === 1) return 'Yesterday';
  if (day < 7)  return `${day}d ago`;
  return new Date(isoString).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
