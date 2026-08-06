import { useState, useRef, useEffect } from 'react';
import { KanbanBoard } from './components/KanbanBoard';
import { BacklogView } from './components/BacklogView';
import { TaskModal } from './components/TaskModal';
import { DashboardView } from './components/DashboardView';
import { HIERARCHY_ENABLED } from './config';
import { MembersDirectory } from './components/MembersDirectory';
import { Login } from './components/Login';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { ToastProvider, useToast } from './context/ToastContext';
import { WorkspaceProvider, useWorkspace } from './context/WorkspaceContext';
import { MyProfileView } from './components/MyProfileView';
import type { Task, ProjectStats, Member, WorkItemType, TaskPriority, TaskStatus } from './types';
import { DEFAULT_MEMBERS } from './config/members';
import * as XLSX from 'xlsx';
import { 
  Kanban, 
  ListTodo, 
  Upload, 
  Download, 
  Plus, 
  Search, 
  FolderKanban,
  FolderOpen,
  LayoutDashboard,
  Users,
  LogOut,
  Sun,
  Moon,
  ArrowUpDown,
  Loader2,
  User
} from 'lucide-react';

function mapSpreadsheetStatus(statusStr: string): TaskStatus {
  const norm = (statusStr || '').toUpperCase().trim().replace(/[\s_-]+/g, '');
  if (['DONE', 'COMPLETE', 'COMPLETED', 'FINISHED', 'CLOSED', 'RESOLVED'].includes(norm)) {
    return 'DONE';
  }
  if (['INPROGRESS', 'PROGRESS', 'DEVELOPMENT', 'DEV'].includes(norm)) {
    return 'IN_PROGRESS';
  }
  if (['INREVIEW', 'REVIEW', 'QA', 'TESTING'].includes(norm)) {
    return 'IN_REVIEW';
  }
  if (['BACKLOG'].includes(norm)) {
    return 'BACKLOG';
  }
  return 'TODO';
}

