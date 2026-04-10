export type UserRole = 'admin' | 'lead' | 'member';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: UserRole;
  teamId?: string;
  createdAt: any;
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
  teamId?: string;
  timeSpent: number; // in seconds
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
