import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { useAuth } from '../lib/AuthContext';
import { db, collection, query, where, onSnapshot, orderBy, limit } from '../lib/firebase';
import { Task, Goal } from '../types';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';
import { CheckCircle2, Clock, Target, TrendingUp, Sparkles } from 'lucide-react';
import { getProductivityRecommendations } from '../lib/gemini';
import { Badge } from './ui/badge';
import { motion } from 'motion/react';
import { handleFirestoreError, OperationType } from '../lib/error-handler';

export default function Dashboard() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loadingAI, setLoadingAI] = useState(false);

  useEffect(() => {
    if (!user) return;

    const tasksQuery = query(
      collection(db, 'tasks'),
      where('assigneeId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(10)
    );

    const goalsQuery = query(
      collection(db, 'goals'),
      where('userId', '==', user.uid),
      limit(5)
    );

    const unsubTasks = onSnapshot(tasksQuery, (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'tasks');
    });

    const unsubGoals = onSnapshot(goalsQuery, (snapshot) => {
      setGoals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Goal)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'goals');
    });

    return () => {
      unsubTasks();
      unsubGoals();
    };
  }, [user]);

  useEffect(() => {
    if (tasks.length > 0 && recommendations.length === 0 && !loadingAI) {
      setLoadingAI(true);
      getProductivityRecommendations(tasks, goals).then(recs => {
        setRecommendations(recs);
        setLoadingAI(false);
      });
    }
  }, [tasks, goals]);

  const stats = [
    { label: 'Completed Tasks', value: tasks.filter(t => t.status === 'completed').length, icon: CheckCircle2, color: 'text-green-600' },
    { label: 'Active Goals', value: goals.length, icon: Target, color: 'text-blue-600' },
    { label: 'Hours Tracked', value: (tasks.reduce((acc, t) => acc + (t.timeSpent || 0), 0) / 3600).toFixed(1), icon: Clock, color: 'text-orange-600' },
    { label: 'Efficiency Score', value: '84%', icon: TrendingUp, color: 'text-purple-600' },
  ];

  const chartData = [
    { name: 'Mon', tasks: 4, hours: 6 },
    { name: 'Tue', tasks: 7, hours: 8 },
    { name: 'Wed', tasks: 5, hours: 5 },
    { name: 'Thu', tasks: 8, hours: 9 },
    { name: 'Fri', tasks: 6, hours: 7 },
    { name: 'Sat', tasks: 2, hours: 3 },
    { name: 'Sun', tasks: 1, hours: 2 },
  ];

  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <Card key={i} className="border-none shadow-sm bg-white overflow-hidden group hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                  <h3 className="text-3xl font-bold mt-1">{stat.value}</h3>
                </div>
                <div className={`p-3 rounded-2xl bg-slate-50 group-hover:scale-110 transition-transform ${stat.color}`}>
                  <stat.icon className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Main Chart */}
        <Card className="lg:col-span-2 border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Weekly Productivity</CardTitle>
          </CardHeader>
          <CardContent className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorTasks" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Area type="monotone" dataKey="tasks" stroke="#3b82f6" fillOpacity={1} fill="url(#colorTasks)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* AI Recommendations */}
        <Card className="border-none shadow-sm bg-primary/5 border-primary/10">
          <CardHeader className="flex flex-row items-center space-x-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg font-semibold">AI Insights</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {loadingAI ? (
                <div className="space-y-4 animate-pulse">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-20 bg-white/50 rounded-xl" />
                  ))}
                </div>
              ) : recommendations.length > 0 ? (
                recommendations.map((rec, i) => (
                  <div key={i} className="bg-white p-4 rounded-xl shadow-sm border border-primary/10">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-sm">{rec.title}</h4>
                      <Badge variant={rec.impact === 'High' ? 'default' : 'secondary'}>{rec.impact}</Badge>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{rec.description}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500 text-center py-8">Complete more tasks to get personalized AI insights.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Tasks & Goals */}
      <div className="grid md:grid-cols-2 gap-8">
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Recent Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {tasks.length > 0 ? tasks.map(task => (
                <div key={task.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="flex items-center space-x-3">
                    <div className={`w-2 h-2 rounded-full ${task.status === 'completed' ? 'bg-green-500' : 'bg-blue-500'}`} />
                    <span className={`text-sm font-medium ${task.status === 'completed' ? 'line-through text-slate-400' : ''}`}>
                      {task.title}
                    </span>
                  </div>
                  <Badge variant="outline" className="text-[10px] uppercase tracking-wider">{task.priority}</Badge>
                </div>
              )) : (
                <p className="text-sm text-slate-500 text-center py-4">No tasks yet.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Active Goals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {goals.length > 0 ? goals.map(goal => (
                <div key={goal.id} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{goal.title}</span>
                    <span className="text-slate-500">{goal.progress}%</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${goal.progress}%` }}
                      className="h-full bg-primary"
                    />
                  </div>
                </div>
              )) : (
                <p className="text-sm text-slate-500 text-center py-4">No goals set.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
