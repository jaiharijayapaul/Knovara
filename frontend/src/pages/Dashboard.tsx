import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchCourses, createCourse } from '@/services/api';
import type { Course, CourseCreatePayload } from '@/types/course';
import { 
  GraduationCap, 
  LogOut, 
  BookOpen, 
  Sparkles, 
  PlusCircle, 
  User, 
  Loader2, 
  HelpCircle, 
  UploadCloud, 
  ArrowRight, 
  FileText, 
  X
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Quick subject creation modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectCategory, setNewSubjectCategory] = useState('Computer Science');
  const [newSubjectDescription, setNewSubjectDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const loadCourses = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchCourses();
      setCourses(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjectName.trim()) return;

    setIsCreating(true);
    setCreateError(null);
    try {
      const payload: CourseCreatePayload = {
        name: newSubjectName.trim(),
        subject: newSubjectCategory.trim(),
        description: newSubjectDescription.trim() || 'Uploaded study materials and notes',
      };
      const created = await createCourse(payload);
      setIsModalOpen(false);
      setNewSubjectName('');
      setNewSubjectDescription('');
      // Navigate directly into the new subject workspace to upload materials immediately!
      navigate(`/courses/${created.id}`);
    } catch {
      setCreateError('Could not create study subject. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };



  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-teal-500 selection:text-white">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          <div className="flex items-center space-x-3">
            <Link to="/dashboard" className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center shadow-lg shadow-teal-500/20">
                <GraduationCap className="w-6 h-6 text-slate-950 stroke-[2.5]" />
              </div>
              <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-white via-slate-200 to-teal-400 bg-clip-text text-transparent">
                Knovara
              </span>
            </Link>
            <span className="hidden sm:inline-flex ml-2 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20">
              AI Study Hub
            </span>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center space-x-2 text-xs font-medium text-slate-300">
            <span className="px-3 py-1.5 rounded-lg bg-slate-800 text-teal-400 font-semibold cursor-default">
              My Study Hub
            </span>
            <Link to="/courses" className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors">
              All Subjects
            </Link>
            <Link to="/instructions" className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors flex items-center space-x-1">
              <HelpCircle className="w-3.5 h-3.5 text-teal-400" />
              <span>How It Works</span>
            </Link>
          </nav>

          {/* User Controls */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs">
              <div className="w-6 h-6 rounded-full bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-400">
                <User className="w-3.5 h-3.5" />
              </div>
              <span className="font-medium text-slate-200 max-w-[120px] truncate">{user?.name}</span>
            </div>

            <button
              onClick={logout}
              title="Sign Out"
              className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 border border-slate-700/50 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

        </div>
      </header>

      {/* Main Dashboard Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Welcome & Step 1 Hero Banner */}
        <section className="rounded-3xl bg-gradient-to-br from-teal-950/60 via-slate-900 to-slate-900 border border-teal-500/30 p-6 sm:p-8 relative overflow-hidden shadow-2xl">
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/30 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Simple, Personalized AI Learning</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                Hello, <span className="text-teal-400">{user?.name}</span>! Ready to study?
              </h1>
              <p className="text-sm text-slate-300 leading-relaxed">
                Upload your notes, textbook chapters, or lecture slides. Your AI tutor will instantly read them, 
                explain concepts in simple words, and create practice flashcards and quizzes for you.
              </p>
            </div>

            <div className="flex-shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <button
                onClick={() => setIsModalOpen(true)}
                className="px-6 py-3 rounded-2xl text-xs font-bold text-slate-950 bg-gradient-to-r from-teal-400 to-emerald-400 hover:from-teal-300 hover:to-emerald-300 transition-all shadow-lg shadow-teal-500/20 flex items-center justify-center space-x-2 cursor-pointer"
              >
                <UploadCloud className="w-4 h-4 text-slate-950" />
                <span>Upload New Notes / Material</span>
              </button>
              <Link
                to="/instructions"
                className="px-5 py-3 rounded-2xl text-xs font-semibold text-slate-300 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/80 transition-colors flex items-center justify-center space-x-1.5"
              >
                <HelpCircle className="w-4 h-4 text-teal-400" />
                <span>View Guide</span>
              </Link>
            </div>
          </div>

          {/* 4-Step Learning Concept Flow Bar */}
          <div className="mt-8 pt-6 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-3.5 rounded-2xl bg-slate-950/40 border border-slate-800/80 flex items-center space-x-3">
              <div className="w-8 h-8 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/30 flex items-center justify-center font-bold text-sm">
                1
              </div>
              <div>
                <p className="text-xs font-bold text-white">Upload Material</p>
                <p className="text-[11px] text-slate-400">PDF, slides, doc, or notes</p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/40 border border-slate-800/80 flex items-center space-x-3">
              <div className="w-8 h-8 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/30 flex items-center justify-center font-bold text-sm">
                2
              </div>
              <div>
                <p className="text-xs font-bold text-white">AI Content Analysis</p>
                <p className="text-[11px] text-slate-400">Key topics & summary prepared</p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/40 border border-slate-800/80 flex items-center space-x-3">
              <div className="w-8 h-8 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/30 flex items-center justify-center font-bold text-sm">
                3
              </div>
              <div>
                <p className="text-xs font-bold text-white">Ask AI Tutor (Q&A)</p>
                <p className="text-[11px] text-slate-400">Simple words & analogies</p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/40 border border-slate-800/80 flex items-center space-x-3">
              <div className="w-8 h-8 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/30 flex items-center justify-center font-bold text-sm">
                4
              </div>
              <div>
                <p className="text-xs font-bold text-white">Cards & Quiz Practice</p>
                <p className="text-[11px] text-slate-400">Flashcards & instant feedback</p>
              </div>
            </div>
          </div>
        </section>

        {/* Study Subjects Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center space-x-2.5">
              <BookOpen className="w-5 h-5 text-teal-400" />
              <span>Your Study Subjects</span>
            </h2>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setIsModalOpen(true)}
                className="text-xs font-semibold text-teal-400 hover:text-teal-300 flex items-center space-x-1 cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Add Subject</span>
              </button>
            </div>
          </div>

          {loading ? (
            <div className="py-16 text-center text-xs text-slate-400 flex items-center justify-center space-x-2">
              <Loader2 className="w-5 h-5 animate-spin text-teal-400" />
              <span>Loading your study subjects...</span>
            </div>
          ) : courses.length === 0 ? (
            <div className="p-10 rounded-3xl border-2 border-dashed border-slate-800 bg-slate-900/30 text-center space-y-4 max-w-xl mx-auto">
              <div className="w-14 h-14 rounded-2xl bg-teal-500/10 text-teal-400 border border-teal-500/30 flex items-center justify-center mx-auto">
                <UploadCloud className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">No study materials uploaded yet</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Start by uploading your notes, lecture slides, or textbook chapter. The AI will immediately analyze it and guide you.
                </p>
              </div>
              <div className="flex items-center justify-center">
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="inline-flex items-center space-x-2 px-6 py-3 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-teal-400 to-emerald-400 hover:from-teal-300 hover:to-emerald-300 transition-all cursor-pointer shadow-lg shadow-teal-500/20"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>Upload Your Study Notes</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {courses.map((course) => (
                <div
                  key={course.id}
                  className="rounded-3xl bg-slate-900/60 border border-slate-800 hover:border-teal-500/40 p-6 flex flex-col justify-between space-y-5 transition-all shadow-lg hover:shadow-teal-500/5 group"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-teal-500/10 text-teal-300 border border-teal-500/20">
                        {course.subject || 'Study Subject'}
                      </span>
                      <span className="text-xs text-slate-400 flex items-center space-x-1">
                        <FileText className="w-3.5 h-3.5 text-teal-400" />
                        <span>{course.documents_count} Files</span>
                      </span>
                    </div>

                    <div>
                      <h3 className="font-extrabold text-white text-lg group-hover:text-teal-300 transition-colors">
                        {course.name}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                        {course.description || 'Uploaded course materials and notes ready for study.'}
                      </p>
                    </div>

                    <div className="flex items-center space-x-2 text-[11px] text-slate-400 pt-1">
                      <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-medium">
                        {course.topics_count} Key Topics
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 font-medium">
                        AI Ready
                      </span>
                    </div>
                  </div>

                  {/* Direct 1-Click Action Buttons */}
                  <div className="pt-3 border-t border-slate-800/80 space-y-2">
                    <Link
                      to={`/courses/${course.id}`}
                      className="w-full py-2.5 px-3 rounded-xl bg-teal-400 hover:bg-teal-300 text-slate-950 font-bold text-xs flex items-center justify-center space-x-2 transition-all shadow-md shadow-teal-500/10"
                    >
                      <span>Open Study Room</span>
                      <ArrowRight className="w-4 h-4" />
                    </Link>

                    <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                      <Link
                        to={`/courses/${course.id}?tab=tutor`}
                        className="py-1.5 px-2 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 text-center truncate font-medium transition-colors"
                        title="Ask AI Questions"
                      >
                        💬 Ask AI
                      </Link>
                      <Link
                        to={`/courses/${course.id}?tab=flashcards`}
                        className="py-1.5 px-2 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 text-center truncate font-medium transition-colors"
                        title="Study Flashcards"
                      >
                        🗂️ Cards
                      </Link>
                      <Link
                        to={`/courses/${course.id}?tab=assessments`}
                        className="py-1.5 px-2 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 text-center truncate font-medium transition-colors"
                        title="Take Practice Quiz"
                      >
                        📝 Quiz
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </main>

      {/* Quick Subject Creation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">New Study Subject</h3>
                  <p className="text-xs text-slate-400">Step 1: Name your subject, then upload notes</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {createError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                {createError}
              </div>
            )}



            <form onSubmit={handleCreateSubject} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Subject / Chapter Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Biology - Cell Structure, Economics 101, History Ch 4"
                  value={newSubjectName}
                  onChange={(e) => setNewSubjectName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-teal-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Category
                </label>
                <select
                  value={newSubjectCategory}
                  onChange={(e) => setNewSubjectCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-white text-xs focus:outline-none focus:border-teal-400"
                >
                  <option value="Science">Science & Medicine</option>
                  <option value="Computer Science">Computer Science & Engineering</option>
                  <option value="Mathematics">Mathematics & Statistics</option>
                  <option value="Business">Business & Economics</option>
                  <option value="Humanities">Humanities & Social Sciences</option>
                  <option value="General">General / Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Notes / Description (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Midterm exam chapters, lecture slides"
                  value={newSubjectDescription}
                  onChange={(e) => setNewSubjectDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-teal-400"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating || !newSubjectName.trim()}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-teal-400 hover:bg-teal-300 disabled:opacity-50 transition-colors flex items-center space-x-1.5"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <span>Create & Upload Material &rarr;</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500">
        <p>Knovara — Simple, source-grounded AI learning assistant.</p>
      </footer>
    </div>
  );
};

