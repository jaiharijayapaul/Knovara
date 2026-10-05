import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  fetchCourses, 
  createCourse, 
  deleteCourse
} from '@/services/api';
import type { Course, CourseCreatePayload } from '@/types/course';
import { useAuth } from '@/contexts/AuthContext';
import { 
  GraduationCap, 
  FolderPlus, 
  BookOpen, 
  Trash2, 
  ArrowRight, 
  Loader2, 
  Layers, 
  Plus, 
  X, 
  AlertCircle, 
  LogOut, 
  User, 
  HelpCircle
} from 'lucide-react';

export const Courses: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('Computer Science');
  const [description, setDescription] = useState('');

  const loadCourses = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await fetchCourses();
      setCourses(data);
    } catch {
      setErrorMessage('Failed to load courses. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const payload: CourseCreatePayload = {
        name: name.trim(),
        subject: subject.trim(),
        description: description.trim() || undefined,
      };
      const created = await createCourse(payload);
      setIsModalOpen(false);
      setName('');
      setDescription('');
      navigate(`/courses/${created.id}`);
    } catch {
      setErrorMessage('Failed to create study subject. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };



  const handleDeleteCourse = async (courseId: string, courseName: string) => {
    if (!window.confirm(`Are you sure you want to delete course "${courseName}"? All isolated materials will be removed.`)) {
      return;
    }
    try {
      await deleteCourse(courseId);
      setCourses((prev) => prev.filter((c) => c.id !== courseId));
    } catch {
      alert('Failed to delete course.');
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
            <span className="hidden sm:inline-flex ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20">
              Workspaces
            </span>
          </div>

          <nav className="hidden md:flex items-center space-x-1 text-xs font-medium text-slate-300">
            <Link to="/dashboard" className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors">
              Dashboard
            </Link>
            <span className="px-3 py-1.5 rounded-lg bg-slate-800 text-teal-400 font-semibold cursor-default">
              Courses
            </span>
            <Link to="/instructions" className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors flex items-center space-x-1">
              <HelpCircle className="w-3.5 h-3.5 text-teal-400" />
              <span>Platform Guide</span>
            </Link>
          </nav>

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

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Study Subjects
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Select a subject to view your uploaded notes, ask the AI tutor questions, practice flashcards, or take a quiz.
            </p>
          </div>

          <div className="flex items-center space-x-3">

            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold text-slate-950 bg-gradient-to-r from-teal-400 to-emerald-400 hover:from-teal-300 hover:to-emerald-300 shadow-md shadow-teal-500/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Add New Subject</span>
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start space-x-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Courses Grid */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-teal-400" />
            <p className="text-xs">Loading your study subjects...</p>
          </div>
        ) : courses.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/20 p-12 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center mx-auto">
              <FolderPlus className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-white">No subjects created yet</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Add your first subject to upload your study notes, ask questions in simple words, and take practice quizzes.
              </p>
            </div>
            <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold text-slate-950 bg-gradient-to-r from-teal-400 to-emerald-400 hover:from-teal-300 hover:to-emerald-300 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add First Subject</span>
              </button>
              <Link
                to="/instructions"
                className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-medium text-slate-300 bg-slate-900 border border-slate-800 hover:bg-slate-800 transition-colors"
              >
                <HelpCircle className="w-4 h-4 text-teal-400" />
                <span>View Platform Guide</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => (
              <div
                key={course.id}
                className="rounded-2xl bg-slate-900/50 border border-slate-800/80 p-6 flex flex-col justify-between hover:border-teal-500/40 hover:bg-slate-900/80 transition-all shadow-xl group relative overflow-hidden"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-800 text-teal-400 border border-slate-700">
                      {course.subject}
                    </span>
                    <button
                      onClick={() => handleDeleteCourse(course.id, course.name)}
                      title="Delete Course Workspace"
                      className="text-slate-500 hover:text-rose-400 p-1 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-white group-hover:text-teal-300 transition-colors">
                      {course.name}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                      {course.description || 'Uploaded notes, AI tutor, and practice quizzes.'}
                    </p>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center space-x-4">
                    <span className="flex items-center space-x-1.5">
                      <Layers className="w-3.5 h-3.5 text-teal-400" />
                      <span>{course.topics_count} Concepts</span>
                    </span>
                    <span className="flex items-center space-x-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-slate-500" />
                      <span>{course.documents_count} Files</span>
                    </span>
                  </div>

                  <Link
                    to={`/courses/${course.id}`}
                    className="inline-flex items-center space-x-1 font-semibold text-teal-400 group-hover:translate-x-0.5 transition-transform"
                  >
                    <span>Open Subject</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

      </main>

      {/* Course Creation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-white">Add New Study Subject</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>



            <form onSubmit={handleCreateCourse} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Subject Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Physics 101, Machine Learning, Organic Chemistry"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500/80 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Category / Department
                </label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Computer Science, Science, Math, Engineering"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500/80 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Short Description (Optional)
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What will you be studying in this subject?"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500/80 transition-all"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !name.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-950 bg-gradient-to-r from-teal-400 to-emerald-400 hover:from-teal-300 hover:to-emerald-300 disabled:opacity-50 transition-colors flex items-center space-x-1.5 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <span>Create Subject</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500">
        <p>Knovara — Your AI Study Companion. Simple learning, grounded notes, and instant practice.</p>
      </footer>
    </div>
  );
};

export default Courses;
