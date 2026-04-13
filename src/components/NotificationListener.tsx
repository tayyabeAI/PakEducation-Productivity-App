import { useEffect } from 'react';
import { db, collection, query, where, onSnapshot, updateDoc, doc, serverTimestamp } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { Notification } from '../types';
import { toast } from 'sonner';

export default function NotificationListener() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    // Listen for unread notifications for the current user
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      where('read', '==', false)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const notification = { id: change.doc.id, ...change.doc.data() } as Notification;
          
          // Show popup notification
          toast(notification.title, {
            description: notification.message,
            action: {
              label: 'Mark as Read',
              onClick: () => markAsRead(notification.id!)
            },
          });
        }
      });
    });

    return () => unsubscribe();
  }, [user]);

  const markAsRead = async (notificationId: string) => {
    try {
      await updateDoc(doc(db, 'notifications', notificationId), {
        read: true,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  return null; // This component doesn't render anything
}
