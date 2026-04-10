import { useState, useEffect, useMemo } from 'react';
import { db, collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { Task } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Textarea } from './ui/textarea';
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Clock, 
  Calendar as CalendarIcon,
  Trash2,
  CheckCircle2,
  Circle,
  AlertCircle,
  Info,
  Eye,
  Copy,
  PauseCircle,
  PlayCircle,
  CheckSquare
} from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from './ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from './ui/select';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from './ui/dropdown-menu';
import { Label } from './ui/label';
import { toast } from 'sonner';
import { handleFirestoreError, OperationType } from '../lib/error-handler';

// Countdown Timer Component
function CountdownTimer({ dueDate }: { dueDate: string }) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const calculateTimeLeft = () => {
      const difference = +new Date(dueDate + 'T23:59:59') - +new Date();
      if (difference <= 0) return 'Expired';

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((difference / 1000 / 60) % 60);

      if (days > 0) return `${days}d ${hours}h left`;
      if (hours > 0) return `${hours}h ${minutes}m left`;
      return `${minutes}m left`;
    };

    const timer = setInterval(() => setTimeLeft(calculateTimeLeft()), 60000);
    setTimeLeft(calculateTimeLeft());
    return () => clearInterval(timer);
  }, [dueDate]);

  return (
    <div className="flex items-center text-[10px] font-medium text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">
      <Clock className="h-3 w-3 mr-1" />
      {timeLeft}
    </div>
  );
}

