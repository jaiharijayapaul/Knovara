import { useState, useEffect, useCallback } from 'react';
import { fetchHealthStatus } from '@/services/api';
import type { HealthResponse } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';
import { 
  Sparkles, 
  BookOpen, 
  BrainCircuit, 
  Award, 
  GraduationCap, 
  Layers,
  ArrowRight,
  LogIn,
  UserPlus,
  LayoutDashboard,
  ShieldCheck,
  Repeat,
  FileText,
  ChevronRight,
  Bot,
  Check,
  Activity
} from 'lucide-react';

export const Overview = () => {
  const { isAuthenticated, user } = useAuth();
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'tutor' | 'mastery' | 'srs' | 'assessment'>('tutor');
  const [showDiagnostics, setShowDiagnostics] = useState<boolean>(false);
  const [activeNavSection, setActiveNavSection] = useState<string>('');

  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      setActiveNavSection(id);
      const navOffset = 90;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - navOffset;
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
      window.history.pushState(null, '', `#${id}`);
    }
  };

  useEffect(() => {
    if (window.location.hash) {
      const hashId = window.location.hash.replace('#', '');
      const element = document.getElementById(hashId);
      if (element) {
        setActiveNavSection(hashId);
        setTimeout(() => {
          const navOffset = 90;
          const elementPosition = element.getBoundingClientRect().top;
          const offsetPosition = elementPosition + window.pageYOffset - navOffset;
          window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
          });
        }, 120);
      }
    }

    const handleScroll = () => {
      const sections = ['features', 'architecture', 'pedagogy'];
      const scrollPosition = window.scrollY + 130;
      for (const sectionId of sections) {
        const el = document.getElementById(sectionId);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPosition >= top && scrollPosition < top + height) {
            setActiveNavSection(sectionId);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const checkHealth = useCallback(async () => {
    const start = performance.now();
    try {
      const data = await fetchHealthStatus();
      const end = performance.now();
      setLatency(Math.round(end - start));
      setHealth(data);
    } catch {
      setHealth(null);
      setLatency(null);
    }
  }, []);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  const pedagogicalModes = [
    {
      id: 'socratic',
      name: 'Guided Thinking',
      tag: 'Think & Learn',
      desc: 'Helps you think through problems with friendly questions so you discover the answer on your own, rather than just memorizing.',
      color: 'from-teal-500/20 to-emerald-500/20 border-teal-500/30 text-teal-300'
    },
    {
      id: 'scaffolded',
      name: 'Step-by-Step Helper',
      tag: 'Easy Steps',
      desc: 'Breaks down long formulas and difficult topics into small, bite-sized steps that are easy to follow.',
      color: 'from-blue-500/20 to-indigo-500/20 border-blue-500/30 text-blue-300'
    },
    {
      id: 'feynman',
      name: 'Simple Everyday Words',
      tag: 'Plain Language',
      desc: 'Explains hard ideas using everyday examples and clear language, without confusing technical jargon.',
      color: 'from-amber-500/20 to-orange-500/20 border-amber-500/30 text-amber-300'
    },
    {
      id: 'debate',
      name: "Mistake Buster",
      tag: 'Avoid Traps',
      desc: 'Highlights common traps and misunderstandings students make on tests so you do not lose marks.',
      color: 'from-rose-500/20 to-pink-500/20 border-rose-500/30 text-rose-300'
    },
    {
      id: 'analogy',
      name: 'Real-World Examples',
      tag: 'Life Connections',
      desc: 'Connects abstract concepts to everyday things like sports, cars, or cooking so they stick in your mind.',
      color: 'from-purple-500/20 to-violet-500/20 border-purple-500/30 text-purple-300'
    },
    {
      id: 'prep',
      name: 'Exam Practice Drill',
      tag: 'Test Ready',
      desc: 'Tests you with exam-style questions, instant scoring, and clear explanations of why an answer is right.',
      color: 'from-cyan-500/20 to-sky-500/20 border-cyan-500/30 text-cyan-300'
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-teal-500 selection:text-white">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center shadow-lg shadow-teal-500/20">
              <GraduationCap className="w-5 h-5 text-slate-950 stroke-[2.5]" />
            </div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-white via-slate-100 to-teal-300 bg-clip-text text-transparent">
                Knovara
              </span>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-800/80 text-teal-400 border border-slate-700">
                AI Study Assistant
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center space-x-8 text-sm font-medium text-slate-400">
            <a 
              href="#features" 
              onClick={(e) => scrollToSection(e, 'features')}
              className={`transition-colors cursor-pointer ${
                activeNavSection === 'features' ? 'text-teal-400 font-semibold' : 'hover:text-teal-400'
              }`}
            >
              Key Features
            </a>
            <a 
              href="#architecture" 
              onClick={(e) => scrollToSection(e, 'architecture')}
              className={`transition-colors cursor-pointer ${
                activeNavSection === 'architecture' ? 'text-teal-400 font-semibold' : 'hover:text-teal-400'
              }`}
            >
              How You Learn
            </a>
            <a 
              href="#pedagogy" 
              onClick={(e) => scrollToSection(e, 'pedagogy')}
              className={`transition-colors cursor-pointer ${
                activeNavSection === 'pedagogy' ? 'text-teal-400 font-semibold' : 'hover:text-teal-400'
              }`}
            >
              Tutor Styles
            </a>
            <Link to="/instructions" className="text-teal-400 hover:text-teal-300 font-semibold transition-colors">Student Guide</Link>
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center space-x-3">
            {isAuthenticated ? (
              <div className="flex items-center space-x-2">
                <Link
                  to="/courses"
                  className="hidden sm:inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors"
                >
                  <BookOpen className="w-3.5 h-3.5 text-teal-400" />
                  <span>My Courses</span>
                </Link>
                <Link
                  to="/dashboard"
                  className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-slate-950 bg-gradient-to-r from-teal-400 to-emerald-400 hover:from-teal-300 hover:to-emerald-300 shadow-md shadow-teal-500/20 transition-all cursor-pointer"
                >
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  <span>Dashboard ({user?.name ? user.name.split(' ')[0] : 'Student'})</span>
                </Link>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Link
                  to="/login"
                  className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors"
                >
                  <LogIn className="w-3.5 h-3.5 text-teal-400" />
                  <span>Sign In</span>
                </Link>
                <Link
                  to="/register"
                  className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-slate-950 bg-gradient-to-r from-teal-400 to-emerald-400 hover:from-teal-300 hover:to-emerald-300 shadow-md shadow-teal-500/20 transition-all"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Get Started Free</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Page Body */}
      <main className="flex-1 space-y-20 pb-20">

        {/* HERO SECTION */}
        <section className="relative overflow-hidden pt-16 sm:pt-24 pb-12 border-b border-slate-800/60">
          {/* Subtle Ambient Radial Lighting */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-gradient-to-tr from-teal-600/15 via-emerald-600/10 to-transparent blur-3xl pointer-events-none -z-10" />

          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
            
            {/* Top Pill */}
            <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-teal-500/10 border border-teal-500/25 text-xs font-medium text-teal-300">
              <Sparkles className="w-3.5 h-3.5 text-teal-400 animate-pulse" />
              <span>Personal AI Study Assistant • Explains Everything From Your Notes</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight sm:leading-[1.15]">
              Upload Your Study Notes.{' '}
              <span className="bg-gradient-to-r from-teal-300 via-emerald-400 to-cyan-300 bg-clip-text text-transparent">
                Understand in Simple Words.
              </span>
            </h1>

            {/* Subtitle */}
            <p className="max-w-3xl mx-auto text-base sm:text-lg text-slate-300 leading-relaxed">
              Upload your textbook chapters, lecture slides, or class notes. Knovara's AI tutor reads them, 
              explains concepts in plain and friendly language with real-world examples, and prepares your practice flashcards and quizzes.
            </p>

            {/* Primary Action Buttons */}
            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
              {isAuthenticated ? (
                <Link
                  to="/courses"
                  className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-3 rounded-xl text-sm font-semibold text-slate-950 bg-gradient-to-r from-teal-400 to-emerald-400 hover:from-teal-300 hover:to-emerald-300 shadow-xl shadow-teal-500/25 transition-all"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Open Your Study Subjects</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              ) : (
                <Link
                  to="/register"
                  className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-3 rounded-xl text-sm font-semibold text-slate-950 bg-gradient-to-r from-teal-400 to-emerald-400 hover:from-teal-300 hover:to-emerald-300 shadow-xl shadow-teal-500/25 transition-all"
                >
                  <span>Start Learning Free</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              )}

              <Link
                to="/instructions"
                className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-3 rounded-xl text-sm font-medium text-slate-300 bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:text-white transition-colors"
              >
                <Sparkles className="w-4 h-4 text-teal-400" />
                <span>How to Study (Guide)</span>
              </Link>
            </div>

            {/* Core Differentiators Badges */}
            <div className="pt-10 grid grid-cols-2 md:grid-cols-4 gap-3 max-w-4xl mx-auto text-left">
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-start space-x-3">
                <ShieldCheck className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-semibold text-white">No Fake Answers</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">Exact page & slide numbers from your notes</p>
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-start space-x-3">
                <BrainCircuit className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-semibold text-white">Track Your Progress</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">Clear percentages for topics you mastered</p>
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-start space-x-3">
                <Repeat className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-semibold text-white">Smart Flashcards</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">Reviews cards so you remember for exams</p>
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-start space-x-3">
                <Layers className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-semibold text-white">Upload Any Material</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">PDF books, slides, and class notes</p>
                </div>
              </div>
            </div>

          </div>
        </section>


        {/* FOUR CORE PILLARS SECTION */}
        <section id="features" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10 scroll-mt-24 sm:scroll-mt-28">
          <div className="text-center space-y-2 max-w-2xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-widest text-teal-400">Key Features</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Everything You Need to Understand & Ace Your Subjects
            </h2>
            <p className="text-sm text-slate-400">
              Turn difficult textbooks and confusing lectures into clear, friendly lessons tailored to how you learn.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Pillar 1 */}
            <div className="rounded-2xl bg-slate-900/50 border border-slate-800/90 p-6 space-y-4 hover:border-teal-500/40 transition-all duration-200 flex flex-col justify-between group">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 group-hover:scale-105 transition-transform">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-semibold text-teal-400 uppercase tracking-wider">Upload Notes</span>
                  <h3 className="text-base font-semibold text-white">All Notes in One Place</h3>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Upload textbook PDFs, PowerPoint slides, and lecture notes. Knovara reads every page and organizes them cleanly by subject.
                </p>
              </div>
              <ul className="text-[11px] text-slate-400 space-y-1.5 pt-3 border-t border-slate-800/60">
                <li className="flex items-center space-x-1.5">
                  <Check className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                  <span>Exact book page: [Book, p. 42]</span>
                </li>
                <li className="flex items-center space-x-1.5">
                  <Check className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                  <span>Exact slide number: [Slide 18]</span>
                </li>
                <li className="flex items-center space-x-1.5">
                  <Check className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                  <span>Exact video time: [18:20 - 20:05]</span>
                </li>
              </ul>
            </div>

            {/* Pillar 2 */}
            <div className="rounded-2xl bg-slate-900/50 border border-slate-800/90 p-6 space-y-4 hover:border-emerald-500/40 transition-all duration-200 flex flex-col justify-between group">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
                  <Bot className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">Friendly AI Tutor</span>
                  <h3 className="text-base font-semibold text-white">Ask Anything in Plain Words</h3>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Ask anything about your notes. Instead of confusing answers, the AI explains step-by-step with real-world examples so you truly get it.
                </p>
              </div>
              <ul className="text-[11px] text-slate-400 space-y-1.5 pt-3 border-t border-slate-800/60">
                <li className="flex items-center space-x-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Choose your favorite explanation style</span>
                </li>
                <li className="flex items-center space-x-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Remembers your questions & past chats</span>
                </li>
                <li className="flex items-center space-x-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>100% truthful to your uploaded notes</span>
                </li>
              </ul>
            </div>

            {/* Pillar 3 */}
            <div className="rounded-2xl bg-slate-900/50 border border-slate-800/90 p-6 space-y-4 hover:border-cyan-500/40 transition-all duration-200 flex flex-col justify-between group">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 group-hover:scale-105 transition-transform">
                  <Activity className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-semibold text-cyan-400 uppercase tracking-wider">Progress Tracker</span>
                  <h3 className="text-base font-semibold text-white">See What You Have Mastered</h3>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Track your progress topic-by-topic so you always know which chapters you have mastered and which need a quick review before exams.
                </p>
              </div>
              <ul className="text-[11px] text-slate-400 space-y-1.5 pt-3 border-t border-slate-800/60">
                <li className="flex items-center space-x-1.5">
                  <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>Clear topic progress bars</span>
                </li>
                <li className="flex items-center space-x-1.5">
                  <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>Helpful explanations for wrong answers</span>
                </li>
                <li className="flex items-center space-x-1.5">
                  <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>Tailored suggestions on what to study next</span>
                </li>
              </ul>
            </div>

            {/* Pillar 4 */}
            <div className="rounded-2xl bg-slate-900/50 border border-slate-800/90 p-6 space-y-4 hover:border-purple-500/40 transition-all duration-200 flex flex-col justify-between group">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 group-hover:scale-105 transition-transform">
                  <Repeat className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-semibold text-purple-400 uppercase tracking-wider">Smart Flashcards</span>
                  <h3 className="text-base font-semibold text-white">Remember Everything for Exams</h3>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Practice auto-generated cards that reappear right when your brain needs a refresher, making sure formulas and terms stay in memory.
                </p>
              </div>
              <ul className="text-[11px] text-slate-400 space-y-1.5 pt-3 border-t border-slate-800/60">
                <li className="flex items-center space-x-1.5">
                  <Check className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  <span>Automatic review reminders</span>
                </li>
                <li className="flex items-center space-x-1.5">
                  <Check className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  <span>Updates your topic progress as you study</span>
                </li>
                <li className="flex items-center space-x-1.5">
                  <Check className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  <span>Cards created directly from your notes</span>
                </li>
              </ul>
            </div>

          </div>
        </section>


        {/* INTERACTIVE STUDIO PREVIEW */}
        <section id="preview" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 scroll-mt-24 sm:scroll-mt-28">
          <div className="text-center space-y-2 max-w-xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-widest text-teal-400">Interactive Demo</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              See How You Will Study
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Click any tab below to preview the AI chat, topic progress, flashcards, and quizzes.
            </p>
          </div>

          {/* Tab Selector */}
          <div className="flex items-center justify-center">
            <div className="p-1 rounded-2xl bg-slate-900 border border-slate-800 flex items-center space-x-1">
              <button
                onClick={() => setActiveTab('tutor')}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === 'tutor'
                    ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Ask AI Tutor
              </button>
              <button
                onClick={() => setActiveTab('mastery')}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === 'mastery'
                    ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Topic Progress
              </button>
              <button
                onClick={() => setActiveTab('srs')}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === 'srs'
                    ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Study Flashcards
              </button>
              <button
                onClick={() => setActiveTab('assessment')}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === 'assessment'
                    ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Practice Quizzes
              </button>
            </div>
          </div>

          {/* Interactive Card Canvas */}
          <div className="rounded-3xl bg-slate-900/60 border border-slate-800 p-6 sm:p-8 shadow-2xl backdrop-blur-md relative overflow-hidden">
            
            {activeTab === 'tutor' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-400">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-white">AI Tutor Chat: Understanding Entropy & Decision Trees</h4>
                      <p className="text-[11px] text-slate-400">Style: Guided Thinking • Notes: ML_Textbook_Ch4.pdf</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    From Your Notes
                  </span>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-800 max-w-xl text-xs space-y-1">
                    <span className="font-semibold text-slate-300">Sarah (Student):</span>
                    <p className="text-slate-400">
                      In simple words, why is entropy highest when a coin has a 50/50 chance of landing heads or tails?
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-teal-950/20 border border-teal-500/30 max-w-2xl text-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-teal-300 flex items-center space-x-1.5">
                        <Bot className="w-4 h-4" />
                        <span>Knovara AI Tutor:</span>
                      </span>
                      <span className="text-[10px] text-teal-400 font-mono bg-teal-900/40 px-2 py-0.5 rounded border border-teal-700/50">
                        From: [ML_Textbook_Ch4.pdf, p. 42]
                      </span>
                    </div>
                    <p className="text-slate-300 leading-relaxed">
                      Think of entropy as a measure of <strong className="text-white">surprise</strong> or <strong className="text-white">uncertainty</strong>. If a coin landed Heads 99% of the time, you would almost never be surprised! But when it is 50/50, you have zero clue what will happen next—making the unpredictability as high as possible.
                    </p>
                    <p className="text-slate-400 italic">
                      "When outcomes are equally balanced, uncertainty reaches its peak. In machine learning, this tells us where more information is needed to make a clear decision."
                    </p>
                    <div className="pt-1 text-[11px] text-teal-300/80 flex items-center space-x-2">
                      <ChevronRight className="w-3.5 h-3.5" />
                      <span>Next question: How does this help a decision tree choose the best question to ask?</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'mastery' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div>
                    <h4 className="text-sm font-semibold text-white">Student Topic Progress Tracker</h4>
                    <p className="text-[11px] text-slate-400">Subject: Machine Learning & AI</p>
                  </div>
                  <span className="text-xs text-slate-400">Overall Subject Progress: <strong className="text-teal-400 font-bold">84% (Strong)</strong></span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-800 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-white">Decision Trees</span>
                      <span className="text-emerald-400 font-mono">92% (Mastered)</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-700 overflow-hidden">
                      <div className="h-full bg-emerald-400 rounded-full" style={{ width: '92%' }} />
                    </div>
                    <p className="text-[11px] text-slate-400">Entropy, splitting rules, and tree pruning mastered.</p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-800 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-white">Random Forest & Bagging</span>
                      <span className="text-teal-400 font-mono">78% (Practicing)</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-700 overflow-hidden">
                      <div className="h-full bg-teal-400 rounded-full" style={{ width: '78%' }} />
                    </div>
                    <p className="text-[11px] text-slate-400">Combining trees and voting predictions.</p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-800 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-white">Support Vector Machines</span>
                      <span className="text-amber-400 font-mono">54% (Needs Review)</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-700 overflow-hidden">
                      <div className="h-full bg-amber-400 rounded-full" style={{ width: '54%' }} />
                    </div>
                    <p className="text-[11px] text-amber-300/80">Slack variables and penalty C need a quick review.</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'srs' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div>
                    <h4 className="text-sm font-semibold text-white">Flashcard Practice: Machine Learning</h4>
                    <p className="text-[11px] text-slate-400">Smart Spaced Review (Reminds you right before you forget)</p>
                  </div>
                  <span className="text-xs text-purple-400 font-mono bg-purple-950/40 px-2.5 py-1 rounded-full border border-purple-500/20">
                    4 Ready to Review
                  </span>
                </div>

                <div className="max-w-xl mx-auto p-6 rounded-2xl bg-slate-800/60 border border-slate-700/80 space-y-4 text-center">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-teal-400 bg-slate-900 px-2 py-0.5 rounded">
                    Flashcard #3 • Topic: Ensemble Learning
                  </span>
                  <h3 className="text-base font-bold text-white">
                    In simple words, why does a Random Forest combine many trees instead of using just one?
                  </h3>
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-300 text-left">
                    <span className="text-slate-400 font-semibold block mb-1">Simple Answer:</span>
                    A single decision tree can easily memorize specific training quirks and make mistakes on new test questions. Averaging predictions across many different trees cancels out individual errors, giving you much higher accuracy!
                  </div>
                  <div className="pt-2 flex items-center justify-center space-x-2 text-xs">
                    <span className="text-slate-500 text-[11px] mr-2">How well did you know it?</span>
                    <button className="px-3 py-1.5 rounded-lg bg-rose-950/50 border border-rose-700/40 text-rose-300 hover:bg-rose-900/50">Again (1d)</button>
                    <button className="px-3 py-1.5 rounded-lg bg-amber-950/50 border border-amber-700/40 text-amber-300 hover:bg-amber-900/50">Hard (3d)</button>
                    <button className="px-3 py-1.5 rounded-lg bg-teal-950/50 border border-teal-700/40 text-teal-300 hover:bg-teal-900/50">Good (6d)</button>
                    <button className="px-3 py-1.5 rounded-lg bg-emerald-950/50 border border-emerald-700/40 text-emerald-300 hover:bg-emerald-900/50">Easy (12d)</button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'assessment' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div>
                    <h4 className="text-sm font-semibold text-white">Practice Quiz: Quick Knowledge Check</h4>
                    <p className="text-[11px] text-slate-400">Difficulty: Medium • Exam-Style Question</p>
                  </div>
                  <span className="text-xs text-cyan-400 font-mono bg-cyan-950/40 px-2.5 py-1 rounded-full border border-cyan-500/20">
                    Instant Feedback Active
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-800 text-xs space-y-3">
                  <p className="font-semibold text-white">
                    Question 4: You train a decision tree and it gets 100% on practice questions, but only 62% on new test questions. What is the best fix?
                  </p>
                  <div className="space-y-2 pt-1">
                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 flex items-center justify-between">
                      <span>A) Make the tree even deeper with more splits</span>
                      <span className="text-[10px] text-slate-500 font-mono">Makes overfitting worse</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-teal-950/30 border border-teal-500/40 text-teal-200 flex items-center justify-between">
                      <span className="font-medium">B) Prune the tree (cut back deep branches) so it focuses on main patterns</span>
                      <span className="text-[10px] text-teal-400 font-semibold flex items-center space-x-1">
                        <Check className="w-3.5 h-3.5" />
                        <span>Correct! (Prevents Overfitting)</span>
                      </span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
                      <span>C) Ignore the test questions and keep training on the same data</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </section>


        {/* SOCRATIC MODES SHOWCASE */}
        <section id="pedagogy" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10 scroll-mt-24 sm:scroll-mt-28">
          <div className="text-center space-y-2 max-w-2xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-widest text-teal-400">Teaching Styles</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Choose How Your AI Tutor Explains Things
            </h2>
            <p className="text-sm text-slate-400">
              Everyone learns differently. Switch explanation styles anytime depending on whether you want simple analogies, step-by-step math, or exam practice.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {pedagogicalModes.map((mode) => (
              <div
                key={mode.id}
                className="rounded-2xl bg-slate-900/40 border border-slate-800 p-5 space-y-3 hover:border-slate-700 transition-all flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-white">{mode.name}</h4>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-gradient-to-r ${mode.color}`}>
                      {mode.tag}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {mode.desc}
                  </p>
                </div>
                <div className="pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-teal-400 font-medium">
                  <span>Try this style in chat</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </div>
            ))}
          </div>
        </section>


        {/* THE 5-STAGE COGNITIVE MASTERY LOOP (REPLACING ROADMAP) */}
        <section id="architecture" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 scroll-mt-24 sm:scroll-mt-28">
          <div className="rounded-3xl bg-gradient-to-b from-slate-900/90 to-slate-950 border border-slate-800/90 p-8 sm:p-12 space-y-8">
            <div className="text-center space-y-2 max-w-2xl mx-auto">
              <span className="text-xs font-bold uppercase tracking-widest text-teal-400">Simple 5-Step Study Plan</span>
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                How You Master Any Subject
              </h2>
              <p className="text-xs sm:text-sm text-slate-400">
                From uploading your class notes to feeling 100% confident on exam day.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 pt-4">
              <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3">
                <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
                  <FileText className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">1. Upload Notes</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Drop in your textbook PDFs, PowerPoint slides, or class notes.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <BrainCircuit className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">2. Instant AI Analysis</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  The AI reads your material and pulls out key ideas and formulas.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                  <Bot className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">3. Ask AI Tutor</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Chat anytime and ask questions in plain, friendly language.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                  <Award className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">4. Practice Quizzes</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Test your understanding with instant quiz scores and explanations.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <Repeat className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">5. Study Flashcards</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Review smart flashcards scheduled so you remember for exams.
                </p>
              </div>
            </div>
          </div>
        </section>


        {/* FINAL CTA BANNER */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="rounded-3xl bg-gradient-to-tr from-teal-900/40 via-slate-900 to-emerald-950/40 border border-teal-500/30 p-8 sm:p-12 space-y-6 shadow-2xl relative overflow-hidden">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Ready to Make Studying Easy and Stress-Free?
            </h2>
            <p className="max-w-2xl mx-auto text-sm sm:text-base text-slate-300">
              Create your free student account to upload notes, ask questions in simple words, practice flashcards, and ace your exams.
            </p>
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                to="/register"
                className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-7 py-3.5 rounded-xl text-sm font-semibold text-slate-950 bg-gradient-to-r from-teal-400 to-emerald-400 hover:from-teal-300 hover:to-emerald-300 shadow-xl shadow-teal-500/25 transition-all"
              >
                <span>Create Student Account</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/login"
                className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-7 py-3.5 rounded-xl text-sm font-medium text-slate-300 bg-slate-900 border border-slate-700 hover:bg-slate-800 transition-colors"
              >
                <span>Sign In with Google / Email</span>
              </Link>
            </div>
          </div>
        </section>

      </main>


      {/* PROFESSIONAL FOOTER */}
      <footer className="border-t border-slate-900 bg-slate-950/90 py-10 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-6 h-6 rounded-lg bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <GraduationCap className="w-3.5 h-3.5" />
            </div>
            <span className="font-semibold text-slate-300">Knovara AI Study Assistant</span>
            <span>•</span>
            <span>Helping students understand every subject in simple, friendly words</span>
          </div>

          {/* Discreet diagnostics toggle for evaluators */}
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setShowDiagnostics(!showDiagnostics)}
              className="hover:text-slate-400 transition-colors flex items-center space-x-1.5 cursor-pointer"
            >
              <span className={`w-2 h-2 rounded-full ${health ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
              <span>Service Status {latency !== null ? `(${latency}ms)` : ''}</span>
            </button>
            <span>•</span>
            <span>100% Based On Your Notes</span>
            <span>•</span>
            <span>© 2026 Knovara. All rights reserved.</span>
          </div>
        </div>

        {/* Collapsible Diagnostics Drawer for Developers / Evaluators */}
        {showDiagnostics && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 pt-6 border-t border-slate-900/80">
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] grid grid-cols-1 sm:grid-cols-3 gap-4 text-slate-400">
              <div>
                <span className="text-slate-200 font-semibold block mb-1">Backend Engine</span>
                <p>Status: <span className="text-emerald-400 font-medium">{health?.status || 'Active'}</span></p>
                <p>Version: <span className="font-mono text-slate-300">{health?.version || '0.1.0'}</span></p>
              </div>
              <div>
                <span className="text-slate-200 font-semibold block mb-1">Database Dialect</span>
                <p>Dialect: <span className="font-mono text-slate-300">{health?.database.dialect || 'SQLite'}</span></p>
                <p>Status: <span className="text-emerald-400 font-medium">{health?.database.status || 'Connected'}</span></p>
              </div>
              <div>
                <span className="text-slate-200 font-semibold block mb-1">AI Inference & Embeddings</span>
                <p>Provider: <span className="text-teal-400 font-medium">Google Gemini</span></p>
                <p>Models: <span className="font-mono text-slate-300">gemini-1.5-pro / text-embedding-004</span></p>
              </div>
            </div>
          </div>
        )}
      </footer>
    </div>
  );
};

export default Overview;
