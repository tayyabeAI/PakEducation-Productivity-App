import { useState, useEffect } from 'react';
import { db, collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { Goal } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { Plus, Target, Trash2, Calendar, TrendingUp } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Label } from './ui/label';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { handleFirestoreError, OperationType } from '../lib/error-handler';

export default function Goals() {
  const { user } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newGoal, setNewGoal] = useState({
    title: '',
    description: '',
    type: 'short-term' as const,
    frequency: 'daily' as const,
    targetDate: new Date().toISOString().split('T')[0],
    progress: 0
  });

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'goals'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setGoals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Goal)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'goals');
    });
    return () => unsubscribe();
  }, [user]);

  const handleAddGoal = async () => {
    if (!newGoal.title) return;
    try {
      await addDoc(collection(db, 'goals'), {
        ...newGoal,
        userId: user?.uid,
        createdAt: serverTimestamp()
      });
      setIsAddDialogOpen(false);
      setNewGoal({ title: '', description: '', type: 'short-term', frequency: 'daily', targetDate: new Date().toISOString().split('T')[0], progress: 0 });
      toast.success('Goal created');
    } catch (error) {
      toast.error('Failed to create goal');
    }
  };

  const updateProgress = async (id: string, progress: number) => {
    try {
      await updateDoc(doc(db, 'goals', id), { progress: Math.min(100, Math.max(0, progress)) });
    } catch (error) {
      toast.error('Failed to update progress');
    }
  };

  const deleteGoal = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'goals', id));
      toast.success('Goal deleted');
    } catch (error) {
      toast.error('Failed to delete goal');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Your Goals</h2>
          <p className="text-slate-500">Track your short-term and long-term milestones</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger render={<Button className="rounded-full px-6"><Plus className="h-4 w-4 mr-2" />New Goal</Button>} />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Set a New Goal</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Goal Title</Label>
                <Input value={newGoal.title} onChange={(e) => setNewGoal({...newGoal, title: e.target.value})} placeholder="e.g. Learn React 19" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Type</Label>
                  <Select value={newGoal.type} onValueChange={(v) => setNewGoal({...newGoal, type: v as any})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="short-term">Short Term</SelectItem>
                      <SelectItem value="long-term">Long Term</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Frequency</Label>
                  <Select value={newGoal.frequency} onValueChange={(v) => setNewGoal({...newGoal, frequency: v as any})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Target Date & Time</Label>
                <Input type="datetime-local" value={newGoal.targetDate} onChange={(e) => setNewGoal({...newGoal, targetDate: e.target.value})} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleAddGoal} className="w-full">Create Goal</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {goals.map((goal) => (
          <Card key={goal.id} className="border-none shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div className="space-y-1">
                <CardTitle className="text-lg font-bold">{goal.title}</CardTitle>
                <div className="flex flex-wrap gap-2">
                  <div className="flex items-center text-xs text-slate-500">
                    <Calendar className="w-3 h-3 mr-1" />
                    {new Date(goal.targetDate).toLocaleString()}
                  </div>
                  <Badge variant="secondary" className="text-[10px] h-4 px-1 capitalize">
                    {goal.frequency}
                  </Badge>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="text-slate-400 hover:text-red-500" onClick={() => deleteGoal(goal.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Progress</span>
                  <span className="font-bold">{goal.progress}%</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${goal.progress}%` }}
                    className="h-full bg-primary"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <Button variant="outline" size="sm" onClick={() => updateProgress(goal.id, goal.progress - 10)}>-10%</Button>
                <Button variant="outline" size="sm" onClick={() => updateProgress(goal.id, goal.progress + 10)}>+10%</Button>
                <Button variant="outline" size="sm" className="flex-1" onClick={() => updateProgress(goal.id, 100)}>Complete</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
