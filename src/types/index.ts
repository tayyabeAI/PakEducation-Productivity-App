export type UserRole = 'super-admin' | 'admin' | 'lead' | 'member';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: UserRole;
  teamId?: string;
  teamIds?: string[];
  createdAt: any;
  lastLogin?: any;
  canCreateMultipleTeams?: boolean;
  providerId?: string;
  status: 'active' | 'suspended' | 'deleted';
}

export interface Team {
  id: string;
  name: string;
  leadId: string;
  createdAt: any;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in-progress' | 'completed' | 'deleted';
  priority: 'low' | 'medium' | 'high';
  frequency: 'once' | 'daily' | 'weekly' | 'custom';
  dueDate: string;
  assigneeId: string;
  assigneeIds?: string[];
  completedBy?: string;
  completedAt?: any;
  teamId?: string;
  timeSpent: number; // in seconds
  timerStartedAt?: any;
  timerStartedBy?: string;
  createdAt: any;
  isInactive?: boolean;
  deleteRequested?: boolean;
  deleteRequestedBy?: string;
  completionComment?: string;
}

export interface Goal {
  id: string;
  title: string;
  description: string;
  type: 'short-term' | 'long-term';
  frequency: 'daily' | 'weekly' | 'monthly';
  targetDate: string;
  progress: number;
  userId: string;
  teamId?: string;
  createdAt: any;
}

export interface TimeLog {
  id: string;
  taskId: string;
  userId: string;
  startTime: any;
  endTime?: any;
  duration: number; // in seconds
}

export interface ChatMessage {
  id: string;
  teamId?: string;
  receiverId?: string;
  senderId: string;
  senderName: string;
  message: string;
  timestamp: any;
}

export interface SessionLog {
  id: string;
  userId: string;
  startTime: any;
  endTime?: any;
  duration: number; // in seconds
}

export interface Invitation {
  id?: string;
  teamId: string;
  teamName: string;
  inviterId: string;
  inviterName: string;
  email: string;
  role: UserRole;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: any;
  description?: string;
}

export interface TeamDataRecord {
  id?: string;
  teamId: string;
  batchId: string;
  sheetName: string;
  assignedUserId?: string | null;
  assignedUserIds?: string[]; // Multiple assignees
  editorIds?: string[]; // Users with edit access
  viewerIds?: string[]; // Users with view access
  dataFields: Record<string, any>;
  status: string;
  createdBy: string;
  createdAt: any;
  updatedBy?: string;
  updatedAt?: any;
}

export interface ActivityLog {
  id?: string;
  teamId?: string | null;
  action: 'upload' | 'assignment' | 'update' | 'login' | 'role_change' | 'status_change' | 'team_create' | 'team_switch' | 'delete';
  details: string;
  userId: string;
  userName: string;
  timestamp: any;
  recordId?: string;
}

export interface Notification {
  id?: string;
  userId: string;
  title: string;
  message: string;
  type: 'task_assigned' | 'task_updated' | 'system';
  read: boolean;
  createdAt: any;
  link?: string;
}

export interface ReportTemplate {
  id?: string;
  name: string;
  teamId: string;
  createdBy: string;
  createdAt: any;
  filters: FilterGroup;
  columns: string[]; // Visible columns
}

export interface FilterGroup {
  id?: string;
  logic: 'AND' | 'OR';
  conditions: (FilterCondition | FilterGroup)[];
}

export interface FilterCondition {
  id?: string;
  field: string;
  operator: 'equals' | 'not-equals' | 'greater-than' | 'less-than' | 'contains' | 'between';
  value: any;
  valueEnd?: any; // For between
}
