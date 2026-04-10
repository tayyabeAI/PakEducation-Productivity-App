import { useState } from 'react';
import { db, collection, addDoc, serverTimestamp, query, where, getDocs } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './ui/dialog';
import { toast } from 'sonner';
import { Mail, UserPlus, Send } from 'lucide-react';
import { UserRole } from '../types';

interface InviteDialogProps {
  teamId: string;
  teamName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function InviteDialog({ teamId, teamName, open, onOpenChange }: InviteDialogProps) {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('member');
  const [description, setDescription] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleInvite = async () => {
    if (!email || !user) return;
    
    setIsSending(true);
    try {
      // Check if user is already in a team or already invited
      const inviteQuery = query(
        collection(db, 'invitations'), 
        where('email', '==', email),
        where('teamId', '==', teamId),
        where('status', '==', 'pending')
      );
      const inviteSnapshot = await getDocs(inviteQuery);
      
      if (!inviteSnapshot.empty) {
        toast.error('An invitation is already pending for this email');
        setIsSending(false);
        return;
      }

      // Create invitation record
      await addDoc(collection(db, 'invitations'), {
        teamId,
        teamName,
        inviterId: user.uid,
        inviterName: user.displayName,
        email,
        role,
        description,
        status: 'pending',
        createdAt: serverTimestamp()
      });

      toast.success('Invitation sent successfully!');
      onOpenChange(false);
      setEmail('');
      setDescription('');
    } catch (error) {
      console.error('Invite error:', error);
      toast.error('Failed to send invitation');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            Invite Team Member
          </DialogTitle>
          <DialogDescription>
            Invite someone to join <span className="font-bold text-slate-900">{teamName}</span>. 
            They will receive an email invitation.
          </DialogDescription>
        </DialogHeader>

        <div className="py-6 space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                id="email"
                type="email"
                placeholder="colleague@example.com" 
                className="pl-10"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Assign Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Member (Standard access)</SelectItem>
                <SelectItem value="lead">Lead (Can manage tasks & members)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Personal Message (Optional)</Label>
            <Textarea 
              id="description"
              placeholder="Hey! Join our team on PakEducation Productivity App..." 
              className="resize-none h-24"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Email Preview Design */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email Preview</p>
            <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white text-[10px] font-bold">PE</div>
                <div className="text-[10px] text-slate-500">PakEducation Productivity App</div>
              </div>
              <h4 className="text-sm font-bold mb-1">You're invited to join {teamName}!</h4>
              <p className="text-[11px] text-slate-600 mb-3">
                {user?.displayName} has invited you to collaborate on their team.
              </p>
              {description && (
                <div className="bg-slate-50 p-2 rounded text-[10px] text-slate-500 italic mb-3 border-l-2 border-primary">
                  "{description}"
                </div>
              )}
              <Button disabled className="w-full h-8 text-[11px] rounded-md">Join Team</Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleInvite} disabled={!email || isSending} className="min-w-[120px]">
            {isSending ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Send Invite
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
