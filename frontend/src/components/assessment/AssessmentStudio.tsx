import React, { useState, useEffect, useCallback } from 'react';
import { 
  fetchAssessments, 
  fetchAssessmentDetail, 
  generateAssessment, 
  deleteAssessment,
  fetchAssessmentAttempts,
  fetchAttemptDetail,
  createRemediationSession,
} from '@/services/api';
import type { 
  Assessment, 
  AssessmentDetail, 
  AssessmentDifficulty,
  AssessmentGeneratePayload,
  AssessmentAttempt,
  AssessmentAttemptDetail
} from '@/types/assessment';
import type { Topic } from '@/types/course';
import { AssessmentTestRunner } from './AssessmentTestRunner';
import { AssessmentAttemptReview } from './AssessmentAttemptReview';
import {
  Award,
  BookOpen,
  Sparkles,
  Clock,
  Trash2,
  Plus,
  X,
  Loader2,
  PlayCircle,
  BarChart3,
  History,
  HelpCircle,
  ArrowRight,
  Timer
} from 'lucide-react';

interface AssessmentStudioProps {
  courseId: string;
  courseName: string;
  topics: Topic[];
  onNavigateToTutor?: (sessionId?: string) => void;
  initialAssessmentId?: string | null;
}

export type StudioTab = 'overview' | 'exam' | 'review' | 'history';

