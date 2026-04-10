import { useState, useEffect, useRef } from 'react';
import { db, collection, query, where, onSnapshot, addDoc, serverTimestamp, orderBy, limit } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { Task, TimeLog } from '../types';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Play, Pause, Square, Clock, History } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from './ui/badge';

export default function TimeTracker() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [logs, setLogs] = useState<TimeLog[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [isRunning, setIsRunning] = useState(false);
  const [time, setTime] = useState(0);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (!user) return;
    const tasksQuery = query(collection(db, 'tasks'), where('assigneeId', '==', user.uid), where('status', '!=', 'completed'));
    const logsQuery = query(collection(db, 'timeLogs'), where('userId', '==', user.uid), orderBy('startTime', 'desc'), limit(10));

    const unsubTasks = onSnapshot(tasksQuery, (s) => setTasks(s.docs.map(d => ({ id: d.id, ...d.data() } as Task))));
    const unsubLogs = onSnapshot(logsQuery, (s) => setLogs(s.docs.map(d => ({ id: d.id, ...d.data() } as TimeLog))));

    return () => { unsubTasks(); unsubLogs(); };
  }, [user]);

  const startTimer = () => {
    if (!selectedTaskId) {
      toast.error('Please select a task first');
      return;
    }
    setIsRunning(true);
    timerRef.current = setInterval(() => {
      setTime(prev => prev + 1);
    }, 1000);
  };

  const stopTimer = async () => {
    clearInterval(timerRef.current);
    setIsRunning(false);
    
    if (time > 0) {
      try {
        await addDoc(collection(db, 'timeLogs'), {
          taskId: selectedTaskId,
          userId: user?.uid,
          startTime: serverTimestamp(),
          duration: time
        });
        toast.success(`Tracked ${formatTime(time)}`);
        setTime(0);
      } catch (error) {
        toast.error('Failed to save time log');
      }
    }
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <Card className="border-none shadow-lg bg-white overflow-hidden">
        <div className="bg-primary p-12 text-center text-white">
          <h2 className="text-6xl font-mono font-bold tracking-widest mb-8">{formatTime(time)}</h2>
          <div className="flex items-center justify-center space-x-6">
            {!isRunning ? (
              <Button size="lg" className="rounded-full w-20 h-20 bg-white text-primary hover:bg-slate-100" onClick={startTimer}>
                <Play className="w-8 h-8 fill-current" />
              </Button>
            ) : (
              <Button size="lg" className="rounded-full w-20 h-20 bg-white text-primary hover:bg-slate-100" onClick={stopTimer}>
                <Square className="w-8 h-8 fill-current" />
              </Button>
            )}
          </div>
        </div>
        <CardContent className="p-8">
          <div className="space-y-4">
            <label className="text-sm font-medium text-slate-500">What are you working on?</label>
            <Select value={selectedTaskId} onValueChange={setSelectedTaskId}>
              <SelectTrigger className="h-14 text-lg border-slate-200">
                <SelectValue placeholder="Select a task..." />
              </SelectTrigger>
              <SelectContent>
                {tasks.map(task => (
                  <SelectItem key={task.id} value={task.id}>{task.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-8">
        <Card className="border-none shadow-sm">
          <CardHeader className="flex flex-row items-center space-x-2">
            <History className="w-5 h-5 text-slate-400" />
            <CardTitle className="text-lg">Recent Logs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {logs.map(log => {
                const task = tasks.find(t => t.id === log.taskId);
                return (
                  <div key={log.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
                    <div>
                      <p className="text-sm font-medium">{task?.title || 'Unknown Task'}</p>
                      <p className="text-xs text-slate-500">Today</p>
                    </div>
                    <Badge variant="secondary">{formatTime(log.duration)}</Badge>
                  </div>
                );
              })}
              {logs.length === 0 && <p className="text-center text-slate-500 py-4">No logs yet</p>}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-slate-900 text-white">
          <CardHeader>
            <CardTitle className="text-lg">Weekly Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-slate-400 text-sm">Total Time</p>
                <h3 className="text-4xl font-bold">12h 45m</h3>
              </div>
              <Badge className="bg-green-500/20 text-green-400 border-none">+2.4h from last week</Badge>
            </div>
            <div className="flex items-center justify-between gap-1 h-24">
              {[40, 60, 30, 80, 50, 20, 10].map((h, i) => (
                <div key={i} className="flex-1 bg-slate-800 rounded-t-sm relative group">
                  <div 
                    className="absolute bottom-0 left-0 right-0 bg-primary rounded-t-sm transition-all duration-500" 
                    style={{ height: `${h}%` }}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
