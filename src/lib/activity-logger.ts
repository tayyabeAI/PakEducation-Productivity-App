import { db, collection, addDoc, serverTimestamp } from './firebase';
import { auth } from './firebase';

export type ActivityAction = 
  | 'upload' 
  | 'assignment' 
  | 'update' 
  | 'login' 
  | 'role_change' 
  | 'status_change' 
  | 'team_create' 
  | 'team_switch' 
  | 'delete';

export async function logActivity(
  action: ActivityAction, 
  details: string, 
  teamId?: string | null,
  recordId?: string
) {
  const user = auth.currentUser;
  if (!user) return;

  try {
    await addDoc(collection(db, 'activity_logs'), {
      action,
      details,
      teamId: teamId || null,
      userId: user.uid,
      userName: user.displayName || user.email || 'Unknown User',
      timestamp: serverTimestamp(),
      recordId: recordId || null
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
}
