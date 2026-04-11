/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { Toaster } from 'sonner';
import { useState } from 'react';
import { 
  LayoutDashboard, 
  CheckSquare, 
  Target, 
  Clock, 
  Users, 
  MessageSquare, 
  Settings, 
  LogOut, 
  Menu, 
  X,
  ShieldCheck,
  BarChart3
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { motion, AnimatePresence } from 'motion/react';

// Components (to be implemented)
import Dashboard from '@/components/Dashboard';
import Tasks from '@/components/Tasks';
import Goals from '@/components/Goals';
import TimeTracker from '@/components/TimeTracker';
import Team from '@/components/Team';
import Chat from '@/components/Chat';
import AdminPanel from '@/components/AdminPanel';
import LandingPage from '@/components/LandingPage';
import Reports from '@/components/Reports';
import SessionTracker from '@/components/SessionTracker';
import InvitationsBanner from '@/components/InvitationsBanner';
import ErrorBoundary from '@/components/ErrorBoundary';

function AppContent() {
  const { user, loading, signIn, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <LandingPage onSignIn={signIn} />;
  }

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare },
    { id: 'goals', label: 'Goals', icon: Target },
    { id: 'time', label: 'Time Tracking', icon: Clock },
    { id: 'team', label: 'Team', icon: Users },
    { id: 'chat', label: 'Chat', icon: MessageSquare },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
  ];

  if (user.role === 'admin' || user.role === 'super-admin') {
    navItems.push({ id: 'admin', label: 'Admin Panel', icon: ShieldCheck });
  }

  return (
    <div className="h-screen flex bg-slate-50 overflow-hidden">
      <SessionTracker />
      <InvitationsBanner />
      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 280 : 80 }}
        className="bg-white border-r border-slate-200 flex flex-col z-20"
      >
        <div className="p-6 flex items-center justify-between">
          {isSidebarOpen && (
            <motion.span 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="font-bold text-xl text-primary truncate"
            >
              PakEducation Productivity App
            </motion.span>
          )}
          <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
            {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>

        <ScrollArea className="flex-1 px-4">
          <nav className="space-y-2">
            {navItems.map((item) => (
              <Button
                key={item.id}
                variant={activeTab === item.id ? 'default' : 'ghost'}
                className={`w-full justify-start ${!isSidebarOpen && 'px-0 justify-center'}`}
                onClick={() => setActiveTab(item.id)}
              >
                <item.icon className={`h-5 w-5 ${isSidebarOpen && 'mr-3'}`} />
                {isSidebarOpen && <span>{item.label}</span>}
              </Button>
            ))}
          </nav>
        </ScrollArea>

        <div className="p-4 border-t border-slate-200">
          <div className={`flex items-center ${isSidebarOpen ? 'space-x-3' : 'justify-center'}`}>
            <Avatar>
              <AvatarImage src={user.photoURL} />
              <AvatarFallback>{user.displayName[0]}</AvatarFallback>
            </Avatar>
            {isSidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{user.displayName}</p>
                <p className="text-xs text-slate-500 truncate capitalize">{user.role}</p>
              </div>
            )}
            {isSidebarOpen && (
              <Button variant="ghost" size="icon" onClick={logout}>
                <LogOut className="h-4 w-4" />
              </Button>
            )}
          </div>
          {!isSidebarOpen && (
            <Button variant="ghost" size="icon" className="w-full mt-4" onClick={logout}>
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8">
          <h2 className="text-xl font-semibold text-slate-800 capitalize">
            {navItems.find(i => i.id === activeTab)?.label}
          </h2>
          <div className="flex items-center space-x-4">
            <Button variant="outline" size="sm">Help & Feedback</Button>
          </div>
        </header>

        <ScrollArea className="flex-1 h-full p-8">
          <div className="max-w-7xl mx-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {activeTab === 'dashboard' && <Dashboard />}
                {activeTab === 'tasks' && <Tasks />}
                {activeTab === 'goals' && <Goals />}
                {activeTab === 'time' && <TimeTracker />}
                {activeTab === 'team' && <Team />}
                {activeTab === 'chat' && <Chat />}
                {activeTab === 'reports' && <Reports />}
                {activeTab === 'admin' && <AdminPanel />}
              </motion.div>
            </AnimatePresence>

            {/* Footer */}
            <footer className="mt-20 py-8 border-t border-slate-200 flex flex-col items-center gap-4 text-center">
              <div className="text-slate-500 text-sm font-medium">
                © 2026. Idea By Muhammad Tayyab
              </div>
              <div className="flex items-center space-x-4">
                <a 
                  href="https://www.instagram.com/tayyabegaming" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-primary hover:text-white transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
                </a>
                <a 
                  href="https://www.facebook.com/tayyabegaming" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-primary hover:text-white transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
                </a>
              </div>
            </footer>
          </div>
        </ScrollArea>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
        <Toaster position="top-right" />
      </AuthProvider>
    </ErrorBoundary>
  );
}

