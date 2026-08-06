import type { Task, Member } from '../types';
import { DEFAULT_MEMBERS, sanitizeAndDeduplicateMembers } from '../config/members';

export type ViewType = 'DASHBOARD' | 'BOARD' | 'BACKLOG' | 'MEMBERS' | 'PROFILE';

export interface WorkspaceState {
  tasks: Task[];
  members: Member[];
  activeView: ViewType;
  selectedTaskId: string | null;
  filters: {
    priority: string;
    status: string;
    assignee: string;
    search: string;
    type: string;
    parentFeature: string;
    owner: string;
    module: string;
  };
  sorting: {
    field: string;
    direction: 'asc' | 'desc';
  };
  dashboard: {
    selectedChart: string;
  };
  theme: 'light' | 'dark';
  lastOpened: number;
}

export interface VersionedWorkspace {
  version: number;
  workspace: WorkspaceState;
}

const STORAGE_KEY = 'jira_clone_workspace';
const CURRENT_VERSION = 1;

export const DEFAULT_WORKSPACE_STATE: WorkspaceState = {
  tasks: [],
  members: [...DEFAULT_MEMBERS],
  activeView: 'DASHBOARD',
  selectedTaskId: null,
  filters: {
    priority: 'ALL',
    status: 'ALL',
    assignee: 'ALL',
    search: '',
    type: 'ALL',
    parentFeature: 'ALL',
    owner: 'ALL',
    module: 'ALL',
  },
  sorting: {
    field: 'createdAt',
    direction: 'desc',
  },
  dashboard: {
    selectedChart: 'completion',
  },
  theme: 'light',
  lastOpened: Date.now(),
};

/**
 * Run migrations sequentially from the stored version to the current version.
 */
function migrateWorkspace(data: any): WorkspaceState {
  let version = data.version || 0;
  let workspace = data.workspace || { ...DEFAULT_WORKSPACE_STATE };

  // Phase 12 - Schema migration loops
  if (version < 1) {
    // Perform migrations needed to reach version 1
    workspace = {
      ...DEFAULT_WORKSPACE_STATE,
      ...workspace,
      filters: {
        ...DEFAULT_WORKSPACE_STATE.filters,
        ...(workspace.filters || {}),
      },
      sorting: {
        ...DEFAULT_WORKSPACE_STATE.sorting,
        ...(workspace.sorting || {}),
      },
      dashboard: {
        ...DEFAULT_WORKSPACE_STATE.dashboard,
        ...(workspace.dashboard || {}),
      },
    };
    version = 1;
  }

  // Ensure backward compatibility on tasks and filters
  const featureTitles = [
    'community version',
    'ai governance dashboard redesign',
    'gsdb evaluation',
    'desktop version',
    'sandbox environment',
    'audit template creation',
    'slm model creation'
  ];

  if (workspace.tasks) {
    workspace.tasks = workspace.tasks.map((t: any) => {
      let resolvedType = t.type;
      
      // Auto-detect incorrectly imported Feature records
      if (!resolvedType) {
        const titleLower = (t.title || '').toLowerCase();
        if (t.id.startsWith('FEAT-') || t.id.startsWith('FEATURE-') || featureTitles.some(ft => titleLower.includes(ft))) {
          resolvedType = 'FEATURE';
        } else {
          resolvedType = 'TASK';
        }
      }

      return {
        owner: '',
        module: '',
        comments: '',
        createdBy: '',
        ...t,
        type: resolvedType,
        parentFeatureId: t.parentFeatureId || null,
      };
    });
  }

  workspace.members = sanitizeAndDeduplicateMembers(workspace.members || []);

  workspace.filters = {
    ...DEFAULT_WORKSPACE_STATE.filters,
    ...(workspace.filters || {}),
  };

  return workspace;
}

/**
 * Handle data backup in case of migration failures or parsing crashes.
 */
function backupRawData(raw: string) {
  try {
    const backupKey = `jira_clone_workspace_backup_${Date.now()}`;
    localStorage.setItem(backupKey, raw);
    console.warn(`Saved corrupted workspace state to backup: ${backupKey}`);
  } catch (e) {
    console.error('Failed to save workspace backup key', e);
  }
}

/**
 * Loads the workspace state, handles data migrations, and preserves legacy task/member data.
 */
export function loadWorkspace(): WorkspaceState {
  // Check for legacy standalone data (Phase 1 / Preservation Requirement)
  const legacyTasksRaw = localStorage.getItem('jira_clone_tasks');
  const legacyMembersRaw = localStorage.getItem('jira_clone_members');

  const rawWorkspace = localStorage.getItem(STORAGE_KEY);

  if (rawWorkspace) {
    try {
      const parsed = JSON.parse(rawWorkspace) as VersionedWorkspace;
      
      // Phase 12 & 13 - Schema checks & migration loops
      if (typeof parsed === 'object' && parsed !== null) {
        const migrated = migrateWorkspace(parsed);
        
        // If legacy data exists and workspace tasks/members are empty, merge them in
        if (migrated.tasks.length === 0 && legacyTasksRaw) {
          try {
            migrated.tasks = JSON.parse(legacyTasksRaw);
          } catch (e) {
            console.error('Failed to import legacy tasks', e);
          }
        }
        if (migrated.members.length === 0 && legacyMembersRaw) {
          try {
            migrated.members = JSON.parse(legacyMembersRaw);
          } catch (e) {
            console.error('Failed to import legacy members', e);
          }
        }
        
        return migrated;
      }
    } catch (err) {
      // Phase 13 - Error recovery
      console.error('Corrupted workspace JSON detected. Activating recovery plan...', err);
      backupRawData(rawWorkspace);
      // Fallback: clear invalid data and load default
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  // Fallback: If no workspace is found, but legacy tasks/members exist, populate them
  const initialWorkspace = { ...DEFAULT_WORKSPACE_STATE };
  if (legacyTasksRaw) {
    try {
      initialWorkspace.tasks = JSON.parse(legacyTasksRaw);
    } catch (e) {
      console.error(e);
    }
  }
  if (legacyMembersRaw) {
    try {
      initialWorkspace.members = JSON.parse(legacyMembersRaw);
    } catch (e) {
      console.error(e);
    }
  }

  return initialWorkspace;
}

/**
 * Save workspace state securely under version control.
 */
export function saveWorkspace(state: WorkspaceState): void {
  const versioned: VersionedWorkspace = {
    version: CURRENT_VERSION,
    workspace: state,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(versioned));
}

/**
 * Clear workspace state.
 */
export function clearWorkspace(): void {
  localStorage.removeItem(STORAGE_KEY);
}