export default function Tasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCommentDialogOpen, setIsCommentDialogOpen] = useState(false);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [completingTask, setCompletingTask] = useState<Task | null>(null);
  const [viewingTask, setViewingTask] = useState<Task | null>(null);
  const [completionComment, setCompletionComment] = useState('');

  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'medium' as const,
    frequency: 'once' as const,
    status: 'todo' as const,
    dueDate: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    if (!user) return;

    let q;
    if (user.role === 'admin') {
      q = query(collection(db, 'tasks'));
    } else if (user.role === 'lead' && user.teamId) {
      q = query(collection(db, 'tasks'), where('teamId', '==', user.teamId));
    } else {
      q = query(collection(db, 'tasks'), where('assigneeId', '==', user.uid));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'tasks');
    });

    return () => unsubscribe();
  }, [user]);

  const handleAddTask = async () => {
    if (!newTask.title || !user) return;
    try {
      await addDoc(collection(db, 'tasks'), {
        ...newTask,
        assigneeId: user.uid,
        teamId: user.teamId || null,
        timeSpent: 0,
        createdAt: serverTimestamp()
      });
      setIsAddDialogOpen(false);
      setNewTask({
        title: '',
        description: '',
        priority: 'medium',
        frequency: 'once',
        status: 'todo',
        dueDate: new Date().toISOString().split('T')[0]
      });
      toast.success('Task added successfully');
    } catch (error) {
      toast.error('Failed to add task');
    }
  };

  const handleUpdateTask = async () => {
    if (!editingTask) return;
    try {
      await updateDoc(doc(db, 'tasks', editingTask.id), {
        title: editingTask.title,
        description: editingTask.description,
        priority: editingTask.priority,
        frequency: editingTask.frequency,
        dueDate: editingTask.dueDate
      });
      setIsEditDialogOpen(false);
      setEditingTask(null);
      toast.success('Task updated');
    } catch (error) {
      toast.error('Failed to update task');
    }
  };

  const toggleTaskStatus = async (task: Task) => {
    if (task.status === 'completed') {
      try {
        await updateDoc(doc(db, 'tasks', task.id), { status: 'todo' });
      } catch (error) {
        toast.error('Failed to update task');
      }
    } else {
      setCompletingTask(task);
      setIsCommentDialogOpen(true);
    }
  };

  const handleCompleteTask = async () => {
    if (!completingTask) return;
    try {
      await updateDoc(doc(db, 'tasks', completingTask.id), { 
        status: 'completed',
        completionComment: completionComment,
        completedAt: serverTimestamp()
      });
      setIsCommentDialogOpen(false);
      setCompletingTask(null);
      setCompletionComment('');
      toast.success('Task completed');
    } catch (error) {
      toast.error('Failed to complete task');
    }
  };

  const handleDeleteRequest = async (task: Task) => {
    if (user?.role === 'admin' || user?.role === 'lead') {
      try {
        await updateDoc(doc(db, 'tasks', task.id), { status: 'deleted' });
        toast.success('Task moved to deleted history');
      } catch (error) {
        toast.error('Failed to delete task');
      }
    } else {
      try {
        await updateDoc(doc(db, 'tasks', task.id), { 
          deleteRequested: true, 
          deleteRequestedBy: user?.uid 
        });
        toast.success('Delete request sent to Admin/Lead');
      } catch (error) {
        toast.error('Failed to request delete');
      }
    }
  };

  const handleFinalDelete = async (task: Task) => {
    try {
      await updateDoc(doc(db, 'tasks', task.id), { 
        status: 'deleted',
        deleteRequested: false 
      });
      toast.success('Task deleted');
    } catch (error) {
      toast.error('Failed to delete task');
    }
  };

  const handleDuplicateTask = async (task: Task) => {
    try {
      await addDoc(collection(db, 'tasks'), {
        title: `${task.title} (Copy)`,
        description: task.description,
        priority: task.priority,
        frequency: task.frequency,
        status: 'todo',
        dueDate: task.dueDate,
        assigneeId: user?.uid,
        teamId: user?.teamId || null,
        timeSpent: 0,
        createdAt: serverTimestamp()
      });
      toast.success('Task duplicated');
    } catch (error) {
      toast.error('Failed to duplicate task');
    }
  };

  const handleToggleInactive = async (task: Task) => {
    try {
      await updateDoc(doc(db, 'tasks', task.id), { isInactive: !task.isInactive });
      toast.success(task.isInactive ? 'Task activated' : 'Task set to inactive');
    } catch (error) {
      toast.error('Failed to update task');
    }
  };

  const isPast = (dateStr: string) => {
    const today = new Date().toISOString().split('T')[0];
    return dateStr < today;
  };

  const isToday = (dateStr: string) => {
    const today = new Date().toISOString().split('T')[0];
    return dateStr === today;
  };

  const filteredTasks = useMemo(() => {
    return tasks
      .filter(task => {
        const isTaskToday = isToday(task.dueDate);
        const matchesTodaySearch = searchQuery.toLowerCase() === 'today' && isTaskToday;

        const matchesSearch = 
          task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          task.priority.toLowerCase().includes(searchQuery.toLowerCase()) ||
          task.frequency.toLowerCase().includes(searchQuery.toLowerCase()) ||
          matchesTodaySearch;
        
        const matchesStatus = filterStatus === 'all' || task.status === filterStatus;
        
        // If status is not 'deleted', don't show deleted tasks unless specifically filtered
        if (filterStatus !== 'deleted' && task.status === 'deleted') return false;
        
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        // Priority sorting: high > medium > low
        const priorityMap = { high: 3, medium: 2, low: 1 };
        return priorityMap[b.priority] - priorityMap[a.priority];
      });
  }, [tasks, searchQuery, filterStatus]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input 
            placeholder="Search tasks..." 
            className="pl-10 bg-white border-slate-200"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[150px] bg-white border-slate-200">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="todo">To Do</SelectItem>
              <SelectItem value="in-progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="deleted">Deleted</SelectItem>
            </SelectContent>
          </Select>
          
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger render={<Button className="rounded-full px-6"><Plus className="h-4 w-4 mr-2" />Add Task</Button>} />
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Create New Task</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="title">Title</Label>
                  <Input 
                    id="title" 
                    value={newTask.title} 
                    onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                    placeholder="Task title"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="desc">Description</Label>
                  <Input 
                    id="desc" 
                    value={newTask.description} 
                    onChange={(e) => setNewTask({...newTask, description: e.target.value})}
                    placeholder="Optional description"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Priority</Label>
                    <Select value={newTask.priority} onValueChange={(v) => setNewTask({...newTask, priority: v as any})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Frequency</Label>
                    <Select value={newTask.frequency} onValueChange={(v) => setNewTask({...newTask, frequency: v as any})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="once">Once</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="custom">Specific Timeframe</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Due Date</Label>
                  <Input 
                    type="date" 
                    value={newTask.dueDate} 
                    onChange={(e) => setNewTask({...newTask, dueDate: e.target.value})}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleAddTask} className="w-full">Create Task</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filteredTasks.map((task) => (
          <Card 
            key={task.id} 
            className={`border-none shadow-sm hover:shadow-md transition-all group ${task.isInactive ? 'opacity-60 bg-slate-50' : ''}`}
          >
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center space-x-4 flex-1 min-w-0">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="rounded-full hover:bg-primary/10 hover:text-primary shrink-0"
                  onClick={() => toggleTaskStatus(task)}
                >
                  {task.status === 'completed' ? (
                    <CheckCircle2 className="h-6 w-6 text-green-500" />
                  ) : (
                    <Circle className="h-6 w-6 text-slate-300" />
                  )}
                </Button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 
                      className={`font-semibold truncate cursor-pointer hover:text-primary transition-colors ${task.status === 'completed' ? 'line-through text-slate-400' : 'text-slate-900'}`}
                      onClick={() => { setViewingTask(task); setIsDetailsDialogOpen(true); }}
                    >
                      {task.title}
                    </h4>
                    {task.isInactive && <Badge variant="outline" className="text-[10px] h-4">Inactive</Badge>}
                    {task.frequency === 'daily' && isToday(task.dueDate) && (
                      <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-[10px] h-4">Today</Badge>
                    )}
                    {task.frequency === 'daily' && isPast(task.dueDate) && (
                      <Badge variant="outline" className="text-slate-400 text-[10px] h-4">Old</Badge>
                    )}
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-3 mt-1">
                    <div className="flex items-center text-[10px] text-slate-500">
                      <CalendarIcon className="h-3 w-3 mr-1" />
                      {task.dueDate}
                    </div>
                    <div className="flex items-center text-[10px] text-slate-500">
                      <Clock className="h-3 w-3 mr-1" />
                      {(task.timeSpent / 3600).toFixed(1)}h
                    </div>
                    <Badge variant="outline" className="text-[10px] h-4 capitalize">
                      {task.frequency}
                    </Badge>
                    <Badge 
                      variant="secondary" 
                      className={`text-[10px] uppercase px-2 py-0 h-4 ${
                        task.priority === 'high' ? 'bg-red-50 text-red-600' : 
                        task.priority === 'medium' ? 'bg-orange-50 text-orange-600' : 
                        'bg-blue-50 text-blue-600'
                      }`}
                    >
                      {task.priority}
                    </Badge>
                    {task.status !== 'completed' && task.status !== 'deleted' && <CountdownTimer dueDate={task.dueDate} />}
                  </div>

                  {task.deleteRequested && (
                    <div className="mt-2 flex items-center text-[10px] text-red-600 bg-red-50 p-1.5 rounded-md">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Pending to delete by Admin or Team Leader
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-1 ml-4">
                <DropdownMenu>
                  <DropdownMenuTrigger render={
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  } />
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem onClick={() => { setViewingTask(task); setIsDetailsDialogOpen(true); }}>
                      <Eye className="mr-2 h-4 w-4" /> View Details
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setEditingTask(task); setIsEditDialogOpen(true); }}>
                      <Plus className="mr-2 h-4 w-4" /> Edit Task
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDuplicateTask(task)}>
                      <Copy className="mr-2 h-4 w-4" /> Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleToggleInactive(task)}>
                      {task.isInactive ? <PlayCircle className="mr-2 h-4 w-4" /> : <PauseCircle className="mr-2 h-4 w-4" />}
                      {task.isInactive ? 'Activate' : 'Set Inactive'}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    
                    {task.deleteRequested && (user?.role === 'admin' || user?.role === 'lead') ? (
                      <DropdownMenuItem className="text-red-600" onClick={() => handleFinalDelete(task)}>
                        <Trash2 className="mr-2 h-4 w-4" /> Confirm Delete
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem className="text-red-600" onClick={() => handleDeleteRequest(task)}>
                        <Trash2 className="mr-2 h-4 w-4" /> Delete Task
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardContent>
          </Card>
        ))}
        {filteredTasks.length === 0 && (
          <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckSquare className="h-8 w-8 text-slate-300" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">No tasks found</h3>
            <p className="text-slate-500">Try adjusting your search or filters</p>
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
          </DialogHeader>
          {editingTask && (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Title</Label>
                <Input 
                  value={editingTask.title} 
                  onChange={(e) => setEditingTask({...editingTask, title: e.target.value})}
                />
              </div>
              <div className="grid gap-2">
                <Label>Description</Label>
                <Textarea 
                  value={editingTask.description} 
                  onChange={(e) => setEditingTask({...editingTask, description: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Priority</Label>
                  <Select value={editingTask.priority} onValueChange={(v) => setEditingTask({...editingTask, priority: v as any})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Frequency</Label>
                  <Select value={editingTask.frequency} onValueChange={(v) => setEditingTask({...editingTask, frequency: v as any})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="once">Once</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="custom">Specific Timeframe</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Due Date</Label>
                <Input 
                  type="date" 
                  value={editingTask.dueDate} 
                  onChange={(e) => setEditingTask({...editingTask, dueDate: e.target.value})}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={handleUpdateTask} className="w-full">Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Comment Dialog */}
      <Dialog open={isCommentDialogOpen} onOpenChange={setIsCommentDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Complete Task</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="flex items-center space-x-2 text-sm text-slate-500">
              <Info className="h-4 w-4" />
              <span>Add a comment about your progress (optional).</span>
            </div>
            <Textarea 
              placeholder="What did you achieve? Any notes?"
              value={completionComment}
              onChange={(e) => setCompletionComment(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCommentDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCompleteTask}>Complete Task</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Task Details</DialogTitle>
          </DialogHeader>
          {viewingTask && (
            <div className="space-y-6 py-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{viewingTask.title}</h3>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="secondary">{viewingTask.status}</Badge>
                  <Badge variant="outline">{viewingTask.priority} Priority</Badge>
                  <Badge variant="outline">{viewingTask.frequency}</Badge>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label className="text-slate-500">Description</Label>
                <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100 min-h-[100px]">
                  {viewingTask.description || "No description provided."}
                </p>
              </div>

              {viewingTask.completionComment && (
                <div className="space-y-2">
                  <Label className="text-slate-500">Completion Comment</Label>
                  <p className="text-sm text-green-700 bg-green-50 p-3 rounded-lg border border-green-100">
                    {viewingTask.completionComment}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <p className="text-slate-500">Due Date</p>
                  <p className="font-medium">{viewingTask.dueDate}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-slate-500">Time Spent</p>
                  <p className="font-medium">{(viewingTask.timeSpent / 3600).toFixed(1)} hours</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailsDialogOpen(false)}>Close</Button>
            <Button onClick={() => { setIsDetailsDialogOpen(false); setEditingTask(viewingTask); setIsEditDialogOpen(true); }}>
              Edit Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
