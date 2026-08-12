import React, { useState } from 'react';
import { Users, Plus, Trash2, UserPlus, Search, AlertTriangle } from 'lucide-react';
import type { Member, MemberRole, Task } from '../types';
import { useAuth } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';

interface MembersDirectoryProps {
  members: Member[];
  tasks: Task[];
  onAddMember: (name: string, role: MemberRole, email?: string) => void;
  onRemoveMember: (id: string) => void;
}

export const MembersDirectory: React.FC<MembersDirectoryProps> = ({
  members,
  tasks,
  onAddMember,
  onRemoveMember,
}) => {
  const { currentUser, currentUserId } = useAuth();
  const { userRole } = useWorkspace();

  const [name, setName] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [role, setRole] = useState<MemberRole>('PRODUCT_MANAGER');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  // Confirm delete modal state
  const [confirmDeleteMember, setConfirmDeleteMember] = useState<Member | null>(null);

  // Determine if current user can delete members (only PRODUCT_MANAGER role)
  const canDelete = userRole === 'PRODUCT_MANAGER';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAddMember(name.trim(), role, emailInput.trim() || undefined);
    setName('');
    setEmailInput('');
  };

  const handleDeleteClick = (member: Member) => {
    if (!canDelete) return; // extra guard
    setConfirmDeleteMember(member);
  };

  const handleConfirmDelete = () => {
    if (confirmDeleteMember && canDelete) {
      onRemoveMember(confirmDeleteMember.id);
    }
    setConfirmDeleteMember(null);
  };

  const getInitials = (n: string) => {
    return n.trim().split(/\s+/).map(x => x[0]).join('').toUpperCase().slice(0, 2);
  };

  const filteredMembers = members.filter(m => {
    const matchesSearch =
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.email && m.email.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesRole = roleFilter === 'ALL' || m.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const getRoleBadgeStyle = (r: MemberRole) => {
    switch (r) {
      case 'PRODUCT_MANAGER':
        return { backgroundColor: 'rgba(109,40,217,0.1)', color: '#7c3aed', border: '1px solid rgba(109,40,217,0.2)' };
      case 'INTERN':
        return { backgroundColor: 'rgba(217,119,6,0.1)', color: '#b45309', border: '1px solid rgba(217,119,6,0.2)' };
      default:
        return { backgroundColor: 'rgba(100, 116, 139, 0.1)', color: '#64748b', border: '1px solid rgba(100, 116, 139, 0.2)' };
    }
  };

  const getRoleLabel = (r: MemberRole) => {
    if (r === 'PRODUCT_MANAGER') return 'Product Manager';
    return 'Intern';
  };

  // Suppress unused vars lint warnings
  void currentUser;
  void currentUserId;

  return (
    <>
      {/* ── Confirm Delete Modal ── */}
      {confirmDeleteMember && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 300, backdropFilter: 'blur(3px)',
          animation: 'fadeIn 0.15s ease',
        }}>
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.5rem',
            maxWidth: '400px',
            width: '90%',
            boxShadow: 'var(--shadow-lg)',
            animation: 'slideUp 0.2s ease',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                backgroundColor: 'var(--priority-critical-bg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <AlertTriangle size={18} style={{ color: 'var(--color-danger)' }} />
              </div>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  Remove team member?
                </h3>
              </div>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '0.5rem' }}>
              You are about to remove <strong style={{ color: 'var(--text-primary)' }}>{confirmDeleteMember.name}</strong> from the workspace.
            </p>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.55, marginBottom: '1.25rem' }}>
              This action will remove the member from the workspace. Existing work items assigned to this member will not be deleted.
            </p>

            <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setConfirmDeleteMember(null)}
                autoFocus
              >
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={handleConfirmDelete}
              >
                <Trash2 size={14} /> Delete Member
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2.5fr', gap: '1.25rem' }}>

        {/* Add Member Form */}
        <div className="stat-card" style={{ alignSelf: 'start' }}>
          <h3 style={{
            fontSize: '0.85rem', fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            borderBottom: '1px solid var(--border-color)', paddingBottom: '0.65rem',
            marginBottom: '1rem', color: 'var(--text-primary)',
          }}>
            <UserPlus size={15} style={{ color: 'var(--color-primary)' }} /> Add Member
          </h3>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            <div className="form-group">
              <label htmlFor="member-name">Full Name</label>
              <input
                id="member-name"
                type="text"
                className="form-input"
                placeholder="e.g. Alex Rivera"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="member-email">Email Address</label>
              <input
                id="member-email"
                type="email"
                className="form-input"
                placeholder="e.g. alex@logmark-ai.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="member-role">Logmark Role</label>
              <select
                id="member-role"
                className="form-select"
                value={role}
                onChange={(e) => setRole(e.target.value as MemberRole)}
              >
                <option value="PRODUCT_MANAGER">Product Manager</option>
                <option value="INTERN">Intern</option>
              </select>
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
              <Plus size={15} /> Add to Directory
            </button>
          </form>
        </div>

        {/* Directory List */}
        <div className="stat-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Header */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            flexWrap: 'wrap', gap: '0.75rem',
            borderBottom: '1px solid var(--border-color)', paddingBottom: '0.65rem',
          }}>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0, color: 'var(--text-primary)' }}>
              <Users size={15} style={{ color: 'var(--color-primary)' }} /> Team Directory
              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', marginLeft: '0.15rem' }}>
                ({members.length})
              </span>
            </h3>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <div className="search-input-wrapper">
                <Search className="search-icon" size={13} />
                <input
                  type="text"
                  placeholder="Search name or email..."
                  className="search-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <select
                className="select-filter"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option value="ALL">All Roles</option>
                <option value="PRODUCT_MANAGER">Product Manager</option>
                <option value="INTERN">Intern</option>
              </select>
            </div>
          </div>

          {/* Permission notice for non-PM users */}
          {!canDelete && (
            <div style={{
              padding: '0.5rem 0.75rem',
              background: 'var(--bg-hover)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}>
              <AlertTriangle size={12} style={{ color: 'var(--color-warning)', flexShrink: 0 }} />
              Only Product Managers can add or remove team members.
            </div>
          )}

          {/* Member Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.875rem' }}>
            {filteredMembers.length === 0 ? (
              <div className="empty-state" style={{ gridColumn: '1 / -1', padding: '2.5rem 1rem' }}>
                <Users className="empty-state-icon" />
                <h3>No team members found</h3>
                <p>Try adjusting your search or role filter.</p>
              </div>
            ) : (
              filteredMembers.map(m => {
                const memberTasks = tasks.filter(t => {
                  const aMatch = (t.assignee && t.assignee.toLowerCase() === m.name.toLowerCase()) ||
                    (t.assignee && m.email && t.assignee.toLowerCase() === m.email.toLowerCase());
                  const oMatch = t.owner && t.owner.split(/[,/]+/).map(o => o.trim().toLowerCase())
                    .some(o => o === m.name.toLowerCase() || (m.email && o === m.email.toLowerCase()));
                  return aMatch || oMatch;
                });
                const openTasks = memberTasks.filter(t => t.status !== 'DONE').length;
                const doneTasks = memberTasks.filter(t => t.status === 'DONE').length;
                const pct = memberTasks.length > 0 ? Math.round((doneTasks / memberTasks.length) * 100) : 0;

                return (
                  <div
                    key={m.id}
                    className="task-card"
                    style={{
                      display: 'flex', flexDirection: 'column', gap: '0.65rem',
                      padding: '0.875rem', borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-card)',
                      position: 'relative',
                    }}
                  >
                    {/* Delete button — only shown to PRODUCT_MANAGER */}
                    {canDelete && (
                      <button
                        style={{
                          position: 'absolute', top: '0.6rem', right: '0.6rem',
                          padding: '0.28rem',
                          backgroundColor: 'transparent',
                          border: '1px solid transparent',
                          borderRadius: '50%',
                          cursor: 'pointer',
                          color: 'var(--text-muted)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={e => {
                          (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--priority-critical-bg)';
                          (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-danger)';
                          (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-danger)';
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                          (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent';
                          (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)';
                        }}
                        onClick={() => handleDeleteClick(m)}
                        title="Remove Member"
                        id={`delete-member-${m.id}`}
                      >
                        <Trash2 size={12} />
                      </button>
                    )}

                    {/* Avatar + Name + Role */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', paddingRight: canDelete ? '1.5rem' : 0 }}>
                      <div style={{
                        width: 38, height: 38, borderRadius: '50%',
                        backgroundColor: m.avatarColor || '#3b82f6',
                        color: '#fff', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontWeight: 700, fontSize: '0.9rem',
                        flexShrink: 0,
                      }}>
                        {getInitials(m.name)}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <span style={{
                          fontWeight: 700, display: 'block', fontSize: '0.85rem',
                          color: 'var(--text-primary)', overflow: 'hidden',
                          textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {m.name}
                        </span>
                        <span style={{
                          display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }} title={m.email}>
                          {m.email || '—'}
                        </span>
                        <span style={{
                          display: 'inline-block', marginTop: '0.2rem',
                          padding: '0.1rem 0.35rem', borderRadius: 4,
                          fontSize: '0.62rem', fontWeight: 700,
                          ...getRoleBadgeStyle(m.role),
                        }}>
                          {getRoleLabel(m.role)}
                        </span>
                      </div>
                    </div>

                    {/* Stats */}
                    <div style={{
                      borderTop: '1px solid var(--border-color)', paddingTop: '0.55rem',
                      display: 'flex', justifyContent: 'space-between',
                      fontSize: '0.75rem', color: 'var(--text-secondary)',
                    }}>
                      <div>
                        <span style={{ display: 'block', fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.88rem' }}>
                          {memberTasks.length}
                        </span>
                        <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                          Assigned
                        </span>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <span style={{ display: 'block', fontWeight: 800, color: 'var(--status-progress-text)', fontSize: '0.88rem' }}>
                          {openTasks}
                        </span>
                        <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                          Open
                        </span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ display: 'block', fontWeight: 800, color: 'var(--status-done-text)', fontSize: '0.88rem' }}>
                          {doneTasks}
                        </span>
                        <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                          Done
                        </span>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="progress-bar-track">
                      <div
                        className={`progress-bar-fill${pct === 100 ? ' complete' : ''}`}
                        style={{ width: `${pct}%` }}
                        title={`${pct}% complete`}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </>
  );
};
