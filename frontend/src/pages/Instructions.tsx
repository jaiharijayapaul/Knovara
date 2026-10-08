import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { 
  GraduationCap, 
  ArrowLeft, 
  BookOpen, 
  UploadCloud, 
  BrainCircuit, 
  Sparkles, 
  Award, 
  Repeat, 
  Activity, 
  CheckCircle2, 
  HelpCircle, 
  Bot, 
  Target,
  Timer,
  Network,
  Printer,
  Shield,
  FileText,
  Users,
  ExternalLink
} from 'lucide-react';

const YouTubeIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

export const Instructions: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const [activeSection, setActiveSection] = useState<'workflow' | 'modes' | 'features' | 'memory' | 'admin'>('workflow');

  const steps = [
    {
      number: '01',
      title: 'Step 1: Upload Notes or Ingest YouTube Lectures',
      icon: UploadCloud,
      color: 'teal',
      summary: 'Upload textbooks, slides, or paste any educational YouTube lecture URL.',
      details: [
        'Upload your PDF textbooks, PowerPoint presentations (.pptx), markdown files, or text notes.',
        '🎥 YouTube Lecture Ingestion: Paste any video link (e.g., https://youtube.com/watch?v=...) into the dropzone to extract speech transcripts.',
        '🌐 Multilingual Video Auto-Translation: If the video is in Hindi, Spanish, French, German, Tamil, or any other language, Knovara automatically translates the lecture transcript into fluent academic English!',
        '⏱️ Clickable Timestamps: Every video concept is tagged with exact time ranges (e.g. [YouTube: 04:22 - 05:40]) allowing 1-click jumps directly to that second on YouTube.'
      ]
    },
    {
      number: '02',
      title: 'Step 2: Instant AI Reading & 1-Click Study Notes',
      icon: Sparkles,
      color: 'emerald',
      summary: 'The AI reads your material and synthesizes comprehensive study guides in simple English.',
      details: [
        'The moment you upload, the AI parses pages and video segments into high-dimensional vector embeddings.',
        '📝 1-Click AI Study Notes: Click "Generate AI Study Notes" on any file or lecture to synthesize a full markdown study guide with intuitive analogies and self-checks.',
        '📚 Course Master Guide: Click "Master Study Guide" to merge all chapters and video lectures into one comprehensive exam preparation handout.',
        '🇬🇧 Strictly in English: All notes, summaries, and key definitions are formulated in fluent, crystal-clear English regardless of the video source language.'
      ]
    },
    {
      number: '03',
      title: 'Step 3: Ask Socratic AI Tutor (Source Grounded)',
      icon: Bot,
      color: 'cyan',
      summary: 'Ask any question about your notes. The AI answers clearly with exact page and video citations.',
      details: [
        'Open the "Ask AI Tutor" tab to chat with your friendly personal study assistant.',
        'Ask anything: "Explain gradient descent simply", "Give me a real-world analogy", or "Walk me through this formula step-by-step".',
        'Choose from 7 teaching styles: Guided Thinking (Socratic), Everyday Analogy, First Principles, Mistake Buster, Exam Prep, Deep Dive, or Quick 30-Sec Summary.',
        'Every answer cites exact page numbers or video timestamps so you can verify that it is 100% grounded in your syllabus.'
      ]
    },
    {
      number: '04',
      title: 'Step 4: Practice with Spaced Repetition Flashcards',
      icon: Repeat,
      color: 'amber',
      summary: 'Review terms and formulas using cards made directly from your material.',
      details: [
        'Open the "Study Flashcards" tab to test your cognitive recall.',
        'Flashcards are created automatically from the core definitions, formulas, and concepts in your notes.',
        'Flip the card to see the simple answer, then rate your recall: Again, Hard, Good, or Easy.',
        'SuperMemo SM-2 Algorithm: Automatically computes optimal repetition intervals to schedule cards right before you forget them.'
      ]
    },
    {
      number: '05',
      title: 'Step 5: Test Yourself with Adaptive Quizzes & Mock Exams',
      icon: Award,
      color: 'purple',
      summary: 'Take practice quizzes or timed mock exams with instant misconception explanations.',
      details: [
        'Take an untimed practice quiz to learn without pressure, or try a Timed Mock Exam with a real countdown clock.',
        'Adaptive Blueprints: Quizzes automatically target your weakest concepts discovered during previous practice sessions.',
        'Misconception Feedback: When you miss a question, get an instant explanation explaining the specific trap you fell into.',
        'Question Palette & Review: Jump between questions and flag tricky items to double-check before final submission.'
      ]
    }
  ];

  const modesGuide = [
    {
      name: 'Guided Thinking (Socratic)',
      tag: 'Think & Learn',
      badge: 'Default',
      purpose: 'Gives the direct answer first, then asks an encouraging question to help you connect ideas.',
      bestFor: 'Building deep conceptual understanding rather than surface-level memorization.',
      example: '"Supervised learning uses labeled inputs. Considering this, how would the model know if its prediction was right or wrong?"'
    },
    {
      name: 'Simple Everyday Analogy',
      tag: 'Easy to Picture',
      badge: 'Fun Examples',
      purpose: 'Explains tricky or difficult concepts using fun, everyday real-life examples.',
      bestFor: 'Making abstract math, science, and coding concepts intuitive and easy to picture.',
      example: '"Think of backpropagation like a coach reviewing game tape and showing each player exactly where to adjust their position."'
    },
    {
      name: 'Step-by-Step Guide',
      tag: 'Easy Steps',
      badge: 'Step-by-Step',
      purpose: 'Breaks complex formulas, algorithms, or problems down into small, bite-sized steps.',
      bestFor: 'Math derivations, coding procedures, and multi-step homework problems.',
      example: '"Let us calculate this in 3 easy steps. Step 1: calculate the error difference between target and prediction."'
    },
    {
      name: 'Common Mistakes & Tips',
      tag: 'Mistake Buster',
      badge: 'Trap Warning',
      purpose: 'Points out common student traps and misconceptions, showing you the easy way to remember correctly.',
      bestFor: 'Avoiding lost marks on multiple-choice quizzes and tricky exam questions.',
      example: '"Trap: Students often confuse precision with recall. Remember: Precision cares about quality, Recall cares about finding everyone."'
    },
    {
      name: 'Exam & Test Ready',
      tag: 'High Importance',
      badge: 'Exam Focus',
      purpose: 'Focuses strictly on the core definitions, formulas, and questions most likely to appear on your test.',
      bestFor: 'High-yield revision right before midterms, unit tests, and final exams.',
      example: '"Here are the 3 points your professor is most likely to test from this lecture."'
    },
    {
      name: 'Detailed Explanation',
      tag: 'In-Depth',
      badge: 'Thorough',
      purpose: 'Gives you a full, clear explanation with theoretical background, nuances, and real-world applications.',
      bestFor: 'Course projects, research papers, and developing mastery of complex subjects.',
      example: '"Here is a complete breakdown of how this architecture is implemented in production systems."'
    },
    {
      name: 'Quick 30-Sec Summary',
      tag: 'Rapid Recap',
      badge: 'Quick',
      purpose: 'Gives you 3 quick, punchy bullet points to review the main ideas in 30 seconds.',
      bestFor: 'Quickly refreshing your memory right before class starts.',
      example: '"Here is a 30-second summary with the 3 most essential takeaways from your reading."'
    }
  ];

  const newFeatures = [
    {
      title: 'Multilingual YouTube Ingestion & Auto-Translation',
      icon: YouTubeIcon,
      tag: 'Global Lectures',
      color: 'red',
      description: 'Ingest any YouTube lecture video in any language with automatic translation into clear English.',
      benefits: [
        'Paste any educational YouTube URL into your course workspace.',
        'Automatically extracts captions in English, Hindi, Spanish, French, German, Tamil, etc.',
        'Non-English lectures are automatically translated into clear, fluent English while preserving exact timestamps.',
        'Interactive timestamp badges [YouTube: 04:22 - 05:40] let you jump straight to the video with 1 click.'
      ]
    },
    {
      title: '1-Click AI Study Notes & Master Guide',
      icon: FileText,
      tag: 'Study Materials',
      color: 'emerald',
      description: 'Synthesize beautiful, comprehensive study notes from any document or lecture video.',
      benefits: [
        'Click "Generate AI Study Notes" on any uploaded document or ingested video.',
        'Organized into 6 clear sections: Big Picture, Core Concepts, Key Facts/Formulas, Exam Takeaways, Traps, and Self-Tests.',
        'Click "Master Study Guide" to synthesize a complete course-wide review sheet in one click.',
        'All synthesized notes are formulated strictly in fluent, easy-to-understand English.'
      ]
    },
    {
      title: 'Interactive Concept Mind Map',
      icon: Network,
      tag: 'Visual Learning',
      color: 'teal',
      description: 'See how all your course concepts connect together in an interactive visual network.',
      benefits: [
        'Green circles mean you have mastered that concept.',
        'Yellow circles show topics you are currently learning.',
        'Red circles show weak topics that need a quick review.',
        'Click any circle to ask the AI Tutor questions or practice quiz questions on that topic.'
      ]
    },
    {
      title: 'One-Click Exam Revision Sheet',
      icon: Printer,
      tag: 'Print & PDF',
      color: 'cyan',
      description: 'Export a clean, printable study handout ready for your final exam review.',
      benefits: [
        'Automatically highlights your high-priority weak spots that need attention first.',
        'Includes core definitions, key formulas, and exam takeaways from your syllabus.',
        'Includes high-yield quick Q&As with a button to hide/show answers for self-testing.',
        'Click "Print / Save PDF" to get a clean white handout with no dark backgrounds.'
      ]
    },
    {
      title: 'Timed Mock Exam Mode',
      icon: Timer,
      tag: 'Real Exam Test',
      color: 'amber',
      description: 'Practice answering questions under real exam time limits.',
      benefits: [
        'Live countdown timer shows exactly how many minutes and seconds you have left.',
        'Friendly color alerts turn amber under 2 minutes and red under 60 seconds.',
        'Question palette lets you jump directly to any question with one click.',
        'Use the "Flag for Review" button to mark tricky questions and revisit them before submitting.'
      ]
    },
    {
      title: 'Admin Command Center & Role Control',
      icon: Shield,
      tag: 'Educator & Admin',
      color: 'purple',
      description: 'Comprehensive administrative dashboard for educators and platform managers.',
      benefits: [
        'Access the dedicated /admin panel to manage all user accounts and system status.',
        'Role-Based Access Control (RBAC): Seamlessly assign Student, Instructor, or Admin roles.',
        'Audit courses, documents, quizzes, and chunk storage across all users.',
        'Monitor database health, server latency, and AI service status in real-time.'
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-teal-500 selection:text-white">
      {/* Top Navigation */}
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link
              to={isAuthenticated ? "/dashboard" : "/"}
              className="flex items-center space-x-2 text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-xs font-semibold">Back to {isAuthenticated ? 'Dashboard' : 'Home'}</span>
            </Link>
            <div className="h-4 w-px bg-slate-800 hidden sm:block" />
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center shadow-md shadow-teal-500/20">
                <GraduationCap className="w-4 h-4 text-slate-950 stroke-[2.5]" />
              </div>
              <span className="font-bold text-lg text-white">Knovara Learning Guide</span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {user?.role === 'admin' && (
              <Link
                to="/admin"
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-purple-300 bg-purple-950/50 border border-purple-500/30 hover:bg-purple-900/40 transition-all"
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Admin Hub</span>
              </Link>
            )}
            {isAuthenticated ? (
              <Link
                to="/courses"
                className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-950 bg-gradient-to-r from-teal-400 to-emerald-400 hover:from-teal-300 hover:to-emerald-300 shadow-md shadow-teal-500/20 transition-all"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Open My Subjects</span>
              </Link>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-950 bg-gradient-to-r from-teal-400 to-emerald-400 hover:from-teal-300 hover:to-emerald-300 shadow-md shadow-teal-500/20 transition-all"
              >
                <span>Sign In to Start</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Guide Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
        
        {/* Hero Banner in Simple Words */}
        <section className="text-center space-y-4 max-w-3xl mx-auto pt-4">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-xs font-medium text-teal-300">
            <HelpCircle className="w-3.5 h-3.5 text-teal-400" />
            <span>Complete Student & Educator Guide</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
            How to Learn, Practice & Master with{' '}
            <span className="bg-gradient-to-r from-teal-400 via-emerald-400 to-cyan-300 bg-clip-text text-transparent">
              Knovara
            </span>
          </h1>
          <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
            Your end-to-end handbook: upload notes, ingest multilingual YouTube lectures with auto-translation, chat with the Socratic AI tutor in English, study smart flashcards, track mastery, and ace your exams.
          </p>
        </section>

        {/* Section Navigation Tabs */}
        <div className="flex items-center justify-center border-b border-slate-800 pb-4">
          <div className="p-1 rounded-2xl bg-slate-900 border border-slate-800 flex items-center space-x-1 flex-wrap justify-center gap-1">
            <button
              onClick={() => setActiveSection('workflow')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeSection === 'workflow'
                  ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              1. 5-Step Study Plan
            </button>
            <button
              onClick={() => setActiveSection('modes')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeSection === 'modes'
                  ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              2. How AI Explains Things
            </button>
            <button
              onClick={() => setActiveSection('features')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeSection === 'features'
                  ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              3. Study Tools & Features
            </button>
            <button
              onClick={() => setActiveSection('memory')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeSection === 'memory'
                  ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              4. Science of Memory & BKT
            </button>
            <button
              onClick={() => setActiveSection('admin')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeSection === 'admin'
                  ? 'bg-purple-500 text-white shadow-md shadow-purple-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              5. Admin & Educator Hub
            </button>
          </div>
        </div>

        {/* TAB 1: 5-STEP STUDY PLAN */}
        {activeSection === 'workflow' && (
          <section className="space-y-8 animate-in fade-in duration-200">
            <div className="text-left space-y-1">
              <h2 className="text-xl font-bold text-white flex items-center space-x-2">
                <Target className="w-5 h-5 text-teal-400" />
                <span>The 5 Simple Steps to Master Any Subject</span>
              </h2>
              <p className="text-xs text-slate-400">
                Follow these 5 steps to turn your notes and lecture videos into permanent knowledge you understand and remember for exams.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {steps.map((step) => {
                const Icon = step.icon;
                return (
                  <div
                    key={step.number}
                    className="rounded-2xl bg-slate-900/60 border border-slate-800 p-6 space-y-4 hover:border-teal-500/30 transition-all flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
                          <Icon className="w-5 h-5" />
                        </div>
                        <span className="font-mono text-2xl font-black text-slate-700">{step.number}</span>
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-white">{step.title}</h3>
                        <p className="text-xs text-teal-400 mt-0.5">{step.summary}</p>
                      </div>
                      <ul className="text-xs text-slate-400 space-y-2 pt-2 border-t border-slate-800/80">
                        {step.details.map((detail, idx) => (
                          <li key={idx} className="flex items-start space-x-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 shrink-0 mt-0.5" />
                            <span className="leading-relaxed">{detail}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* TAB 2: HOW AI EXPLAINS THINGS */}
        {activeSection === 'modes' && (
          <section className="space-y-8 animate-in fade-in duration-200">
            <div className="text-left space-y-1">
              <h2 className="text-xl font-bold text-white flex items-center space-x-2">
                <Bot className="w-5 h-5 text-teal-400" />
                <span>7 Friendly Ways the AI Explains Topics (Strictly in English)</span>
              </h2>
              <p className="text-xs text-slate-400">
                Choose the explanation style that fits your learning goal. You can switch styles at any time in the Ask AI Tutor tab.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {modesGuide.map((m, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl bg-slate-900/60 border border-slate-800 p-6 space-y-4 hover:border-slate-700 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-1 rounded-full bg-slate-800 text-[11px] font-semibold text-teal-300">
                        {m.badge}
                      </span>
                      <span className="text-[11px] font-mono text-slate-500">{m.tag}</span>
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">{m.name}</h3>
                      <p className="text-xs text-slate-300 mt-1 leading-relaxed">{m.purpose}</p>
                    </div>
                    <div className="pt-2 border-t border-slate-800/80 space-y-2 text-xs">
                      <div>
                        <span className="text-[11px] font-semibold text-slate-400 block mb-0.5">Best When:</span>
                        <p className="text-slate-300 text-xs">{m.bestFor}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 italic text-slate-400 text-[11px] leading-relaxed">
                        {m.example}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* TAB 3: STUDY TOOLS & FEATURES */}
        {activeSection === 'features' && (
          <section className="space-y-8 animate-in fade-in duration-200">
            <div className="text-left space-y-1">
              <h2 className="text-xl font-bold text-white flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-teal-400" />
                <span>Core Study Tools & Platform Capabilities</span>
              </h2>
              <p className="text-xs text-slate-400">
                Explore the built-in learning features designed to help you prepare for exams faster and more effectively.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {newFeatures.map((feat, idx) => {
                const Icon = feat.icon;
                return (
                  <div
                    key={idx}
                    className="rounded-2xl bg-slate-900/60 border border-slate-800 p-6 space-y-4 hover:border-teal-500/30 transition-all flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
                          <Icon className="w-5 h-5" />
                        </div>
                        <span className="px-2.5 py-1 rounded-full bg-slate-800 text-[11px] font-semibold text-slate-300">
                          {feat.tag}
                        </span>
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-white">{feat.title}</h3>
                        <p className="text-xs text-slate-300 mt-1 leading-relaxed">{feat.description}</p>
                      </div>
                      <ul className="text-xs text-slate-400 space-y-2 pt-2 border-t border-slate-800/80">
                        {feat.benefits.map((b, bIdx) => (
                          <li key={bIdx} className="flex items-start space-x-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 shrink-0 mt-0.5" />
                            <span className="leading-relaxed">{b}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* TAB 4: HOW IT HELPS YOU REMEMBER & BKT */}
        {activeSection === 'memory' && (
          <section className="space-y-8 animate-in fade-in duration-200">
            <div className="text-left space-y-1">
              <h2 className="text-xl font-bold text-white flex items-center space-x-2">
                <BrainCircuit className="w-5 h-5 text-teal-400" />
                <span>The Cognitive Science Behind Knovara</span>
              </h2>
              <p className="text-xs text-slate-400">
                How Bayesian Knowledge Tracing (BKT) and Spaced Repetition guarantee long-term retention.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Bayesian Knowledge Tracing */}
              <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-6 space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Bayesian Knowledge Tracing (BKT)</h3>
                    <p className="text-xs text-slate-400">Probabilistic latent mastery modeling</p>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  Unlike traditional platforms that simply count correct answers, Knovara models your internal understanding using 4 cognitive parameters per concept:
                </p>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-2.5 text-slate-300 font-mono">
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-cyan-400 shrink-0">P(L₀):</span>
                    <span className="font-sans text-slate-300">Initial mastery prior before any question is answered.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-cyan-400 shrink-0">P(T):</span>
                    <span className="font-sans text-slate-300">Transition probability — likelihood of learning a topic after practice.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-cyan-400 shrink-0">P(G):</span>
                    <span className="font-sans text-slate-300">Guess parameter — filters out lucky guesses so your score reflects genuine knowledge.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-cyan-400 shrink-0">P(S):</span>
                    <span className="font-sans text-slate-300">Slip parameter — prevents a single careless mistake from resetting a mastered topic.</span>
                  </div>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">
                  Whenever you submit a quiz answer, Knovara computes the posterior probability <span className="font-mono text-cyan-300">P(L_t)</span> to accurately map your concept mastery from 0% to 100%.
                </p>
              </div>

              {/* Spaced Repetition Flashcard Engine */}
              <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-6 space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                    <Repeat className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">SuperMemo SM-2 Spaced Repetition</h3>
                    <p className="text-xs text-slate-400">Beating the Ebbinghaus Forgetting Curve</p>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  Our brains naturally forget newly learned facts within days unless reinforced. Knovara schedules reviews at the mathematically optimal point of decay:
                </p>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-2.5 text-slate-300">
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-purple-400 shrink-0">Repetition 1:</span>
                    <span>1 day interval after first learning the concept.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-purple-400 shrink-0">Repetition 2:</span>
                    <span>6 days interval to solidify memory consolidation.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-purple-400 shrink-0">Repetition 3+:</span>
                    <span>Dynamically scaled by your Easiness Factor (EF) rating (Again, Hard, Good, Easy).</span>
                  </div>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">
                  Rating a card "Again" immediately drops its interval to review today, ensuring you fix gaps before test day.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* TAB 5: ADMIN & EDUCATOR HUB */}
        {activeSection === 'admin' && (
          <section className="space-y-8 animate-in fade-in duration-200">
            <div className="text-left space-y-1">
              <h2 className="text-xl font-bold text-white flex items-center space-x-2">
                <Shield className="w-5 h-5 text-purple-400" />
                <span>Admin Command Center & Institutional Management</span>
              </h2>
              <p className="text-xs text-slate-400">
                Institutional controls for teachers, school administrators, and system managers to oversee users and learning assets.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* User & Role Management */}
              <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-6 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                  <Users className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">User Accounts & RBAC</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  View all registered student and teacher profiles. Search by name or email, inspect account creation dates, and elevate permissions between:
                </p>
                <div className="space-y-1.5 text-xs text-slate-400 pt-2 border-t border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-bold text-emerald-300">student</span>
                    <span>Standard access to workspaces, tutor, and flashcards.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-bold text-blue-300">instructor</span>
                    <span>Can author courses, inspect syllabus coverage, and review class analytics.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-bold text-purple-300">admin</span>
                    <span>Full privileges to manage users, system database, and server endpoints.</span>
                  </div>
                </div>
              </div>

              {/* Course & Document Control */}
              <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-6 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
                  <BookOpen className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">Course & Document Audit</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Comprehensive audit oversight across all active learning spaces:
                </p>
                <ul className="space-y-2 text-xs text-slate-400 pt-2 border-t border-slate-800">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 shrink-0 mt-0.5" />
                    <span>Audit courses created across all subjects and departments.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 shrink-0 mt-0.5" />
                    <span>Inspect uploaded PDFs, PPTX slides, and ingested YouTube videos.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 shrink-0 mt-0.5" />
                    <span>Review semantic chunk counts, vector indexing status, and quiz generations.</span>
                  </li>
                </ul>
              </div>

              {/* System & Infrastructure Health */}
              <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-6 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Activity className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">Infrastructure Status</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Live health monitoring for the entire Knovara production deployment:
                </p>
                <ul className="space-y-2 text-xs text-slate-400 pt-2 border-t border-slate-800">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>PostgreSQL Database connectivity & connection pool latency.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Google Gemini 2.5 Flash API connectivity and rate limits.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>FastAPI Render backend and Vercel edge proxy performance.</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-purple-950/30 border border-purple-500/30 flex items-center justify-between flex-wrap gap-4">
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Shield className="w-4 h-4 text-purple-400" />
                  <span>How to Access the Admin Dashboard</span>
                </h4>
                <p className="text-xs text-slate-300">
                  If your account has been granted the <span className="font-bold text-purple-300">admin</span> role, you can access the command center at <span className="font-mono text-purple-300">/admin</span> or via the top navigation badge.
                </p>
              </div>
              <Link
                to="/admin"
                className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 shadow-md shadow-purple-600/30 transition-all"
              >
                <span>Launch Admin Command Center</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          </section>
        )}

        {/* Quick Start Callout */}
        <section className="rounded-3xl bg-gradient-to-r from-teal-950/40 via-slate-900 to-emerald-950/40 border border-teal-500/30 p-8 sm:p-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-left">
            <h3 className="text-xl sm:text-2xl font-bold text-white">Ready to Start Learning?</h3>
            <p className="text-xs sm:text-sm text-slate-400 max-w-xl">
              Upload your notes, paste lecture videos, ask questions in simple words, and get ready to ace your tests with confidence.
            </p>
          </div>
          <div className="flex items-center space-x-3 shrink-0">
            {isAuthenticated ? (
              <Link
                to="/courses"
                className="px-6 py-3 rounded-xl text-xs font-semibold text-slate-950 bg-gradient-to-r from-teal-400 to-emerald-400 hover:from-teal-300 hover:to-emerald-300 shadow-md shadow-teal-500/20 transition-all cursor-pointer"
              >
                Go to My Subjects
              </Link>
            ) : (
              <Link
                to="/register"
                className="px-6 py-3 rounded-xl text-xs font-semibold text-slate-950 bg-gradient-to-r from-teal-400 to-emerald-400 hover:from-teal-300 hover:to-emerald-300 shadow-md shadow-teal-500/20 transition-all cursor-pointer"
              >
                Create Free Account
              </Link>
            )}
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500">
        <p>Knovara — Your friendly AI study partner. Upload notes, learn in simple words, and master your subjects.</p>
      </footer>
    </div>
  );
};

export default Instructions;