export const AssessmentStudio: React.FC<AssessmentStudioProps> = ({ 
  courseId, 
  courseName, 
  topics,
  onNavigateToTutor,
  initialAssessmentId,
}) => {
  // Assessment list & active inspection
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [activeAssessmentId, setActiveAssessmentId] = useState<string | null>(null);
  const [assessmentDetail, setAssessmentDetail] = useState<AssessmentDetail | null>(null);
  const [loadingList, setLoadingList] = useState<boolean>(true);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);

  // Studio Mode: 'overview' (quiz launcher) | 'exam' (active exam runner) | 'review' (attempt diagnostic) | 'history' (past attempts)
  const [studioTab, setStudioTab] = useState<StudioTab>('overview');
  const [isTimedExamMode, setIsTimedExamMode] = useState<boolean>(true);
  const [attempts, setAttempts] = useState<AssessmentAttempt[]>([]);
  const [activeAttempt, setActiveAttempt] = useState<AssessmentAttemptDetail | null>(null);
  const [loadingAttempts, setLoadingAttempts] = useState<boolean>(false);

  // Generator form state
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [genTitle, setGenTitle] = useState<string>('');
  const [genTopic, setGenTopic] = useState<string>('');
  const [genNumQuestions, setGenNumQuestions] = useState<number>(5);
  const [genDifficulty, setGenDifficulty] = useState<AssessmentDifficulty>('medium');
  const [showGenModal, setShowGenModal] = useState<boolean>(false);
  const [genError, setGenError] = useState<string | null>(null);

  useEffect(() => {
    if (initialAssessmentId) {
      setActiveAssessmentId(initialAssessmentId);
    }
  }, [initialAssessmentId]);

  // Load all assessments
  const loadAssessments = useCallback(async () => {
    setLoadingList(true);
    try {
      const data = await fetchAssessments(courseId);
      setAssessments(data);
      if (data.length > 0 && !activeAssessmentId) {
        setActiveAssessmentId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load assessments:', err);
    } finally {
      setLoadingList(false);
    }
  }, [courseId, activeAssessmentId]);

  useEffect(() => {
    loadAssessments();
  }, [loadAssessments]);

  // Load detailed assessment and its attempts
  const loadDetail = useCallback(async (assessmentId: string) => {
    setLoadingDetail(true);
    setLoadingAttempts(true);
    try {
      const [detail, pastAttempts] = await Promise.all([
        fetchAssessmentDetail(courseId, assessmentId, false),
        fetchAssessmentAttempts(courseId, assessmentId),
      ]);
      setAssessmentDetail(detail);
      setAttempts(pastAttempts);
      
      // If there are past attempts, preload the latest attempt for review if requested
      if (pastAttempts.length > 0 && !activeAttempt) {
        try {
          const latestDetail = await fetchAttemptDetail(courseId, assessmentId, pastAttempts[0].id);
          setActiveAttempt(latestDetail);
        } catch {
          // ignore background preload error
        }
      }
    } catch (err) {
      console.error('Failed to load assessment detail or attempts:', err);
    } finally {
      setLoadingDetail(false);
      setLoadingAttempts(false);
    }
  }, [courseId, activeAttempt]);

  useEffect(() => {
    if (activeAssessmentId) {
      loadDetail(activeAssessmentId);
      // Reset view to overview when switching assessments unless in exam mode
      if (studioTab !== 'exam') {
        setStudioTab('overview');
      }
    }
  }, [activeAssessmentId, loadDetail]);

  // Handle generating new assessment
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    setGenError(null);

    const chosenTopic = genTopic.trim() || (topics.length > 0 ? topics[0].name : courseName);

    const payload: AssessmentGeneratePayload = {
      title: genTitle.trim() || `Practice Quiz: ${chosenTopic}`,
      topic: chosenTopic,
      num_questions: genNumQuestions,
      difficulty: genDifficulty,
    };

    try {
      const created = await generateAssessment(courseId, payload);
      setAssessments(prev => [created, ...prev]);
      setActiveAssessmentId(created.id);
      setAssessmentDetail(created);
      setAttempts([]);
      setActiveAttempt(null);
      setStudioTab('overview');
      setShowGenModal(false);
      setGenTitle('');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed to generate assessment.';
      setGenError(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle deleting assessment
  const handleDelete = async (assessmentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this quiz?')) return;
    try {
      await deleteAssessment(courseId, assessmentId);
      const remaining = assessments.filter(a => a.id !== assessmentId);
      setAssessments(remaining);
      if (activeAssessmentId === assessmentId) {
        if (remaining.length > 0) {
          setActiveAssessmentId(remaining[0].id);
        } else {
          setActiveAssessmentId(null);
          setAssessmentDetail(null);
          setActiveAttempt(null);
          setAttempts([]);
        }
      }
    } catch (err) {
      console.error('Failed to delete assessment:', err);
    }
  };

  // Load a historical attempt to review
  const handleSelectHistoricalAttempt = async (attemptId: string) => {
    if (!activeAssessmentId) return;
    try {
      setLoadingDetail(true);
      const detail = await fetchAttemptDetail(courseId, activeAssessmentId, attemptId);
      setActiveAttempt(detail);
      setStudioTab('review');
    } catch (err) {
      console.error('Failed to load attempt detail:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Exam completion handler
  const handleExamCompleted = (completedAttempt: AssessmentAttemptDetail) => {
    setActiveAttempt(completedAttempt);
    setAttempts(prev => [completedAttempt, ...prev]);
    setStudioTab('review');
  };

  // If in active exam mode, take full width for focused testing experience
  if (studioTab === 'exam' && assessmentDetail) {
    return (
      <AssessmentTestRunner
        courseId={courseId}
        assessment={assessmentDetail}
        isTimedMode={isTimedExamMode}
        timeLimitMinutes={assessmentDetail.time_limit_minutes || 15}
        onCompleted={handleExamCompleted}
        onCancel={() => setStudioTab('overview')}
      />
    );
  }

  // If in review mode and an attempt is active, show the diagnostic review studio
  if (studioTab === 'review' && assessmentDetail && activeAttempt) {
    return (
      <AssessmentAttemptReview
        courseId={courseId}
        courseName={courseName}
        assessment={assessmentDetail}
        attempt={activeAttempt}
        onRetake={() => setStudioTab('exam')}
        onBackToStudio={() => setStudioTab('overview')}
        onRemediate={async (questionId, errorCategory) => {
          try {
            const session = await createRemediationSession(courseId, {
              source_type: 'assessment_mistake',
              attempt_id: activeAttempt.id,
              question_id: questionId,
              error_category: errorCategory,
              pedagogical_mode: 'misconception_buster',
            });
            if (onNavigateToTutor) {
              onNavigateToTutor(session.id);
            }
          } catch (err) {
            console.error('Failed to initialize remediation session:', err);
          }
        }}
        onAskTutor={(qText, misDiag) => {
          if (onNavigateToTutor) {
            const prompt = `I was answering this question from "${assessmentDetail.title}": "${qText}". My diagnostic report identified this misconception: "${misDiag || 'conceptual error'}". Could you guide me through where my reasoning went wrong?`;
            onNavigateToTutor(prompt);
          }
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Studio Header Bar */}
      <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center">
              <Award className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight">Practice Quizzes & Self-Tests</h2>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/30">
              Grounded in Notes
            </span>
          </div>
          <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
            Test yourself on your uploaded study notes for <strong className="text-slate-200 font-semibold">{courseName}</strong>. 
            All questions are generated directly from your material, with instant scoring and simple explanations.
          </p>
        </div>

        <button
          onClick={() => {
            if (topics.length > 0 && !genTopic) {
              setGenTopic(topics[0].name);
            }
            setShowGenModal(true);
          }}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-teal-500/20 transition-all self-start md:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Create New Practice Quiz</span>
        </button>
      </div>

      {/* Main Studio Grid: Assessments Sidebar + Active Assessment Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Assessment Configurations List (4 cols) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Available Quizzes ({assessments.length})
            </span>
          </div>

          {loadingList ? (
            <div className="p-8 rounded-2xl bg-slate-900/40 border border-slate-800 flex items-center justify-center text-xs text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin mr-2 text-teal-400" />
              Loading quizzes...
            </div>
          ) : assessments.length === 0 ? (
            <div className="p-8 rounded-2xl bg-slate-900/40 border border-slate-800/80 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto text-slate-500">
                <Award className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">No Quizzes Created Yet</p>
                <p className="text-xs text-slate-400 mt-1">Generate your first quiz based on your uploaded notes.</p>
              </div>
              <button
                onClick={() => {
                  if (topics.length > 0 && !genTopic) {
                    setGenTopic(topics[0].name);
                  }
                  setShowGenModal(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs font-semibold hover:bg-teal-500/20 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                Generate Quiz Now
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {assessments.map((a) => {
                const isSelected = a.id === activeAssessmentId;
                return (
                  <div
                    key={a.id}
                    onClick={() => {
                      setActiveAssessmentId(a.id);
                      setStudioTab('overview');
                    }}
                    className={`group relative p-4 rounded-2xl cursor-pointer transition-all border ${
                      isSelected
                        ? 'bg-slate-900 border-teal-500/60 shadow-lg shadow-teal-500/10'
                        : 'bg-slate-900/40 border-slate-800/80 hover:bg-slate-900/80 hover:border-slate-700 text-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h4 className="text-xs font-bold text-white group-hover:text-teal-300 transition-colors line-clamp-1">
                        {a.title}
                      </h4>
                      <button
                        onClick={(e) => handleDelete(a.id, e)}
                        title="Delete quiz"
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 rounded transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-slate-400 mb-2.5">
                      <span className="capitalize px-1.5 py-0.5 rounded bg-slate-800 text-teal-300 font-medium">
                        {a.difficulty}
                      </span>
                      <span>&bull;</span>
                      <span>{a.questions_count} Questions</span>
                      <span>&bull;</span>
                      <span>{a.total_points} Pts</span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-800/60 pt-2">
                      <span className="truncate max-w-[180px]">{a.topic || 'General Material'}</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {a.time_limit_minutes || 15}m
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Active Assessment Inspector (8 cols) */}
        <div className="lg:col-span-8">
          {loadingDetail ? (
            <div className="h-[450px] rounded-3xl bg-slate-900/40 border border-slate-800 flex flex-col items-center justify-center text-slate-500 gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-teal-400" />
              <p className="text-xs">Loading quiz details...</p>
            </div>
          ) : !assessmentDetail ? (
            <div className="h-[400px] rounded-3xl bg-slate-900/40 border border-slate-800 flex flex-col items-center justify-center text-slate-500 p-6 text-center space-y-3">
              <Award className="w-12 h-12 text-slate-600 mx-auto" />
              <div>
                <p className="text-sm font-semibold text-slate-300">No Quiz Selected</p>
                <p className="text-xs text-slate-500 mt-1">Select a quiz from the list or create a new one.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Assessment Meta Header */}
              <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-white">{assessmentDetail.title}</h3>
                      <span className="capitalize px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-500/10 text-teal-400 border border-teal-500/30">
                        {assessmentDetail.difficulty}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Topic: <span className="text-slate-200 font-medium">{assessmentDetail.topic || courseName}</span>
                    </p>
                  </div>

                  {/* Primary Call to Action: Start Quiz / Timed Mock Exam */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => {
                        setIsTimedExamMode(true);
                        setStudioTab('exam');
                      }}
                      className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 via-amber-500 to-orange-500 hover:brightness-110 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
                      title="Simulate real exam conditions with countdown timer, auto-submit, and question flagging"
                    >
                      <Timer className="w-4 h-4 stroke-[2.5]" />
                      <span>Start Timed Mock Exam ({assessmentDetail.time_limit_minutes || 15}m)</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsTimedExamMode(false);
                        setStudioTab('exam');
                      }}
                      className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white font-semibold text-xs flex items-center gap-2 transition-all cursor-pointer"
                      title="Practice at your own pace without any time pressure"
                    >
                      <PlayCircle className="w-4 h-4 text-teal-400 stroke-[2.5]" />
                      <span>Untimed Practice</span>
                    </button>
                  </div>
                </div>

                {/* Subnavigation Tabs */}
                <div className="flex items-center gap-2 pt-3 border-t border-slate-800/80">
                  <button
                    onClick={() => setStudioTab('overview')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                      studioTab === 'overview'
                        ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Quiz Details</span>
                  </button>

                  <button
                    onClick={() => setStudioTab('history')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                      studioTab === 'history'
                        ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>Past Attempts ({attempts.length})</span>
                  </button>

                  {activeAttempt && (
                    <button
                      onClick={() => setStudioTab('review')}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 hover:bg-cyan-500/20 transition-all ml-auto"
                    >
                      <BarChart3 className="w-3.5 h-3.5" />
                      <span>View Latest Results ({Math.round(activeAttempt.percentage)}%)</span>
                    </button>
                  )}
                </div>
              </div>

              {/* View: Attempt History */}
              {studioTab === 'history' && (
                <div className="space-y-3">
                  <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-1">
                      Your Attempt History
                    </h4>
                    <p className="text-xs text-slate-400">
                      Review how your score has improved over multiple practice attempts.
                    </p>
                  </div>

                  {loadingAttempts ? (
                    <div className="p-8 rounded-2xl bg-slate-900/40 border border-slate-800 text-center flex items-center justify-center text-xs text-slate-500">
                      <Loader2 className="w-4 h-4 animate-spin text-teal-400 mr-2" />
                      Loading past attempts...
                    </div>
                  ) : attempts.length === 0 ? (
                    <div className="p-8 rounded-2xl bg-slate-900/40 border border-slate-800 text-center space-y-3">
                      <HelpCircle className="w-8 h-8 text-slate-600 mx-auto" />
                      <p className="text-xs text-slate-400">You haven't attempted this quiz yet.</p>
                      <button
                        onClick={() => setStudioTab('exam')}
                        className="px-5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs"
                      >
                        Start Your First Attempt
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {attempts.map((att, idx) => {
                        return (
                          <div
                            key={att.id}
                            className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-slate-700 transition-all"
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-11 h-11 rounded-xl flex items-center justify-center font-black font-mono text-sm shrink-0 ${
                                  att.passed
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                }`}
                              >
                                {Math.round(att.percentage)}%
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-white">
                                    Attempt #{attempts.length - idx}
                                  </span>
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                      att.passed
                                        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                                        : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                                    }`}
                                  >
                                    {att.passed ? 'Passed 🎉' : 'Needs Practice'}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                                  <span>{att.score} / {att.total_points} pts</span>
                                  <span>&bull;</span>
                                  <span>{Math.round(att.time_spent_seconds)}s</span>
                                  <span>&bull;</span>
                                  <span>{new Date(att.created_at).toLocaleDateString()}</span>
                                </div>
                              </div>
                            </div>

                            <button
                              onClick={() => handleSelectHistoricalAttempt(att.id)}
                              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition-all self-end sm:self-auto"
                            >
                              <span>Review Answers & Explanations</span>
                              <ArrowRight className="w-3.5 h-3.5 text-teal-400" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* View: Quiz Overview & Launcher (Replaces cheating blueprint) */}
              {studioTab === 'overview' && (
                <div className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-6">
                  <div className="space-y-2">
                    <h4 className="text-base font-bold text-white">
                      Ready to Test Your Understanding?
                    </h4>
                    <p className="text-xs text-slate-400 leading-relaxed max-w-xl">
                      This quiz contains {assessmentDetail.questions.length} questions grounded directly in your uploaded notes. 
                      Take your time. Answers will be scored and detailed feedback will be revealed after you submit.
                    </p>
                  </div>

                  {/* 3 Metric Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                      <div className="text-[11px] text-slate-500 uppercase font-semibold">Questions</div>
                      <div className="text-lg font-bold text-teal-400">{assessmentDetail.questions.length}</div>
                      <div className="text-[11px] text-slate-400">Multiple-choice questions</div>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                      <div className="text-[11px] text-slate-500 uppercase font-semibold">Estimated Time</div>
                      <div className="text-lg font-bold text-slate-200">~{assessmentDetail.time_limit_minutes || 15} Mins</div>
                      <div className="text-[11px] text-slate-400">No rush, answer at your pace</div>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                      <div className="text-[11px] text-slate-500 uppercase font-semibold">Pass Mark</div>
                      <div className="text-lg font-bold text-emerald-400">70%</div>
                      <div className="text-[11px] text-slate-400">To demonstrate solid mastery</div>
                    </div>
                  </div>

                  {/* Simple Student Advice */}
                  <div className="p-4 rounded-2xl bg-teal-500/5 border border-teal-500/20 text-xs text-slate-300 space-y-2">
                    <div className="font-semibold text-teal-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>How this practice quiz works:</span>
                    </div>
                    <ul className="space-y-1 text-slate-400 list-disc list-inside">
                      <li>Each question tests a core concept from your uploaded material.</li>
                      <li>Options are varied and balanced to test real comprehension.</li>
                      <li>Immediate scoring, answer breakdowns, and helpful explanations appear right after submission.</li>
                    </ul>
                  </div>

                  {/* Bottom Actions */}
                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <button
                      onClick={() => setStudioTab('exam')}
                      className="px-6 py-3 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-teal-500/25 transition-all cursor-pointer"
                    >
                      <PlayCircle className="w-4 h-4 stroke-[2.5]" />
                      <span>Start Practice Quiz Now</span>
                    </button>

                    {attempts.length > 0 && (
                      <button
                        onClick={() => {
                          if (activeAttempt) {
                            setStudioTab('review');
                          } else if (attempts.length > 0) {
                            handleSelectHistoricalAttempt(attempts[0].id);
                          }
                        }}
                        className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center gap-2 transition-all cursor-pointer"
                      >
                        <BarChart3 className="w-4 h-4 text-teal-400" />
                        <span>Review Previous Results ({Math.round(activeAttempt?.percentage || attempts[0]?.percentage || 0)}%)</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Generator Modal */}
      {showGenModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-teal-400" />
                <h4 className="text-sm font-bold text-white">Create a Practice Quiz</h4>
              </div>
              <button
                onClick={() => setShowGenModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleGenerate} className="p-6 space-y-4">
              {genError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                  {genError}
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Quiz Title (Optional)
                </label>
                <input
                  type="text"
                  value={genTitle}
                  onChange={(e) => setGenTitle(e.target.value)}
                  placeholder={`e.g. ${courseName} Practice Quiz`}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              {/* Scope Topic */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Focus Topic from Notes
                </label>
                <select
                  value={genTopic}
                  onChange={(e) => setGenTopic(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-teal-500"
                >
                  <option value="">All Uploaded Notes ({courseName})</option>
                  {topics.map((t) => (
                    <option key={t.id} value={t.name}>{t.name}</option>
                  ))}
                </select>
              </div>

              {/* Difficulty & Number of Questions */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Difficulty
                  </label>
                  <select
                    value={genDifficulty}
                    onChange={(e) => setGenDifficulty(e.target.value as AssessmentDifficulty)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-teal-500"
                  >
                    <option value="easy">Easy (Core Ideas)</option>
                    <option value="medium">Medium (Standard)</option>
                    <option value="hard">Hard (Advanced)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Questions Count
                  </label>
                  <select
                    value={genNumQuestions}
                    onChange={(e) => setGenNumQuestions(parseInt(e.target.value) || 5)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-teal-500"
                  >
                    <option value={3}>3 Questions (Quick)</option>
                    <option value={5}>5 Questions (Standard)</option>
                    <option value={8}>8 Questions (Deep)</option>
                    <option value={10}>10 Questions (Complete)</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowGenModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isGenerating}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 disabled:opacity-50 text-xs font-bold text-slate-950 flex items-center gap-1.5 shadow-lg shadow-teal-500/20 transition-all cursor-pointer"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Generating Quiz...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Create Quiz</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
