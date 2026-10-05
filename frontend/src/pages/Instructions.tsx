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
  Printer
} from 'lucide-react';

export const Instructions: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [activeSection, setActiveSection] = useState<'workflow' | 'modes' | 'features' | 'memory'>('workflow');

  const steps = [
    {
      number: '01',
      title: 'Step 1: Upload Your Study Material',
      icon: UploadCloud,
      color: 'teal',
      summary: 'Upload your lecture slides, PDF textbook, class notes, or audio transcripts.',
      details: [
        'Click "Upload New Material" on your Dashboard or open any subject workspace.',
        'Upload your PDF books, PowerPoint presentations (.pptx), text notes, or lecture transcripts.',
        'Supports all subjects: Computer Science, Biology, Medicine, Physics, Mathematics, and Engineering.',
        'Every subject is kept in its own clean folder so your notes never get mixed up.'
      ]
    },
    {
      number: '02',
      title: 'Step 2: Instant AI Reading & Summary',
      icon: Sparkles,
      color: 'emerald',
      summary: 'The AI reads your material and explains the key ideas in simple words.',
      details: [
        'The moment you upload, the AI reads through your pages and notes automatically.',
        'It picks out the most important topics and writes short, easy-to-understand summaries.',
        'You can check your main concepts right on your workspace anytime.',
        'Add new notes or slides whenever you get new lectures from your teacher.'
      ]
    },
    {
      number: '03',
      title: 'Step 3: Ask AI Tutor (Answers in Simple Words)',
      icon: Bot,
      color: 'cyan',
      summary: 'Ask any question about your notes. The AI answers in clear, friendly language.',
      details: [
        'Open the "Ask AI Tutor" tab to chat with your friendly personal assistant.',
        'Ask anything: "Can you explain this in simple words?", "Give me an everyday example", or "Walk me through this step-by-step".',
        'Choose your favorite way of learning: Simple Analogy, Step-by-Step, Mistake Buster, or Exam Key Points.',
        'Every answer mentions the exact page from your notes so you can trust that it is 100% accurate.'
      ]
    },
    {
      number: '04',
      title: 'Step 4: Practice with Smart Flashcards',
      icon: Repeat,
      color: 'amber',
      summary: 'Review terms and formulas using cards made directly from your material.',
      details: [
        'Open the "Study Flashcards" tab to test your memory.',
        'Flashcards are created automatically from the sentences and ideas in your notes.',
        'Flip the card to see the simple answer, then rate how well you knew it: Again, Hard, Good, or Easy.',
        'Smart timing brings cards back right before you forget them, helping you remember for exam day.'
      ]
    },
    {
      number: '05',
      title: 'Step 5: Test Yourself with Quizzes & Mock Exams',
      icon: Award,
      color: 'purple',
      summary: 'Take practice quizzes or timed mock exams with clear, step-by-step explanations.',
      details: [
        'Take an untimed practice quiz to learn without pressure, or try a Timed Mock Exam with a real countdown clock.',
        'Use the question palette to jump between questions and flag tricky ones to review later.',
        'Get instant scores and clear explanations for any question you missed.',
        'See your progress improve as you practice and build real confidence.'
      ]
    }
  ];

  const modesGuide = [
    {
      name: 'Guided Thinking',
      tag: 'Think & Learn',
      badge: 'Default',
      purpose: 'Asks you simple, encouraging questions so you can figure out the answer on your own.',
      bestFor: 'Building confidence and truly understanding concepts rather than just memorizing answers.',
      example: '"Looking at the first heading in your notes, what do you think is the main goal here?"'
    },
    {
      name: 'Simple Everyday Analogy',
      tag: 'Easy to Picture',
      badge: 'Fun Examples',
      purpose: 'Explains tricky or difficult concepts using fun, everyday real-life examples.',
      bestFor: 'Making difficult topics easy to picture and remember.',
      example: '"Think of this concept like a GPS navigation system helping you reach a destination..."'
    },
    {
      name: 'Step-by-Step Guide',
      tag: 'Easy Steps',
      badge: 'Step-by-Step',
      purpose: 'Breaks complex formulas, algorithms, or problems down into small, easy steps.',
      bestFor: 'Math calculations, coding procedures, and tricky homework questions.',
      example: '"Let us solve this in 3 easy steps. Step 1: what numbers are we given in the problem?"'
    },
    {
      name: 'Common Mistakes & Tips',
      tag: 'Mistake Buster',
      badge: 'Trap Warning',
      purpose: 'Points out common student traps and misconceptions, showing you the easy way to remember correctly.',
      bestFor: 'Avoiding lost marks on tests and multiple-choice exams.',
      example: '"Many students confuse precision with recall. Here is a simple trick to never mix them up..."'
    },
    {
      name: 'Exam & Test Ready',
      tag: 'High Importance',
      badge: 'Exam Focus',
      purpose: 'Focuses strictly on the core definitions, formulas, and questions most likely to appear on your test.',
      bestFor: 'Quick revision before tests, midterms, and final exam day.',
      example: '"Here are the top 3 points your teacher is most likely to ask about this chapter on the exam."'
    },
    {
      name: 'Detailed Explanation',
      tag: 'In-Depth',
      badge: 'Thorough',
      purpose: 'Gives you a full, clear explanation with all the background, examples, and real-world uses.',
      bestFor: 'Course projects, assignments, and understanding the deeper theory.',
      example: '"Here is a clear look at how this technique is used by scientists and engineers in real life."'
    },
    {
      name: 'Quick 30-Sec Summary',
      tag: 'Rapid Recap',
      badge: 'Quick',
      purpose: 'Gives you 3 quick, punchy bullet points to review the main ideas in 30 seconds.',
      bestFor: 'Quickly refreshing your memory right before class starts.',
      example: '"Here is a 30-second summary with the 3 most important takeaways from your reading."'
    }
  ];

  const newFeatures = [
    {
      title: 'Interactive Concept Mind Map',
      icon: Network,
      tag: 'Visual Learning',
      color: 'teal',
      description: 'See how all your course concepts connect together in a visual network.',
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
      color: 'emerald',
      description: 'Export a clean, 1-page printable study guide ready for your final exam review.',
      benefits: [
        'Automatically highlights your high-priority weak spots that need attention first.',
        'Includes core definitions and key takeaways from your uploaded notes.',
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
              <span className="font-bold text-lg text-white">Knovara Student Guide</span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
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
            <span>Easy Student Guide</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
            How to Study and Learn with{' '}
            <span className="bg-gradient-to-r from-teal-400 via-emerald-400 to-cyan-300 bg-clip-text text-transparent">
              Knovara
            </span>
          </h1>
          <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
            A simple, friendly guide to help you upload your notes, ask questions in simple words, practice with smart flashcards, take quizzes, and master any subject easily.
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
              4. How It Helps You Remember
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
                Follow these 5 steps to turn your notes into knowledge you understand and remember for exams.
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
                <span>7 Friendly Ways the AI Explains Topics</span>
              </h2>
              <p className="text-xs text-slate-400">
                Choose the explanation style that works best for you. You can switch styles at any time while chatting.
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
                      <h3 className="text-base font-bold text-white">{m.name}</h3>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-300 border border-teal-500/20">
                        {m.badge}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed font-medium">
                      {m.purpose}
                    </p>
                    <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-1.5">
                      <span className="text-[10px] font-bold text-teal-400 uppercase tracking-wider block">When to Use This</span>
                      <p className="text-[11px] text-slate-400">{m.bestFor}</p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-800/60">
                    <span className="text-[10px] text-slate-500 block mb-1">Example Tutor Response:</span>
                    <p className="text-xs text-slate-300 italic font-serif">"{m.example}"</p>
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
                <span>Special Study Tools Made for Students</span>
              </h2>
              <p className="text-xs text-slate-400">
                These built-in features help you study faster, spot weak areas, and practice under real exam conditions.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-teal-500/10 text-teal-300 border border-teal-500/20">
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

        {/* TAB 4: HOW IT HELPS YOU REMEMBER */}
        {activeSection === 'memory' && (
          <section className="space-y-8 animate-in fade-in duration-200">
            <div className="text-left space-y-1">
              <h2 className="text-xl font-bold text-white flex items-center space-x-2">
                <BrainCircuit className="w-5 h-5 text-teal-400" />
                <span>How Knovara Helps You Remember (In Simple Words)</span>
              </h2>
              <p className="text-xs text-slate-400">
                How Knovara tracks your progress, prevents lucky guesses, and schedules review times so you remember for test day.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Progress & Knowledge Tracing */}
              <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-6 space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Smart Progress Tracking</h3>
                    <p className="text-xs text-slate-400">Knowing what you truly understand</p>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  Instead of just counting how many questions you got right, Knovara looks at whether you truly understand the concept or just made a lucky guess.
                </p>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-2.5 text-slate-300">
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-cyan-400 shrink-0">🎯 Mastery Score:</span>
                    <span>Shows how well you know each topic from 0% to 100%.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-cyan-400 shrink-0">🍀 Lucky Guess Filter:</span>
                    <span>If you guess an answer right by chance, Knovara asks another question later to make sure you truly know it.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-cyan-400 shrink-0">🔄 Careless Mistake Protection:</span>
                    <span>If you make a small slip on something you already know well, your score doesn't suddenly drop to zero.</span>
                  </div>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">
                  This gives you an honest, reliable view of your strengths so you walk into exams with genuine confidence.
                </p>
              </div>

              {/* Spaced Repetition Flashcard Engine */}
              <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-6 space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                    <Repeat className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Smart Review Timing (Spaced Memory)</h3>
                    <p className="text-xs text-slate-400">Locking knowledge into long-term memory</p>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  Our brains naturally forget new information within a few days unless we review it. Knovara schedules your reviews right before you're about to forget.
                </p>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-2.5 text-slate-300">
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-purple-400 shrink-0">Day 1:</span>
                    <span>First review right after reading the notes to form the memory.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-purple-400 shrink-0">Day 3 to 6:</span>
                    <span>Second review to strengthen the memory path in your brain.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-purple-400 shrink-0">2 to 4 Weeks:</span>
                    <span>Final refresh to lock the knowledge permanently into your long-term memory.</span>
                  </div>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">
                  Rating a card "Again" brings it back immediately so you can fix weak spots today, instead of discovering them on the exam paper.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Quick Start Callout */}
        <section className="rounded-3xl bg-gradient-to-r from-teal-950/40 via-slate-900 to-emerald-950/40 border border-teal-500/30 p-8 sm:p-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-left">
            <h3 className="text-xl sm:text-2xl font-bold text-white">Ready to Start Learning?</h3>
            <p className="text-xs sm:text-sm text-slate-400 max-w-xl">
              Upload your notes or slides, ask questions in simple words, and get ready to ace your tests with confidence.
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
