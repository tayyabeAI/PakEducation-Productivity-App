import { useState, useEffect } from 'react';
import { db, collection, query, where, onSnapshot, updateDoc, doc, serverTimestamp, orderBy, limit } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { Notification } from '../types';
import { Bell, Check, Info, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button, buttonVariants } from './ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './ui/popover';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '../lib/utils';

export default function NotificationCenter() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedNotifications = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Notification[];
      
      setNotifications(fetchedNotifications);
      setUnreadCount(fetchedNotifications.filter(n => !n.read).length);
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

  const markAllAsRead = async () => {
    const unread = notifications.filter(n => !n.read);
    for (const n of unread) {
      if (n.id) markAsRead(n.id);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'task_assigned': return <Info className="h-4 w-4 text-blue-500" />;
      case 'task_updated': return <AlertCircle className="h-4 w-4 text-amber-500" />;
      case 'system': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      default: return <Bell className="h-4 w-4 text-slate-500" />;
    }
  };

  return (
    <Popover>
      <PopoverTrigger className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "relative")}>
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <Badge 
            className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-500 text-white border-2 border-white"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </Badge>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-8" onClick={markAllAsRead}>
              Mark all as read
            </Button>
          )}
        </div>
        <ScrollArea className="h-[400px]">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              No notifications yet
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div 
                  key={notification.id} 
                  className={`p-4 hover:bg-slate-50 transition-colors relative group ${!notification.read ? 'bg-blue-50/30' : ''}`}
                >
                  <div className="flex gap-3">
                    <div className="mt-1">{getIcon(notification.type)}</div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!notification.read ? 'font-semibold' : 'text-slate-700'}`}>
                        {notification.title}
                      </p>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                        {notification.message}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        {notification.createdAt ? formatDistanceToNow(notification.createdAt.toDate(), { addSuffix: true }) : 'Just now'}
                      </p>
                    </div>
                    {!notification.read && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => markAsRead(notification.id!)}
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        <div className="p-2 border-t text-center">
          <Button variant="ghost" size="sm" className="w-full text-xs text-slate-500">
            View all notifications
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
