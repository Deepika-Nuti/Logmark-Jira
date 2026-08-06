import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Save, 
  Trash2, 
  Play, 
  Pause, 
  RotateCcw, 
  Clock, 
  Users,
  FolderKanban,
  FileText,
  Calendar,
  AlertTriangle,
  Info,
  MessageSquare
} from 'lucide-react';
import type { Task, Member, ActivityLog, TaskStatus, WorkItemType, TaskPriority, Attachment } from '../types';
import { HIERARCHY_ENABLED } from '../config';
import { useWorkspace, parseComments, checkPermission } from '../context/WorkspaceContext';
import type { ThreadedComment } from '../context/WorkspaceContext';
import { useAuth } from '../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../utils/supabaseClient';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  task?: Task | null;
  members: Member[];
  allTasks: Task[];
  onSave: (taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'activities'> & { id?: string; activities?: ActivityLog[] }) => void;
  onDelete?: (id: string) => void;
}

export const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  onClose,
  task,
  members,
  allTasks,
  onSave,
  onDelete,
}) => {
  const { userRole, userDisplayName } = useWorkspace();
  const { currentUser, currentUserId } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('TODO');
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [dueDate, setDueDate] = useState('');
  const [assignee, setAssignee] = useState('');
  const [reporter, setReporter] = useState('');
  const [type, setType] = useState<WorkItemType>('TASK');
  const [parentFeatureId, setParentFeatureId] = useState<string | null>(null);
  const [owner, setOwner] = useState('');
  const [module, setModule] = useState('');
  const [comments, setComments] = useState('');
  const [techNotes, setTechNotes] = useState('');
  const [timeEstimated, setTimeEstimated] = useState(0);
  const [timeLogged, setTimeLogged] = useState(0);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [createdBy, setCreatedBy] = useState('');

  const [activeTab, setActiveTab] = useState<'details' | 'assignment' | 'discussion' | 'activity'>('details');
  const [newCommentText, setNewCommentText] = useState('');

  // Validation Error State
  const [validationError, setValidationError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Stopwatch Timer States
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const timerIntervalRef = useRef<any | null>(null);

  // Manual Time Input States
  const [manualLogAmount, setManualLogAmount] = useState('');
  const [manualLogComment, setManualLogComment] = useState('');

  // Attachments
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null); // 0-100 or null
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Attachment | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Image preview modal
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewZoomed, setPreviewZoomed] = useState(false);

  // Reset local state when task changes or modal opens
  useEffect(() => {
    setActiveTab('details');
    setNewCommentText('');
    
    if (task) {
      const parsed = parseComments(task.comments);
      setTitle(task.title);
      setDescription(task.description);
      setStatus(task.status);
      setPriority(task.priority);
      setDueDate(task.dueDate);
      setAssignee(task.assignee);
      setReporter(task.reporter);
      setType(task.type || 'TASK');
      setParentFeatureId(task.parentFeatureId || null);
      setOwner(task.owner || '');
      setModule(task.module || '');
      setComments(task.comments || '');
      setTechNotes(parsed.techNotes || '');
      setTimeEstimated(task.timeEstimated || 0);
      setTimeLogged(task.timeLogged || 0);
      setActivities(task.activities || []);
      setCreatedBy(task.createdBy || '');
      setAttachments(task.attachments || []);
    } else {
      setTitle('');
      setDescription('');
      setStatus('TODO');
      setPriority('MEDIUM');
      setDueDate(new Date().toISOString().split('T')[0]);
      setAssignee('');
      setReporter('');
      setType('TASK');
      setParentFeatureId(null);
      setOwner('');
      setModule('');
      setComments('');
      setTechNotes('');
      setTimeEstimated(0);
      setTimeLogged(0);
      setActivities([]);
      setCreatedBy('');
      setAttachments([]);
    }
    
    setTimerSeconds(0);
    setIsTimerRunning(false);
    setValidationError(null);
    setSuccessMessage(null);
    setManualLogAmount('');
    setManualLogComment('');
    setUploadProgress(null);
    setUploadError(null);
    setDeleteConfirm(null);
    setPreviewUrl(null);
    setPreviewZoomed(false);

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
  }, [task, isOpen]);

  // Stopwatch intervals
  useEffect(() => {
    if (isTimerRunning) {
      timerIntervalRef.current = setInterval(() => {
        setTimerSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [isTimerRunning]);

  // Stopwatch controls
  const startTimer = () => setIsTimerRunning(true);
  const stopTimer = () => setIsTimerRunning(false);
  const resetTimer = () => {
    setIsTimerRunning(false);
    setTimerSeconds(0);
  };

  const logTimerTime = () => {
    if (timerSeconds < 5) {
      setValidationError("Timer duration too short to log (must be at least 5 seconds).");
      return;
    }
    const decimalHours = timerSeconds / 3600;
    const roundedHours = Math.round(decimalHours * 100) / 100;
    const newLogged = Math.round((timeLogged + roundedHours) * 100) / 100;
    
    setTimeLogged(newLogged);
    setTimerSeconds(0);
    setIsTimerRunning(false);
    setValidationError(null);

    const now = new Date().toISOString();
    const act: ActivityLog = {
      id: 'ACT-' + Math.random(),
      user: owner || assignee || 'CurrentUser',
      action: `Logged ${roundedHours} hours using stopwatch timer`,
      timestamp: now
    };
    const updatedActivities = [act, ...activities];
    setActivities(updatedActivities);
    setSuccessMessage(`Logged ${roundedHours} hours to the task!`);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  // Manual log submit handler
  const handleManualLog = () => {
    const hours = parseFloat(manualLogAmount);
    if (isNaN(hours) || hours <= 0) {
      setValidationError("Please enter a valid positive number of hours.");
      return;
    }

    const newLogged = Math.round((timeLogged + hours) * 100) / 100;
    setTimeLogged(newLogged);
    setManualLogAmount('');
    setValidationError(null);

    const commentSuffix = manualLogComment.trim() ? `: "${manualLogComment.trim()}"` : '';
    const now = new Date().toISOString();
    const act: ActivityLog = {
      id: 'ACT-' + Math.random(),
      user: owner || assignee || 'CurrentUser',
      action: `Manually logged ${hours} hours${commentSuffix}`,
      timestamp: now
    };
    const updatedActivities = [act, ...activities];
    setActivities(updatedActivities);
    setManualLogComment('');
    setSuccessMessage(`Logged ${hours} hours to the task!`);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setValidationError("Summary / Title is required.");
      return;
    }

    if (HIERARCHY_ENABLED && type !== 'FEATURE' && !parentFeatureId) {
      setValidationError("A parent Feature is required for Tasks, Bugs, and Improvements.");
      return;
    }

    setValidationError(null);
    onSave({
      title: title.trim(),
      description,
      status,
      priority,
      dueDate,
      assignee,
      reporter,
      type,
      parentFeatureId,
      owner,
      module,
      comments,
      timeEstimated,
      timeLogged,
      createdBy,
      attachments,
      id: task?.id,
      activities: activities
    });
  };

  const formatTimerString = (sec: number) => {
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = sec % 60;
    return [
      hrs.toString().padStart(2, '0'),
      mins.toString().padStart(2, '0'),
      secs.toString().padStart(2, '0')
    ].join(':');
  };

  const currentUserName = userDisplayName;

  const canEdit = !task || checkPermission(userRole, 'EDIT', task, currentUserName).allowed;
  const canAssign = !task || checkPermission(userRole, 'ASSIGN', task, currentUserName).allowed;
  const canDelete = task && checkPermission(userRole, 'DELETE', task, currentUserName).allowed;
  const canCreate = !task && checkPermission(userRole, 'CREATE', { type }, currentUserName).allowed;

  const isDeveloper = userRole === 'DEVELOPER';
  const isQA = userRole === 'QA';
  const isEmployee = userRole === 'EMPLOYEE';

  const typeTooltip = "You don't have permission to create this work item type.";
  const editTooltip = "You don't have permission to edit this work item.";
  const assignTooltip = "Only Product Managers and Admins can assign work items.";
  const deleteTooltip = "You don't have permission to delete this work item.";
  const ownerTooltip = "Only Product Managers and Admins can manage owners/reporters.";
  const employeeTooltip = "Employees cannot edit features or estimate hours.";

  const canCreateType = (tType: WorkItemType) => {
    return checkPermission(userRole, 'CREATE', { type: tType }, currentUserName).allowed;
  };

  const getRelativeTime = (isoString: string) => {
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
    return past.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handleAddThreadedComment = () => {
    if (!newCommentText.trim()) return;

    const parsed = parseComments(comments);
    const newCommentObj: ThreadedComment = {
      id: 'COMM-' + Math.random().toString(36).substr(2, 9),
      userId: currentUser || '',
      authorName: userDisplayName,
      authorEmail: currentUser || '',
      text: newCommentText.trim(),
      timestamp: new Date().toISOString()
    };

    const updatedComments = JSON.stringify({
      techNotes: parsed.techNotes,
      commentsList: [newCommentObj, ...parsed.commentsList],
      attachments: parsed.attachments,
    });

    setComments(updatedComments);
    setNewCommentText('');

    if (task) {
      const commentLog: ActivityLog = {
        id: 'COMM-LOG-' + Math.random(),
        user: userDisplayName,
        action: `Comment added`,
        timestamp: new Date().toISOString()
      };
      
      const newActivities = [commentLog, ...activities];
      setActivities(newActivities);
      
      onSave({
        title,
        description,
        status,
        priority,
        dueDate,
        assignee,
        reporter,
        type,
        parentFeatureId,
        owner,
        module,
        comments: updatedComments,
        createdBy,
        timeEstimated,
        timeLogged,
        attachments,
        activities: newActivities
      });
    }
  };

  const features = allTasks.filter((t) => t.type === 'FEATURE' && t.id !== task?.id);

  if (!isOpen) return null;

  const progressPercent = timeEstimated > 0 ? Math.min(100, (timeLogged / timeEstimated) * 100) : 0;

  const handleTechNotesChange = (val: string) => {
    setTechNotes(val);
    const parsed = parseComments(comments);
    setComments(JSON.stringify({
      techNotes: val,
      commentsList: parsed.commentsList,
      attachments: parsed.attachments,
    }));
  };

  // --- Attachment Handlers ---
  const ALLOWED_MIME_TYPES = [
    'image/png', 'image/jpeg', 'image/jpg',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'application/zip',
  ];
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

  const persistAttachments = (updated: Attachment[], currentComments: string) => {
    const parsed = parseComments(currentComments);
    const newCommentsJson = JSON.stringify({
      techNotes: parsed.techNotes,
      commentsList: parsed.commentsList,
      attachments: updated,
    });
    setComments(newCommentsJson);
    return newCommentsJson;
  };

  const handleFileUpload = async (file: File) => {
    if (!task) return; // Only allow attachments on existing saved tasks
    setUploadError(null);

    // MIME type check
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      setUploadError('File type not supported. Allowed: PNG, JPG, PDF, DOCX, XLSX, TXT, ZIP.');
      return;
    }
    // Size check
    if (file.size > MAX_FILE_SIZE) {
      setUploadError('File exceeds the 10 MB limit.');
      return;
    }
    // Duplicate check (name + size)
    const duplicate = attachments.find(a => a.name === file.name && a.size === file.size);
    if (duplicate) {
      setUploadError('This attachment already exists.');
      return;
    }

    if (!isSupabaseConfigured || !supabase) {
      setUploadError('Storage is not configured.');
      return;
    }

    setUploadProgress(0);

    try {
      const storagePath = `work-item-attachments/${task.id}/${Date.now()}_${file.name}`;

      // Simulated progress since Supabase JS doesn't expose native XHR progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => (prev !== null && prev < 90 ? prev + 10 : prev));
      }, 150);

      const { error: uploadErr } = await supabase.storage
        .from('work-item-attachments')
        .upload(storagePath, file, { upsert: false });

      clearInterval(progressInterval);

      if (uploadErr) {
        setUploadProgress(null);
        setUploadError(`Upload failed: ${uploadErr.message}`);
        return;
      }

      const { data: urlData } = supabase.storage
        .from('work-item-attachments')
        .getPublicUrl(storagePath);

      setUploadProgress(100);

      const newAttachment: Attachment = {
        id: 'ATT-' + Math.random().toString(36).substr(2, 9),
        name: file.name,
        storagePath,
        publicUrl: urlData.publicUrl,
        mimeType: file.type,
        size: file.size,
        uploadedBy: userDisplayName,
        uploadedById: currentUserId || '',
        uploadedAt: new Date().toISOString(),
      };

      const updatedAttachments = [newAttachment, ...attachments];
      setAttachments(updatedAttachments);
      const newCommentsStr = persistAttachments(updatedAttachments, comments);

      // Log activity
      const actLog: ActivityLog = {
        id: 'ACT-' + Math.random(),
        user: userDisplayName,
        action: `Uploaded attachment: ${file.name}`,
        timestamp: new Date().toISOString(),
      };
      const newActivities = [actLog, ...activities];
      setActivities(newActivities);

      onSave({
        title, description, status, priority, dueDate, assignee, reporter, type,
        parentFeatureId, owner, module, comments: newCommentsStr, createdBy,
        timeEstimated, timeLogged, attachments: updatedAttachments, activities: newActivities,
      });

      setTimeout(() => setUploadProgress(null), 1200);
    } catch (err: any) {
      setUploadProgress(null);
      setUploadError(`Upload error: ${err.message}`);
    }
  };

  const handleDeleteAttachment = async (att: Attachment) => {
    if (!isSupabaseConfigured || !supabase) return;

    try {
      await supabase.storage.from('work-item-attachments').remove([att.storagePath]);
    } catch {
      // Proceed even if storage delete fails — remove metadata regardless
    }

    const updatedAttachments = attachments.filter(a => a.id !== att.id);
    setAttachments(updatedAttachments);
    const newCommentsStr = persistAttachments(updatedAttachments, comments);
    setDeleteConfirm(null);

    // Log activity
    const actLog: ActivityLog = {
      id: 'ACT-' + Math.random(),
      user: userDisplayName,
      action: `Deleted attachment: ${att.name}`,
      timestamp: new Date().toISOString(),
    };
    const newActivities = [actLog, ...activities];
    setActivities(newActivities);

    onSave({
      title, description, status, priority, dueDate, assignee, reporter, type,
      parentFeatureId, owner, module, comments: newCommentsStr, createdBy,
      timeEstimated, timeLogged, attachments: updatedAttachments, activities: newActivities,
    });
  };

  const handleDownload = async (att: Attachment) => {
    try {
      const res = await fetch(att.publicUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = att.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      // Log download activity
      const actLog: ActivityLog = {
        id: 'ACT-' + Math.random(),
        user: userDisplayName,
        action: `Downloaded attachment: ${att.name}`,
        timestamp: new Date().toISOString(),
      };
      const newActivities = [actLog, ...activities];
      setActivities(newActivities);
      if (task) {
        onSave({
          title, description, status, priority, dueDate, assignee, reporter, type,
          parentFeatureId, owner, module, comments, createdBy,
          timeEstimated, timeLogged, attachments, activities: newActivities,
        });
      }
    } catch {
      // Fallback: open in new tab
      window.open(att.publicUrl, '_blank');
    }
  };

  const canDeleteAttachment = (att: Attachment) => {
    if (userRole === 'ADMIN' || userRole === 'PRODUCT_MANAGER') return true;
    return att.uploadedById === currentUserId;
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return '🖼';
    if (mimeType === 'application/pdf') return '📄';
    if (mimeType.includes('word')) return '📝';
    if (mimeType.includes('sheet')) return '📊';
    if (mimeType === 'text/plain') return '📃';
    if (mimeType === 'application/zip') return '📦';
    return '📎';
  };

  const sortedAttachments = [...attachments].sort(
    (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
  );

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '950px', width: '90%', display: 'flex', flexDirection: 'column', height: '85vh', overflow: 'hidden' }}>
        
        {/* Sticky Header */}
        <div className="modal-header" style={{ flexShrink: 0, borderBottom: '1px solid var(--border-color)', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
            <FolderKanban size={20} className="logo-icon" />
            <span>{task ? `${task.id}: ${task.title}` : 'Create New Work Item'}</span>
          </h2>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Close modal" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          
          {/* Tabs Navigation */}
          <div style={{
            display: 'flex',
            borderBottom: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-app)',
            padding: '0.5rem 1.5rem 0 1.5rem',
            gap: '1rem',
            flexShrink: 0
          }}>
            <button
              type="button"
              style={{
                padding: '0.5rem 1rem',
                border: 'none',
                borderBottom: activeTab === 'details' ? '2px solid var(--color-primary)' : '2px solid transparent',
                backgroundColor: 'transparent',
                color: activeTab === 'details' ? 'var(--text-primary)' : 'var(--text-muted)',
                fontWeight: activeTab === 'details' ? 800 : 600,
                cursor: 'pointer',
                fontSize: '0.85rem'
              }}
              onClick={() => setActiveTab('details')}
            >
              Details
            </button>
            <button
              type="button"
              style={{
                padding: '0.5rem 1rem',
                border: 'none',
                borderBottom: activeTab === 'assignment' ? '2px solid var(--color-primary)' : '2px solid transparent',
                backgroundColor: 'transparent',
                color: activeTab === 'assignment' ? 'var(--text-primary)' : 'var(--text-muted)',
                fontWeight: activeTab === 'assignment' ? 800 : 600,
                cursor: 'pointer',
                fontSize: '0.85rem'
              }}
              onClick={() => setActiveTab('assignment')}
            >
              Assignment
            </button>
            <button
              type="button"
              style={{
                padding: '0.5rem 1rem',
                border: 'none',
                borderBottom: activeTab === 'discussion' ? '2px solid var(--color-primary)' : '2px solid transparent',
                backgroundColor: 'transparent',
                color: activeTab === 'discussion' ? 'var(--text-primary)' : 'var(--text-muted)',
                fontWeight: activeTab === 'discussion' ? 800 : 600,
                cursor: 'pointer',
                fontSize: '0.85rem'
              }}
              onClick={() => setActiveTab('discussion')}
            >
              Discussion
            </button>
            {task && (
              <button
                type="button"
                style={{
                  padding: '0.5rem 1rem',
                  border: 'none',
                  borderBottom: activeTab === 'activity' ? '2px solid var(--color-primary)' : '2px solid transparent',
                  backgroundColor: 'transparent',
                  color: activeTab === 'activity' ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontWeight: activeTab === 'activity' ? 800 : 600,
                  cursor: 'pointer',
                  fontSize: '0.85rem'
                }}
                onClick={() => setActiveTab('activity')}
              >
                Activity ({activities.length})
              </button>
            )}
          </div>

          {/* Sticky Tab Body (only this scrolls) */}
          <div className="modal-body-scroll" style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
            
            {validationError && (
              <div className="validation-error-alert" style={{
                backgroundColor: 'var(--priority-critical-bg)',
                border: '1px solid var(--priority-critical-text)',
                color: 'var(--priority-critical-text)',
                padding: '0.65rem 0.85rem',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '1rem',
                flexShrink: 0
              }}>
                <AlertTriangle size={16} />
                <span>{validationError}</span>
              </div>
            )}
            {successMessage && (
              <div className="validation-success-alert" style={{
                backgroundColor: 'var(--status-done-pill)',
                border: '1px solid var(--status-done-text)',
                color: 'var(--status-done-text)',
                padding: '0.65rem 0.85rem',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '1rem',
                flexShrink: 0
              }}>
                <Info size={16} />
                <span>{successMessage}</span>
              </div>
            )}

            {/* TAB 1: DETAILS */}
            {activeTab === 'details' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div className="form-section-card">
                  <span className="form-section-title">
                    <FileText size={14} /> General Information
                  </span>
                  
                  <div className="form-grid-2">
                    <div className="form-group">
                      <label>Work Item Type <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                      <select
                        className="form-select"
                        value={type}
                        onChange={(e) => setType(e.target.value as WorkItemType)}
                        disabled={task ? !canEdit : false}
                        title={task && !canEdit ? editTooltip : undefined}
                      >
                        <option value="TASK" disabled={!canCreateType('TASK')} title={!canCreateType('TASK') ? typeTooltip : undefined}>Task</option>
                        {HIERARCHY_ENABLED && (
                          <option value="FEATURE" disabled={!canCreateType('FEATURE')} title={!canCreateType('FEATURE') ? "QA and Employees cannot create Feature items." : undefined}>
                            Feature (Parent Theme)
                          </option>
                        )}
                        <option value="BUG" disabled={!canCreateType('BUG')} title={!canCreateType('BUG') ? typeTooltip : undefined}>Bug / Defect</option>
                        <option value="IMPROVEMENT" disabled={!canCreateType('IMPROVEMENT')} title={!canCreateType('IMPROVEMENT') ? typeTooltip : undefined}>Improvement</option>
                      </select>
                    </div>
                    
                    {HIERARCHY_ENABLED && type !== 'FEATURE' && (
                      <div className="form-group">
                        <label>Parent Feature</label>
                        <select
                          className="form-select"
                          value={parentFeatureId || ''}
                          onChange={(e) => setParentFeatureId(e.target.value || null)}
                          disabled={!canEdit || isEmployee}
                          title={!canEdit ? editTooltip : isEmployee ? "Employees cannot change parent features." : undefined}
                        >
                          <option value="">Select Parent Feature...</option>
                          {features.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.id}: {f.title} {f.module ? `| Mod: ${f.module}` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="form-group" style={{ marginTop: '0.75rem' }}>
                    <label htmlFor="modal-task-title">Summary / Title <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                    <input
                      id="modal-task-title"
                      type="text"
                      className="form-input"
                      placeholder="e.g. Upgrade Supabase configurations"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      required
                      disabled={!canEdit || !!(task && task.type === 'FEATURE' && isEmployee)}
                      title={!canEdit ? editTooltip : (task && task.type === 'FEATURE' && isEmployee) ? employeeTooltip : undefined}
                    />
                  </div>

                  <div className="form-group" style={{ marginTop: '0.75rem' }}>
                    <label htmlFor="modal-task-desc">Description</label>
                    <textarea
                      id="modal-task-desc"
                      className="form-textarea"
                      placeholder="Describe the goals, parameters, and requirements of this issue..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      disabled={!canEdit || !!(task && task.type === 'FEATURE' && isEmployee)}
                      title={!canEdit ? editTooltip : (task && task.type === 'FEATURE' && isEmployee) ? employeeTooltip : undefined}
                    />
                  </div>
                </div>

                <div className="form-section-card">
                  <span className="form-section-title">
                    <Calendar size={14} /> Workflow & Classification
                  </span>
                  
                  <div className="form-grid-2">
                    <div className="form-group">
                      <label htmlFor="modal-task-module">Component / Module</label>
                      <input
                        id="modal-task-module"
                        type="text"
                        className="form-input"
                        placeholder="e.g. Backend, Auth, UI"
                        value={module}
                        onChange={(e) => setModule(e.target.value)}
                        disabled={!canEdit || !!(task && task.type === 'FEATURE' && isEmployee)}
                        title={!canEdit ? editTooltip : (task && task.type === 'FEATURE' && isEmployee) ? employeeTooltip : undefined}
                      />
                    </div>

                    <div className="form-group">
                      <label>Workflow Status <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                      <select
                        className="form-select"
                        value={status}
                        onChange={(e) => setStatus(e.target.value as TaskStatus)}
                        disabled={task ? !checkPermission(userRole, 'STATUS', task, currentUserName).allowed : false}
                        title={task && !checkPermission(userRole, 'STATUS', task, currentUserName).allowed ? "You don't have permission to change status." : undefined}
                      >
                        <option value="BACKLOG">Backlog</option>
                        <option value="TODO">To Do</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="IN_REVIEW">In Review</option>
                        <option value="DONE">Done</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Priority Level <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                      <select
                        className="form-select"
                        value={priority}
                        onChange={(e) => setPriority(e.target.value as TaskPriority)}
                        disabled={isEmployee}
                        title={isEmployee ? "Employees cannot change priorities." : undefined}
                      >
                        <option value="LOW">Low</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HIGH">High</option>
                        <option value="CRITICAL">Critical</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="form-section-card">
                  <span className="form-section-title">
                    <MessageSquare size={14} /> Tech Notes
                  </span>
                  
                  <div className="form-group">
                    <textarea
                      className="form-textarea"
                      style={{ minHeight: '80px' }}
                      placeholder="Add brief technical comments, blockages, summaries..."
                      value={techNotes}
                      onChange={(e) => handleTechNotesChange(e.target.value)}
                      disabled={!canEdit}
                      title={!canEdit ? editTooltip : undefined}
                    />
                  </div>
                </div>

                {/* Attachments Section */}
                {task && (
                  <div className="form-section-card">
                    <span className="form-section-title">
                      📎 Attachments {attachments.length > 0 && <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>({attachments.length})</span>}
                    </span>

                    {/* Upload Error */}
                    {uploadError && (
                      <div style={{ padding: '0.5rem 0.75rem', backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', color: '#ef4444', fontSize: '0.8rem', fontWeight: 600 }}>
                        {uploadError}
                      </div>
                    )}

                    {/* Upload Progress */}
                    {uploadProgress !== null && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                          Uploading...
                        </span>
                        <div style={{ height: '8px', background: 'var(--bg-hover)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: `${uploadProgress}%`, height: '100%', background: 'var(--color-primary)', borderRadius: '4px', transition: 'width 0.2s ease' }} />
                        </div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{uploadProgress}%</span>
                      </div>
                    )}

                    {/* Drop Zone */}
                    <div
                      onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
                      onDragLeave={() => setIsDraggingOver(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDraggingOver(false);
                        const file = e.dataTransfer.files[0];
                        if (file) handleFileUpload(file);
                      }}
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        border: `2px dashed ${isDraggingOver ? 'var(--color-primary)' : 'var(--border-color)'}`,
                        borderRadius: '12px',
                        padding: '1.5rem',
                        textAlign: 'center',
                        cursor: 'pointer',
                        backgroundColor: isDraggingOver ? 'rgba(59,130,246,0.05)' : 'var(--bg-app)',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}
                    >
                      <span style={{ fontSize: '1.75rem' }}>📎</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        Drag files here
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 600 }}>
                        — or Browse Files —
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        PNG • JPG • PDF • DOCX • XLSX • TXT • ZIP • Maximum 10 MB
                      </span>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".png,.jpg,.jpeg,.pdf,.docx,.xlsx,.txt,.zip"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file);
                        e.target.value = '';
                      }}
                    />

                    {/* Attachment Cards — newest first */}
                    {sortedAttachments.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '260px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                        {sortedAttachments.map(att => (
                          <div key={att.id} style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            padding: '0.65rem 0.85rem',
                            borderRadius: '10px',
                            border: '1px solid var(--border-color)',
                            backgroundColor: 'var(--bg-app)',
                          }}>
                            <span style={{ fontSize: '1.35rem', flexShrink: 0 }}>{getFileIcon(att.mimeType)}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.name}</div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                {getRelativeTime(att.uploadedAt)} • {att.uploadedBy} • {formatBytes(att.size)}
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                              {/* Preview */}
                              <button type="button" title="Preview"
                                onClick={() => {
                                  if (att.mimeType.startsWith('image/')) {
                                    setPreviewUrl(att.publicUrl);
                                    setPreviewZoomed(false);
                                  } else {
                                    window.open(att.publicUrl, '_blank');
                                  }
                                }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', padding: '0.25rem', borderRadius: '6px', color: 'var(--text-secondary)' }}
                              >👁</button>
                              {/* Download */}
                              <button type="button" title="Download"
                                onClick={() => handleDownload(att)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', padding: '0.25rem', borderRadius: '6px', color: 'var(--text-secondary)' }}
                              >⬇</button>
                              {/* Delete */}
                              {canDeleteAttachment(att) && (
                                <button type="button" title="Delete"
                                  onClick={() => setDeleteConfirm(att)}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', padding: '0.25rem', borderRadius: '6px', color: '#ef4444' }}
                                >🗑</button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Delete Confirmation */}
                    {deleteConfirm && (
                      <div style={{
                        padding: '1rem',
                        border: '1px solid rgba(239,68,68,0.3)',
                        borderRadius: '10px',
                        backgroundColor: 'rgba(239,68,68,0.05)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem',
                      }}>
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)' }}>Delete attachment?</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--color-primary)', fontWeight: 600, marginTop: '0.25rem' }}>{deleteConfirm.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>This action cannot be undone.</div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button type="button" onClick={() => setDeleteConfirm(null)}
                            className="btn btn-secondary" style={{ flex: 1, fontSize: '0.8rem', padding: '0.4rem' }}>
                            Cancel
                          </button>
                          <button type="button" onClick={() => handleDeleteAttachment(deleteConfirm)}
                            className="btn" style={{ flex: 1, fontSize: '0.8rem', padding: '0.4rem', backgroundColor: '#ef4444', borderColor: '#ef4444', color: '#fff' }}>
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: ASSIGNMENT */}
            {activeTab === 'assignment' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div className="form-section-card">
                  <span className="form-section-title">
                    <Users size={14} /> People & Scheduling
                  </span>
                  
                  <div className="form-grid-2">
                    <div className="form-group">
                      <label>Owner / Manager</label>
                      <select
                        className="form-select"
                        value={owner}
                        onChange={(e) => setOwner(e.target.value)}
                        disabled={isDeveloper || isQA || isEmployee}
                        title={(isDeveloper || isQA || isEmployee) ? ownerTooltip : undefined}
                      >
                        <option value="">No Owner assigned...</option>
                        {members.map(m => (
                          <option key={m.id} value={m.name}>{m.name} ({m.role.replace('_', ' ')})</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Assignee</label>
                      <select
                        className="form-select"
                        value={assignee}
                        onChange={(e) => setAssignee(e.target.value)}
                        disabled={!canAssign}
                        title={!canAssign ? assignTooltip : undefined}
                      >
                        <option value="">Unassigned...</option>
                        {members.map(m => (
                          <option key={m.id} value={m.name}>{m.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Reporter</label>
                      <select
                        className="form-select"
                        value={reporter}
                        onChange={(e) => setReporter(e.target.value)}
                        disabled={isDeveloper || isQA || isEmployee}
                        title={(isDeveloper || isQA || isEmployee) ? ownerTooltip : undefined}
                      >
                        <option value="">No Reporter assigned...</option>
                        {members.map(m => (
                          <option key={m.id} value={m.name}>{m.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label htmlFor="modal-task-due">Due Date</label>
                      <input
                        id="modal-task-due"
                        type="date"
                        className="form-input"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        disabled={!canEdit}
                        title={!canEdit ? editTooltip : undefined}
                      />
                    </div>
                  </div>
                </div>

                <div className="form-section-card">
                  <span className="form-section-title">
                    <Clock size={14} /> Time Tracker & Estimates
                  </span>
                  
                  <div className="form-grid-2">
                    <div className="form-group">
                      <label>Time Estimated (hours)</label>
                      <input
                        type="number"
                        className="form-input"
                        min="0"
                        step="0.5"
                        value={timeEstimated || 0}
                        onChange={(e) => setTimeEstimated(parseFloat(e.target.value) || 0)}
                        disabled={isEmployee}
                        title={isEmployee ? employeeTooltip : undefined}
                      />
                    </div>

                    <div className="form-group">
                      <label>Time Logged (hours)</label>
                      <input
                        type="number"
                        className="form-input"
                        min="0"
                        step="0.5"
                        value={timeLogged || 0}
                        onChange={(e) => setTimeLogged(parseFloat(e.target.value) || 0)}
                        disabled={isEmployee}
                        title={isEmployee ? employeeTooltip : undefined}
                      />
                    </div>
                  </div>

                  {timeEstimated > 0 && (
                    <div style={{ marginTop: '0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>
                        <span>Progress: {Math.round(progressPercent)}% logged</span>
                        <span>{timeLogged}h of {timeEstimated}h</span>
                      </div>
                      <div style={{ height: '6px', background: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ 
                          width: `${progressPercent}%`, 
                          height: '100%', 
                          backgroundColor: progressPercent > 100 ? 'var(--color-danger)' : 'var(--status-done-text)',
                          borderRadius: '3px'
                        }} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Time tracking widgets inside Assignment tab */}
                {task && (
                  <div className="form-section-card">
                    <span className="form-section-title">
                      <Clock size={14} /> Stopwatch & Work Logs
                    </span>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--bg-app)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '1.25rem', fontWeight: 700, color: isTimerRunning ? 'var(--color-primary)' : 'inherit' }}>
                          {formatTimerString(timerSeconds)}
                        </span>
                        <div style={{ display: 'flex', gap: '0.35rem' }}>
                          {isTimerRunning ? (
                            <button type="button" className="btn btn-secondary" style={{ padding: '0.4rem' }} onClick={stopTimer} title="Pause">
                              <Pause size={14} />
                            </button>
                          ) : (
                            <button type="button" className="btn btn-primary" style={{ padding: '0.4rem' }} onClick={startTimer} title="Start stopwatch" disabled={isEmployee}>
                              <Play size={14} />
                            </button>
                          )}
                          <button type="button" className="btn btn-secondary" style={{ padding: '0.4rem' }} onClick={resetTimer} title="Reset" disabled={isEmployee}>
                            <RotateCcw size={14} />
                          </button>
                          <button 
                            type="button" 
                            className="btn btn-primary" 
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }} 
                            onClick={logTimerTime}
                            disabled={timerSeconds === 0 || isEmployee}
                          >
                            Log Time
                          </button>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <input
                          type="number"
                          className="form-input"
                          style={{ width: '80px' }}
                          placeholder="Hours"
                          min="0.1"
                          step="0.1"
                          value={manualLogAmount}
                          onChange={(e) => setManualLogAmount(e.target.value)}
                          disabled={isEmployee}
                          title={isEmployee ? employeeTooltip : undefined}
                        />
                        <input
                          type="text"
                          className="form-input"
                          style={{ flex: 1, minWidth: '150px' }}
                          placeholder="Add details of work..."
                          value={manualLogComment}
                          onChange={(e) => setManualLogComment(e.target.value)}
                          disabled={isEmployee}
                          title={isEmployee ? employeeTooltip : undefined}
                        />
                        <button type="button" className="btn btn-secondary" onClick={handleManualLog} disabled={isEmployee} title={isEmployee ? employeeTooltip : undefined}>
                          Log Hours
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: DISCUSSION */}
            {activeTab === 'discussion' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div className="form-section-card">
                  <span className="form-section-title">
                    <MessageSquare size={14} /> Discussion Feed
                  </span>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <textarea
                      rows={3}
                      className="form-textarea"
                      placeholder="Type your message here... (Enter to send, Shift+Enter for new line)"
                      value={newCommentText}
                      onChange={(e) => setNewCommentText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleAddThreadedComment();
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ alignSelf: 'flex-end', padding: '0.4rem 1rem', fontSize: '0.8rem' }}
                      onClick={handleAddThreadedComment}
                      disabled={!newCommentText.trim()}
                    >
                      Send Message
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                    {parseComments(comments).commentsList.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)' }}>
                        <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700 }}>No discussions yet.</p>
                        <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', opacity: 0.8 }}>Start the first discussion.</p>
                      </div>
                    ) : (
                      parseComments(comments).commentsList.map((comm) => {
                        const commInitials = comm.authorName.split(/\s+/).map(n => n[0]).join('').toUpperCase().slice(0, 2);
                        const commColor = members.find(m => m.name.toLowerCase() === comm.authorName.toLowerCase())?.avatarColor || 'var(--color-primary)';
                        return (
                          <div key={comm.id} style={{ display: 'flex', gap: '0.75rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                            <div style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              backgroundColor: commColor,
                              color: '#fff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '0.8rem',
                              flexShrink: 0
                            }}>
                              {commInitials}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: 0, flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)' }}>{comm.authorName}</span>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{getRelativeTime(comm.timestamp)}</span>
                              </div>
                              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                {comm.text}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: ACTIVITY */}
            {activeTab === 'activity' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div className="form-section-card">
                  <span className="form-section-title">
                    <FolderKanban size={14} /> Audit Trail & History
                  </span>
                  
                  {activities.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      No events recorded on this work item.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderLeft: '2px solid var(--border-color)', paddingLeft: '1.25rem', marginLeft: '0.5rem' }}>
                      {activities.map((act) => (
                        <div key={act.id} style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                          <div style={{
                            position: 'absolute',
                            left: '-1.65rem',
                            top: '0.25rem',
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--color-primary)',
                            border: '2px solid var(--bg-card)'
                          }} />
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)' }}>{act.user}</span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{getRelativeTime(act.timestamp)}</span>
                          </div>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{act.action}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>

          {/* Sticky Footer */}
          <div className="modal-footer" style={{ flexShrink: 0, borderTop: '1px solid var(--border-color)', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            {task && onDelete && (
              <button
                type="button"
                className="btn btn-danger"
                style={{ marginRight: 'auto' }}
                onClick={() => {
                  if (confirm("Permanently delete this work item? This action is irreversible.")) {
                    onDelete(task.id);
                    onClose();
                  }
                }}
                disabled={!canDelete}
                title={!canDelete ? deleteTooltip : undefined}
              >
                <Trash2 size={16} /> Delete
              </button>
            )}
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={task ? !canEdit : !canCreate}
              title={task ? (!canEdit ? editTooltip : undefined) : (!canCreate ? typeTooltip : undefined)}
            >
              <Save size={16} /> {task ? 'Save Changes' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>

      {/* Image Preview Modal */}
      {previewUrl && (
        <div
          onClick={() => setPreviewUrl(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.85)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
          }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
            <button
              type="button"
              onClick={() => setPreviewUrl(null)}
              style={{ position: 'absolute', top: '-2rem', right: 0, background: 'none', border: 'none', color: '#fff', fontSize: '1.5rem', cursor: 'pointer' }}
            >✕</button>
            <button
              type="button"
              onClick={() => setPreviewZoomed(z => !z)}
              style={{ position: 'absolute', top: '-2rem', right: '2.5rem', background: 'none', border: 'none', color: '#fff', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 700 }}
            >{previewZoomed ? '⤡ Fit' : '⤢ Full Size'}</button>
            <img
              src={previewUrl}
              alt="Preview"
              style={{
                maxWidth: previewZoomed ? 'none' : '80vw',
                maxHeight: previewZoomed ? 'none' : '80vh',
                width: previewZoomed ? 'auto' : undefined,
                borderRadius: '10px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                display: 'block',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
