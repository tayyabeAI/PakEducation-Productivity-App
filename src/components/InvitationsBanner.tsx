import { useState, useEffect } from 'react';
import { db, collection, query, where, onSnapshot, doc, updateDoc, deleteDoc } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { Invitation } from '../types';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Mail, Check, X, Users } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from '../lib/error-handler';

export default function InvitationsBanner() {
  const { user } = useAuth();
  const [invitations, setInvitations] = useState<Invitation[]>([]);

  useEffect(() => {
    if (!user?.email) return;

    const q = query(
      collection(db, 'invitations'),
      where('email', '==', user.email),
      where('status', '==', 'pending')
    );

    const unsub = onSnapshot(q, (s) => {
      setInvitations(s.docs.map(d => ({ id: d.id, ...d.data() } as Invitation)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'invitations');
    });

    return () => unsub();
  }, [user?.email]);

  const handleAccept = async (invite: Invitation) => {
    if (!user) return;
    try {
      // 1. Update user profile with teamId and role
      await updateDoc(doc(db, 'users', user.uid), {
        teamId: invite.teamId,
        role: invite.role
      });

      // 2. Update invitation status
      await updateDoc(doc(db, 'invitations', invite.id!), {
        status: 'accepted'
      });

      toast.success(`Joined team ${invite.teamName}!`);
    } catch (error) {
      toast.error('Failed to join team');
    }
  };

  const handleDecline = async (inviteId: string) => {
    try {
      await updateDoc(doc(db, 'invitations', inviteId), {
        status: 'declined'
      });
      toast.info('Invitation declined');
    } catch (error) {
      toast.error('Failed to decline invitation');
    }
  };

  if (invitations.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 w-full max-w-md space-y-3">
      <AnimatePresence>
        {invitations.map((invite) => (
          <motion.div
            key={invite.id}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <Card className="border-none shadow-2xl bg-slate-900 text-white overflow-hidden">
              <CardContent className="p-0">
                <div className="p-4 flex items-start space-x-4">
                  <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shrink-0">
                    <Users className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold">Team Invitation</p>
                    <p className="text-xs text-slate-400 mt-1">
                      <span className="text-white font-medium">{invite.inviterName}</span> invited you to join <span className="text-primary font-bold">{invite.teamName}</span> as a <span className="capitalize">{invite.role}</span>.
                    </p>
                    {invite.description && (
                      <p className="text-[10px] text-slate-500 mt-2 italic line-clamp-2">
                        "{invite.description}"
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex border-t border-white/10">
                  <button
                    onClick={() => handleDecline(invite.id!)}
                    className="flex-1 py-3 text-xs font-medium text-slate-400 hover:bg-white/5 transition-colors flex items-center justify-center"
                  >
                    <X className="w-3 h-3 mr-2" /> Decline
                  </button>
                  <div className="w-px bg-white/10" />
                  <button
                    onClick={() => handleAccept(invite)}
                    className="flex-1 py-3 text-xs font-bold text-primary hover:bg-primary/10 transition-colors flex items-center justify-center"
                  >
                    <Check className="w-3 h-3 mr-2" /> Accept & Join
                  </button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
