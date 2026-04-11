import { useState, useEffect, useRef } from 'react';
import { db, collection, query, where, onSnapshot, addDoc, serverTimestamp, orderBy, limit, getDocs, or } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { ChatMessage, UserProfile } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Send, Hash, Users, Search, User, MessageSquare } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { handleFirestoreError, OperationType } from '../lib/error-handler';

export default function Chat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [chatType, setChatType] = useState<'team' | 'direct'>('team');
  const [selectedRecipient, setSelectedRecipient] = useState<UserProfile | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchUser, setSearchUser] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;

    let q;
    if (chatType === 'team' && user.teamId) {
      q = query(
        collection(db, 'chats'),
        where('teamId', '==', user.teamId),
        orderBy('timestamp', 'asc'),
        limit(50)
      );
    } else if (chatType === 'direct' && selectedRecipient) {
      q = query(
        collection(db, 'chats'),
        or(
          where('senderId', '==', user.uid),
          where('receiverId', '==', user.uid)
        ),
        orderBy('timestamp', 'asc'),
        limit(100)
      );
    } else {
      setMessages([]);
      return;
    }

    const unsubscribe = onSnapshot(q, (s) => {
      const allMsgs = s.docs.map(d => ({ id: d.id, ...d.data() } as ChatMessage));
      if (chatType === 'direct' && selectedRecipient) {
        // Filter for specific conversation
        const filtered = allMsgs.filter(m => 
          (m.senderId === user.uid && m.receiverId === selectedRecipient.uid) ||
          (m.senderId === selectedRecipient.uid && m.receiverId === user.uid)
        );
        setMessages(filtered);
      } else {
        setMessages(allMsgs);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'chats');
    });

    return () => unsubscribe();
  }, [user?.uid, user?.teamId, chatType, selectedRecipient?.uid]);

  useEffect(() => {
    if (chatType === 'direct') {
      const fetchUsers = async () => {
        const s = await getDocs(collection(db, 'users'));
        setUsers(s.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)).filter(u => u.uid !== user?.uid));
      };
      fetchUsers();
    }
  }, [chatType, user?.uid]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    try {
      const msgData: any = {
        senderId: user.uid,
        senderName: user.displayName,
        message: newMessage,
        timestamp: serverTimestamp()
      };

      if (chatType === 'team' && user.teamId) {
        msgData.teamId = user.teamId;
      } else if (chatType === 'direct' && selectedRecipient) {
        msgData.receiverId = selectedRecipient.uid;
      } else {
        return;
      }

      await addDoc(collection(db, 'chats'), msgData);
      setNewMessage('');
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const filteredUsers = users.filter(u => 
    u.displayName.toLowerCase().includes(searchUser.toLowerCase()) || 
    u.uid.toLowerCase().includes(searchUser.toLowerCase())
  );

  return (
    <div className="h-[calc(100vh-200px)] flex bg-white rounded-3xl border border-slate-200 overflow-hidden">
      {/* Sidebar for Direct Messages */}
      <div className="w-64 border-r border-slate-100 flex flex-col bg-slate-50/30">
        <div className="p-4 border-b border-slate-100">
          <Tabs value={chatType} onValueChange={(v) => setChatType(v as any)}>
            <TabsList className="w-full">
              <TabsTrigger value="team" className="flex-1">Team</TabsTrigger>
              <TabsTrigger value="direct" className="flex-1">Direct</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        
        <ScrollArea className="flex-1">
          {chatType === 'team' ? (
            <div className="p-2">
              <Button 
                variant={chatType === 'team' ? 'secondary' : 'ghost'} 
                className="w-full justify-start space-x-2 rounded-xl h-12"
              >
                <Hash className="w-4 h-4" />
                <span>Team General</span>
              </Button>
            </div>
          ) : (
            <div className="p-2 space-y-2">
              <div className="relative mb-4">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                <Input 
                  placeholder="Search by ID or Name" 
                  className="h-8 pl-7 text-xs"
                  value={searchUser}
                  onChange={(e) => setSearchUser(e.target.value)}
                />
              </div>
              {filteredUsers.map(u => (
                <Button 
                  key={u.uid}
                  variant={selectedRecipient?.uid === u.uid ? 'secondary' : 'ghost'}
                  className="w-full justify-start space-x-2 rounded-xl h-12 px-2"
                  onClick={() => setSelectedRecipient(u)}
                >
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={u.photoURL} />
                    <AvatarFallback>{u.displayName[0]}</AvatarFallback>
                  </Avatar>
                  <div className="text-left overflow-hidden">
                    <p className="text-xs font-semibold truncate">{u.displayName}</p>
                    <p className="text-[10px] text-slate-400 truncate">ID: {u.uid.slice(0, 8)}...</p>
                  </div>
                </Button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center space-x-2">
            {chatType === 'team' ? (
              <>
                <Hash className="w-5 h-5 text-slate-400" />
                <h3 className="font-bold">Team General</h3>
              </>
            ) : (
              <>
                <User className="w-5 h-5 text-slate-400" />
                <h3 className="font-bold">{selectedRecipient?.displayName || 'Select a user'}</h3>
              </>
            )}
          </div>
        </div>

        <ScrollArea className="flex-1 p-6">
          <div className="space-y-6">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex items-start space-x-3 ${msg.senderId === user?.uid ? 'flex-row-reverse space-x-reverse' : ''}`}>
                <Avatar className="w-8 h-8 mt-1">
                  <AvatarFallback>{msg.senderName[0]}</AvatarFallback>
                </Avatar>
                <div className={`max-w-[70%] ${msg.senderId === user?.uid ? 'items-end' : 'items-start'}`}>
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-xs font-bold text-slate-900">{msg.senderName}</span>
                    <span className="text-[10px] text-slate-400">
                      {msg.timestamp?.toDate ? msg.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
                    </span>
                  </div>
                  <div className={`p-3 rounded-2xl text-sm ${
                    msg.senderId === user?.uid 
                      ? 'bg-primary text-white rounded-tr-none' 
                      : 'bg-slate-100 text-slate-900 rounded-tl-none'
                  }`}>
                    {msg.message}
                  </div>
                </div>
              </div>
            ))}
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2 py-20">
                <MessageSquare className="w-12 h-12 opacity-20" />
                <p>No messages yet</p>
              </div>
            )}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>

        <form onSubmit={handleSendMessage} className="p-4 bg-slate-50 border-t border-slate-100">
          <div className="relative">
            <Input 
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={chatType === 'team' ? "Message team..." : "Message user..."}
              className="pr-12 h-12 bg-white border-slate-200 rounded-2xl"
              disabled={chatType === 'direct' && !selectedRecipient}
            />
            <Button 
              type="submit" 
              size="icon" 
              className="absolute right-1.5 top-1.5 h-9 w-9 rounded-xl"
              disabled={!newMessage.trim() || (chatType === 'direct' && !selectedRecipient)}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
