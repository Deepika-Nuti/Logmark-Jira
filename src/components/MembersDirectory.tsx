import React, { useState } from 'react';
import { Users, Plus, Trash2, UserPlus, Search } from 'lucide-react';
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
  const { currentUserId, currentUser } = useAuth();
  const { userRole } = useWorkspace();
  const isEmployee = userRole === 'EMPLOYEE' || userRole === 'INTERN';
  const [name, setName] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [role, setRole] = useState<MemberRole>('DEVELOPER');
  
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAddMember(name.trim(), role, emailInput.trim() || undefined);
    setName('');
    setEmailInput('');
  };

  const getInitials = (n: string) => {
    return n.trim().split(/\s+/).map(x => x[0]).join('').toUpperCase().slice(0, 2);
  };

  // Filter members based on search query and role filter
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
        return { backgroundColor: 'rgba(139, 92, 246, 0.12)', color: '#8b5cf6', border: '1px solid rgba(139, 92, 246, 0.25)' };
      case 'DEVELOPER':
        return { backgroundColor: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.25)' };
      case 'QA':
        return { backgroundColor: 'rgba(16, 185, 129, 0.12)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.25)' };
      case 'INTERN':
        return { backgroundColor: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.25)' };
      case 'EMPLOYEE':
        return { backgroundColor: 'rgba(100, 116, 139, 0.12)', color: '#64748b', border: '1px solid rgba(100, 116, 139, 0.25)' };
      default: // DESIGNER
        return { backgroundColor: 'rgba(236, 72, 153, 0.12)', color: '#ec4899', border: '1px solid rgba(236, 72, 153, 0.25)' };
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: isEmployee ? '1fr' : '1fr 2.5fr', gap: '1.5rem' }}>
      
      {/* Create Team Member Form — Admin/Manager/Developer only */}
      {!isEmployee && (
      <div className="stat-card" style={{ padding: '1.5rem', alignSelf: 'start', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>
          <UserPlus size={18} style={{ color: 'var(--color-primary)' }} /> Add Member
        </h3>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group">
            <label htmlFor="member-name" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Full Name</label>
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
            <label htmlFor="member-email" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Email Address</label>
            <input
              id="member-email"
              type="email"
              className="form-input"
              placeholder="e.g. alex.rivera@logmark-ai.com"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="member-role" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Logmark Role</label>
            <select
              id="member-role"
              className="form-select"
              value={role}
              onChange={(e) => setRole(e.target.value as MemberRole)}
            >
              <option value="DEVELOPER">Developer</option>
              <option value="DESIGNER">Designer</option>
              <option value="QA">QA / Tester</option>
              <option value="PRODUCT_MANAGER">Product Manager</option>
              <option value="INTERN">Intern</option>
              <option value="EMPLOYEE">Employee</option>
            </select>
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Plus size={16} /> Add to Directory
          </button>
        </form>
      </div>
      )}

      {/* Directory List Container */}
      <div className="stat-card" style={{ padding: '1.5rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        
        {/* Header & Quick search filters */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, color: 'var(--text-primary)' }}>
            <Users size={18} style={{ color: 'var(--color-primary)' }} /> Team Directory ({members.length})
          </h3>
          
          {/* Filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <div className="search-input-wrapper" style={{ minWidth: '180px' }}>
              <Search className="search-icon" size={14} />
              <input
                type="text"
                placeholder="Search name or email..."
                className="search-input"
                style={{ padding: '0.4rem 0.5rem 0.4rem 2rem', fontSize: '0.8rem' }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <select
              className="select-filter"
              style={{ padding: '0.4rem 1.5rem 0.4rem 0.5rem', fontSize: '0.8rem' }}
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="ALL">All Roles</option>
              <option value="PRODUCT_MANAGER">Product Manager</option>
              <option value="INTERN">Intern</option>
              <option value="DEVELOPER">Developer</option>
              <option value="DESIGNER">Designer</option>
              <option value="QA">QA / Tester</option>
              <option value="EMPLOYEE">Employee</option>
            </select>
          </div>
        </div>

        {/* Directory Card Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem' }}>
          {filteredMembers.length === 0 ? (
            <div className="empty-state" style={{ gridColumn: '1 / -1', padding: '3rem 1rem' }}>
              <Users className="empty-state-icon" />
              <h3>No team members found</h3>
              <p>Try resetting filters or check the spelling.</p>
            </div>
          ) : (
            filteredMembers.map(m => {
              // Match tasks using owner/assignee column
              const memberTasks = tasks.filter(t => {
                const assigneeMatch = (t.assignee && t.assignee.toLowerCase() === m.name.toLowerCase()) || 
                                      (t.assignee && m.email && t.assignee.toLowerCase() === m.email.toLowerCase());
                const ownerMatch = t.owner && t.owner.split(/[,/]+/).map(o => o.trim().toLowerCase()).some(o => o === m.name.toLowerCase() || (m.email && o === m.email.toLowerCase()));
                return assigneeMatch || ownerMatch;
              });
              const openTasks = memberTasks.filter(t => t.status !== 'DONE').length;
              
              return (
                <div 
                  key={m.id} 
                  className="task-card"
                  style={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    gap: '0.75rem',
                    padding: '1rem', 
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)', 
                    backgroundColor: 'var(--bg-app)',
                    position: 'relative'
                  }}
                >
                  {/* Delete button — Admin/Manager/Developer only */}
                  {!isEmployee && (
                  <button
                    className="btn btn-danger"
                    style={{ 
                      position: 'absolute',
                      top: '0.75rem',
                      right: '0.75rem',
                      padding: '0.3rem', 
                      backgroundColor: 'rgba(239, 68, 68, 0.08)', 
                      color: '#ef4444', 
                      borderColor: 'transparent',
                      borderRadius: '50%'
                    }}
                    onClick={() => {
                      if (confirm(`Remove ${m.name} from directory? Unassigns their active tasks.`)) {
                        onRemoveMember(m.id);
                      }
                    }}
                    title="Remove Member"
                  >
                    <Trash2 size={12} />
                  </button>
                  )}

                  {/* Profile Info */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem' }}>
                    <div style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '50%',
                      backgroundColor: m.avatarColor || '#3b82f6',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: '1rem',
                      boxShadow: '0 2px 8px -2px rgba(0, 0, 0, 0.15)',
                      flexShrink: 0
                    }}>
                      {getInitials(m.name)}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <span style={{ fontWeight: 800, display: 'block', fontSize: '0.9rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={m.name}>
                        {m.name}
                      </span>
                      <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '0.1rem' }} title={m.email}>
                        {m.email}
                      </span>
                      <span style={{ 
                        display: 'inline-block',
                        padding: '0.15rem 0.35rem',
                        borderRadius: '4px',
                        fontSize: '0.6rem',
                        fontWeight: 700,
                        marginTop: '0.25rem',
                        ...getRoleBadgeStyle(m.role)
                      }}>
                        {m.role.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  {/* Metrics details */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                    <div style={{ textAlign: 'left' }}>
                      <span style={{ display: 'block', fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{memberTasks.length}</span>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Total Tasks</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ display: 'block', fontWeight: 800, color: 'var(--color-primary)', fontSize: '0.9rem' }}>{openTasks}</span>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Open Issues</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

    </div>
  );
};
