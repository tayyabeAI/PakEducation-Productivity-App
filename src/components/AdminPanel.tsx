import { useState, useEffect, useMemo } from 'react';
import { db, collection, query, onSnapshot, updateDoc, doc, deleteDoc, where } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { UserProfile, Team, Task } from '../types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { 
  Shield, 
  UserX, 
  UserCheck, 
  Activity, 
  Database, 
  Settings, 
  Users, 
  Search, 
  Filter, 
  Eye, 
  Ban, 
  Trash2, 
  ChevronDown,
  Check,
  Calendar
} from 'lucide-react';
import { toast } from 'sonner';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import { handleFirestoreError, OperationType } from '../lib/error-handler';

export default function AdminPanel() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  
  // UI State
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [visibleColumns, setVisibleColumns] = useState({
    user: true,
    role: true,
    platform: true,
    joinedDate: true,
    status: true,
    team: true,
    actions: true
  });

  useEffect(() => {
    if (currentUser?.role !== 'admin') return;
    
    const unsubUsers = onSnapshot(collection(db, 'users'), (s) => {
      setUsers(s.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    const unsubTeams = onSnapshot(collection(db, 'teams'), (s) => {
      setTeams(s.docs.map(d => ({ id: d.id, ...d.data() } as Team)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'teams');
    });

    const unsubTasks = onSnapshot(collection(db, 'tasks'), (s) => {
      setAllTasks(s.docs.map(d => ({ id: d.id, ...d.data() } as Task)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'tasks');
    });

    return () => {
      unsubUsers();
      unsubTeams();
      unsubTasks();
    };
  }, [currentUser]);

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch = 
        user.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = roleFilter === 'all' || user.role === roleFilter;
      const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
      
      const userDate = user.createdAt?.toDate ? user.createdAt.toDate() : new Date(user.createdAt);
      const matchesYear = yearFilter === 'all' || userDate.getFullYear().toString() === yearFilter;
      const matchesMonth = monthFilter === 'all' || (userDate.getMonth() + 1).toString() === monthFilter;

      return matchesSearch && matchesRole && matchesStatus && matchesYear && matchesMonth;
    });
  }, [users, searchQuery, roleFilter, statusFilter, yearFilter, monthFilter]);

  const years = useMemo(() => {
    const yearsSet = new Set<string>();
    users.forEach(u => {
      if (u.createdAt) {
        const date = u.createdAt.toDate ? u.createdAt.toDate() : new Date(u.createdAt);
        yearsSet.add(date.getFullYear().toString());
      }
    });
    return Array.from(yearsSet).sort((a, b) => b.localeCompare(a));
  }, [users]);

  const months = [
    { value: '1', label: 'January' },
    { value: '2', label: 'February' },
    { value: '3', label: 'March' },
    { value: '4', label: 'April' },
    { value: '5', label: 'May' },
    { value: '6', label: 'June' },
    { value: '7', label: 'July' },
    { value: '8', label: 'August' },
    { value: '9', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' },
  ];

  const updateUserStatus = async (uid: string, newStatus: 'active' | 'suspended' | 'deleted') => {
    try {
      await updateDoc(doc(db, 'users', uid), { status: newStatus });
      toast.success(`User ${newStatus} successfully`);
    } catch (error) {
      toast.error('Failed to update user status');
    }
  };

  const updateUserRole = async (uid: string, newRole: string) => {
    try {
      await updateDoc(doc(db, 'users', uid), { role: newRole });
      toast.success('User role updated');
    } catch (error) {
      toast.error('Failed to update role');
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getProviderBadge = (providerId?: string) => {
    switch (providerId) {
      case 'google.com':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Google</Badge>;
      case 'facebook.com':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Facebook</Badge>;
      case 'password':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Email</Badge>;
      default:
        return <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">{providerId || 'Direct'}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500 hover:bg-green-600">Active</Badge>;
      case 'suspended':
        return <Badge variant="destructive" className="bg-orange-500 hover:bg-orange-600">Suspended</Badge>;
      case 'deleted':
        return <Badge variant="destructive">Deleted</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  if (currentUser?.role !== 'admin') {
    return <div className="p-8 text-center">Access Denied</div>;
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-sm bg-slate-900 text-white">
          <CardContent className="p-6 flex items-center space-x-4">
            <div className="p-3 bg-white/10 rounded-xl"><Activity className="w-6 h-6" /></div>
            <div>
              <p className="text-slate-400 text-sm">System Status</p>
              <h3 className="text-xl font-bold">Operational</h3>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-6 flex items-center space-x-4">
            <div className="p-3 bg-primary/10 rounded-xl text-primary"><Users className="w-6 h-6" /></div>
            <div>
              <p className="text-slate-500 text-sm">Total Users</p>
              <h3 className="text-xl font-bold">{users.length}</h3>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-6 flex items-center space-x-4">
            <div className="p-3 bg-orange-500/10 rounded-xl text-orange-500"><Database className="w-6 h-6" /></div>
            <div>
              <p className="text-slate-500 text-sm">Active Teams</p>
              <h3 className="text-xl font-bold">{teams.length}</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader className="flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0">
          <div className="flex items-center space-x-3">
            <CardTitle>User Management</CardTitle>
            <Badge variant="secondary" className="rounded-full px-3">
              {filteredUsers.length} Users Found
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                placeholder="Search email or name..." 
                className="pl-10 w-[250px]" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="lead">Lead</SelectItem>
                <SelectItem value="member">Member</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="deleted">Deleted</SelectItem>
              </SelectContent>
            </Select>

            <Select value={yearFilter} onValueChange={setYearFilter}>
              <SelectTrigger className="w-[100px]">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={monthFilter} onValueChange={setMonthFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Months</SelectItem>
                {months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger render={
                <Button variant="outline" size="sm">
                  <Settings className="w-4 h-4 mr-2" /> Columns
                </Button>
              } />
              <PopoverContent className="w-56">
                <div className="space-y-2">
                  <h4 className="font-medium text-sm mb-2">Visible Columns</h4>
                  {Object.entries(visibleColumns).map(([key, value]) => (
                    <div key={key} className="flex items-center space-x-2">
                      <input 
                        type="checkbox" 
                        id={key} 
                        checked={value} 
                        onChange={() => setVisibleColumns(prev => ({ ...prev, [key]: !value }))}
                        className="rounded border-slate-300 text-primary focus:ring-primary"
                      />
                      <label htmlFor={key} className="text-sm capitalize">{key.replace(/([A-Z])/g, ' $1')}</label>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                {visibleColumns.user && <TableHead>User</TableHead>}
                {visibleColumns.role && <TableHead>Role</TableHead>}
                {visibleColumns.platform && <TableHead>Platform</TableHead>}
                {visibleColumns.joinedDate && <TableHead>Joined Date</TableHead>}
                {visibleColumns.status && <TableHead>Status</TableHead>}
                {visibleColumns.team && <TableHead>Team</TableHead>}
                {visibleColumns.actions && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => {
                const userTeam = teams.find(t => t.id === user.teamId);
                return (
                  <TableRow key={user.uid}>
                    {visibleColumns.user && (
                      <TableCell className="flex items-center space-x-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={user.photoURL} />
                          <AvatarFallback>{user.displayName[0]}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{user.displayName}</p>
                          <p className="text-xs text-slate-500">{user.email}</p>
                        </div>
                      </TableCell>
                    )}
                    {visibleColumns.role && (
                      <TableCell>
                        <Badge variant={user.role === 'admin' ? 'default' : 'secondary'} className="capitalize">
                          {user.role}
                        </Badge>
                      </TableCell>
                    )}
                    {visibleColumns.platform && (
                      <TableCell>
                        {getProviderBadge(user.providerId)}
                      </TableCell>
                    )}
                    {visibleColumns.joinedDate && (
                      <TableCell className="text-sm text-slate-600">
                        {formatDate(user.createdAt)}
                      </TableCell>
                    )}
                    {visibleColumns.status && (
                      <TableCell>
                        {getStatusBadge(user.status)}
                      </TableCell>
                    )}
                    {visibleColumns.team && (
                      <TableCell>
                        {userTeam ? (
                          <Dialog>
                            <DialogTrigger render={
                              <Button variant="link" className="p-0 h-auto text-primary font-medium" onClick={() => setSelectedTeam(userTeam)}>
                                {userTeam.name}
                              </Button>
                            } />
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>Team Details: {userTeam.name}</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-6 py-4">
                                <div className="grid grid-cols-3 gap-4">
                                  <div className="bg-slate-50 p-4 rounded-xl">
                                    <p className="text-xs text-slate-500 uppercase font-bold mb-1">Team Leader</p>
                                    <p className="font-medium">{users.find(u => u.uid === userTeam.leadId)?.displayName || 'Unknown'}</p>
                                  </div>
                                  <div className="bg-slate-50 p-4 rounded-xl">
                                    <p className="text-xs text-slate-500 uppercase font-bold mb-1">Members</p>
                                    <p className="font-medium">{users.filter(u => u.teamId === userTeam.id).length} Users</p>
                                  </div>
                                  <div className="bg-slate-50 p-4 rounded-xl">
                                    <p className="text-xs text-slate-500 uppercase font-bold mb-1">Completion</p>
                                    <p className="font-medium">
                                      {allTasks.filter(t => t.teamId === userTeam.id && t.status === 'completed').length} / {allTasks.filter(t => t.teamId === userTeam.id).length} Tasks
                                    </p>
                                  </div>
                                </div>
                                
                                <div>
                                  <h4 className="font-bold mb-3 flex items-center">
                                    <Check className="w-4 h-4 mr-2 text-green-500" /> Team Tasks
                                  </h4>
                                  <ScrollArea className="h-[300px] pr-4">
                                    <div className="space-y-3">
                                      {allTasks.filter(t => t.teamId === userTeam.id).map(task => (
                                        <div key={task.id} className="flex items-center justify-between p-3 border rounded-lg">
                                          <div>
                                            <p className="font-medium text-sm">{task.title}</p>
                                            <p className="text-xs text-slate-500">Assigned to: {users.find(u => u.uid === task.assigneeId)?.displayName}</p>
                                          </div>
                                          <Badge variant={task.status === 'completed' ? 'default' : 'secondary'}>
                                            {task.status}
                                          </Badge>
                                        </div>
                                      ))}
                                      {allTasks.filter(t => t.teamId === userTeam.id).length === 0 && (
                                        <p className="text-center text-slate-500 py-8">No tasks assigned to this team.</p>
                                      )}
                                    </div>
                                  </ScrollArea>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        ) : (
                          <span className="text-slate-400 text-sm italic">No Team</span>
                        )}
                      </TableCell>
                    )}
                    {visibleColumns.actions && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <Popover>
                            <PopoverTrigger render={
                              <Button variant="ghost" size="icon"><Settings className="w-4 h-4" /></Button>
                            } />
                            <PopoverContent className="w-48">
                              <div className="space-y-1">
                                <p className="text-xs font-bold text-slate-500 px-2 py-1 uppercase">Change Role</p>
                                <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => updateUserRole(user.uid, 'admin')}>Admin</Button>
                                <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => updateUserRole(user.uid, 'lead')}>Lead</Button>
                                <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => updateUserRole(user.uid, 'member')}>Member</Button>
                                <Separator className="my-1" />
                                <p className="text-xs font-bold text-slate-500 px-2 py-1 uppercase">Account Status</p>
                                {user.status !== 'active' && (
                                  <Button variant="ghost" size="sm" className="w-full justify-start text-green-600" onClick={() => updateUserStatus(user.uid, 'active')}>
                                    <UserCheck className="w-4 h-4 mr-2" /> Activate
                                  </Button>
                                )}
                                {user.status !== 'suspended' && (
                                  <Button variant="ghost" size="sm" className="w-full justify-start text-orange-600" onClick={() => updateUserStatus(user.uid, 'suspended')}>
                                    <Ban className="w-4 h-4 mr-2" /> Suspend
                                  </Button>
                                )}
                                {user.status !== 'deleted' && (
                                  <Button variant="ghost" size="sm" className="w-full justify-start text-red-600" onClick={() => updateUserStatus(user.uid, 'deleted')}>
                                    <Trash2 className="w-4 h-4 mr-2" /> Delete
                                  </Button>
                                )}
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {filteredUsers.length === 0 && (
            <div className="py-20 text-center">
              <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-slate-300" />
              </div>
              <h3 className="font-bold text-slate-900">No users found</h3>
              <p className="text-slate-500">Try adjusting your filters or search query.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