function MainAppContent() {
  const { isAuthenticated, logout, currentUser, isCloud, currentUserId } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { addToast } = useToast();
  const {
    tasks,
    members,
    activeView,
    selectedTaskId,
    filters,
    sorting,
    isRestoring,
    setActiveView,
    setSelectedTaskId,
    setFilters,
    setSorting,
    handleSaveTask,
    handleStatusChange,
    handleDeleteTask,
    handleAddMember,
    handleRemoveMember,
    importWorkspaceData,
  } = useWorkspace();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [myWorkItemsOnly, setMyWorkItemsOnly] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

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
                            members.find(m => m.name.toLowerCase() === currentUserName.toLowerCase());
  const userDisplayName = currentUserMember ? currentUserMember.name : currentUserName;
  const userDisplayRole = currentUserMember ? currentUserMember.role.replace('_', ' ') : 'Employee';

  // Phase 14 - Loading Screen
  if (isRestoring) {
    return (
      <div className="restore-loading-screen">
        <div className="restore-loading-container">
          <Loader2 className="spinner-icon restore-spinner" size={48} />
          <h2>Loading Workspace...</h2>
          <p>Restoring your tasks, directory, and layout settings</p>
        </div>
      </div>
    );
  }

  // Phase 2 - Authentication Protected Route Guard
  if (!isAuthenticated) {
    return <Login />;
  }

  // Handle Log out trigger (Phase 11)
  const handleLogoutClick = () => {
    logout();
    addToast('Logged Out Successfully', 'success');
  };

  // Helper function: Parse CSV file contents
  const parseCSV = (text: string): Record<string, string>[] => {
    const lines: string[][] = [];
    let row: string[] = [];
    let currentVal = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (inQuotes) {
        if (char === '"') {
          if (nextChar === '"') {
            currentVal += '"';
            i++; // skip next char
          } else {
            inQuotes = false;
          }
        } else {
          currentVal += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ',') {
          row.push(currentVal);
          currentVal = '';
        } else if (char === '\r' || char === '\n') {
          row.push(currentVal);
          currentVal = '';
          if (row.length > 0 && row.some(cell => cell.trim().length > 0)) {
            lines.push(row);
          }
          row = [];
          if (char === '\r' && nextChar === '\n') {
            i++; // skip double newline chars
          }
        } else {
          currentVal += char;
        }
      }
    }
    
    if (row.length > 0 || currentVal.length > 0) {
      row.push(currentVal);
      lines.push(row);
    }

    if (lines.length < 2) return [];

    const headers = lines[0].map(h => h.trim());
    const dataRows = lines.slice(1);

    return dataRows.map(r => {
      const obj: Record<string, string> = {};
      headers.forEach((h, index) => {
        obj[h] = (r[index] || '').trim();
      });
      return obj;
    });
  };

  // Helper function: Parse Excel binary file contents via SheetJS
  const parseExcel = (arrayBuffer: ArrayBuffer): Record<string, any>[] => {
    const data = new Uint8Array(arrayBuffer);
    const workbook = XLSX.read(data, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);
    return jsonData as Record<string, any>[];
  };

  // Automatically detect sheet type and map records to Features or Actionables
  const processSpreadsheetRows = async (rows: Record<string, any>[]) => {
    if (rows.length === 0) {
      addToast('Spreadsheet contains no data rows', 'error');
      return;
    }

    const firstRowKeys = Object.keys(rows[0]).map(k => k.trim().toLowerCase());

    const hasFeatureName = firstRowKeys.includes('feature name') || firstRowKeys.includes('featurename');
    const hasModule = firstRowKeys.includes('module');
    const hasTitle = firstRowKeys.includes('title');
    const hasDescription = firstRowKeys.includes('description');

    let isFeaturesSheet = false;

    // Detect spreadsheet type by column headers
    if (hasFeatureName || (hasModule && !hasTitle)) {
      isFeaturesSheet = true;
    } else if (hasTitle || hasDescription) {
      isFeaturesSheet = false;
    } else {
      isFeaturesSheet = window.confirm(
        "Could not auto-detect sheet type. Is this a Features spreadsheet?\n\n" +
        "• Click 'OK' if this is a Features sheet (epic deliverables)\n" +
        "• Click 'Cancel' if this is an Actionables sheet (individual implementation tasks)"
      );
    }

    let importedTasks: Task[] = [];

    if (isFeaturesSheet) {
      // Map Feature fields
      importedTasks = rows.map((row, idx) => {
        const title = row['Feature Name'] || row.title || row.FeatureName || 'Untitled Feature';
        const module = row.Module || row.module || '';
        const owner = row.Owner || row.owner || '';
        const priorityVal = (row.Priority || row.priority || 'MEDIUM').toUpperCase();
        const comments = row.Comments || row.comments || '';
        const description = row.Description || row.description || '';

        const priority = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(priorityVal) ? priorityVal as TaskPriority : 'MEDIUM';
        const status = mapSpreadsheetStatus(row.Status || row.status);

        const id = row.id || `FEAT-${1000 + idx}`;

        return {
          id,
          title,
          description,
          status,
          priority,
          dueDate: row.dueDate || row.due_date || new Date().toISOString().split('T')[0],
          assignee: row.assignee || owner || '',
          reporter: row.reporter || 'Admin',
          timeEstimated: parseFloat(row.timeEstimated || row.time_estimated) || 0,
          timeLogged: parseFloat(row.timeLogged || row.time_logged) || 0,
          type: (HIERARCHY_ENABLED ? 'FEATURE' : 'TASK') as WorkItemType,
          parentFeatureId: null,
          owner,
          module,
          comments,
          createdBy: row.createdBy || row.created_by || 'Admin',
          attachments: [],
          activities: [],
          createdAt: row.createdAt || row.created_at || new Date().toISOString(),
          updatedAt: row.updatedAt || row.updated_at || new Date().toISOString(),
        };
      });

      addToast(`Detected Features sheet. Parsed ${importedTasks.length} features.`, 'info');
    } else {
      // Map Actionable fields
      importedTasks = rows.map((row, idx) => {
        const title = row.Title || row.title || 'Untitled Actionable';
        const description = row.Description || row.description || '';
        const owner = row.Owner || row.owner || '';
        const priorityVal = (row.Priority || row.priority || 'MEDIUM').toUpperCase();
        const comments = row.Comments || row.comments || '';

        const priority = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(priorityVal) ? priorityVal as TaskPriority : 'MEDIUM';
        const status = mapSpreadsheetStatus(row.Status || row.status);
        
        const typeVal = (row.Type || row.type || 'TASK').toUpperCase() as WorkItemType;
        const type = ['TASK', 'BUG', 'IMPROVEMENT'].includes(typeVal) ? typeVal : 'TASK';

        const id = row.id || `TASK-${1000 + idx}`;

        return {
          id,
          title,
          description,
          status,
          priority,
          dueDate: row.dueDate || row.due_date || new Date().toISOString().split('T')[0],
          assignee: row.assignee || owner || '',
          reporter: row.reporter || 'Admin',
          timeEstimated: parseFloat(row.timeEstimated || row.time_estimated) || 0,
          timeLogged: parseFloat(row.timeLogged || row.time_logged) || 0,
          type,
          parentFeatureId: null, // linked during merge processing
          owner,
          module: row.Module || row.module || '',
          comments,
          createdBy: row.createdBy || row.created_by || 'Admin',
          attachments: [],
          activities: [],
          createdAt: row.createdAt || row.created_at || new Date().toISOString(),
          updatedAt: row.updatedAt || row.updated_at || new Date().toISOString(),
        };
      });

      addToast(`Detected Actionables sheet. Parsed ${importedTasks.length} actionables.`, 'info');
    }

    await processAndMergeItems(importedTasks, isFeaturesSheet);
  };

  // Merge items into database, handling duplicate prevention and auto-linking associations
  const processAndMergeItems = async (importedTasks: Task[], isFeaturesSheet: boolean) => {
    let finalTasksList = [...tasks];

    const userWantsMerge = window.confirm(
      "Do you want to MERGE the imported items into your existing workspace?\n\n" +
      "• Click 'OK' to MERGE and combine data.\n" +
      "• Click 'Cancel' to REPLACE your current workspace entirely."
    );

    if (!userWantsMerge) {
      finalTasksList = [];
    }

    let insertedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    const skipReasons: string[] = [];

    if (isFeaturesSheet && HIERARCHY_ENABLED) {
      // Prevent duplicate Features by updating in-place
      importedTasks.forEach(importedFeature => {
        if (!importedFeature.title || importedFeature.title.trim() === 'Untitled Feature') {
          skippedCount++;
          skipReasons.push(`Row ${importedFeature.id}: Empty feature name`);
          return;
        }

        const dupIdx = finalTasksList.findIndex(t => 
          t.type === 'FEATURE' && 
          (t.title.toLowerCase() === importedFeature.title.toLowerCase() || t.id.toLowerCase() === importedFeature.id.toLowerCase())
        );

        if (dupIdx !== -1) {
          finalTasksList[dupIdx] = {
            ...finalTasksList[dupIdx],
            ...importedFeature,
            id: finalTasksList[dupIdx].id // preserve original ID to retain child task linkages
          };
          updatedCount++;
        } else {
          finalTasksList.push(importedFeature);
          insertedCount++;
        }
      });
    } else {
      // Associate Tasks automatically with Parent Feature (Feature Name -> Module -> Owner)
      const allFeatures = HIERARCHY_ENABLED ? finalTasksList.filter(t => t.type === 'FEATURE') : [];

      importedTasks.forEach(importedTask => {
        if (!importedTask.title || importedTask.title.trim() === 'Untitled Actionable' || importedTask.title.trim() === 'Untitled Feature') {
          skippedCount++;
          skipReasons.push(`Row ${importedTask.id}: Empty title`);
          return;
        }

        let matchedParentId: string | null = null;

        if (HIERARCHY_ENABLED) {
          // Try title match
          const matchedByName = allFeatures.find(f => 
            f.title.toLowerCase() === importedTask.title.toLowerCase() ||
            importedTask.title.toLowerCase().includes(f.title.toLowerCase())
          );
          if (matchedByName) {
            matchedParentId = matchedByName.id;
          }

          // Try module match
          if (!matchedParentId && importedTask.module) {
            const matchedByModule = allFeatures.find(f => 
              f.module && f.module.toLowerCase() === importedTask.module.toLowerCase()
            );
            if (matchedByModule) {
              matchedParentId = matchedByModule.id;
            }
          }

          // Try owner match
          if (!matchedParentId && importedTask.owner) {
            const matchedByOwner = allFeatures.find(f => 
              f.owner && f.owner.toLowerCase() === importedTask.owner.toLowerCase()
            );
            if (matchedByOwner) {
              matchedParentId = matchedByOwner.id;
            }
          }
        }

        importedTask.parentFeatureId = matchedParentId;

        // Prevent duplicate Actionable by updating in-place
        const dupIdx = finalTasksList.findIndex(t => 
          (HIERARCHY_ENABLED ? t.type !== 'FEATURE' : true) && 
          t.title.toLowerCase() === importedTask.title.toLowerCase()
        );

        if (dupIdx !== -1) {
          finalTasksList[dupIdx] = {
            ...finalTasksList[dupIdx],
            ...importedTask,
            id: finalTasksList[dupIdx].id
          };
          updatedCount++;
        } else {
          finalTasksList.push(importedTask);
          insertedCount++;
        }
      });
    }

    // Populate team registry automatically with newly imported Owners
    const finalMembers = [...members];
    const uniqueOwners = new Set<string>();

    finalTasksList.forEach(t => {
      if (t.owner) uniqueOwners.add(t.owner);
      if (t.assignee) uniqueOwners.add(t.assignee);
    });

    uniqueOwners.forEach(name => {
      const cleanName = name.trim();
      if (!cleanName || cleanName.toLowerCase() === 'unassigned') return;

      const exists = finalMembers.some(m => m.name.toLowerCase() === cleanName.toLowerCase());
      if (!exists) {
        const colors = ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#ef4444', '#14b8a6'];
        finalMembers.push({
          id: 'MEM-' + Math.floor(100 + Math.random() * 900),
          name: cleanName,
          email: '',
          role: 'DEVELOPER',
          avatarColor: colors[Math.floor(Math.random() * colors.length)]
        });
      }
    });

    importWorkspaceData(finalTasksList, finalMembers, false);
    
    // Show import summary alert report
    const summaryMsg = 
      `${isFeaturesSheet ? 'Features' : 'Tasks'} Spreadsheet Import Summary:\n\n` +
      `• Total Rows Read: ${importedTasks.length}\n` +
      `• Newly Inserted: ${insertedCount}\n` +
      `• Updated Existing: ${updatedCount}\n` +
      `• Skipped: ${skippedCount}${skippedCount > 0 ? ` (${skipReasons.slice(0, 3).join(', ')}${skipReasons.length > 3 ? '...' : ''})` : ''}\n\n` +
      `All records have been successfully saved into Supabase database storage.`;
    
    alert(summaryMsg);
    addToast(userWantsMerge ? 'Spreadsheet Merged Successfully' : 'Workspace Restored from Spreadsheet', 'success');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    const isJson = fileExtension === 'json';
    const isCsv = fileExtension === 'csv';
    const isExcel = fileExtension === 'xlsx' || fileExtension === 'xls';

    if (!isJson && !isCsv && !isExcel) {
      addToast('Unsupported file type. Please upload Excel (.xlsx, .xls), CSV, or JSON.', 'error');
      return;
    }

    const reader = new FileReader();

    if (isJson) {
      reader.onload = async (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          let importedTasks: any[] = [];
          let importedMembers: any[] = [];

          if (parsed && typeof parsed === 'object') {
            if (parsed.version !== 1 && parsed.version !== undefined) {
              addToast('Unsupported project version schema', 'error');
              return;
            }

            const wsData = parsed.workspace || parsed;
            if (Array.isArray(wsData.tasks)) {
              importedTasks = wsData.tasks;
            } else if (Array.isArray(parsed)) {
              importedTasks = parsed;
            }

            if (Array.isArray(wsData.members)) {
              importedMembers = wsData.members;
            }
          }

          if (importedTasks.length === 0 && importedMembers.length === 0) {
            addToast('Malformed backup file rejected', 'error');
            return;
          }

          // Map tasks standardly
          const validTasks: Task[] = importedTasks.map((item: any, idx) => ({
            id: item.id || (item.type === 'FEATURE' ? `FEAT-${1000 + idx}` : `TASK-${1000 + idx}`),
            title: item.title || 'Untitled Task',
            description: item.description || '',
            status: ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'].includes(item.status) ? item.status : 'TODO',
            priority: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(item.priority) ? item.priority : 'MEDIUM',
            dueDate: item.dueDate || item.due_date || new Date().toISOString().split('T')[0],
            assignee: item.assignee || item.owner || '',
            reporter: item.reporter || 'Admin',
            timeEstimated: parseFloat(item.timeEstimated || item.time_estimated) || 0,
            timeLogged: parseFloat(item.timeLogged || item.time_logged) || 0,
            type: (item.type || 'TASK') as WorkItemType,
            parentFeatureId: item.parentFeatureId || item.parent_feature_id || null,
            owner: item.owner || '',
            module: item.module || '',
            comments: item.comments || '',
            createdBy: item.createdBy || item.created_by || 'Admin',
            attachments: Array.isArray(item.attachments) ? item.attachments : [],
            activities: Array.isArray(item.activities) ? item.activities : [],
            createdAt: item.createdAt || item.created_at || new Date().toISOString(),
            updatedAt: item.updatedAt || item.updated_at || new Date().toISOString(),
          }));

          const validMembers: Member[] = importedMembers.length > 0 ? importedMembers.map((item: any, idx) => {
            const colors = ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#ef4444', '#14b8a6'];
            const nameVal = item.name || 'Unknown Member';
            return {
              id: item.id || `MEM-${100 + idx}`,
              name: nameVal,
              email: item.email || `${nameVal.toLowerCase().replace(/\s+/g, '.')}@logmark-ai.com`,
              role: ['DEVELOPER', 'DESIGNER', 'QA', 'PRODUCT_MANAGER', 'INTERN', 'EMPLOYEE'].includes(item.role) ? item.role : 'EMPLOYEE',
              avatarColor: item.avatarColor || colors[Math.floor(Math.random() * colors.length)],
            };
          }) : [...DEFAULT_MEMBERS];

          const userWantsMerge = window.confirm(
            "Do you want to MERGE the imported tasks and members into your existing workspace?\n\n" +
            "• Click 'OK' to MERGE and combine data.\n" +
            "• Click 'Cancel' to REPLACE your current workspace entirely."
          );

          await importWorkspaceData(validTasks, validMembers, userWantsMerge);
          addToast(userWantsMerge ? 'Import Merged Successfully' : 'Workspace Restored from File', 'success');
        } catch (err) {
          console.error(err);
          addToast('Failed to parse JSON file', 'error');
        }
      };
      reader.readAsText(file);
    } else if (isCsv) {
      reader.onload = async (event) => {
        try {
          const text = event.target?.result as string;
          const rows = parseCSV(text);
          await processSpreadsheetRows(rows);
        } catch (err) {
          console.error(err);
          addToast('Failed to parse CSV file', 'error');
        }
      };
      reader.readAsText(file);
    } else if (isExcel) {
      reader.onload = async (event) => {
        try {
          const buffer = event.target?.result as ArrayBuffer;
          const rows = parseExcel(buffer);
          await processSpreadsheetRows(rows);
        } catch (err) {
          console.error(err);
          addToast('Failed to parse Excel file', 'error');
        }
      };
      reader.readAsArrayBuffer(file);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Export JSON configuration backer (Phase 18)
  const handleExportTasks = () => {
    const backupObj = {
      version: 1,
      workspace: {
        tasks,
        members,
        activeView,
        filters,
        sorting,
        theme,
      }
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupObj, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `logmark-workspace-backup-${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    addToast('Workspace Exported Successfully', 'success');
  };

  // Apply filters and sorting (Phase 7 & 8)
  const filteredTasks = tasks.filter((task) => {
    if (myWorkItemsOnly) {
      const assigneeMatch = task.assignee && task.assignee.toLowerCase() === currentUserName.toLowerCase();
      const ownerMatch = task.owner && task.owner.toLowerCase().includes(currentUserName.toLowerCase());
      const reporterMatch = task.reporter && task.reporter.toLowerCase() === currentUserName.toLowerCase();
      if (!assigneeMatch && !ownerMatch && !reporterMatch) {
        return false;
      }
    }

    const matchesSearch = 
      task.title.toLowerCase().includes(filters.search.toLowerCase()) ||
      task.description.toLowerCase().includes(filters.search.toLowerCase()) ||
      task.id.toLowerCase().includes(filters.search.toLowerCase()) ||
      (task.assignee && task.assignee.toLowerCase().includes(filters.search.toLowerCase())) ||
      (task.reporter && task.reporter.toLowerCase().includes(filters.search.toLowerCase()));
    
    const matchesPriority = filters.priority === 'ALL' || task.priority === filters.priority;
    
    // Status filter applies to all views (Kanban Board and Backlog)
    const matchesStatus = filters.status === 'ALL' || task.status === filters.status;
    
    const matchesAssignee = filters.assignee === 'ALL' 
      ? true 
      : filters.assignee === 'UNASSIGNED' 
        ? !task.assignee 
        : task.assignee.toLowerCase() === filters.assignee.toLowerCase();

    const matchesType = !filters.type || filters.type === 'ALL' || task.type === filters.type;
    
    const matchesParentFeature = !filters.parentFeature || filters.parentFeature === 'ALL' 
      ? true 
      : filters.parentFeature === 'NONE' 
        ? !task.parentFeatureId 
        : task.parentFeatureId === filters.parentFeature;

    const matchesOwner = !filters.owner || filters.owner === 'ALL' || task.owner === filters.owner;
    const matchesModule = !filters.module || filters.module === 'ALL' || task.module === filters.module;

    return matchesSearch && matchesPriority && matchesStatus && matchesAssignee && matchesType && matchesParentFeature && matchesOwner && matchesModule;
  });

  const sortedTasks = [...filteredTasks].sort((a, b) => {
    let comparison = 0;
    const field = sorting.field;
    
    if (field === 'title') {
      comparison = a.title.localeCompare(b.title);
    } else if (field === 'dueDate') {
      comparison = (a.dueDate || '').localeCompare(b.dueDate || '');
    } else if (field === 'priority') {
      const priorityWeight = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
      const weightA = priorityWeight[a.priority as keyof typeof priorityWeight] || 0;
      const weightB = priorityWeight[b.priority as keyof typeof priorityWeight] || 0;
      comparison = weightA - weightB;
    } else {
      // Default to createdAt
      comparison = a.createdAt.localeCompare(b.createdAt);
    }
    
    return sorting.direction === 'asc' ? comparison : -comparison;
  });

  // Calculate dynamic stats
  const featuresList = tasks.filter(t => t.type === 'FEATURE');
  const featuresDoneCount = featuresList.filter(t => t.status === 'DONE').length;

  const bugsList = tasks.filter(t => t.type === 'BUG');
  const bugsDoneCount = bugsList.filter(t => t.status === 'DONE').length;

  const improvementsList = tasks.filter(t => t.type === 'IMPROVEMENT');
  const improvementsDoneCount = improvementsList.filter(t => t.status === 'DONE').length;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overdueTasksCount = tasks.filter(t => {
    if (!t.dueDate || t.status === 'DONE') return false;
    const due = new Date(t.dueDate);
    due.setHours(0, 0, 0, 0);
    return due < today;
  }).length;

  const stats: ProjectStats = {
    total: tasks.length,
    backlog: tasks.filter(t => t.status === 'BACKLOG').length,
    todo: tasks.filter(t => t.status === 'TODO').length,
    inProgress: tasks.filter(t => t.status === 'IN_PROGRESS').length,
    inReview: tasks.filter(t => t.status === 'IN_REVIEW').length,
    done: tasks.filter(t => t.status === 'DONE').length,
    critical: tasks.filter(t => t.priority === 'CRITICAL').length,
    totalEstimatedHours: tasks.reduce((sum, t) => sum + (t.timeEstimated || 0), 0),
    totalLoggedHours: tasks.reduce((sum, t) => sum + (t.timeLogged || 0), 0),
    featuresTotal: featuresList.length,
    featuresDone: featuresDoneCount,
    featuresInProgress: featuresList.filter(t => t.status === 'IN_PROGRESS').length,
    tasksTotal: tasks.filter(t => t.type === 'TASK').length,
    tasksDone: tasks.filter(t => t.type === 'TASK' && t.status === 'DONE').length,
    bugsTotal: bugsList.length,
    bugsDone: bugsDoneCount,
    improvementsTotal: improvementsList.length,
    improvementsDone: improvementsDoneCount,
    criticalTasks: tasks.filter(t => t.priority === 'CRITICAL').length,
    overdueTasks: overdueTasksCount,
  };

  const selectedTask = selectedTaskId 
    ? tasks.find(t => t.id === selectedTaskId) || null 
    : null;

  return (
    <div className="app-container">
      {/* Phase 10 - Header Upgrades */}
      <header className="app-header">
        <div className="brand-section">
          <FolderKanban className="logo-icon" />
          <h1>Logmark <span>Jira Studio</span></h1>
        </div>
        <div className="header-actions">
          
          {/* 1. Connection Status Indicator Widget */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.4rem 0.75rem',
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid var(--border-color)',
            borderRadius: '20px',
            fontSize: '0.75rem',
            fontWeight: 600,
            color: 'var(--text-secondary)'
          }}>
            {isOnline ? (
              <>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }} />
                <span>Connected</span>
                <span style={{ opacity: 0.5 }}>|</span>
                <span>Workspace: Logmark AI</span>
                {currentUser && (
                  <>
                    <span style={{ opacity: 0.5 }}>|</span>
                    <span>Logged in as: {userDisplayName}</span>
                  </>
                )}
              </>
            ) : (
              <>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444', display: 'inline-block' }} />
                <span>Offline</span>
                <span style={{ opacity: 0.5 }}>|</span>
                <span style={{ color: 'var(--color-danger)' }}>Changes may not be synchronized.</span>
              </>
            )}
          </div>

          {/* Theme Toggle Switcher */}
          <button className="btn btn-secondary theme-toggle-btn" onClick={toggleTheme} title="Toggle Dark/Light Mode">
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          </button>

          <div className="file-input-wrapper">
            <button className="btn btn-secondary">
              <Upload size={16} /> Import Project / Sheet
            </button>
            <input 
              type="file" 
              accept=".json,.csv,.xlsx,.xls" 
              className="file-input" 
              onChange={handleFileUpload} 
              ref={fileInputRef}
            />
          </div>

          <button className="btn btn-secondary" onClick={handleExportTasks} disabled={tasks.length === 0}>
            <Download size={16} /> Export Backup
          </button>
          
          <button 
            className="btn btn-primary" 
            onClick={() => {
              setSelectedTaskId(null);
              setIsCreateMode(true);
              setIsModalOpen(true);
            }}
          >
            <Plus size={16} /> Create Task
          </button>

          {/* User Profile Badge (Phase 10) */}
          <div className="header-profile-section">
            <div className="profile-avatar-badge" title={currentUser || 'User'}>
              {userDisplayName.charAt(0).toUpperCase()}
            </div>
            <span className="profile-role-pill">{userDisplayRole}</span>
            <button className="btn btn-secondary logout-btn" onClick={handleLogoutClick} title="Logout Session">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Local Sandbox Info Banner */}
      {!isCloud && (
        <div className="sandbox-warning-banner" style={{
          backgroundColor: 'var(--status-progress-pill)',
          borderBottom: '1px solid var(--status-progress-border)',
          color: 'var(--status-progress-text)',
          fontSize: '0.8rem',
          fontWeight: 700,
          padding: '0.5rem 2rem',
          textAlign: 'center',
        }}>
          ⚠️ Local Sandbox Mode: Supabase configuration is missing in `.env`. Changes are stored in browser local storage.
        </div>
      )}

      <main className="dashboard-main">
        {/* Navigation Tabs (Phase 6 - Persist Navigation) */}
        <section className="toolbar" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '0.5rem' }}>
          <div className="view-tabs" style={{ display: 'inline-flex', padding: '4px', backgroundColor: 'var(--bg-hover)', borderRadius: '8px', border: '1px solid var(--border-color)', gap: '4px' }}>
            <button
              className={`view-tab-btn ${activeView === 'DASHBOARD' ? 'active' : ''}`}
              style={{ border: 'none', borderRadius: '6px', padding: '0.4rem 0.85rem' }}
              onClick={() => setActiveView('DASHBOARD')}
            >
              <LayoutDashboard size={14} /> Logmark Analytics
            </button>
            <button
              className={`view-tab-btn ${activeView === 'BOARD' ? 'active' : ''}`}
              style={{ border: 'none', borderRadius: '6px', padding: '0.4rem 0.85rem' }}
              onClick={() => setActiveView('BOARD')}
            >
              <Kanban size={14} /> Kanban Board
            </button>
            <button
              className={`view-tab-btn ${activeView === 'BACKLOG' ? 'active' : ''}`}
              style={{ border: 'none', borderRadius: '6px', padding: '0.4rem 0.85rem' }}
              onClick={() => setActiveView('BACKLOG')}
            >
              <ListTodo size={14} /> Backlog List
            </button>
            <button
              className={`view-tab-btn ${activeView === 'MEMBERS' ? 'active' : ''}`}
              style={{ border: 'none', borderRadius: '6px', padding: '0.4rem 0.85rem' }}
              onClick={() => setActiveView('MEMBERS')}
            >
              <Users size={14} /> Team Registry
            </button>
            <button
              className={`view-tab-btn ${activeView === 'PROFILE' ? 'active' : ''}`}
              style={{ border: 'none', borderRadius: '6px', padding: '0.4rem 0.85rem' }}
              onClick={() => setActiveView('PROFILE')}
            >
              <User size={14} /> My Profile
            </button>
          </div>

          {/* Interactive Filters & Sorting Toolbar */}
          {(activeView === 'BOARD' || activeView === 'BACKLOG') && (
            <div className="toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', width: '100%' }}>
              <div className="search-filter-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                
                {/* 6. Kanban Work Items Toggle Segment */}
                <div style={{
                  display: 'flex',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '20px',
                  padding: '2px',
                  marginRight: '0.5rem'
                }}>
                  <button
                    type="button"
                    style={{
                      padding: '0.35rem 0.85rem',
                      borderRadius: '18px',
                      border: 'none',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      backgroundColor: !myWorkItemsOnly ? 'var(--color-primary)' : 'transparent',
                      color: !myWorkItemsOnly ? '#fff' : 'var(--text-secondary)'
                    }}
                    onClick={() => setMyWorkItemsOnly(false)}
                  >
                    All Work Items
                  </button>
                  <button
                    type="button"
                    style={{
                      padding: '0.35rem 0.85rem',
                      borderRadius: '18px',
                      border: 'none',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      backgroundColor: myWorkItemsOnly ? 'var(--color-primary)' : 'transparent',
                      color: myWorkItemsOnly ? '#fff' : 'var(--text-secondary)'
                    }}
                    onClick={() => setMyWorkItemsOnly(true)}
                  >
                    My Work Items
                  </button>
                </div>

                <div className="search-input-wrapper">
                  <Search className="search-icon" />
                  <input
                    type="text"
                    placeholder="Search summaries, tickets..."
                    className="search-input"
                    value={filters.search}
                    onChange={(e) => setFilters({ search: e.target.value })}
                  />
                </div>

                {/* Assignee Filter Dropdown */}
                <select
                  className="select-filter"
                  value={filters.assignee}
                  onChange={(e) => setFilters({ assignee: e.target.value })}
                >
                  <option value="ALL">All Assignees</option>
                  <option value="UNASSIGNED">Unassigned</option>
                  {filters.assignee && filters.assignee !== 'ALL' && filters.assignee !== 'UNASSIGNED' && !members.some(m => m.name === filters.assignee) && (
                    <option value={filters.assignee}>{filters.assignee}</option>
                  )}
                  {members.map((m) => (
                    <option key={m.id} value={m.name}>
                      {m.name}
                    </option>
                  ))}
                </select>

                {/* Owner Filter */}
                <select
                  className="select-filter"
                  value={filters.owner || 'ALL'}
                  onChange={(e) => setFilters({ owner: e.target.value })}
                >
                  <option value="ALL">All Owners</option>
                  {filters.owner && filters.owner !== 'ALL' && !tasks.some(t => t.owner === filters.owner) && (
                    <option value={filters.owner}>Owner: {filters.owner}</option>
                  )}
                  {Array.from(new Set(tasks.map(t => t.owner).filter(Boolean))).map((ownerName) => (
                    <option key={ownerName} value={ownerName}>
                      Owner: {ownerName}
                    </option>
                  ))}
                </select>

                <select
                  className="select-filter"
                  value={filters.priority}
                  onChange={(e) => setFilters({ priority: e.target.value })}
                >
                  <option value="ALL">All Priorities</option>
                  <option value="LOW">Low Priority</option>
                  <option value="MEDIUM">Medium Priority</option>
                  <option value="HIGH">High Priority</option>
                  <option value="CRITICAL">Critical Priority</option>
                </select>

                {/* Status Filter */}
                <select
                  className="select-filter"
                  value={filters.status}
                  onChange={(e) => setFilters({ status: e.target.value })}
                >
                  <option value="ALL">All Statuses</option>
                  <option value="BACKLOG">Backlog</option>
                  <option value="TODO">To Do</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="IN_REVIEW">In Review</option>
                  <option value="DONE">Done</option>
                </select>

                {/* Type Filter */}
                <select
                  className="select-filter"
                  value={filters.type}
                  onChange={(e) => setFilters({ type: e.target.value })}
                >
                  <option value="ALL">All Types</option>
                  <option value="TASK">Tasks Only</option>
                  <option value="FEATURE">Features Only</option>
                  <option value="BUG">Bugs Only</option>
                  <option value="IMPROVEMENT">Improvements Only</option>
                </select>

                {/* Parent Feature Filter */}
                {HIERARCHY_ENABLED && (
                  <select
                    className="select-filter"
                    value={filters.parentFeature}
                    onChange={(e) => setFilters({ parentFeature: e.target.value })}
                  >
                    <option value="ALL">All Parent Features</option>
                    <option value="NONE">Unassigned / No Feature</option>
                    {tasks.filter(t => t.type === 'FEATURE').map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.id}: {f.title}
                      </option>
                    ))}
                  </select>
                )}

                {/* Module Filter */}
                <select
                  className="select-filter"
                  value={filters.module || 'ALL'}
                  onChange={(e) => setFilters({ module: e.target.value })}
                >
                  <option value="ALL">All Modules</option>
                  {filters.module && filters.module !== 'ALL' && !tasks.some(t => t.module === filters.module) && (
                    <option value={filters.module}>Module: {filters.module}</option>
                  )}
                  {Array.from(new Set(tasks.map(t => t.module).filter(Boolean))).map((modName) => (
                    <option key={modName} value={modName}>
                      Module: {modName}
                    </option>
                  ))}
                </select>

                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setFilters({
                      priority: 'ALL',
                      status: 'ALL',
                      assignee: 'ALL',
                      search: '',
                      type: 'ALL',
                      parentFeature: 'ALL',
                      owner: 'ALL',
                      module: 'ALL',
                    });
                  }}
                  title="Reset Filters"
                >
                  Reset
                </button>
              </div>

              {/* Sort selector dropdown */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <select
                  className="select-filter"
                  style={{ paddingRight: '1rem' }}
                  value={sorting.field}
                  onChange={(e) => setSorting({ ...sorting, field: e.target.value })}
                >
                  <option value="createdAt">Sort: Created Date</option>
                  <option value="title">Sort: Title</option>
                  <option value="dueDate">Sort: Due Date</option>
                  <option value="priority">Sort: Priority</option>
                </select>
                <button 
                  className="btn btn-secondary" 
                  style={{ padding: '0.5rem' }} 
                  onClick={() => setSorting({ ...sorting, direction: sorting.direction === 'asc' ? 'desc' : 'asc' })}
                  title="Toggle Sorting Direction"
                >
                  <ArrowUpDown size={14} />
                </button>
              </div>
            </div>
          )}
        </section>

        {/* View switching layout */}
        {activeView === 'PROFILE' ? (
          <MyProfileView />
        ) : activeView === 'DASHBOARD' ? (
          <DashboardView 
            tasks={tasks}
            members={members}
            stats={stats}
            onCreateWorkItem={() => {
              setSelectedTaskId(null);
              setIsCreateMode(true);
              setIsModalOpen(true);
            }}
            onImportSpreadsheet={() => {
              fileInputRef.current?.click();
            }}
            onNavigate={(view) => setActiveView(view)}
          />
        ) : activeView === 'MEMBERS' ? (
          <MembersDirectory 
            members={members}
            tasks={tasks}
            onAddMember={handleAddMember}
            onRemoveMember={handleRemoveMember}
          />
        ) : sortedTasks.length === 0 && tasks.length > 0 ? (
          <div className="empty-state">
            <Search className="empty-state-icon" />
            <h3>No results matching filters</h3>
            <p>Try resetting priority selection, assignee options, or search parameters.</p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="empty-state" style={{ padding: '4rem 2rem' }}>
            <FolderOpen size={48} className="empty-state-icon" style={{ color: 'var(--color-primary)' }} />
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Workspace Empty</h3>
            <p style={{ maxWidth: '400px', margin: '0 auto' }}>
              Create your first task or upload a JSON backup file to populate project requirements, priorities, and deadlines.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <div className="file-input-wrapper">
                <button className="btn btn-secondary">
                  <Upload size={16} /> Import Project / Sheet
                </button>
                <input 
                  type="file" 
                  accept=".json,.csv,.xlsx,.xls" 
                  className="file-input" 
                  onChange={handleFileUpload} 
                  ref={fileInputRef}
                />
              </div>
              <button 
                className="btn btn-primary"
                onClick={() => {
                  setSelectedTaskId(null);
                  setIsCreateMode(true);
                  setIsModalOpen(true);
                }}
              >
                <Plus size={16} /> Create First Task
              </button>
            </div>
          </div>
        ) : activeView === 'BOARD' ? (
          <KanbanBoard
            tasks={sortedTasks}
            allTasks={tasks}
            onTaskClick={(task) => {
              setSelectedTaskId(task.id);
              setIsCreateMode(false);
              setIsModalOpen(true);
            }}
            onStatusChange={handleStatusChange}
          />
        ) : (
          <BacklogView
            tasks={sortedTasks}
            onTaskClick={(task) => {
              setSelectedTaskId(task.id);
              setIsCreateMode(false);
              setIsModalOpen(true);
            }}
            onDeleteTask={handleDeleteTask}
          />
        )}
      </main>

      {/* 7. Workspace Footer */}
      <footer style={{
        marginTop: '2rem',
        padding: '1.5rem 1rem',
        borderTop: '1px solid var(--border-color)',
        textAlign: 'center',
        fontSize: '0.8rem',
        color: 'var(--text-muted)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.25rem',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }}>
        <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>Logmark Jira Studio | Internal Workspace</div>
        <div>Version 1.2.0 | Powered by Logmark AI</div>
      </footer>

      {/* Task Modal for CRUD Actions */}
      <TaskModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedTaskId(null);
        }}
        task={isCreateMode ? null : selectedTask}
        members={members}
        allTasks={tasks}
        onSave={(data) => {
          handleSaveTask(data);
          setIsModalOpen(false);
          setSelectedTaskId(null);
        }}
        onDelete={(id) => {
          handleDeleteTask(id);
          setIsModalOpen(false);
          setSelectedTaskId(null);
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <ThemeProvider>
        <AuthProvider>
          <WorkspaceProvider>
            <MainAppContent />
          </WorkspaceProvider>
        </AuthProvider>
      </ThemeProvider>
    </ToastProvider>
  );
}
