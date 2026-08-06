import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import type { Task, Member, MemberRole, ActivityLog, TaskStatus, WorkItemType, Attachment } from '../types';
import { loadWorkspace, saveWorkspace } from '../utils/storage';
import type { WorkspaceState, ViewType } from '../utils/storage';
import { useTheme } from './ThemeContext';
import { useToast } from './ToastContext';
import { useAuth } from './AuthContext';
import { supabase, isSupabaseConfigured } from '../utils/supabaseClient';
import { 
  DEFAULT_MEMBERS, 
  ORG_MEMBER_EMAIL_ROLES, 
  sanitizeAndDeduplicateMembers, 
  normalizeMemberReference, 
  lookupMemberByEmail 
} from '../config/members';

export interface ThreadedComment {
  id: string;
  userId: string;
  authorName: string;
  authorEmail: string;
  text: string;
  timestamp: string;
}

export interface ThreadedCommentsPayload {
  techNotes: string;
  commentsList: ThreadedComment[];
  attachments: Attachment[];
}

export function parseComments(commentsStr: string | null | undefined): ThreadedCommentsPayload {
  if (!commentsStr) {
    return { techNotes: '', commentsList: [], attachments: [] };
  }
  const trimmed = commentsStr.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && (typeof parsed.techNotes === 'string' || Array.isArray(parsed.commentsList))) {
        return {
          techNotes: parsed.techNotes || '',
          commentsList: Array.isArray(parsed.commentsList) ? parsed.commentsList : [],
          attachments: Array.isArray(parsed.attachments) ? parsed.attachments : [],
        };
      }
    } catch {
      // Fallback to text
    }
  }
  return {
    techNotes: commentsStr,
    commentsList: [],
    attachments: [],
  };
}

export function checkPermission(
  role: MemberRole,
  action: 'CREATE' | 'EDIT' | 'DELETE' | 'IMPORT' | 'EXPORT' | 'ASSIGN' | 'PRIORITY' | 'MOVE' | 'COMMENT' | 'STATUS' | 'LOG_WORK',
  task?: Partial<Task>,
  userName?: string
): { allowed: boolean; reason?: string } {
  // ADMIN has full access
  if (role === 'ADMIN') {
    return { allowed: true };
  }

  // PRODUCT_MANAGER has almost full access except deletion
  if (role === 'PRODUCT_MANAGER') {
    if (action === 'DELETE') {
      return { allowed: false, reason: "Only Administrators can delete work items." };
    }
    return { allowed: true };
  }

  // DEVELOPER permissions — broad access for development & testing
  if (role === 'DEVELOPER') {
    if (action === 'DELETE') {
      return { allowed: false, reason: "Developers do not have permission to delete work items." };
    }
    return { allowed: true };
  }

  // QA permissions
  if (role === 'QA') {
    if (['DELETE', 'IMPORT'].includes(action)) {
      return { allowed: false, reason: `QA roles do not have permission to ${action.toLowerCase()} work items.` };
    }
    if (action === 'CREATE' && task?.type === 'FEATURE') {
      return { allowed: false, reason: "QA roles cannot create Feature items." };
    }
    if (['STATUS', 'COMMENT', 'EDIT'].includes(action)) {
      return { allowed: true };
    }
    return { allowed: false, reason: "QA roles do not have permission for this action." };
  }

  // EMPLOYEE & INTERN permissions — can manage their own work items
  if (role === 'EMPLOYEE' || role === 'INTERN') {
    if (['DELETE', 'IMPORT'].includes(action)) {
      return { allowed: false, reason: `${role === 'INTERN' ? 'Interns' : 'Employees'} do not have permission to ${action.toLowerCase()} work items.` };
    }
    if (action === 'ASSIGN') {
      return { allowed: false, reason: `${role === 'INTERN' ? 'Interns' : 'Employees'} cannot assign work items to others.` };
    }
    if (action === 'CREATE' && task?.type === 'FEATURE') {
      return { allowed: false, reason: `${role === 'INTERN' ? 'Interns' : 'Employees'} cannot create Feature items.` };
    }
    if (action === 'CREATE' && (task?.type === 'TASK' || task?.type === 'BUG' || task?.type === 'IMPROVEMENT')) {
      return { allowed: true };
    }
    const isOwn = task && userName && (
      (task.assignee && task.assignee.toLowerCase() === userName.toLowerCase()) ||
      (task.reporter && task.reporter.toLowerCase() === userName.toLowerCase()) ||
      (task.owner && task.owner.toLowerCase().includes(userName.toLowerCase())) ||
      (task.createdBy && task.createdBy.toLowerCase() === userName.toLowerCase())
    );
    if (['EDIT', 'STATUS', 'MOVE', 'LOG_WORK', 'PRIORITY'].includes(action)) {
      if (!task?.id) return { allowed: true }; // New task creation
      if (isOwn) return { allowed: true };
      return { allowed: false, reason: `${role === 'INTERN' ? 'Interns' : 'Employees'} can only modify their own work items.` };
    }
    if (action === 'COMMENT') {
      return { allowed: true };
    }
    return { allowed: false, reason: "Unauthorized role for this action." };
  }

  return { allowed: false, reason: "Unauthorized role." };
}

interface WorkspaceContextType {
  tasks: Task[];
  members: Member[];
  activeView: ViewType;
  selectedTaskId: string | null;
  filters: WorkspaceState['filters'];
  sorting: {
    field: string;
    direction: 'asc' | 'desc';
  };
  dashboard: {
    selectedChart: string;
  };
  isRestoring: boolean;
  setTasks: (tasks: Task[]) => void;
  setMembers: (members: Member[]) => void;
  setActiveView: (view: ViewType) => void;
  setSelectedTaskId: (id: string | null) => void;
  setFilters: (filters: Partial<WorkspaceState['filters']>) => void;
  setSorting: (sorting: WorkspaceState['sorting']) => void;
  setDashboard: (dashboard: WorkspaceState['dashboard']) => void;
  userRole: MemberRole;
  userDisplayName: string;
  currentUserEmail: string | null;
  
