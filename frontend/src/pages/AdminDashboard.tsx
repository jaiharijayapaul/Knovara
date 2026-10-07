import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Shield,
  Users,
  BookOpen,
  FileText,
  MessageSquare,
  Sparkles,
  Database,
  RefreshCw,
  Search,
  ArrowLeft,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  HardDrive,
  Activity,
  Layers,
  GraduationCap,
  ShieldCheck,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchAdminStats,
  fetchAdminUsers,
  updateAdminUserRole,
  fetchAdminCourses,
  deleteAdminCourse,
  fetchAdminActivity,
} from '@/services/api';
import type { AdminStats, AdminUser, AdminCourse, AdminActivity } from '@/types/admin';

export const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Active sub-tab: 'overview' | 'users' | 'courses' | 'activity'
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'courses' | 'activity'>('overview');

  // Data states
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [courses, setCourses] = useState<AdminCourse[]>([]);
  const [activity, setActivity] = useState<AdminActivity[]>([]);

  // Loading states
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Search & Filter states
  const [userSearch, setUserSearch] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [courseSearch, setCourseSearch] = useState<string>('');

  // Notification banners
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const loadAllData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [statsRes, usersRes, coursesRes, activityRes] = await Promise.all([
        fetchAdminStats(),
        fetchAdminUsers(userSearch || undefined),
        fetchAdminCourses(courseSearch || undefined),
        fetchAdminActivity(30),
      ]);
      setStats(statsRes);
      setUsers(usersRes);
      setCourses(coursesRes);
      setActivity(activityRes);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to load administrative telemetry.';
      showNotification(msg, 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userSearch, courseSearch]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Handle role mutation
  const handleRoleChange = async (targetUser: AdminUser, newRole: 'student' | 'instructor' | 'admin') => {
    if (targetUser.role === newRole) return;
    setActionLoadingId(targetUser.id);
    try {
      const updated = await updateAdminUserRole(targetUser.id, newRole);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      showNotification(`Updated role for ${updated.name} to "${newRole.toUpperCase()}".`);
      // Refresh stats
      const newStats = await fetchAdminStats();
      setStats(newStats);
    } catch {
      showNotification(`Failed to update role for ${targetUser.name}.`, 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle course purge
  const handleCourseDelete = async (course: AdminCourse) => {
    if (
      !window.confirm(
        `Are you sure you want to administratively PURGE course "${course.name}"? This permanently deletes all associated documents, vector chunks, and quiz items.`
      )
    ) {
      return;
    }
    setActionLoadingId(course.id);
    try {
      await deleteAdminCourse(course.id);
      setCourses((prev) => prev.filter((c) => c.id !== course.id));
      showNotification(`Course "${course.name}" permanently deleted.`);
      const newStats = await fetchAdminStats();
      setStats(newStats);
    } catch {
      showNotification(`Failed to delete course "${course.name}".`, 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  // Filter users by role
  const filteredUsers = users.filter((u) => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    return true;
  });

  if (loading && !stats) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-4 text-slate-400">
        <Loader2 className="w-10 h-10 animate-spin text-teal-400" />
        <p className="text-sm font-medium">Loading Knovara Administrative Command Center...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-teal-500 selection:text-black">
      {/* Top Banner Navigation */}
      <header className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer flex items-center space-x-1.5 text-xs font-semibold"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Learner Hub</span>
            </button>
            <div className="h-6 w-px bg-slate-800" />
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-xl bg-gradient-to-tr from-rose-500 to-amber-500 text-white shadow-md">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <h1 className="text-sm sm:text-base font-extrabold text-white tracking-tight flex items-center gap-2">
                  <span>Knovara Admin Console</span>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold">
                    Superuser
                  </span>
                </h1>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {stats && (
              <div className="hidden md:flex items-center space-x-2 text-xs font-mono px-3 py-1.5 rounded-xl bg-slate-800/60 border border-slate-700/60 text-slate-300">
                <span
                  className={`w-2 h-2 rounded-full ${
                    stats.database_status === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                  }`}
                />
                <span>DB: {stats.database_dialect.toUpperCase()}</span>
              </div>
            )}
            <button
              onClick={() => loadAllData(true)}
              disabled={refreshing}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer border border-slate-700"
              title="Refresh Telemetry"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-teal-400' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Notification Alert */}
        {notification && (
          <div
            className={`p-4 rounded-2xl border flex items-center justify-between text-xs font-semibold animate-in fade-in ${
              notification.type === 'success'
                ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
            }`}
          >
            <div className="flex items-center space-x-2.5">
              {notification.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{notification.message}</span>
            </div>
            <button onClick={() => setNotification(null)} className="opacity-70 hover:opacity-100">
              &times;
            </button>
          </div>
        )}

        {/* Executive KPI Overview Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-semibold">Total Users</span>
                <Users className="w-4 h-4 text-sky-400" />
              </div>
              <div className="text-2xl font-black text-white">{stats.total_users}</div>
              <div className="text-[10px] text-slate-400 flex items-center space-x-1 font-mono">
                <span className="text-sky-300">{stats.total_students} Std</span>
                <span>&bull;</span>
                <span className="text-amber-300">{stats.total_instructors} Inst</span>
                <span>&bull;</span>
                <span className="text-rose-300">{stats.total_admins} Adm</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-semibold">Courses</span>
                <BookOpen className="w-4 h-4 text-teal-400" />
              </div>
              <div className="text-2xl font-black text-white">{stats.total_courses}</div>
              <div className="text-[10px] text-teal-400/90 font-medium">
                {stats.total_topics} Curriculum Units
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-semibold">Study Assets</span>
                <FileText className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-black text-white">{stats.total_documents}</div>
              <div className="text-[10px] text-amber-400/90 font-medium">
                PDFs, PPTXs, YouTube
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-semibold">Vector Chunks</span>
                <Layers className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="text-2xl font-black text-white">{stats.total_chunks}</div>
              <div className="text-[10px] text-indigo-300 font-mono">
                pgvector RAG units
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-semibold">AI Tutor Chats</span>
                <MessageSquare className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-black text-white">{stats.total_tutor_sessions}</div>
              <div className="text-[10px] text-emerald-300 font-medium">
                {stats.total_flashcards} Flashcards
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-semibold">Storage Volume</span>
                <HardDrive className="w-4 h-4 text-rose-400" />
              </div>
              <div className="text-2xl font-black text-white">{formatBytes(stats.total_storage_bytes)}</div>
              <div className="text-[10px] text-rose-300 font-mono">
                Multimodal storage
              </div>
            </div>
          </div>
        )}

        {/* Tab Navigation Pill Bar */}
        <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-teal-400 text-slate-950 shadow-md shadow-teal-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Platform Overview</span>
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === 'users'
                ? 'bg-teal-400 text-slate-950 shadow-md shadow-teal-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>User Management ({users.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('courses')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === 'courses'
                ? 'bg-teal-400 text-slate-950 shadow-md shadow-teal-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Course Fleet ({courses.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('activity')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === 'activity'
                ? 'bg-teal-400 text-slate-950 shadow-md shadow-teal-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Audit Stream ({activity.length})</span>
          </button>
        </div>

        {/* TAB 1: PLATFORM OVERVIEW */}
        {activeTab === 'overview' && stats && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* System Architecture & Health */}
            <div className="p-6 rounded-3xl bg-slate-900/50 border border-slate-800 space-y-5">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-2xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">System Infrastructure & Data Plane</h3>
                  <p className="text-xs text-slate-400">Database dialect, vector indexing engine, and storage metrics</p>
                </div>
              </div>

              <div className="space-y-3 font-mono text-xs">
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 flex items-center justify-between">
                  <span className="text-slate-400">Database Engine</span>
                  <span className="text-teal-300 font-bold uppercase">{stats.database_dialect}</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 flex items-center justify-between">
                  <span className="text-slate-400">Connection Status</span>
                  <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    ONLINE & HEALTHY
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 flex items-center justify-between">
                  <span className="text-slate-400">Multimodal Vectors</span>
                  <span className="text-indigo-400 font-bold">{stats.total_chunks} embeddings indexed</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 flex items-center justify-between">
                  <span className="text-slate-400">Total Material Storage</span>
                  <span className="text-amber-400 font-bold">{formatBytes(stats.total_storage_bytes)}</span>
                </div>
              </div>
            </div>

            {/* Platform Role Distribution */}
            <div className="p-6 rounded-3xl bg-slate-900/50 border border-slate-800 space-y-5">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Role-Based Access Control (RBAC)</h3>
                  <p className="text-xs text-slate-400">Identity distribution across platform roles</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                      <GraduationCap className="w-3.5 h-3.5 text-sky-400" /> Students
                    </span>
                    <span className="font-mono text-sky-400">{stats.total_students} ({Math.round((stats.total_students / (stats.total_users || 1)) * 100)}%)</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-sky-400 rounded-full"
                      style={{ width: `${(stats.total_students / (stats.total_users || 1)) * 100}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-amber-400" /> Instructors / TAs
                    </span>
                    <span className="font-mono text-amber-400">{stats.total_instructors} ({Math.round((stats.total_instructors / (stats.total_users || 1)) * 100)}%)</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-amber-400 rounded-full"
                      style={{ width: `${(stats.total_instructors / (stats.total_users || 1)) * 100}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-rose-400" /> Platform Administrators
                    </span>
                    <span className="font-mono text-rose-400">{stats.total_admins} ({Math.round((stats.total_admins / (stats.total_users || 1)) * 100)}%)</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-rose-400 rounded-full"
                      style={{ width: `${(stats.total_admins / (stats.total_users || 1)) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: USER MANAGEMENT (RBAC) */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search user by name, email, or role..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
                />
              </div>

              <div className="flex items-center space-x-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
                {(['all', 'student', 'instructor', 'admin'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRoleFilter(r)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer ${
                      roleFilter === r
                        ? 'bg-slate-800 text-teal-300 border border-slate-700'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Users Table */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 font-semibold">
                      <th className="p-3.5 pl-4">User</th>
                      <th className="p-3.5">Education</th>
                      <th className="p-3.5">Courses</th>
                      <th className="p-3.5">Current Role</th>
                      <th className="p-3.5">Change Role</th>
                      <th className="p-3.5 pr-4 text-right">Joined</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-500">
                          No users found matching your search criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((u) => (
                        <tr key={u.id} className="hover:bg-slate-900/60 transition-colors">
                          <td className="p-3.5 pl-4">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-teal-300 uppercase">
                                {u.name.charAt(0)}
                              </div>
                              <div>
                                <div className="font-bold text-white flex items-center gap-1.5">
                                  <span>{u.name}</span>
                                  {u.email === user?.email && (
                                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30 font-semibold">
                                      YOU
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-400 font-mono">{u.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="p-3.5 text-slate-400">{u.education_level}</td>
                          <td className="p-3.5">
                            <span className="font-mono font-semibold text-teal-400">{u.courses_count}</span>
                          </td>
                          <td className="p-3.5">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                u.role === 'admin'
                                  ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                                  : u.role === 'instructor'
                                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                  : 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                              }`}
                            >
                              {u.role}
                            </span>
                          </td>
                          <td className="p-3.5">
                            <select
                              value={u.role}
                              disabled={actionLoadingId === u.id}
                              onChange={(e) =>
                                handleRoleChange(u, e.target.value as 'student' | 'instructor' | 'admin')
                              }
                              className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-400 cursor-pointer disabled:opacity-50"
                            >
                              <option value="student">Student</option>
                              <option value="instructor">Instructor</option>
                              <option value="admin">Admin</option>
                            </select>
                          </td>
                          <td className="p-3.5 pr-4 text-right text-slate-500 font-mono text-[11px]">
                            {new Date(u.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: COURSE FLEET MANAGEMENT */}
        {activeTab === 'courses' && (
          <div className="space-y-4">
            {/* Search */}
            <div className="flex items-center justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={courseSearch}
                  onChange={(e) => setCourseSearch(e.target.value)}
                  placeholder="Search course title or subject..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
                />
              </div>
            </div>

            {/* Courses Table */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 font-semibold">
                      <th className="p-3.5 pl-4">Course</th>
                      <th className="p-3.5">Subject</th>
                      <th className="p-3.5">Owner</th>
                      <th className="p-3.5">Assets</th>
                      <th className="p-3.5">Units</th>
                      <th className="p-3.5 pr-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {courses.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-500">
                          No courses found.
                        </td>
                      </tr>
                    ) : (
                      courses.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-900/60 transition-colors">
                          <td className="p-3.5 pl-4">
                            <div className="font-bold text-white truncate max-w-xs">{c.name}</div>
                            {c.description && (
                              <div className="text-[11px] text-slate-500 truncate max-w-xs">{c.description}</div>
                            )}
                          </td>
                          <td className="p-3.5">
                            <span className="px-2 py-0.5 rounded-md bg-teal-500/10 text-teal-300 border border-teal-500/20 text-[10px] font-semibold">
                              {c.subject}
                            </span>
                          </td>
                          <td className="p-3.5">
                            <div className="font-medium text-slate-200">{c.user_name || 'Anonymous'}</div>
                            <div className="text-[10px] text-slate-500 font-mono">{c.user_email}</div>
                          </td>
                          <td className="p-3.5 font-mono text-amber-300 font-semibold">{c.documents_count} docs</td>
                          <td className="p-3.5 font-mono text-sky-300 font-semibold">{c.topics_count} topics</td>
                          <td className="p-3.5 pr-4 text-right">
                            <div className="flex items-center justify-end space-x-2">
                              <Link
                                to={`/courses/${c.id}`}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                                title="Open Workspace"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </Link>
                              <button
                                onClick={() => handleCourseDelete(c)}
                                disabled={actionLoadingId === c.id}
                                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/20 transition-colors cursor-pointer disabled:opacity-50"
                                title="Purge Course (Admin)"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: AUDIT STREAM & DIAGNOSTICS */}
        {activeTab === 'activity' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Live Platform Activity Stream</h3>
                <p className="text-xs text-slate-400">Chronological feed of documents uploaded, AI tutoring sessions, and courses</p>
              </div>
              <span className="text-[11px] font-mono text-slate-500">Showing last {activity.length} events</span>
            </div>

            <div className="divide-y divide-slate-800/80 rounded-2xl border border-slate-800 bg-slate-900/30 overflow-hidden">
              {activity.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">No activity logged yet.</div>
              ) : (
                activity.map((ev) => (
                  <div key={ev.id} className="p-4 hover:bg-slate-900/60 transition-colors flex items-start space-x-3.5">
                    <div
                      className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                        ev.type === 'document_upload'
                          ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                          : ev.type === 'tutor_session'
                          ? 'bg-teal-500/15 text-teal-400 border border-teal-500/20'
                          : 'bg-sky-500/15 text-sky-400 border border-sky-500/20'
                      }`}
                    >
                      {ev.type === 'document_upload' ? (
                        <FileText className="w-4 h-4" />
                      ) : ev.type === 'tutor_session' ? (
                        <MessageSquare className="w-4 h-4" />
                      ) : (
                        <BookOpen className="w-4 h-4" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-xs text-white truncate">{ev.title}</span>
                        <span className="text-[10px] text-slate-500 font-mono shrink-0">
                          {new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">{ev.detail}</p>
                      {ev.user_name && (
                        <div className="text-[10px] text-slate-500">
                          Triggered by: <span className="text-slate-300 font-medium">{ev.user_name}</span> ({ev.user_email})
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
