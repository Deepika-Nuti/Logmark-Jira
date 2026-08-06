import React from 'react';
import { 
  Users, 
  TrendingUp, 
  ClipboardList,
  FolderKanban,
  Plus,
  Upload,
  Kanban,
  User,
  ListTodo,
  Calendar,
  Sparkles,
  Activity,
  Wifi,
  WifiOff
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
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  tasks,
  members,
  stats,
  onCreateWorkItem,
  onImportSpreadsheet,
  onNavigate,
}) => {
  const { currentUserId, currentUser } = useAuth();
  const { userRole: effectiveRole } = useWorkspace();
  const _stats = stats;
  if (_stats === undefined) {
    // Satisfy TypeScript unused variable check
  }

  const isEmployee = effectiveRole === 'EMPLOYEE' || effectiveRole === 'INTERN';

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
                 (currentUser && members.find(m => m.email?.toLowerCase() === currentUser.toLowerCase())) ||
                 members.find(m => m.name.toLowerCase() === currentUserName.toLowerCase());
  
  const userRoleDisplay = member ? member.role.replace('_', ' ') : effectiveRole.replace('_', ' ');
  const currentDate = new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  // Use all tasks for overall completion rate
  const doneCount = tasks.filter(t => t.status === 'DONE').length;
  const completionRate = tasks.length > 0 
    ? Math.round((doneCount / tasks.length) * 100) 
    : 0;

  // Workload calculations per member in the runtime member registry
  const memberWorkload = members.map(m => {
    const assignedTasks = tasks.filter(t => {
      const assigneeMatch = (t.assignee && t.assignee.toLowerCase() === m.name.toLowerCase()) || 
                            (t.assignee && m.email && t.assignee.toLowerCase() === m.email.toLowerCase());
      const ownerMatch = t.owner && t.owner.split(/[,/]+/).map(o => o.trim().toLowerCase()).some(o => o === m.name.toLowerCase() || (m.email && o === m.email.toLowerCase()));
      return assigneeMatch || ownerMatch;
    });
    const activeTasks = assignedTasks.filter(t => t.status !== 'DONE').length;
    const doneTasks = assignedTasks.filter(t => t.status === 'DONE').length;
    const utilization = assignedTasks.length > 0 
      ? Math.round((doneTasks / assignedTasks.length) * 100) 
      : 0;

    return {
      ...m,
      taskCount: assignedTasks.length,
      activeTasks,
      doneCount: doneTasks,
      utilization,
    };
  });

  // Status distributions list including all tasks
  const backlogCount = tasks.filter(t => t.status === 'BACKLOG').length;
  const todoCount = tasks.filter(t => t.status === 'TODO').length;
  const progressCount = tasks.filter(t => t.status === 'IN_PROGRESS').length;
  const reviewCount = tasks.filter(t => t.status === 'IN_REVIEW').length;
  const doneCountForDistribution = tasks.filter(t => t.status === 'DONE').length;

  const statusLabels = [
    { label: 'Backlog', count: backlogCount, color: 'var(--status-backlog-text)', bg: 'var(--status-backlog-pill)' },
    { label: 'To Do', count: todoCount, color: 'var(--status-todo-text)', bg: 'var(--status-todo-pill)' },
    { label: 'In Progress', count: progressCount, color: 'var(--status-progress-text)', bg: 'var(--status-progress-pill)' },
    { label: 'In Review', count: reviewCount, color: 'var(--status-review-text)', bg: 'var(--status-review-pill)' },
    { label: 'Done', count: doneCountForDistribution, color: 'var(--status-done-text)', bg: 'var(--status-done-pill)' },
  ];

  // My Workspace Calculations
  const myTasks = tasks.filter(t => {
    const assigneeMatch = t.assignee && (t.assignee.toLowerCase() === currentUserName.toLowerCase() || (currentUser && t.assignee.toLowerCase() === currentUser.toLowerCase()));
    const ownerMatch = t.owner && (t.owner.toLowerCase().includes(currentUserName.toLowerCase()) || (currentUser && t.owner.toLowerCase().includes(currentUser.toLowerCase())));
    return assigneeMatch || ownerMatch;
  });

  const myOpenTasks = myTasks.filter(t => t.status !== 'DONE');
  const myCompletedTasks = myTasks.filter(t => t.status === 'DONE');

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const myCompletedThisWeek = myCompletedTasks.filter(t => {
    return new Date(t.updatedAt || t.createdAt) >= sevenDaysAgo;
  }).length;

  const myHighPriorityAssigned = myOpenTasks.filter(t => t.priority === 'HIGH' || t.priority === 'CRITICAL').length;

  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  const myRecentlyAssigned = myTasks.filter(t => {
    return new Date(t.createdAt) >= threeDaysAgo;
  }).length;

  const isOnline = navigator.onLine;

  // Activity feed
  const allActivities = tasks
    .flatMap(t => (t.activities || []).map(a => ({ ...a, taskTitle: t.title, taskId: t.id })))
    .sort((x, y) => new Date(y.timestamp).getTime() - new Date(x.timestamp).getTime())
    .slice(0, 5);

  const getRoleBadgeStyle = (r: string) => {
    switch (r) {
      case 'PRODUCT_MANAGER':
        return { backgroundColor: 'rgba(139, 92, 246, 0.12)', color: '#8b5cf6', border: '1px solid rgba(139, 92, 246, 0.25)' };
      case 'DEVELOPER':
        return { backgroundColor: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.25)' };
      case 'QA':
        return { backgroundColor: 'rgba(16, 185, 129, 0.12)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.25)' };
      case 'INTERN':
        return { backgroundColor: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.25)' };
      case 'EMPLOYEE':
        return { backgroundColor: 'rgba(100, 116, 139, 0.12)', color: '#64748b', border: '1px solid rgba(100, 116, 139, 0.25)' };
      default:
        return { backgroundColor: 'rgba(236, 72, 153, 0.12)', color: '#ec4899', border: '1px solid rgba(236, 72, 153, 0.25)' };
    }
  };

  return (
    <div className="dashboard-view-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
      
      {/* 1. Welcome Header */}
      <div className="stat-card" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '1.5rem 2rem',
        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(139, 92, 246, 0.05) 100%)',
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        boxShadow: 'var(--shadow-sm)',
        backdropFilter: 'blur(8px)',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            backgroundColor: 'rgba(59, 130, 246, 0.15)',
            color: 'var(--color-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <FolderKanban size={24} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              Welcome back, {member ? member.name : currentUserName} <Sparkles size={18} style={{ color: '#f59e0b', fill: '#f59e0b' }} />
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 700 }}>
                {userRoleDisplay} | Logmark AI
              </span>
              <span style={{ color: 'var(--border-color)', fontSize: '0.75rem' }}>•</span>
              <span style={{ fontSize: '0.75rem', color: isOnline ? 'var(--status-done-text)' : 'var(--priority-critical-text)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                {isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
                {isOnline ? 'Connected' : 'Offline'}
              </span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
            <Calendar size={14} />
            <span>{currentDate}</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            Logmark Jira Workspace active • {members.length} Organization Members
          </span>
        </div>
      </div>

      {/* 2. Quick Actions Panel */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
        
        <button 
          onClick={onCreateWorkItem}
          className="task-card"
          style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center',
            gap: '0.5rem', 
            padding: '1rem 0.5rem', 
            borderRadius: '12px', 
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-card)',
            cursor: 'pointer',
            transition: 'all 0.25s var(--transition-normal)',
            height: '90px'
          }}
        >
          <Plus size={20} style={{ color: 'var(--color-primary)' }} />
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>Create Task</span>
        </button>

        <button 
          onClick={onImportSpreadsheet}
          className="task-card"
          style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center',
            gap: '0.5rem', 
            padding: '1rem 0.5rem', 
            borderRadius: '12px', 
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-card)',
            cursor: isEmployee ? 'not-allowed' : 'pointer',
            opacity: isEmployee ? 0.4 : 1,
            transition: 'all 0.25s var(--transition-normal)',
            height: '90px'
          }}
          disabled={isEmployee}
          title={isEmployee ? 'Employees and Interns do not have permission to import spreadsheets.' : 'Import Spreadsheet'}
        >
          <Upload size={20} style={{ color: '#10b981' }} />
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>Import Sheet</span>
        </button>

        <button 
          onClick={() => onNavigate('BOARD')}
          className="task-card"
          style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center',
            gap: '0.5rem', 
            padding: '1rem 0.5rem', 
            borderRadius: '12px', 
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-card)',
            cursor: 'pointer',
            transition: 'all 0.25s var(--transition-normal)',
            height: '90px'
          }}
        >
          <Kanban size={20} style={{ color: '#f59e0b' }} />
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>Kanban Board</span>
        </button>

        <button 
          onClick={() => onNavigate('BACKLOG')}
          className="task-card"
          style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center',
            gap: '0.5rem', 
            padding: '1rem 0.5rem', 
            borderRadius: '12px', 
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-card)',
            cursor: 'pointer',
            transition: 'all 0.25s var(--transition-normal)',
            height: '90px'
          }}
        >
          <ListTodo size={20} style={{ color: '#ec4899' }} />
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>Backlog View</span>
        </button>

        <button 
          onClick={() => onNavigate('MEMBERS')}
          className="task-card"
          style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center',
            gap: '0.5rem', 
            padding: '1rem 0.5rem', 
            borderRadius: '12px', 
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-card)',
            cursor: 'pointer',
            transition: 'all 0.25s var(--transition-normal)',
            height: '90px'
          }}
        >
          <Users size={20} style={{ color: '#8b5cf6' }} />
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>Team Registry</span>
        </button>

        <button 
          onClick={() => onNavigate('PROFILE')}
          className="task-card"
          style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center',
            gap: '0.5rem', 
            padding: '1rem 0.5rem', 
            borderRadius: '12px', 
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-card)',
            cursor: 'pointer',
            transition: 'all 0.25s var(--transition-normal)',
            height: '90px'
          }}
        >
          <User size={20} style={{ color: '#14b8a6' }} />
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>My Profile</span>
        </button>

      </div>

      {/* Main Workspace Layout — Visible to ALL logged in users */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
        
        {/* Left Side: My Workspace & Team Workload */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* My Workspace Section */}
          <div className="stat-card" style={{
            padding: '1.5rem',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <ListTodo size={18} style={{ color: 'var(--color-primary)' }} /> My Workspace
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
              <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>My Open Tasks</span>
                <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', display: 'block', marginTop: '0.2rem' }}>{myOpenTasks.length}</span>
              </div>
              <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>Completed This Week</span>
                <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10b981', display: 'block', marginTop: '0.2rem' }}>{myCompletedThisWeek}</span>
              </div>
              <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>High Priority</span>
                <span style={{ fontSize: '1.25rem', fontWeight: 800, color: myHighPriorityAssigned > 0 ? '#ef4444' : 'var(--text-primary)', display: 'block', marginTop: '0.2rem' }}>{myHighPriorityAssigned}</span>
              </div>
              <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>Recently Assigned</span>
                <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', display: 'block', marginTop: '0.2rem' }}>{myRecentlyAssigned}</span>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>Assigned To Me</span>
              {myTasks.length === 0 ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', border: '1px dashed var(--border-color)', borderRadius: '8px' }}>
                  No work items assigned. Your queue is clean!
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto' }}>
                  {myTasks.map(t => (
                    <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: 'var(--bg-app)', fontSize: '0.8rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.75rem' }}>{t.id}</span>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                      </div>
                      <span style={{
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        padding: '0.1rem 0.35rem',
                        borderRadius: '4px',
                        backgroundColor: t.status === 'DONE' ? 'var(--status-done-pill)' : 'var(--status-progress-pill)',
                        color: t.status === 'DONE' ? 'var(--status-done-text)' : 'var(--status-progress-text)',
                        flexShrink: 0
                      }}>{t.status.replace('_', ' ')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Team Workload & Allocation — VISIBLE TO ALL ROLES */}
          <div className="stat-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.5rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, color: 'var(--text-primary)' }}>
                <Users size={18} style={{ color: 'var(--color-primary)' }} /> Team Workload & Allocation
              </h3>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                {members.length} Active Members
              </span>
            </div>
            
            {memberWorkload.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', border: '1.5px dashed var(--border-color)', borderRadius: '12px' }}>
                <Users size={32} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
                <p style={{ fontSize: '0.85rem', margin: 0 }}>No team members created yet.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                {memberWorkload.map(m => {
                  const totalAssigned = m.taskCount;
                  const activeCount = m.activeTasks;
                  const completedCount = m.doneCount;
                  const utilizationPercent = m.utilization;

                  return (
                    <div key={m.id} className="task-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)' }}>
                      
                      {/* Avatar, Name, Email, Role Badge */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          backgroundColor: m.avatarColor || '#3b82f6',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: '0.95rem',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                          flexShrink: 0
                        }}>
                          {m.name.charAt(0).toUpperCase()}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.25rem' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{m.name}</span>
                            <span style={{ 
                              fontSize: '0.6rem', 
                              fontWeight: 700, 
                              padding: '0.1rem 0.35rem', 
                              borderRadius: '4px',
                              ...getRoleBadgeStyle(m.role)
                            }}>
                              {m.role.replace('_', ' ')}
                            </span>
                          </div>
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '0.1rem' }} title={m.email}>
                            {m.email}
                          </span>
                        </div>
                      </div>

                      {/* Workload Stats Grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem', backgroundColor: 'var(--bg-app)', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <div style={{ textAlign: 'center' }}>
                          <span style={{ display: 'block', fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Assigned</span>
                          <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)' }}>{totalAssigned}</span>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <span style={{ display: 'block', fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Active</span>
                          <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--status-progress-text)' }}>{activeCount}</span>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <span style={{ display: 'block', fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Done</span>
                          <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--status-done-text)' }}>{completedCount}</span>
                        </div>
                      </div>

                      {/* Progress Bar & Utilization */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
                          <span>Utilization</span>
                          <span style={{ fontWeight: 800 }}>{utilizationPercent}%</span>
                        </div>
                        <div style={{ height: '6px', background: 'var(--bg-hover)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ 
                            width: `${utilizationPercent}%`, 
                            height: '100%', 
                            backgroundColor: utilizationPercent === 100 ? 'var(--status-done-text)' : 'var(--color-primary)', 
                            borderRadius: '3px'
                          }} />
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Team Overview, Charts & Recent Activity */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Team Overview (Global Metrics) */}
          <div className="stat-card" style={{ padding: '1.5rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '1rem', boxShadow: 'var(--shadow-sm)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', margin: 0 }}>
              <TrendingUp size={18} style={{ color: 'var(--color-primary)' }} /> Team Overview
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '0.5rem' }}>
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Completion Rate</span>
                <span style={{ fontSize: '2rem', fontWeight: 800, display: 'block' }}>{completionRate}%</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{doneCount} of {tasks.length} total tasks</span>
              </div>
              <div style={{
                position: 'relative',
                width: '70px',
                height: '70px',
                borderRadius: '50%',
                background: `conic-gradient(var(--status-done-text) ${completionRate}%, var(--border-color) 0)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--bg-card)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '0.85rem'
                }}>🎯</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', display: 'block', fontWeight: 600 }}>PENDING</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {tasks.filter(t => t.status === 'TODO' || t.status === 'BACKLOG').length}
                </span>
              </div>
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', display: 'block', fontWeight: 600 }}>IN PROGRESS</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--status-progress-text)' }}>
                  {tasks.filter(t => t.status === 'IN_PROGRESS' || t.status === 'IN_REVIEW').length}
                </span>
              </div>
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', display: 'block', fontWeight: 600 }}>CRITICAL</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--priority-critical-text)' }}>
                  {tasks.filter(t => t.priority === 'CRITICAL').length}
                </span>
              </div>
            </div>
          </div>

          {/* Status Distribution */}
          <div className="stat-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', boxShadow: 'var(--shadow-sm)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', margin: 0 }}>
              <ClipboardList size={18} style={{ color: 'var(--color-primary)' }} /> Task Status Distribution
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {statusLabels.map((st, i) => {
                const sharePercent = tasks.length > 0 ? Math.round((st.count / tasks.length) * 100) : 0;
                return (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                      <span style={{ color: st.color, fontWeight: 700, padding: '0.15rem 0.45rem', backgroundColor: st.bg, borderRadius: '4px', fontSize: '0.75rem' }}>{st.label}</span>
                      <span style={{ fontWeight: 800 }}>{st.count} ({sharePercent}%)</span>
                    </div>
                    <div style={{ height: '8px', background: 'var(--bg-hover)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ 
                         width: `${sharePercent}%`, 
                         height: '100%', 
                         backgroundColor: st.color,
                         borderRadius: '4px'
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Activity Feed */}
          <div className="stat-card" style={{ padding: '1.5rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '1rem', boxShadow: 'var(--shadow-sm)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', margin: 0 }}>
              <Activity size={18} style={{ color: 'var(--color-primary)' }} /> Recent Workspace Activity
            </h3>
            {allActivities.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.8rem', border: '1px dashed var(--border-color)', borderRadius: '8px' }}>
                No activity logs recorded.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {allActivities.map((act) => (
                  <div key={act.id} style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>{act.user}</span>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{getRelativeTime(act.timestamp)}</span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{act.action}</span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--color-primary)', fontFamily: 'monospace', fontWeight: 600 }}>
                      {act.taskId} • {act.taskTitle}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
};

// Internal minimal relative time helper
function getRelativeTime(isoString: string) {
  if (!isoString) return '';
  const now = new Date();
  const past = new Date(isoString);
  const diffMs = now.getTime() - past.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;
  return past.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