  // Actions
  handleSaveTask: (taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'activities'> & { id?: string; activities?: ActivityLog[] }) => void;
  handleStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  handleDeleteTask: (id: string) => void;
  handleAddMember: (name: string, role: MemberRole, email?: string) => void;
  handleRemoveMember: (id: string) => void;
  importWorkspaceData: (importedTasks: Task[], importedMembers: Member[], shouldMerge: boolean) => void;
  registerOrMergeMember: (memberData: Partial<Member> & { name: string; email?: string }) => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { theme, setThemeDirectly } = useTheme();
  const themeRef = useRef(theme);
  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);

  const { addToast } = useToast();
  const { isAuthenticated, currentUserId, currentUser } = useAuth();
  
  const [isRestoring, setIsRestoring] = useState(true);

  // Fallback standalone local storage state loading
  const initialLocal = useRef<WorkspaceState | null>(null);
  if (!initialLocal.current && (!isSupabaseConfigured || !isAuthenticated)) {
    initialLocal.current = loadWorkspace();
  }

  const [tasks, setTasksState] = useState<Task[]>(initialLocal.current ? initialLocal.current.tasks : []);
  const [members, setMembersState] = useState<Member[]>(() => {
    const loaded = initialLocal.current ? initialLocal.current.members : [];
    return sanitizeAndDeduplicateMembers(loaded.length > 0 ? loaded : DEFAULT_MEMBERS);
  });
  const [activeView, setActiveViewState] = useState<ViewType>(initialLocal.current ? initialLocal.current.activeView : 'DASHBOARD');
  const [selectedTaskId, setSelectedTaskIdState] = useState<string | null>(initialLocal.current ? initialLocal.current.selectedTaskId : null);
  const [filters, setFiltersState] = useState<WorkspaceState['filters']>(() => {
    const base = initialLocal.current ? initialLocal.current.filters : null;
    return {
      priority: 'ALL',
      status: 'ALL',
      assignee: 'ALL',
      search: '',
      type: 'ALL',
      parentFeature: 'ALL',
      owner: 'ALL',
      module: 'ALL',
      ...(base || {})
    };
  });
  const [sorting, setSortingState] = useState(initialLocal.current ? initialLocal.current.sorting : {
    field: 'createdAt',
    direction: 'desc' as 'asc' | 'desc',
  });
  const [dashboard, setDashboardState] = useState(initialLocal.current ? initialLocal.current.dashboard : {
    selectedChart: 'completion',
  });

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
  const currentUserMember = members.find(m => m.id === currentUserId) || 
                            (currentUser && members.find(m => m.email.toLowerCase() === currentUser.toLowerCase())) ||
                            members.find(m => m.name.toLowerCase() === currentUserName.toLowerCase());
  const userRole: MemberRole = currentUserMember 
    ? currentUserMember.role 
    : (currentUser && ORG_MEMBER_EMAIL_ROLES[currentUser.toLowerCase()]) || 'EMPLOYEE';
  const userDisplayName = currentUserMember ? currentUserMember.name : currentUserName;

  const effectiveRole: MemberRole =
    currentUser && ORG_MEMBER_EMAIL_ROLES[currentUser.toLowerCase()]
      ? ORG_MEMBER_EMAIL_ROLES[currentUser.toLowerCase()]
      : userRole;


  const activeViewRef = useRef(activeView);
  const filtersRef = useRef(filters);
  const sortingRef = useRef(sorting);

  useEffect(() => {
    activeViewRef.current = activeView;
    filtersRef.current = filters;
    sortingRef.current = sorting;
  }, [activeView, filters, sorting]);

  // State setters
  const setTasks = (val: Task[]) => setTasksState(val);
  const setMembers = (val: Member[]) => setMembersState(sanitizeAndDeduplicateMembers(val));
  const setActiveView = (val: ViewType) => setActiveViewState(val);
  const setSelectedTaskId = (val: string | null) => setSelectedTaskIdState(val);
  const setSorting = (val: WorkspaceState['sorting']) => setSortingState(val);
  const setDashboard = (val: WorkspaceState['dashboard']) => setDashboardState(val);
  const setFilters = (newFilters: Partial<WorkspaceState['filters']>) => {
    setFiltersState((prev) => ({ ...prev, ...newFilters }));
  };

  // Dynamic user auto-registration helper
  const registerOrMergeMember = (memberData: Partial<Member> & { name: string; email?: string }) => {
    setMembersState(prev => {
      const existing = lookupMemberByEmail(memberData.email || '', prev) || lookupMemberByEmail(memberData.name || '', prev);
      if (existing) {
        return prev;
      }
      const updated = sanitizeAndDeduplicateMembers([...prev, {
        id: memberData.id || `MEM-${Math.floor(1000 + Math.random() * 9000)}`,
        name: memberData.name,
        email: memberData.email || `${memberData.name.toLowerCase().replace(/\s+/g, '.')}@logmark-ai.com`,
        role: memberData.role || (memberData.email && ORG_MEMBER_EMAIL_ROLES[memberData.email.toLowerCase()]) || 'EMPLOYEE',
        avatarColor: memberData.avatarColor || '#3b82f6',
      }]);
      return updated;
    });
  };

  // Status Rollup Helper: Auto-calculates parent Feature's status based on child Tasks
  const rollupParentStatus = async (
    parentFeatureId: string | null | undefined, 
    allTasks: Task[], 
    client: any
  ): Promise<Task[]> => {
    if (!parentFeatureId) return allTasks;
    
    const parentFeature = allTasks.find(t => t.id === parentFeatureId);
    if (!parentFeature || parentFeature.type !== 'FEATURE') return allTasks;

    const children = allTasks.filter(t => t.parentFeatureId === parentFeatureId && t.id !== parentFeature.id);
    if (children.length === 0) return allTasks;

    const totalCount = children.length;
    const doneCount = children.filter(c => c.status === 'DONE').length;
    
    let newStatus: TaskStatus = 'TODO';
    if (doneCount === totalCount) {
      newStatus = 'DONE';
    } else if (doneCount > 0 || children.some(c => c.status !== 'TODO' && c.status !== 'BACKLOG')) {
      newStatus = 'IN_PROGRESS';
    }

    if (parentFeature.status === newStatus) return allTasks;

    // Status changed, perform update
    const now = new Date().toISOString();
    const logEntry: ActivityLog = {
      id: 'ROLLUP-' + Math.random(),
      user: 'System',
      action: `Auto-rolled status to ${newStatus.replace('_', ' ')} based on children (${doneCount}/${totalCount} done)`,
      timestamp: now
    };

    const updatedParent: Task = {
      ...parentFeature,
      status: newStatus,
      updatedAt: now,
      activities: [logEntry, ...(parentFeature.activities || [])]
    };

    if (isSupabaseConfigured && client) {
      await client.from('tasks').update({
        status: newStatus,
        updated_at: now
      }).eq('id', parentFeatureId);

      await client.from('activity_logs').insert({
        task_id: parentFeatureId,
        user: logEntry.user,
        action: logEntry.action,
        timestamp: logEntry.timestamp
      });
    }

    return allTasks.map(t => t.id === parentFeatureId ? updatedParent : t);
  };

  // Phase 14 - Loading Screen & Supabase data fetching
  useEffect(() => {
    const client = supabase;
    if (!isSupabaseConfigured || !client || !isAuthenticated || !currentUserId) {
      // Sandbox fallback mode - instant load
      setIsRestoring(false);
      return;
    }

    const fetchWorkspace = async () => {
      try {
        setIsRestoring(true);
        
        // 1. Fetch Members
        const { data: dbMembers, error: memErr } = await client.from('members').select('*');
        if (memErr) throw memErr;

        // 2. Fetch Tasks and their Activity Logs
        const { data: dbTasks, error: taskErr } = await client
          .from('tasks')
          .select('*, activity_logs(*)');
        if (taskErr) throw taskErr;

        // 3. Fetch User Settings
        const { data: dbSettings } = await client
          .from('user_settings')
          .select('*')
          .eq('user_id', currentUserId)
          .single();

        // Populate Members with SOT & Deduplication
        const dbMappedMembers: Member[] = (dbMembers || []).map((m: any) => ({
          id: m.id,
          name: m.name,
          email: m.email || (m.name ? `${m.name.toLowerCase().replace(/\s+/g, '.')}@logmark-ai.com` : ''),
          role: m.role as MemberRole,
          avatarColor: m.avatar_color || '#3b82f6',
        }));

        let mappedMembers = sanitizeAndDeduplicateMembers(dbMappedMembers.length > 0 ? dbMappedMembers : DEFAULT_MEMBERS);

        // Auto-Sync Authenticated User to Team Registry dynamically
        if (isAuthenticated && currentUserId && currentUser) {
          const cleanEmail = currentUser.toLowerCase();
          const getCleanPrefix = (email: string) => email.split('@')[0];
          const getUserName = (userVal: string | null) => {
            if (!userVal) return 'Employee';
            if (userVal.includes('@')) {
              const prefix = getCleanPrefix(userVal);
              return prefix
                .split('.')
                .map(part => part.charAt(0).toUpperCase() + part.slice(1))
                .join(' ');
            }
            return userVal;
          };
          const currentUserName = getUserName(currentUser);
          const exists = mappedMembers.some(
            m => m.id === currentUserId || m.email.toLowerCase() === cleanEmail || m.name.toLowerCase() === currentUserName.toLowerCase()
          );

          if (!exists) {
            const colors = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#ef4444', '#14b8a6'];
            const randomColor = colors[Math.floor(Math.random() * colors.length)];
            const userRoleVal = ORG_MEMBER_EMAIL_ROLES[cleanEmail] || 'EMPLOYEE';
            const newMember: Member = {
              id: currentUserId,
              name: currentUserName,
              email: cleanEmail,
              role: userRoleVal,
              avatarColor: randomColor,
            };

            if (isSupabaseConfigured && client) {
              try {
                await client.from('members').insert({
                  id: currentUserId,
                  name: currentUserName,
                  email: cleanEmail,
                  role: userRoleVal,
                  avatar_color: randomColor,
                });
              } catch (err) {
                console.error('Failed to auto-register member in database:', err);
              }
            }
            mappedMembers = sanitizeAndDeduplicateMembers([...mappedMembers, newMember]);
          }
        }

        setMembersState(mappedMembers);

        // Populate Tasks
        const mappedTasks: Task[] = (dbTasks || []).map((t: any) => {
          let desc = t.description || '';
          let owner = t.owner || '';
          let module = t.module || '';
          let comments = t.comments || '';
          let createdBy = t.created_by || '';

          const parts = desc.split('\n\n---METADATA---\n');
          if (parts.length > 1) {
            try {
              const meta = JSON.parse(parts[1]);
              desc = parts[0];
              owner = meta.owner || '';
              module = meta.module || '';
              comments = meta.comments || '';
              createdBy = meta.createdBy || '';
            } catch {
              // ignore and keep fallbacks
            }
          }

          const parsedComments = parseComments(comments);

          return {
            id: t.id,
            title: t.title,
            description: desc,
            status: t.status as TaskStatus,
            priority: t.priority,
            dueDate: t.due_date || '',
            assignee: t.assignee || '',
            reporter: t.reporter || '',
            timeEstimated: parseFloat(t.time_estimated) || 0,
            timeLogged: parseFloat(t.time_logged) || 0,
            type: (t.type || 'TASK') as WorkItemType,
            parentFeatureId: t.parent_feature_id || null,
            owner,
            module,
            comments,
            createdBy,
            attachments: parsedComments.attachments,
            activities: (t.activity_logs || []).map((a: any) => ({
              id: a.id,
              user: a.user,
              action: a.action,
              timestamp: a.timestamp,
            })).sort((x: any, y: any) => y.timestamp.localeCompare(x.timestamp)),
            createdAt: t.created_at,
            updatedAt: t.updated_at,
          };
        });
        setTasksState(mappedTasks);

        // Populate User Settings (Phase 5 Restore) - Reset filters to avoid silent active filters on load
        if (dbSettings) {
          setActiveViewState(dbSettings.active_view as ViewType);
          setFiltersState({
            priority: 'ALL',
            status: 'ALL',
            assignee: 'ALL',
            search: '',
            type: 'ALL',
            parentFeature: 'ALL',
            owner: 'ALL',
            module: 'ALL',
          });
          setSortingState(dbSettings.sorting);
          setThemeDirectly(dbSettings.theme || 'light');
        } else {
          // Initialize default user settings in database if missing
          await client.from('user_settings').insert({
            user_id: currentUserId,
            active_view: 'DASHBOARD',
            filters: { priority: 'ALL', status: 'ALL', assignee: 'ALL', search: '', type: 'ALL', parentFeature: 'ALL', owner: 'ALL', module: 'ALL' },
            sorting: { field: 'createdAt', direction: 'desc' },
            theme: themeRef.current,
          });
        }
        addToast('Cloud Workspace Synced', 'success');
      } catch (err) {
        console.error('Failed to restore Supabase workspace:', err);
        addToast('Database connection failed. Operating in local buffer mode.', 'warning');
      } finally {
        setIsRestoring(false);
      }
    };

    fetchWorkspace();
  }, [isAuthenticated, currentUserId, currentUser, addToast, setThemeDirectly]);

  // Debounced LocalStorage Auto-Save (Only triggers when offline/mock mode)
  useEffect(() => {
    if (isSupabaseConfigured && isAuthenticated) return; // Cloud takes care of auto-save directly
    if (isRestoring) return;

    const saveTimer = setTimeout(() => {
      saveWorkspace({
        tasks,
        members,
        activeView,
        selectedTaskId,
        filters,
        sorting,
        dashboard,
        theme,
        lastOpened: Date.now(),
      });
    }, 400);

    return () => clearTimeout(saveTimer);
  }, [tasks, members, activeView, selectedTaskId, filters, sorting, dashboard, theme, isRestoring, isAuthenticated]);

  // Immediate Cloud Sync for Theme changes
  useEffect(() => {
    const client = supabase;
    if (!isSupabaseConfigured || !client || !isAuthenticated || !currentUserId || isRestoring) return;

    (async () => {
      try {
        const { error } = await client.from('user_settings').upsert({
          user_id: currentUserId,
          active_view: activeViewRef.current,
          filters: filtersRef.current,
          sorting: sortingRef.current,
          theme: theme,
          updated_at: new Date().toISOString(),
        });
        if (error) {
          console.error("Supabase theme upsert error:", error.message);
        }
      } catch (err) {
        console.error("Failed to sync theme to Supabase:", err);
      }
    })();
  }, [theme, currentUserId, isAuthenticated, isRestoring]);

  // Debounced Cloud Sync for other User Settings (filters, activeView, sorting)
  useEffect(() => {
    const client = supabase;
    if (!isSupabaseConfigured || !client || !isAuthenticated || !currentUserId || isRestoring) return;

    const syncSettingsTimer = setTimeout(async () => {
      try {
        const { error } = await client.from('user_settings').upsert({
          user_id: currentUserId,
          active_view: activeView,
          filters: filters,
          sorting: sorting,
          theme: themeRef.current,
          updated_at: new Date().toISOString(),
        });
        if (error) {
          console.error("Supabase user settings upsert error:", error.message);
        }
      } catch (err) {
        console.error("Failed to sync settings to Supabase:", err);
      }
    }, 500);

    return () => clearTimeout(syncSettingsTimer);
  }, [activeView, filters, sorting, currentUserId, isRestoring, isAuthenticated]);

  // Helper to safely write multiple tasks to Supabase (handling missing columns via serialization fallback)
  const safeUpsertTasks = async (client: any, payload: any[], isInsert = false) => {
    const query = isInsert ? client.from('tasks').insert(payload) : client.from('tasks').upsert(payload);
    const { error } = await query;
    if (!error) return;

    console.warn("Database write failed, retrying with serialized metadata:", error.message);

    const strippedPayload = payload.map(item => {
      const { owner, module, comments, created_by, ...rest } = item;
      const metadata = { owner, module, comments, createdBy: created_by };
      const baseDesc = item.description || '';
      const descWithoutMeta = baseDesc.split('\n\n---METADATA---\n')[0];
      const serializedDesc = `${descWithoutMeta}\n\n---METADATA---\n${JSON.stringify(metadata)}`;

      return {
        ...rest,
        description: serializedDesc
      };
    });

    const retryQuery = isInsert ? client.from('tasks').insert(strippedPayload) : client.from('tasks').upsert(strippedPayload);
    const { error: retryError } = await retryQuery;
    if (retryError) {
      throw retryError;
    }
  };

  // Helper to safely write a single task to Supabase
  const safeWriteTaskSingle = async (client: any, taskId: string, payload: any, isInsert: boolean) => {
    let query;
    if (isInsert) {
      query = client.from('tasks').insert(payload);
    } else {
      query = client.from('tasks').update(payload).eq('id', taskId);
    }

    const { error } = await query;
    if (!error) return;

    console.warn("Single task write failed, retrying with serialized description:", error.message);

    const { owner, module, comments, created_by, ...rest } = payload;
    const metadata = { owner, module, comments, createdBy: created_by };
    const baseDesc = payload.description || '';
    const descWithoutMeta = baseDesc.split('\n\n---METADATA---\n')[0];
    const serializedDesc = `${descWithoutMeta}\n\n---METADATA---\n${JSON.stringify(metadata)}`;

    const retryPayload = {
      ...rest,
      description: serializedDesc
    };

    let retryQuery;
    if (isInsert) {
      retryQuery = client.from('tasks').insert({ ...retryPayload, id: taskId });
    } else {
      retryQuery = client.from('tasks').update(retryPayload).eq('id', taskId);
    }

    const { error: retryError } = await retryQuery;
    if (retryError) {
      console.error("Critical: retry write failed:", retryError.message);
    }
  };

  const rollupParentStatusLocal = (parentFeatureId: string | null | undefined, allTasks: Task[]): Task[] => {
    if (!parentFeatureId) return allTasks;
    const parentFeature = allTasks.find(t => t.id === parentFeatureId);
    if (!parentFeature || parentFeature.type !== 'FEATURE') return allTasks;

    const children = allTasks.filter(t => t.parentFeatureId === parentFeatureId && t.id !== parentFeature.id);
    if (children.length === 0) return allTasks;

    const totalCount = children.length;
    const doneCount = children.filter(c => c.status === 'DONE').length;
    let newStatus: TaskStatus = 'TODO';
    if (doneCount === totalCount) {
      newStatus = 'DONE';
    } else if (doneCount > 0 || children.some(c => c.status !== 'TODO' && c.status !== 'BACKLOG')) {
      newStatus = 'IN_PROGRESS';
    }

    if (parentFeature.status === newStatus) return allTasks;

    const now = new Date().toISOString();
    const logEntry: ActivityLog = {
      id: 'ROLLUP-' + Math.random(),
      user: 'System',
      action: `Auto-rolled status to ${newStatus.replace('_', ' ')} based on children (${doneCount}/${totalCount} done)`,
      timestamp: now
    };

    const updatedParent: Task = {
      ...parentFeature,
      status: newStatus,
      updatedAt: now,
      activities: [logEntry, ...(parentFeature.activities || [])]
    };

    return allTasks.map(t => t.id === parentFeatureId ? updatedParent : t);
  };

  // Task database operations wrapper
  const handleSaveTask = async (taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'activities'> & { id?: string; activities?: ActivityLog[] }) => {
    const now = new Date().toISOString();
    let updatedTasks: Task[] = [];
    const isEditing = !!taskData.id;
    const client = supabase;
    
    // Default relationships logic: Features cannot have parents
    const sanitizedParentId = taskData.type === 'FEATURE' ? null : (taskData.parentFeatureId || null);

    if (isEditing) {
      // Edit mode
      const oldTask = tasks.find(t => t.id === taskData.id);
      if (!oldTask) return;

      // 1. Permission checks
      const check = checkPermission(effectiveRole, 'EDIT', oldTask, currentUserName);
      if (!check.allowed) {
        addToast(check.reason || 'You do not have permission to edit this work item.', 'error');
        return;
      }

      if (oldTask.assignee !== taskData.assignee) {
        const checkAssign = checkPermission(effectiveRole, 'ASSIGN', oldTask, currentUserName);
        if (!checkAssign.allowed) {
          addToast(checkAssign.reason || 'You do not have permission to assign this work item.', 'error');
          return;
        }
      }

      if (oldTask.type === 'FEATURE' && effectiveRole === 'EMPLOYEE') {
        addToast("Employees do not have permission to edit Feature items.", "error");
        return;
      }

      const auditLogs: ActivityLog[] = [...(taskData.activities || oldTask.activities || [])];
      
      // 2. Compute audit changes
      if (oldTask.status !== taskData.status) {
        auditLogs.unshift({
          id: 'AUD-' + Math.random().toString(),
          user: userDisplayName,
          action: `Changed status from ${oldTask.status.replace('_', ' ')} to ${taskData.status.replace('_', ' ')}`,
          timestamp: now,
        });

        if (taskData.status === 'DONE') {
          auditLogs.unshift({
            id: 'AUD-COMP-' + Math.random().toString(),
            user: userDisplayName,
            action: `Completed work item`,
            timestamp: now,
          });
        }
      }

      if (oldTask.priority !== taskData.priority) {
        auditLogs.unshift({
          id: 'AUD-' + Math.random().toString(),
          user: userDisplayName,
          action: `Changed priority from ${oldTask.priority} to ${taskData.priority}`,
          timestamp: now,
        });
      }

      if (oldTask.type !== taskData.type) {
        auditLogs.unshift({
          id: 'AUD-' + Math.random().toString(),
          user: userDisplayName,
          action: `Changed type from ${oldTask.type} to ${taskData.type}`,
          timestamp: now,
        });
      }

      if (oldTask.parentFeatureId !== sanitizedParentId) {
        const parentName = sanitizedParentId ? (tasks.find(t => t.id === sanitizedParentId)?.title || sanitizedParentId) : 'None';
        auditLogs.unshift({
          id: 'AUD-' + Math.random().toString(),
          user: userDisplayName,
          action: `Changed parent feature to: ${parentName}`,
          timestamp: now,
        });
      }

      if (oldTask.timeEstimated !== taskData.timeEstimated) {
        auditLogs.unshift({
          id: 'AUD-' + Math.random().toString(),
          user: userDisplayName,
          action: `Updated time estimate to ${taskData.timeEstimated}h`,
          timestamp: now,
        });
      }

      if (oldTask.assignee !== taskData.assignee) {
        auditLogs.unshift({
          id: 'AUD-' + Math.random().toString(),
          user: userDisplayName,
          action: `Assigned task to ${taskData.assignee || 'Unassigned'}`,
          timestamp: now,
        });
      }

      if (oldTask.owner !== taskData.owner) {
        auditLogs.unshift({
          id: 'AUD-' + Math.random().toString(),
          user: userDisplayName,
          action: `Updated owner to ${taskData.owner || 'None'}`,
          timestamp: now,
        });
      }

      if (oldTask.reporter !== taskData.reporter) {
        auditLogs.unshift({
          id: 'AUD-' + Math.random().toString(),
          user: userDisplayName,
          action: `Updated reporter to ${taskData.reporter || 'None'}`,
          timestamp: now,
        });
      }

      if (oldTask.module !== taskData.module) {
        auditLogs.unshift({
          id: 'AUD-' + Math.random().toString(),
          user: userDisplayName,
          action: `Changed module to ${taskData.module || 'None'}`,
          timestamp: now,
        });
      }

      if (oldTask.dueDate !== taskData.dueDate) {
        auditLogs.unshift({
          id: 'AUD-' + Math.random().toString(),
          user: userDisplayName,
          action: `Changed due date to ${taskData.dueDate || 'None'}`,
          timestamp: now,
        });
      }

      const oldCommentsObj = parseComments(oldTask.comments);
      const newCommentsObj = parseComments(taskData.comments);
      if (newCommentsObj.commentsList.length > oldCommentsObj.commentsList.length) {
        auditLogs.unshift({
          id: 'AUD-' + Math.random().toString(),
          user: userDisplayName,
          action: `Comment added`,
          timestamp: now,
        });
      }

      const updatedTask: Task = {
        ...oldTask,
        ...taskData,
        parentFeatureId: sanitizedParentId,
        owner: taskData.owner || '',
        module: taskData.module || '',
        comments: taskData.comments || '',
        attachments: taskData.attachments ?? oldTask.attachments ?? [],
        createdBy: oldTask.createdBy || currentUserId || '',
        updatedAt: now,
        activities: auditLogs,
      } as Task;

      updatedTasks = tasks.map((t) => (t.id === taskData.id ? updatedTask : t));
      
      // Rollup Status for parent Features (both old and new parents) locally
      if (oldTask.parentFeatureId) {
        updatedTasks = rollupParentStatusLocal(oldTask.parentFeatureId, updatedTasks);
      }
      if (sanitizedParentId && sanitizedParentId !== oldTask.parentFeatureId) {
        updatedTasks = rollupParentStatusLocal(sanitizedParentId, updatedTasks);
      }

      // Update state instantly
      setTasksState(updatedTasks);
      addToast('Task updated successfully', 'success');

      // Sync to database asynchronously
      if (isSupabaseConfigured && client) {
        (async () => {
          try {
            await safeWriteTaskSingle(
              client,
              taskData.id as string,
              {
                title: taskData.title,
                description: taskData.description,
                status: taskData.status,
                priority: taskData.priority,
                due_date: taskData.dueDate,
                assignee: taskData.assignee,
                reporter: taskData.reporter,
                time_estimated: taskData.timeEstimated,
                time_logged: taskData.timeLogged,
                type: taskData.type,
                parent_feature_id: sanitizedParentId,
                owner: taskData.owner || '',
                module: taskData.module || '',
                comments: taskData.comments || '',
                created_by: oldTask.createdBy || currentUserId || '',
                updated_at: now,
              },
              false
            );

            // Sync new audit log entries
            const existingLogIds = new Set((oldTask.activities || []).map(a => a.id));
            const newLogs = auditLogs.filter(a => !existingLogIds.has(a.id));
            if (newLogs.length > 0) {
              await client.from('activity_logs').insert(
                newLogs.map(l => ({
                  task_id: taskData.id,
                  user: l.user,
                  action: l.action,
                  timestamp: l.timestamp,
                }))
              );
            }

            // Sync rollup states to DB
            const syncRollupDb = async (pId: string) => {
              const before = tasks.find(t => t.id === pId);
              const after = updatedTasks.find(t => t.id === pId);
              if (before && after && before.status !== after.status) {
                await client.from('tasks').update({
                  status: after.status,
                  updated_at: after.updatedAt
                }).eq('id', pId);

                const rollupLog = after.activities[0];
                await client.from('activity_logs').insert({
                  task_id: pId,
                  user: rollupLog.user,
                  action: rollupLog.action,
                  timestamp: rollupLog.timestamp
                });
              }
            };

            if (oldTask.parentFeatureId) await syncRollupDb(oldTask.parentFeatureId);
            if (sanitizedParentId && sanitizedParentId !== oldTask.parentFeatureId) await syncRollupDb(sanitizedParentId);

          } catch (err) {
            console.error("Failed to sync edited task in background:", err);
          }
        })();
      }
    } else {
      // Create mode
      const check = checkPermission(effectiveRole, 'CREATE', { type: taskData.type }, currentUserName);
      if (!check.allowed) {
        addToast(check.reason || 'You do not have permission to create this work item.', 'error');
        return;
      }

      const defaultActivity: ActivityLog = {
        id: 'INIT-' + Math.random(),
        user: userDisplayName,
        action: `Created ${taskData.type.toLowerCase()}`,
        timestamp: now,
      };

      const newTask: Task = {
        ...taskData,
        parentFeatureId: sanitizedParentId,
        owner: taskData.owner || '',
        module: taskData.module || '',
        comments: taskData.comments || '',
        attachments: [],
        createdBy: currentUserId || '',
        id: (taskData.type === 'FEATURE' ? 'FEAT-' : 'TASK-') + Math.floor(1000 + Math.random() * 9000),
        timeEstimated: taskData.timeEstimated || 0,
        timeLogged: taskData.timeLogged || 0,
        activities: taskData.activities && taskData.activities.length > 0 
          ? taskData.activities 
          : [defaultActivity],
        createdAt: now,
        updatedAt: now,
      };

      updatedTasks = [...tasks, newTask];

      // Rollup parent Feature locally
      if (sanitizedParentId) {
        updatedTasks = rollupParentStatusLocal(sanitizedParentId, updatedTasks);
      }

      // Update state instantly
      setTasksState(updatedTasks);
      addToast(`Created ${taskData.type.toLowerCase()} successfully`, 'success');

      // Sync to database asynchronously
      if (isSupabaseConfigured && client) {
        (async () => {
          try {
            await safeWriteTaskSingle(
              client,
              newTask.id,
              {
                title: newTask.title,
                description: newTask.description,
                status: newTask.status,
                priority: newTask.priority,
                due_date: newTask.dueDate,
                assignee: newTask.assignee,
                reporter: newTask.reporter,
                time_estimated: newTask.timeEstimated,
                time_logged: newTask.timeLogged,
                type: newTask.type,
                parent_feature_id: sanitizedParentId,
                owner: newTask.owner,
                module: newTask.module,
                comments: newTask.comments,
                created_by: newTask.createdBy || null,
                created_at: newTask.createdAt,
                updated_at: newTask.updatedAt,
              },
              true
            );

            await client.from('activity_logs').insert(
              newTask.activities.map(l => ({
                task_id: newTask.id,
                user: l.user,
                action: l.action,
                timestamp: l.timestamp,
              }))
            );

            // Sync rollup states to DB
            if (sanitizedParentId) {
              const before = tasks.find(t => t.id === sanitizedParentId);
              const after = updatedTasks.find(t => t.id === sanitizedParentId);
              if (before && after && before.status !== after.status) {
                await client.from('tasks').update({
                  status: after.status,
                  updated_at: after.updatedAt
                }).eq('id', sanitizedParentId);

                const rollupLog = after.activities[0];
                await client.from('activity_logs').insert({
                  task_id: sanitizedParentId,
                  user: rollupLog.user,
                  action: rollupLog.action,
                  timestamp: rollupLog.timestamp
                });
              }
            }
          } catch (err) {
            console.error("Failed to sync new task in background:", err);
          }
        })();
      }
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    const oldTask = tasks.find(t => t.id === taskId);
    if (!oldTask) return;

    const check = checkPermission(effectiveRole, 'STATUS', oldTask, currentUserName);
    if (!check.allowed) {
      addToast(check.reason || 'You do not have permission to change task status.', 'error');
      return;
    }

    const logEntry: ActivityLog = {
      id: 'STATUS-' + Math.random(),
      user: userDisplayName,
      action: `Changed status to ${newStatus.replace('_', ' ')}`,
      timestamp: new Date().toISOString()
    };

    const activities = [logEntry];
    if (newStatus === 'DONE' && oldTask.status !== 'DONE') {
      activities.unshift({
        id: 'STATUS-DONE-' + Math.random(),
        user: userDisplayName,
        action: `Completed work item`,
        timestamp: new Date().toISOString()
      });
    }

    let updated = tasks.map((t) => {
      if (t.id === taskId) {
        return {
          ...t,
          status: newStatus,
          updatedAt: new Date().toISOString(),
          activities: [...activities, ...(t.activities || [])]
        };
      }
      return t;
    });

    // Rollup parent status locally (synchronously to avoid lag)
    if (oldTask.parentFeatureId) {
      const parentFeature = updated.find(t => t.id === oldTask.parentFeatureId);
      if (parentFeature && parentFeature.type === 'FEATURE') {
        const children = updated.filter(t => t.parentFeatureId === oldTask.parentFeatureId && t.id !== parentFeature.id);
        if (children.length > 0) {
          const totalCount = children.length;
          const doneCount = children.filter(c => c.status === 'DONE').length;
          let newParentStatus: TaskStatus = 'TODO';
          if (doneCount === totalCount) {
            newParentStatus = 'DONE';
          } else if (doneCount > 0 || children.some(c => c.status !== 'TODO' && c.status !== 'BACKLOG')) {
            newParentStatus = 'IN_PROGRESS';
          }
          if (parentFeature.status !== newParentStatus) {
            const rollupLog: ActivityLog = {
              id: 'ROLLUP-' + Math.random(),
              user: 'System',
              action: `Auto-rolled status to ${newParentStatus.replace('_', ' ')} based on children (${doneCount}/${totalCount} done)`,
              timestamp: new Date().toISOString()
            };
            updated = updated.map(t => t.id === oldTask.parentFeatureId ? {
              ...t,
              status: newParentStatus,
              updatedAt: rollupLog.timestamp,
              activities: [rollupLog, ...(t.activities || [])]
            } : t);
          }
        }
      }
    }

    // Update the state immediately for responsive UI
    setTasksState(updated);
    addToast(`Status updated to ${newStatus.replace('_', ' ')}`, 'success');

    // Run the Supabase update asynchronously in the background
    const client = supabase;
    if (isSupabaseConfigured && client) {
      (async () => {
        try {
          await client.from('tasks').update({
            status: newStatus,
            updated_at: logEntry.timestamp,
          }).eq('id', taskId);

          await client.from('activity_logs').insert(
            activities.map(act => ({
              task_id: taskId,
              user: act.user,
              action: act.action,
              timestamp: act.timestamp,
            }))
          );

          // Sync parent feature rollup to database
          if (oldTask.parentFeatureId) {
            const parentAfter = updated.find(t => t.id === oldTask.parentFeatureId);
            const parentBefore = tasks.find(t => t.id === oldTask.parentFeatureId);
            if (parentAfter && parentBefore && parentAfter.status !== parentBefore.status) {
              await client.from('tasks').update({
                status: parentAfter.status,
                updated_at: parentAfter.updatedAt
              }).eq('id', oldTask.parentFeatureId);

              const parentRollupLog = parentAfter.activities[0];
              await client.from('activity_logs').insert({
                task_id: oldTask.parentFeatureId,
                user: parentRollupLog.user,
                action: parentRollupLog.action,
                timestamp: parentRollupLog.timestamp
              });
            }
          }
        } catch (err) {
          console.error("Supabase sync failed in background:", err);
        }
      })();
    }
  };

  const handleDeleteTask = async (id: string) => {
    const taskToDelete = tasks.find(t => t.id === id);
    if (!taskToDelete) return;

    const check = checkPermission(effectiveRole, 'DELETE', taskToDelete, currentUserName);
    if (!check.allowed) {
      addToast(check.reason || 'You do not have permission to delete this work item.', 'error');
      return;
    }

    let deleteChildren = false;
    let parentIdToRollup: string | null = taskToDelete.parentFeatureId;

    if (taskToDelete.type === 'FEATURE') {
      const childrenCount = tasks.filter(t => t.parentFeatureId === id).length;
      if (childrenCount > 0) {
        const choice = window.prompt(
          `Deleting Feature: ${taskToDelete.title}\n\n` +
          `This Feature has ${childrenCount} child tasks linked to it.\n` +
          `Type "1" to delete the Feature only (child tasks will be moved to Unassigned).\n` +
          `Type "2" to delete the Feature AND all its child tasks.\n\n` +
          `Type anything else to cancel.`
        );
        if (choice === '1') {
          deleteChildren = false;
        } else if (choice === '2') {
          deleteChildren = true;
        } else {
          return; // Cancel
        }
      } else {
        const confirmDelete = window.confirm(`Are you sure you want to delete this Feature: ${taskToDelete.title}?`);
        if (!confirmDelete) return;
      }
    } else {
      const confirmDelete = window.confirm("Are you sure you want to delete this item?");
      if (!confirmDelete) return;
    }

    const client = supabase;
    let updatedTasksList = [...tasks];

    if (taskToDelete.type === 'FEATURE') {
      if (deleteChildren) {
        // Cascade delete
        updatedTasksList = tasks.filter(t => t.id !== id && t.parentFeatureId !== id);
        setTasksState(updatedTasksList);
        addToast('Feature and all child tasks deleted', 'success');

        if (isSupabaseConfigured && client) {
          await client.from('tasks').delete().eq('id', id);
          await client.from('tasks').delete().eq('parent_feature_id', id);
        }
      } else {
        // Orphan children
        updatedTasksList = tasks.map(t => t.parentFeatureId === id ? { ...t, parentFeatureId: null } : t).filter(t => t.id !== id);
        setTasksState(updatedTasksList);
        addToast('Feature deleted. Child tasks moved to Unassigned.', 'info');

        if (isSupabaseConfigured && client) {
          await client.from('tasks').delete().eq('id', id);
          await client.from('tasks').update({ parent_feature_id: null }).eq('parent_feature_id', id);
        }
      }
    } else {
      // Normal task deletion
      updatedTasksList = tasks.filter(t => t.id !== id);
      setTasksState(updatedTasksList);
      addToast('Deleted successfully', 'success');

      if (isSupabaseConfigured && client) {
        await client.from('tasks').delete().eq('id', id);
      }

      // Rollup status
      if (parentIdToRollup) {
        updatedTasksList = await rollupParentStatus(parentIdToRollup, updatedTasksList, client);
        setTasksState(updatedTasksList);
      }
    }
  };

  // Member Actions
  const handleAddMember = async (name: string, role: MemberRole, email?: string) => {
    const colors = ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#ef4444', '#14b8a6'];
    const memberEmail = email || `${name.toLowerCase().replace(/\s+/g, '.')}@logmark-ai.com`;
    const newMember: Member = {
      id: 'MEM-' + Math.floor(100 + Math.random() * 900),
      name,
      email: memberEmail,
      role,
      avatarColor: colors[Math.floor(Math.random() * colors.length)],
    };

    const updated = sanitizeAndDeduplicateMembers([...members, newMember]);
    setMembersState(updated);
    addToast(`${name} added to team`, 'success');

    const client = supabase;
    if (isSupabaseConfigured && client) {
      const { error } = await client.from('members').insert({
        id: newMember.id,
        name: newMember.name,
        email: newMember.email,
        role: newMember.role,
        avatar_color: newMember.avatarColor,
      });
      if (error) console.error('Failed to sync new member to Supabase:', error.message);
    }
  };

  const handleRemoveMember = async (id: string) => {
    const targetMember = members.find(m => m.id === id);
    if (!targetMember) return;
    
    // Unassign tasks assigned to this user
    const now = new Date().toISOString();
    const updatedTasks = tasks.map(t => {
      if (t.assignee.toLowerCase() === targetMember.name.toLowerCase()) {
        return {
          ...t,
          assignee: '',
          activities: [
            {
              id: 'UNASSIGN-' + Math.random(),
              user: 'System',
              action: `Unassigned due to team member deletion`,
              timestamp: now
            },
            ...(t.activities || [])
          ]
        };
      }
      return t;
    });

    setTasksState(updatedTasks);
    setMembersState(members.filter((m) => m.id !== id));
    addToast(`${targetMember.name} removed from team`, 'success');

    const client = supabase;
    if (isSupabaseConfigured && client) {
      // 1. Delete member from table
      await client.from('members').delete().eq('id', id);

      // 2. Unassign tasks in database
      const affectedTasks = tasks.filter(t => t.assignee.toLowerCase() === targetMember.name.toLowerCase());
      for (const t of affectedTasks) {
        await client.from('tasks').update({
          assignee: '',
          updated_at: now
        }).eq('id', t.id);

        await client.from('activity_logs').insert({
          task_id: t.id,
          user: 'System',
          action: 'Unassigned due to team member deletion',
          timestamp: now
        });
      }
    }
  };

  // Import Options
  const importWorkspaceData = async (importedTasks: Task[], importedMembers: Member[], shouldMerge: boolean) => {
    const check = checkPermission(effectiveRole, 'IMPORT', undefined, currentUserName);
    if (!check.allowed) {
      addToast(check.reason || 'You do not have permission to import sheet data.', 'error');
      return;
    }

    let finalTasks = [...tasks];
    let rawMembers = [...members, ...importedMembers];

    if (shouldMerge) {
      const taskMap = new Map(tasks.map(t => [t.id, t]));
      importedTasks.forEach(t => taskMap.set(t.id, t));
      finalTasks = Array.from(taskMap.values());
    } else {
      finalTasks = importedTasks;
      rawMembers = importedMembers;
    }

    const finalMembers = sanitizeAndDeduplicateMembers(rawMembers);

    setTasksState(finalTasks);
    setMembersState(finalMembers);

    const client = supabase;
    if (isSupabaseConfigured && client) {
      try {
        setIsRestoring(true);

        const membersPayload = finalMembers.map(m => ({
          id: m.id,
          name: m.name,
          email: m.email,
          role: m.role,
          avatar_color: m.avatarColor,
        }));
            priority: t.priority,
            due_date: t.dueDate || null,
            assignee: t.assignee || null,
            reporter: t.reporter || null,
            time_estimated: t.timeEstimated || 0,
            time_logged: t.timeLogged || 0,
            type: t.type || 'FEATURE',
            parent_feature_id: null,
            owner: t.owner || '',
            module: t.module || '',
            comments: t.comments || '',
            created_by: t.createdBy || null,
            created_at: t.createdAt || new Date().toISOString(),
            updated_at: t.updatedAt || new Date().toISOString(),
          }));

        const nonFeaturesPayload = finalTasks
          .filter(t => t.type !== 'FEATURE')
          .map(t => ({
            id: t.id,
            title: t.title,
            description: t.description || '',
            status: t.status,
            priority: t.priority,
            due_date: t.dueDate || null,
            assignee: t.assignee || null,
            reporter: t.reporter || null,
            time_estimated: t.timeEstimated || 0,
            time_logged: t.timeLogged || 0,
            type: t.type || 'TASK',
            parent_feature_id: t.parentFeatureId || null,
            owner: t.owner || '',
            module: t.module || '',
            comments: t.comments || '',
            created_by: t.createdBy || null,
            created_at: t.createdAt || new Date().toISOString(),
            updated_at: t.updatedAt || new Date().toISOString(),
          }));

        if (!shouldMerge) {
          // Clear existing database records
          await client.from('tasks').delete().neq('id', 'CLEAR_ALL');
          await client.from('members').delete().neq('id', 'CLEAR_ALL');

          // Bulk insert members
          if (membersPayload.length > 0) {
            const { error: memErr } = await client.from('members').insert(membersPayload);
            if (memErr) throw memErr;
          }

          // Bulk insert features
          if (featuresPayload.length > 0) {
            await safeUpsertTasks(client, featuresPayload, true);
          }

          // Bulk insert non-features
          if (nonFeaturesPayload.length > 0) {
            await safeUpsertTasks(client, nonFeaturesPayload, true);
          }
        } else {
          // Bulk upsert members
          if (membersPayload.length > 0) {
            const { error: memErr } = await client.from('members').upsert(membersPayload);
            if (memErr) throw memErr;
          }

          // Bulk upsert features
          if (featuresPayload.length > 0) {
            await safeUpsertTasks(client, featuresPayload, false);
          }

          // Bulk upsert non-features
          if (nonFeaturesPayload.length > 0) {
            await safeUpsertTasks(client, nonFeaturesPayload, false);
          }
        }

        // Upload activities in bulk
        const logsPayload: any[] = [];
        finalTasks.forEach(t => {
          if (t.activities && t.activities.length > 0) {
            t.activities.forEach(a => {
              logsPayload.push({
                task_id: t.id,
                user: a.user,
                action: a.action,
                timestamp: a.timestamp,
              });
            });
          }
        });

        if (logsPayload.length > 0) {
          const taskIds = finalTasks.map(t => t.id);
          await client.from('activity_logs').delete().in('task_id', taskIds);
          await client.from('activity_logs').insert(logsPayload);
        }

        addToast('Synced imported data to Cloud', 'success');
      } catch (err) {
        console.error('Failed to upload imported data to Supabase:', err);
        addToast('Partial sync failure during import.', 'warning');
      } finally {
        setIsRestoring(false);
      }
    }
  };

  return (
    <WorkspaceContext.Provider
      value={{
        tasks,
        members,
        activeView,
        selectedTaskId,
        filters,
        sorting,
        dashboard,
        isRestoring,
        setTasks,
        setMembers,
        setActiveView,
        setSelectedTaskId,
        setFilters,
        setSorting,
        setDashboard,
        userRole: effectiveRole,
        userDisplayName,
        currentUserEmail: currentUser,
        handleSaveTask,
        handleStatusChange,
        handleDeleteTask,
        handleAddMember,
        handleRemoveMember,
        importWorkspaceData,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
};
