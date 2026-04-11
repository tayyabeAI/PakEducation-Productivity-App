import { useState, useEffect } from 'react';
import { db, collection, query, where, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, orderBy, limit } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { Team as TeamType, UserProfile, Invitation, Task } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Badge } from './ui/badge';
import { Users, UserPlus, Shield, Settings, Mail, Clock, X, LogIn, Plus } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Label } from './ui/label';
import { toast } from 'sonner';
import InviteDialog from './InviteDialog';
import TeamDataView from './TeamDataView';
import { handleFirestoreError, OperationType } from '../lib/error-handler';

export default function Team() {
  const { user } = useAuth();
  const [team, setTeam] = useState<TeamType | null>(null);
  const [allUserTeams, setAllUserTeams] = useState<TeamType[]>([]);
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [pendingInvites, setPendingInvites] = useState<Invitation[]>([]);
  const [recentActivity, setRecentActivity] = useState<Task[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [loading, setLoading] = useState(true);

  // Fetch all teams the user belongs to
  useEffect(() => {
    if (!user) return;

    let q;
    if (user.role === 'super-admin') {
      // Super Admin sees everything
      q = query(collection(db, 'teams'));
    } else if (user.role === 'admin') {
      // Admin only sees teams they created
      q = query(collection(db, 'teams'), where('leadId', '==', user.uid));
    } else if (user.teamIds && user.teamIds.length > 0) {
      // Leads and Members see teams they are part of
      q = query(collection(db, 'teams'), where('__name__', 'in', user.teamIds));
    } else if (user.teamId) {
      q = query(collection(db, 'teams'), where('__name__', '==', user.teamId));
    } else {
      setAllUserTeams([]);
      return;
    }

    const unsub = onSnapshot(q, (s) => {
      setAllUserTeams(s.docs.map(d => ({ id: d.id, ...d.data() } as TeamType)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'teams');
    });

    return () => unsub();
  }, [user?.uid, user?.teamIds, user?.teamId, user?.role]);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    if (user.teamId) {
      setLoading(true);
      const unsubTeam = onSnapshot(doc(db, 'teams', user.teamId), (s) => {
        if (s.exists()) {
          setTeam({ id: s.id, ...s.data() } as TeamType);
        } else {
          setTeam(null);
        }
        setLoading(false);
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, `teams/${user.teamId}`);
      });

      const membersQuery = query(collection(db, 'users'), where('teamId', '==', user.teamId));
      const unsubMembers = onSnapshot(membersQuery, (s) => {
        setMembers(s.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)));
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'users');
      });

      let unsubInvites = () => {};
      if (user.role === 'lead' || user.role === 'admin') {
        const invitesQuery = query(
          collection(db, 'invitations'), 
          where('teamId', '==', user.teamId),
          where('status', '==', 'pending')
        );
        unsubInvites = onSnapshot(invitesQuery, (s) => {
          setPendingInvites(s.docs.map(d => ({ id: d.id, ...d.data() } as Invitation)));
        }, (error) => {
          handleFirestoreError(error, OperationType.LIST, 'invitations');
        });
      }

      const activityQuery = query(
        collection(db, 'tasks'),
        where('teamId', '==', user.teamId),
        where('status', '==', 'completed'),
        orderBy('completedAt', 'desc'),
        limit(5)
      );
      const unsubActivity = onSnapshot(activityQuery, (s) => {
        setRecentActivity(s.docs.map(d => ({ id: d.id, ...d.data() } as Task)));
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'tasks');
      });

      return () => { unsubTeam(); unsubMembers(); unsubInvites(); unsubActivity(); };
    } else {
      setTeam(null);
      setMembers([]);
      setPendingInvites([]);
      setLoading(false);
    }
  }, [user?.uid, user?.teamId, user?.role]);

  const handleCreateTeam = async () => {
    if (!teamName || !user) return;
    try {
      const teamRef = await addDoc(collection(db, 'teams'), {
        name: teamName,
        leadId: user.uid,
        createdAt: serverTimestamp()
      });

      const currentTeamIds = user.teamIds || [];
      const newTeamIds = currentTeamIds.includes(teamRef.id) ? currentTeamIds : [...currentTeamIds, teamRef.id];

      await updateDoc(doc(db, 'users', user.uid), {
        teamId: teamRef.id,
        teamIds: newTeamIds,
        role: (user.role === 'super-admin' || user.role === 'admin') ? user.role : 'lead'
      });
      setIsCreateDialogOpen(false);
      setTeamName('');
      toast.success('Team created successfully');
    } catch (error) {
      toast.error('Failed to create team');
    }
  };

  const switchTeam = async (teamId: string) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        teamId: teamId
      });
      toast.success('Switched team');
    } catch (error) {
      toast.error('Failed to switch team');
    }
  };

  const cancelInvite = async (inviteId: string) => {
    try {
      await deleteDoc(doc(db, 'invitations', inviteId));
      toast.success('Invitation cancelled');
    } catch (error) {
      toast.error('Failed to cancel invitation');
    }
  };

  if (loading) {
    return (
      <div className="h-[400px] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user?.teamId || !team) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-6">
        <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center text-primary">
          <Users className="w-10 h-10" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold">No Team Found</h2>
          <p className="text-slate-500 max-w-sm">Create a team to collaborate with others and monitor collective productivity.</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger render={<Button size="lg" className="rounded-full px-8">Create a Team</Button>} />
          <DialogContent>
            <DialogHeader><DialogTitle>Create New Team</DialogTitle></DialogHeader>
            <div className="py-4 space-y-4">
              <div className="space-y-2">
                <Label>Team Name</Label>
                <Input value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="e.g. Engineering Team" />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreateTeam} className="w-full">Create Team</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
      {/* Team Sidebar */}
      <div className="lg:col-span-1 space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-900">My Teams</h3>
          {(user.canCreateMultipleTeams || user.role === 'admin') && (
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger render={
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                  <Plus className="w-4 h-4" />
                </Button>
              } />
              <DialogContent>
                <DialogHeader><DialogTitle>Create New Team</DialogTitle></DialogHeader>
                <div className="py-4 space-y-4">
                  <div className="space-y-2">
                    <Label>Team Name</Label>
                    <Input value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="e.g. Marketing Team" />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleCreateTeam} className="w-full">Create Team</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
        <div className="space-y-2">
          {allUserTeams.map(t => (
            <button
              key={t.id}
              onClick={() => switchTeam(t.id)}
              className={`w-full flex items-center space-x-3 p-3 rounded-xl transition-all ${
                user.teamId === t.id 
                  ? 'bg-primary text-white shadow-md' 
                  : 'bg-white hover:bg-slate-50 text-slate-600'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                user.teamId === t.id ? 'bg-white/20' : 'bg-slate-100 text-slate-400'
              }`}>
                {t.name[0]}
              </div>
              <span className="font-medium truncate">{t.name}</span>
            </button>
          ))}
          {allUserTeams.length === 0 && (
            <p className="text-xs text-slate-500 italic p-4 text-center bg-slate-50 rounded-xl">
              No teams joined yet.
            </p>
          )}
        </div>
      </div>

      {/* Team Content */}
      <div className="lg:col-span-3 space-y-8">
        {!team ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
            <Users className="w-12 h-12 text-slate-300 mb-4" />
            <h3 className="text-lg font-bold text-slate-900">Select a team</h3>
            <p className="text-sm text-slate-500">Choose a team from the list to view its details.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center text-white font-bold text-xl">
                  {team?.name[0]}
                </div>
                <div>
                  <h2 className="text-2xl font-bold">{team?.name}</h2>
                  <p className="text-slate-500">{members.length} Members</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                {(user.role === 'lead' || user.role === 'admin') && (
                  <Button onClick={() => setIsInviteDialogOpen(true)} variant="outline" className="rounded-full">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Invite
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="rounded-full">
                  <Settings className="w-5 h-5" />
                </Button>
              </div>
            </div>

            <InviteDialog 
              teamId={team.id} 
              teamName={team.name} 
              open={isInviteDialogOpen} 
              onOpenChange={setIsInviteDialogOpen} 
            />

            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="mb-6">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="data">Data Records</TabsTrigger>
              </TabsList>

              <TabsContent value="overview">
                <div className="grid lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 space-y-6">
                    <Card className="border-none shadow-sm">
                      <CardHeader><CardTitle className="text-lg">Team Members</CardTitle></CardHeader>
                      <CardContent>
                        <div className="divide-y divide-slate-100">
                          {members.map(member => (
                            <div key={member.uid} className="py-4 flex items-center justify-between">
                              <div className="flex items-center space-x-4">
                                <Avatar>
                                  <AvatarImage src={member.photoURL} />
                                  <AvatarFallback>{member.displayName[0]}</AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-semibold">{member.displayName}</p>
                                  <div className="flex items-center space-x-2 text-xs text-slate-500">
                                    <span>{member.email}</span>
                                    {member.lastLogin && (
                                      <>
                                        <span>•</span>
                                        <span className="flex items-center">
                                          <LogIn className="w-3 h-3 mr-1" />
                                          Active {formatDistanceToNow(member.lastLogin.toDate(), { addSuffix: true })}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center space-x-4">
                                <Badge variant="secondary" className="capitalize">
                                  {member.role === 'lead' && (member.teamIds?.length || 0) > 1 ? 'Super Leader' : member.role}
                                </Badge>
                                <Button variant="ghost" size="icon"><Mail className="w-4 h-4" /></Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    {pendingInvites.length > 0 && (
                      <Card className="border-none shadow-sm">
                        <CardHeader>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Clock className="w-5 h-5 text-orange-500" />
                            Pending Invitations
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="divide-y divide-slate-100">
                            {pendingInvites.map(invite => (
                              <div key={invite.id} className="py-4 flex items-center justify-between">
                                <div className="flex items-center space-x-4">
                                  <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
                                    <Mail className="w-5 h-5" />
                                  </div>
                                  <div>
                                    <p className="font-semibold">{invite.email}</p>
                                    <p className="text-xs text-slate-500">Invited as {invite.role}</p>
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50">Pending</Badge>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                    onClick={() => cancelInvite(invite.id!)}
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>

                  <div className="space-y-6">
                    <Card className="border-none shadow-sm bg-primary text-white">
                      <CardHeader><CardTitle className="text-lg">Team Productivity</CardTitle></CardHeader>
                      <CardContent className="space-y-4">
                        <div className="text-center py-6">
                          <h3 className="text-5xl font-bold">92%</h3>
                          <p className="text-primary-foreground/70 text-sm mt-2">Average Efficiency</p>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs">
                            <span>Weekly Target</span>
                            <span>92/100</span>
                          </div>
                          <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                            <div className="h-full bg-white w-[92%]" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-none shadow-sm">
                      <CardHeader><CardTitle className="text-lg">Recent Activity</CardTitle></CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {recentActivity.length > 0 ? recentActivity.map(task => (
                            <div key={task.id} className="flex space-x-3">
                              <div className="w-2 h-2 bg-primary rounded-full mt-1.5" />
                              <p className="text-sm text-slate-600">
                                <span className="font-semibold text-slate-900">
                                  {members.find(m => m.uid === (task.completedBy || task.assigneeId))?.displayName || 'A member'}
                                </span> completed task "{task.title}"
                              </p>
                            </div>
                          )) : (
                            <p className="text-sm text-slate-500 text-center py-4">No recent activity</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="data">
                <TeamDataView teamId={team.id} members={members} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </div>
  );
}
