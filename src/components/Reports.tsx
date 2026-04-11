import { useState, useEffect } from 'react';
import { db, collection, query, where, onSnapshot, getDocs } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { Task, Goal, TimeLog } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Download, FileText, Table as TableIcon, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import Papa from 'papaparse';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

export default function Reports() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);

  useEffect(() => {
    if (!user) return;
    const tasksQuery = query(collection(db, 'tasks'), where('assigneeId', '==', user.uid));
    const goalsQuery = query(collection(db, 'goals'), where('userId', '==', user.uid));

    const unsubTasks = onSnapshot(tasksQuery, (s) => setTasks(s.docs.map(d => ({ id: d.id, ...d.data() } as Task))));
    const unsubGoals = onSnapshot(goalsQuery, (s) => setGoals(s.docs.map(d => ({ id: d.id, ...d.data() } as Goal))));

    return () => { unsubTasks(); unsubGoals(); };
  }, [user?.uid]);

  const exportToCSV = () => {
    const data = tasks.map(t => ({
      Title: t.title,
      Status: t.status,
      Priority: t.priority,
      DueDate: t.dueDate,
      TimeSpentHours: (t.timeSpent / 3600).toFixed(2)
    }));
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'productivity_report.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('CSV Exported');
  };

  const exportToPDF = () => {
    const doc = new jsPDF() as any;
    doc.text('PakEducation Productivity Report', 14, 15);
    doc.autoTable({
      startY: 20,
      head: [['Title', 'Status', 'Priority', 'Due Date', 'Hours']],
      body: tasks.map(t => [t.title, t.status, t.priority, t.dueDate, (t.timeSpent / 3600).toFixed(2)]),
    });
    doc.save('productivity_report.pdf');
    toast.success('PDF Exported');
  };

  return (
    <div className="space-y-8">
      <div className="grid md:grid-cols-2 gap-8">
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Download className="w-5 h-5 text-primary" />
              <span>Export Data</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-4">
            <Button onClick={exportToCSV} className="flex-1 h-16 rounded-2xl" variant="outline">
              <TableIcon className="w-5 h-5 mr-2" />
              Export as CSV
            </Button>
            <Button onClick={exportToPDF} className="flex-1 h-16 rounded-2xl" variant="outline">
              <FileText className="w-5 h-5 mr-2" />
              Export as PDF
            </Button>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-slate-900 text-white">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              <span>Summary Stats</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-white/5 rounded-xl">
              <p className="text-slate-400 text-xs uppercase tracking-wider">Completion Rate</p>
              <h4 className="text-2xl font-bold mt-1">
                {tasks.length > 0 ? ((tasks.filter(t => t.status === 'completed').length / tasks.length) * 100).toFixed(0) : 0}%
              </h4>
            </div>
            <div className="p-4 bg-white/5 rounded-xl">
              <p className="text-slate-400 text-xs uppercase tracking-wider">Total Hours</p>
              <h4 className="text-2xl font-bold mt-1">
                {(tasks.reduce((acc, t) => acc + (t.timeSpent || 0), 0) / 3600).toFixed(1)}h
              </h4>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle>Detailed Task Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Time Spent</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map(task => (
                <TableRow key={task.id}>
                  <TableCell className="font-medium">{task.title}</TableCell>
                  <TableCell className="capitalize">{task.status}</TableCell>
                  <TableCell className="capitalize">{task.priority}</TableCell>
                  <TableCell>{(task.timeSpent / 3600).toFixed(2)}h</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
