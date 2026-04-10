import { Button } from './ui/button';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Clock, Shield, Zap, Play, X as CloseIcon } from 'lucide-react';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';

export default function LandingPage({ onSignIn }: { onSignIn: () => void }) {
  const [isVideoOpen, setIsVideoOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-primary selection:text-white">
      {/* Hero Section */}
      <header className="relative overflow-hidden pt-16 pb-32">
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <nav className="flex items-center justify-between mb-24">
            <div className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white font-bold text-xl">P</div>
              <span className="text-2xl font-bold tracking-tight">PakEducation Productivity App</span>
            </div>
            <Button onClick={onSignIn} size="lg" className="rounded-full px-8">Sign In</Button>
          </nav>

          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <h1 className="text-6xl lg:text-7xl font-bold tracking-tighter leading-none mb-6">
                Master Your <span className="text-primary">Productivity</span> with Precision.
              </h1>
              <p className="text-xl text-slate-600 mb-10 max-w-lg leading-relaxed">
                The all-in-one productivity suite for individuals and teams. Track time, manage tasks, and achieve goals with AI-powered insights.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button onClick={onSignIn} size="lg" className="rounded-full text-lg px-10 h-16">Get Started Free</Button>
                <Button 
                  variant="outline" 
                  size="lg" 
                  className="rounded-full text-lg px-10 h-16 group"
                  onClick={() => setIsVideoOpen(true)}
                >
                  <Play className="mr-2 h-5 w-5 fill-current group-hover:text-primary transition-colors" />
                  View Demo
                </Button>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative"
            >
              <div className="aspect-square bg-slate-100 rounded-[3rem] overflow-hidden shadow-2xl border border-slate-200">
                <img 
                  src="https://picsum.photos/seed/productivity/800/800" 
                  alt="Dashboard Preview" 
                  className="w-full h-full object-cover opacity-80"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="absolute -bottom-6 -left-6 bg-white p-6 rounded-2xl shadow-xl border border-slate-100 max-w-[240px]">
                <div className="flex items-center space-x-3 mb-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-sm font-semibold">Live Productivity</span>
                </div>
                <div className="text-2xl font-bold">87% Efficiency</div>
                <div className="text-xs text-slate-500 mt-1">+12% from last week</div>
              </div>
            </motion.div>
          </div>
        </div>
      </header>

      {/* Features */}
      <section className="py-32 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-4xl font-bold tracking-tight mb-4">Everything you need to succeed</h2>
            <p className="text-slate-600 max-w-2xl mx-auto">Powerful features designed to help you focus on what matters most.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { icon: CheckCircle2, title: "Task Management", desc: "Organize tasks with Kanban boards and priority tracking." },
              { icon: Clock, title: "Time Tracking", desc: "Monitor where your time goes with precise logging." },
              { icon: Zap, title: "AI Insights", desc: "Get personalized recommendations to boost your efficiency." },
              { icon: Shield, title: "Team Collaboration", desc: "Manage teams and monitor collective productivity." }
            ].map((f, i) => (
              <div key={i} className="bg-white p-8 rounded-3xl border border-slate-200 hover:shadow-lg transition-shadow">
                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mb-6">
                  <f.icon className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold mb-3">{f.title}</h3>
                <p className="text-slate-600 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 flex flex-col items-center gap-6 text-center">
          <div className="text-slate-500 text-sm font-medium">
            © 2026. Idea By Muhammad Tayyab
          </div>
          <div className="flex items-center space-x-4">
            <a 
              href="https://www.instagram.com/tayyabegaming" 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-primary hover:text-white transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
            </a>
            <a 
              href="https://www.facebook.com/tayyabegaming" 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-primary hover:text-white transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
            </a>
          </div>
        </div>
      </footer>

      {/* Video Modal */}
      <Dialog open={isVideoOpen} onOpenChange={setIsVideoOpen}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black border-none">
          <DialogHeader className="sr-only">
            <DialogTitle>Product Demo Video</DialogTitle>
          </DialogHeader>
          <div className="aspect-video w-full relative flex flex-col items-center justify-center bg-slate-900 text-white p-12 text-center">
            <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mb-6 animate-pulse">
              <Play className="w-10 h-10 text-primary fill-current" />
            </div>
            <h3 className="text-2xl font-bold mb-2">Demo Video Coming Soon</h3>
            <p className="text-slate-400 max-w-md">
              We are currently recording a detailed walkthrough of the PakEducation Productivity App. Check back soon!
            </p>
            <div className="absolute bottom-4 right-4 text-xs text-slate-500 font-mono">
              v1.0.0-beta
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
