import React, { useState, useEffect } from 'react';
import { 
  fetchCourseFlowMap, 
  fetchStudySchedule 
} from '@/services/api';
import type { 
  CourseFlowMapResponse, 
  CourseFlowMapNode, 
  StudyScheduleResponse, 
} from '@/types/course';
import { 
  GitCommit, 
  Lock, 
  Unlock, 
  CheckCircle2, 
  Calendar, 
  Sparkles, 
  Loader2, 
  AlertTriangle, 
  TrendingUp, 
  FileQuestion,
} from 'lucide-react';

interface CourseFlowMapStudioProps {
  courseId: string;
  courseName: string;
  onNavigateToTab?: (tab: 'tutor' | 'assessments' | 'flashcards') => void;
}

export const CourseFlowMapStudio: React.FC<CourseFlowMapStudioProps> = ({
  courseId,
  courseName,
  onNavigateToTab,
}) => {
  const [flowMap, setFlowMap] = useState<CourseFlowMapResponse | null>(null);
  const [schedule, setSchedule] = useState<StudyScheduleResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Exam date picker state
  const [examDate, setExamDate] = useState<string>('2026-10-30');
  const [isUpdatingSchedule, setIsUpdatingSchedule] = useState<boolean>(false);

  // Active view: flow map vs spaced schedule
  const [activeSubTab, setActiveSubTab] = useState<'flow' | 'schedule'>('flow');

  const loadData = async (targetDate?: string) => {
    try {
      if (!targetDate) setLoading(true);
      else setIsUpdatingSchedule(true);
      setError(null);

      const [flowData, scheduleData] = await Promise.all([
        fetchCourseFlowMap(courseId),
        fetchStudySchedule(courseId, targetDate || examDate),
      ]);
      setFlowMap(flowData);
      setSchedule(scheduleData);
    } catch (err: unknown) {
      console.error('Failed to load flow map or study schedule:', err);
      setError('Could not load course flow map or revision schedule. Please verify your connection.');
    } finally {
      setLoading(false);
      setIsUpdatingSchedule(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [courseId]);

  const handleDateChange = (newDate: string) => {
    setExamDate(newDate);
    loadData(newDate);
  };

  const getStatusBadge = (node: CourseFlowMapNode) => {
    switch (node.status) {
      case 'mastered':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5" /> Mastered ({node.mastery_percentage}%)
          </span>
        );
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
            <TrendingUp className="w-3.5 h-3.5" /> In Progress ({node.mastery_percentage}%)
          </span>
        );
      case 'available':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
            <Unlock className="w-3.5 h-3.5" /> Unlocked ({node.mastery_percentage}%)
          </span>
        );
      case 'locked':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
            <Lock className="w-3.5 h-3.5" /> Prerequisites Needed
          </span>
        );
    }
  };

  const getUrgencyBadge = (urgency: 'high' | 'medium' | 'low') => {
    switch (urgency) {
      case 'high':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
            High Priority
          </span>
        );
      case 'medium':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            Medium
          </span>
        );
      case 'low':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            Review Check
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-slate-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
        <p className="text-sm">Calculating prerequisite graph and Ebbinghaus retention curves...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 shrink-0" />
        <div>{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-lg font-bold text-white tracking-tight">{courseName} &bull; Prerequisite Flow & Spaced Schedule</h2>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
              Req 1b &bull; 6a &bull; 6c
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Dynamic DAG dependency map calibrated with Bayesian Knowledge Tracing (BKT) and Hermann Ebbinghaus forgetting curves ($R = e^{'{'}-t/S{'}'}$).
          </p>
        </div>

        {/* Sub-tab navigation */}
        <div className="flex items-center p-1 rounded-xl bg-slate-800/80 border border-slate-700/60 shrink-0">
          <button
            onClick={() => setActiveSubTab('flow')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeSubTab === 'flow'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <GitCommit className="w-3.5 h-3.5" /> Prerequisite Flow Map
          </button>
          <button
            onClick={() => setActiveSubTab('schedule')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeSubTab === 'schedule'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" /> Ebbinghaus Revision Calendar
          </button>
        </div>
      </div>

      {activeSubTab === 'flow' && flowMap && (
        <div className="space-y-6">
          {/* Progress Summary Banner */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-xs text-slate-400 font-medium">Curriculum Modules</span>
              <div className="text-xl font-bold text-white mt-1">{flowMap.nodes.length} Key Topics</div>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-xs text-slate-400 font-medium">Overall Course Mastery</span>
              <div className="text-xl font-bold text-indigo-400 mt-1">{flowMap.overall_progress_percentage}%</div>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-xs text-slate-400 font-medium">Mastered Modules</span>
              <div className="text-xl font-bold text-emerald-400 mt-1">
                {flowMap.nodes.filter(n => n.is_mastered || n.status === 'mastered').length} / {flowMap.nodes.length}
              </div>
            </div>
          </div>

          {/* Flowchart DAG Nodes Display */}
          <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800/80 space-y-4">
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-2">
              <GitCommit className="w-4 h-4 text-indigo-400" /> Prerequisite Flow Chart
            </h3>

            <div className="space-y-4">
              {flowMap.nodes.map((node, index) => {
                const isLocked = node.status === 'locked';

                return (
                  <div key={node.id} className="relative flex items-stretch gap-4">
                    {/* Flow Line Indicator */}
                    <div className="flex flex-col items-center">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 border-2 transition-all ${
                        node.status === 'mastered'
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500'
                          : node.status === 'in_progress'
                          ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500'
                          : node.status === 'available'
                          ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500'
                          : 'bg-slate-800 text-slate-500 border-slate-700'
                      }`}>
                        {index + 1}
                      </div>
                      {index < flowMap.nodes.length - 1 && (
                        <div className="w-0.5 flex-1 bg-slate-800 my-1" />
                      )}
                    </div>

                    {/* Node Card */}
                    <div className={`flex-1 p-4 rounded-xl border transition-all ${
                      isLocked
                        ? 'bg-slate-900/40 border-slate-800/60 opacity-60'
                        : 'bg-slate-850/80 border-slate-750 hover:border-indigo-500/50 shadow-md'
                    }`}>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-white">{node.name}</h4>
                          {getStatusBadge(node)}
                        </div>
                        <div className="text-xs text-slate-400 flex items-center gap-2">
                          <span>{node.chunk_count} verified excerpts</span>
                          <span>&bull;</span>
                          <span className="font-semibold text-slate-300">P(L) = {node.p_know}</span>
                        </div>
                      </div>

                      {node.description && (
                        <p className="text-xs text-slate-400 leading-relaxed mb-3">
                          {node.description}
                        </p>
                      )}

                      {/* Mastery Progress Bar */}
                      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mb-3">
                        <div
                          className={`h-full transition-all duration-300 ${
                            node.status === 'mastered'
                              ? 'bg-emerald-500'
                              : node.status === 'in_progress'
                              ? 'bg-indigo-500'
                              : 'bg-cyan-500'
                          }`}
                          style={{ width: `${Math.min(100, node.mastery_percentage)}%` }}
                        />
                      </div>

                      {/* Fast Action Buttons */}
                      {!isLocked && onNavigateToTab && (
                        <div className="flex items-center gap-2 pt-1 border-t border-slate-800/60">
                          <button
                            onClick={() => onNavigateToTab('tutor')}
                            className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors font-medium"
                          >
                            <Sparkles className="w-3 h-3" /> Practice with Socratic Tutor
                          </button>
                          <span className="text-slate-600">&bull;</span>
                          <button
                            onClick={() => onNavigateToTab('assessments')}
                            className="inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 transition-colors font-medium"
                          >
                            <FileQuestion className="w-3 h-3" /> Take Diagnostic Quiz
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'schedule' && schedule && (
        <div className="space-y-6">
          {/* Target Exam Date Control */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Exam Target Countdown</span>
              <div className="text-base font-bold text-white mt-0.5">
                {schedule.days_until_exam} days remaining until test
              </div>
            </div>

            <div className="flex items-center gap-3">
              <label className="text-xs text-slate-300 font-medium">Target Exam Date:</label>
              <input
                type="date"
                value={examDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
              {isUpdatingSchedule && <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />}
            </div>
          </div>

          {/* Schedule Plan Table */}
          <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800/80 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-400" /> Spaced-Repetition Revision Calendar
              </h3>
              <span className="text-xs text-slate-400">
                Formula: $R = e^{'{'}-t / S{'}'}$ &bull; Target Retention $\ge 70\%$
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-[11px] uppercase tracking-wider">
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Topic Focus</th>
                    <th className="py-3 px-3">Session Mode</th>
                    <th className="py-3 px-3">Retention ($R$)</th>
                    <th className="py-3 px-3">Priority</th>
                    <th className="py-3 px-3">Time</th>
                    <th className="py-3 px-3">Recommended Pedagogical Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {schedule.schedule.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-3 font-semibold text-slate-200">{item.date}</td>
                      <td className="py-3 px-3 font-medium text-white">{item.topic}</td>
                      <td className="py-3 px-3 capitalize text-slate-300">{item.session_type.replace('_', ' ')}</td>
                      <td className="py-3 px-3">
                        <span className={`font-semibold ${
                          item.retention_percentage < 60
                            ? 'text-rose-400'
                            : item.retention_percentage < 80
                            ? 'text-amber-400'
                            : 'text-emerald-400'
                        }`}>
                          {item.retention_percentage}%
                        </span>
                      </td>
                      <td className="py-3 px-3">{getUrgencyBadge(item.urgency)}</td>
                      <td className="py-3 px-3 text-slate-400">{item.recommended_duration_mins} mins</td>
                      <td className="py-3 px-3 text-slate-300">{item.suggested_action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
