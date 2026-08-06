export type TaskStatus = 'BACKLOG' | 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type MemberRole = 'ADMIN' | 'DEVELOPER' | 'DESIGNER' | 'QA' | 'PRODUCT_MANAGER' | 'EMPLOYEE' | 'INTERN';

export type WorkItemType = 'FEATURE' | 'TASK' | 'BUG' | 'IMPROVEMENT';

export interface Member {
  id: string;
  name: string;
  email: string;
  role: MemberRole;
  avatarColor: string; // Hex color for user circles
}

export interface ActivityLog {
  id: string;
  user: string;
  action: string; // e.g. "Status changed to IN_PROGRESS", "Logged 1.5 hours"
  timestamp: string;
}

export interface Attachment {
  id: string;
  name: string;
  storagePath: string; // Path inside the storage bucket, e.g. work-item-attachments/{taskId}/file.png
  publicUrl: string;   // Direct downloadable/previewable URL from Supabase Storage
  mimeType: string;    // e.g. "image/png", "application/pdf"
  size: number;        // File size in bytes
  uploadedBy: string;  // Display name of uploader
  uploadedById: string; // Auth user ID for permission checks
  uploadedAt: string;  // ISO 8601 timestamp
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string;
  assignee: string; // Member name or ID
  reporter: string;
  timeEstimated: number; // in hours
  timeLogged: number; // in hours
  activities: ActivityLog[];
  createdAt: string;
  updatedAt: string;
  type: WorkItemType;
  parentFeatureId: string | null;
  owner: string;
  module: string;
  comments: string;
  createdBy: string;
  attachments: Attachment[]; // Stored in comments JSON — not a separate DB column
}

export interface BoardColumn {
  id: TaskStatus;
  title: string;
  color: string;
}

export interface ProjectStats {
  total: number;
  backlog: number;
  todo: number;
  inProgress: number;
  inReview: number;
  done: number;
  critical: number;
  totalEstimatedHours: number;
  totalLoggedHours: number;
  // Category counts
  featuresTotal: number;
  featuresDone: number;
  featuresInProgress: number;
  tasksTotal: number;
  tasksDone: number;
  bugsTotal: number;
  bugsDone: number;
  improvementsTotal: number;
  improvementsDone: number;
  criticalTasks: number;
  overdueTasks: number;
}
