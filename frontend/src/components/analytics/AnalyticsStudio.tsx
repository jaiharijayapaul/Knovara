import React, { useState, useEffect, useCallback } from 'react';
import {
  fetchCourseAnalytics,
  exportCourseAnalytics,
} from '@/services/api';
import type {
  CourseAnalyticsReport,
  BloomCognitiveTelemetry,
  MisconceptionTelemetry,
  ConceptMatrixItem,
} from '@/types/analytics';
import {
  TrendingUp,
  Brain,
  Zap,
  Clock,
  Award,
  RefreshCw,
  Download,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  Calendar,
  Layers,
  Sparkles,
  HelpCircle,
  Target,
  ChevronRight,
  Flame,
  Check,
  Copy,
} from 'lucide-react';

interface AnalyticsStudioProps {
  courseId: string;
  courseName: string;
  onNavigateToTab?: (tab: 'assessments' | 'tutor' | 'mastery' | 'flashcards') => void;
}

export const AnalyticsStudio: React.FC<AnalyticsStudioProps> = ({
  courseId,
  courseName,
  onNavigateToTab,
}) => {
  const [report, setReport] = useState<CourseAnalyticsReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [copiedExport, setCopiedExport] = useState<boolean>(false);
  const [activeBloomFilter, setActiveBloomFilter] = useState<string | null>(null);
  const [conceptSearch, setConceptSearch] = useState<string>('');

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCourseAnalytics(courseId);
      setReport(data);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load learning analytics telemetry.';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const handleExportMarkdown = async () => {
    setIsExporting(true);
    try {
      const mdContent = (await exportCourseAnalytics(courseId, 'markdown')) as string;
      const blob = new Blob([mdContent], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `knovara_analytics_${courseName.replace(/\s+/g, '_').toLowerCase()}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export markdown report:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyMarkdown = async () => {
    setIsExporting(true);
    try {
      const mdContent = (await exportCourseAnalytics(courseId, 'markdown')) as string;
      await navigator.clipboard.writeText(mdContent);
      setCopiedExport(true);
      setTimeout(() => setCopiedExport(false), 2500);
    } catch (err) {
      console.error('Failed to copy report:', err);
    } finally {
      setIsExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-4">
        <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
        <p className="text-slate-400 text-sm font-medium">
          Synthesizing multi-source learning analytics & progress telemetry...
        </p>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="p-8 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center space-y-4">
        <AlertTriangle className="w-10 h-10 text-rose-400 mx-auto" />
        <h3 className="text-lg font-bold text-white">Analytics Unavailable</h3>
        <p className="text-sm text-slate-300 max-w-md mx-auto">{error || 'Could not compile course analytics telemetry.'}</p>
        <button
          onClick={loadAnalytics}
          className="px-4 py-2 rounded-xl bg-slate-800 text-white hover:bg-slate-700 text-xs font-semibold inline-flex items-center space-x-2"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry Compilation</span>
        </button>
      </div>
    );
  }

  const { velocity, bloom_telemetry, misconception_telemetry, retention_forecast, activity_timeline, concept_matrix, executive_summary } = report;

  // Filter concepts based on search
  const filteredConcepts = concept_matrix.filter((c: ConceptMatrixItem) =>
    c.concept_label.toLowerCase().includes(conceptSearch.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* HEADER & EXECUTIVE SUMMARY BANNER */}
      <div className="relative overflow-hidden p-6 md:p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-indigo-950/40 border border-slate-800/80 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 rounded-full bg-violet-500/10 blur-3xl pointer-events-none" />

        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-3xl">
            <div className="flex items-center space-x-2.5">
              <span className="px-3 py-1 rounded-full text-xs font-semibold tracking-wide uppercase bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5" />
                Learning Velocity & Telemetry
              </span>
              <span className="text-xs text-slate-400">
                Updated {new Date(report.generated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              Curricular Mastery & Progress Telemetry
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed pt-1">
              {executive_summary}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={handleCopyMarkdown}
              disabled={isExporting}
              className="px-3.5 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 text-xs font-semibold text-slate-200 transition-all flex items-center space-x-2"
              title="Copy Markdown Portfolio to clipboard"
            >
              {copiedExport ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedExport ? 'Copied to Clipboard' : 'Copy Portfolio'}</span>
            </button>
            <button
              onClick={handleExportMarkdown}
              disabled={isExporting}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-xs font-semibold text-white shadow-lg shadow-indigo-600/25 transition-all flex items-center space-x-2"
            >
              {isExporting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              <span>Export Report (.md)</span>
            </button>
            <button
              onClick={loadAnalytics}
              className="p-2 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 text-slate-300 transition-all"
              title="Refresh telemetry"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* PRIMARY KPI METRICS GRID */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Metric 1: Overall Course Mastery */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md flex flex-col justify-between group hover:border-indigo-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Course Mastery</span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
              <Brain className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-white tracking-tight">
              {velocity.overall_mastery_pct.toFixed(1)}%
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {velocity.mastered_concepts_count} / {velocity.total_concepts_count} concepts mastered
            </div>
          </div>
        </div>

        {/* Metric 2: Learning Velocity */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md flex flex-col justify-between group hover:border-emerald-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Study Velocity</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-emerald-400 tracking-tight">
              {velocity.mastery_velocity >= 0 ? `+${velocity.mastery_velocity}%` : `${velocity.mastery_velocity}%`}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Delta mastery / iteration
            </div>
          </div>
        </div>

        {/* Metric 3: Active Study Streak */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md flex flex-col justify-between group hover:border-amber-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Active Streak</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-amber-400 tracking-tight">
              {velocity.study_streak_days} <span className="text-sm font-semibold text-slate-400">days</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Consecutive study days
            </div>
          </div>
        </div>

        {/* Metric 4: Total Study Time */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md flex flex-col justify-between group hover:border-violet-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Active Time</span>
            <div className="p-2 rounded-xl bg-violet-500/10 text-violet-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-white tracking-tight">
              {velocity.total_study_time_minutes} <span className="text-sm font-semibold text-slate-400">min</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Assessments & dialogue
            </div>
          </div>
        </div>

        {/* Metric 5: Immediate Retention */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md flex flex-col justify-between group hover:border-cyan-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Retention (SM-2)</span>
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
              <Target className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-cyan-400 tracking-tight">
              {retention_forecast.predicted_retention_pct.toFixed(0)}%
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {retention_forecast.active_cards} cards tracked
            </div>
          </div>
        </div>

        {/* Metric 6: Total Interactions */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md flex flex-col justify-between group hover:border-pink-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Interactions</span>
            <div className="p-2 rounded-xl bg-pink-500/10 text-pink-400">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-white tracking-tight">
              {velocity.total_interactions}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {velocity.assessment_attempts_count} tests • {velocity.flashcard_reviews_count} cards
            </div>
          </div>
        </div>
      </div>

      {/* ROW 2: BLOOM'S TAXONOMY & DIAGNOSTIC ERROR TAXONOMY */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* BLOOM'S TAXONOMY PERFORMANCE (7 cols) */}
        <div className="lg:col-span-7 p-6 rounded-3xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md space-y-5">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <Award className="w-4 h-4 text-indigo-400" />
                <h3 className="text-base font-bold text-white">Bloom&apos;s Revised Taxonomy Profile</h3>
              </div>
              <p className="text-xs text-slate-400">
                Cognitive mastery distribution across lower and higher-order skills
              </p>
            </div>
            {onNavigateToTab && (
              <button
                onClick={() => onNavigateToTab('assessments')}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center space-x-1"
              >
                <span>Take Diagnostic</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="space-y-4 pt-2">
            {bloom_telemetry.map((bloom: BloomCognitiveTelemetry) => {
              const hasData = bloom.total_questions > 0;
              const isSelected = activeBloomFilter === bloom.level;

              // Determine bar color
              let barColor = 'bg-slate-700';
              let badgeColor = 'text-slate-400 bg-slate-800';
              if (hasData) {
                if (bloom.accuracy_pct >= 80) {
                  barColor = 'bg-gradient-to-r from-emerald-500 to-teal-400';
                  badgeColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
                } else if (bloom.accuracy_pct >= 60) {
                  barColor = 'bg-gradient-to-r from-amber-500 to-yellow-400';
                  badgeColor = 'text-amber-400 bg-amber-500/10 border-amber-500/20';
                } else {
                  barColor = 'bg-gradient-to-r from-rose-500 to-pink-500';
                  badgeColor = 'text-rose-400 bg-rose-500/10 border-rose-500/20';
                }
              }

              return (
                <div
                  key={bloom.level}
                  onClick={() => setActiveBloomFilter(isSelected ? null : bloom.level)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-slate-800/90 border-indigo-500/50 shadow-lg shadow-indigo-500/10'
                      : 'bg-slate-900/40 border-slate-800/60 hover:border-slate-700/80 hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-slate-200 capitalize">{bloom.display_name}</span>
                      <span className="text-[11px] text-slate-500 hidden sm:inline">
                        ({bloom.description})
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-slate-400 font-mono text-[11px]">
                        {bloom.correct_questions} / {bloom.total_questions} questions
                      </span>
                      <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${badgeColor}`}>
                        {hasData ? `${bloom.accuracy_pct.toFixed(0)}%` : 'No data'}
                      </span>
                    </div>
                  </div>

                  {/* Progress track */}
                  <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${barColor}`}
                      style={{ width: `${hasData ? Math.max(bloom.accuracy_pct, 4) : 0}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ERROR TAXONOMY & MISCONCEPTIONS (5 cols) */}
        <div className="lg:col-span-5 p-6 rounded-3xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md space-y-5">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <HelpCircle className="w-4 h-4 text-amber-400" />
                <h3 className="text-base font-bold text-white">Misconception Profiler</h3>
              </div>
              <p className="text-xs text-slate-400">
                Cognitive error distribution across diagnostic assessments
              </p>
            </div>
            {onNavigateToTab && (
              <button
                onClick={() => onNavigateToTab('tutor')}
                className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center space-x-1"
              >
                <span>Socratic Tutor</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="space-y-3 pt-2">
            {misconception_telemetry.length === 0 ? (
              <div className="p-8 rounded-2xl bg-slate-900/40 border border-slate-800/60 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <div className="text-sm font-semibold text-slate-200">Zero Active Misconceptions</div>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  Either all questions have been answered correctly or initial diagnostic assessments have not been submitted yet.
                </p>
              </div>
            ) : (
              misconception_telemetry.map((err: MisconceptionTelemetry) => (
                <div
                  key={err.error_category}
                  className="p-3.5 rounded-2xl bg-slate-900/40 border border-slate-800/60 space-y-2 hover:border-slate-700/80 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">{err.display_name}</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-[11px] text-slate-400 font-mono">{err.count} error{err.count !== 1 ? 's' : ''}</span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        {err.percentage.toFixed(0)}%
                      </span>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    💡 {err.remediation_advice}
                  </p>

                  {err.affected_concepts.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {err.affected_concepts.map((concept: string) => (
                        <span
                          key={concept}
                          className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700"
                        >
                          {concept}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ROW 3: SPACED REPETITION (SM-2) EBBINGHAUS RETENTION & DUE FORECAST */}
      <div className="p-6 md:p-8 rounded-3xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-cyan-400" />
              <h3 className="text-lg font-bold text-white">Spaced Repetition (SM-2) Retention Decay Forecast</h3>
            </div>
            <p className="text-xs text-slate-400">
              14-day Ebbinghaus memory stability projection and upcoming flashcard review queue
            </p>
          </div>
          {onNavigateToTab && (
            <button
              onClick={() => onNavigateToTab('flashcards')}
              className="px-3.5 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 text-xs font-semibold flex items-center space-x-1.5 transition-all self-start sm:self-auto"
            >
              <span>Open Flashcard Studio</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Retention breakdown metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/60">
            <div className="text-xs text-slate-400">Due Today</div>
            <div className="text-xl font-black text-rose-400 mt-1">
              {retention_forecast.due_today} <span className="text-xs font-normal text-slate-500">cards</span>
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/60">
            <div className="text-xs text-slate-400">Due Next 3 Days</div>
            <div className="text-xl font-black text-amber-400 mt-1">
              {retention_forecast.due_in_3_days} <span className="text-xs font-normal text-slate-500">cards</span>
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/60">
            <div className="text-xs text-slate-400">Mature Cards (Interval &ge; 21d)</div>
            <div className="text-xl font-black text-emerald-400 mt-1">
              {retention_forecast.mature_cards} / {retention_forecast.active_cards}
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/60">
            <div className="text-xs text-slate-400">Average Ease Factor</div>
            <div className="text-xl font-black text-cyan-400 mt-1">
              {retention_forecast.average_ease_factor.toFixed(2)}
            </div>
          </div>
        </div>

        {/* 14-Day Ebbinghaus Retention Forecast Curve */}
        <div className="p-5 rounded-2xl bg-slate-950/40 border border-slate-800/60 space-y-3">
          <div className="text-xs font-bold text-slate-300 flex items-center justify-between">
            <span>Projected Memory Retention Probability over Next 14 Days</span>
            <span className="text-[11px] text-slate-500 font-mono">Formula: R(t) = exp(-t / S)</span>
          </div>

          <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-15 gap-1.5 pt-2">
            {retention_forecast.forecast_days.map((day) => {
              const isToday = day.day_offset === 0;
              const hasDue = day.cards_due > 0;
              return (
                <div
                  key={day.day_offset}
                  className={`p-2 rounded-xl border text-center flex flex-col justify-between transition-all ${
                    isToday
                      ? 'bg-cyan-500/10 border-cyan-500/40 shadow-sm shadow-cyan-500/10'
                      : 'bg-slate-900/40 border-slate-800/50'
                  }`}
                >
                  <div className="text-[10px] text-slate-400 font-mono">
                    {isToday ? 'Today' : `+${day.day_offset}d`}
                  </div>
                  <div className="text-xs font-bold text-white my-1 font-mono">
                    {day.projected_retention_pct.toFixed(0)}%
                  </div>
                  <div
                    className={`text-[9px] font-semibold rounded px-1 py-0.5 ${
                      hasDue ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30' : 'text-slate-500'
                    }`}
                  >
                    {hasDue ? `${day.cards_due} due` : '-'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ROW 4: CURRICULAR CONCEPT MASTERY MATRIX */}
      <div className="p-6 md:p-8 rounded-3xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <Layers className="w-5 h-5 text-violet-400" />
              <h3 className="text-lg font-bold text-white">Curricular Concept Mastery Matrix</h3>
            </div>
            <p className="text-xs text-slate-400">
              Bayesian Knowledge Tracing $P(L)$ probability and adaptive priority rankings
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <input
              type="text"
              placeholder="Search concepts..."
              value={conceptSearch}
              onChange={(e) => setConceptSearch(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            {onNavigateToTab && (
              <button
                onClick={() => onNavigateToTab('mastery')}
                className="px-3.5 py-1.5 rounded-xl bg-violet-500/15 hover:bg-violet-500/25 border border-violet-500/30 text-violet-300 text-xs font-semibold flex items-center space-x-1.5 transition-all"
              >
                <span>Mastery Dashboard</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {filteredConcepts.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            No concepts match the search criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Concept Label</th>
                  <th className="py-3 px-4">Mastery P(L)</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Priority Score</th>
                  <th className="py-3 px-4">BKT History Sparkline</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {filteredConcepts.map((c: ConceptMatrixItem) => {
                  let badge = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
                  if (c.status === 'Mastered') {
                    badge = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                  } else if (c.status === 'In Progress') {
                    badge = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
                  }

                  return (
                    <tr key={c.concept_label} className="hover:bg-slate-800/30 transition-all">
                      <td className="py-3.5 px-4 font-semibold text-white">
                        {c.concept_label}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold">
                        <span className={c.p_know >= 0.85 ? 'text-emerald-400' : (c.p_know >= 0.5 ? 'text-amber-400' : 'text-rose-400')}>
                          {(c.p_know * 100).toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${badge}`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-400">
                        {c.priority_score.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400">
                        <div className="flex items-center space-x-1">
                          {c.history.map((h, idx) => (
                            <span
                              key={idx}
                              className={`inline-block w-2 rounded-sm ${
                                h >= 0.85 ? 'bg-emerald-400' : (h >= 0.5 ? 'bg-amber-400' : 'bg-rose-400')
                              }`}
                              style={{ height: `${Math.max(6, Math.round(h * 20))}px` }}
                              title={`Iteration ${idx + 1}: ${(h * 100).toFixed(0)}%`}
                            />
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ROW 5: 14-DAY ACTIVITY & ENGAGEMENT TIMELINE */}
      <div className="p-6 md:p-8 rounded-3xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md space-y-5">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-indigo-400" />
              <h3 className="text-lg font-bold text-white">14-Day Study Engagement Volume</h3>
            </div>
            <p className="text-xs text-slate-400">
              Daily interactions across assessment attempts, flashcard reviews, and AI Tutor dialogues
            </p>
          </div>
        </div>

        <div className="grid grid-cols-7 sm:grid-cols-14 gap-2 pt-2">
          {activity_timeline.map((point) => {
            const totalActs = point.assessments_count + point.reviews_count + point.tutor_messages_count;
            const hasActivity = totalActs > 0;
            const dayLabel = point.date.split('-').slice(1).join('/');

            return (
              <div
                key={point.date}
                className={`p-2.5 rounded-2xl border text-center flex flex-col justify-between transition-all ${
                  hasActivity
                    ? 'bg-indigo-500/10 border-indigo-500/30'
                    : 'bg-slate-900/30 border-slate-800/40 text-slate-600'
                }`}
              >
                <div className="text-[10px] font-mono text-slate-400">{dayLabel}</div>
                <div className="my-2">
                  <div className={`text-base font-black ${hasActivity ? 'text-white' : 'text-slate-600'}`}>
                    {totalActs}
                  </div>
                  <div className="text-[9px] text-slate-500">acts</div>
                </div>
                <div className="text-[9px] text-slate-500">
                  {point.assessments_count > 0 && <span title="Assessments">📝</span>}
                  {point.reviews_count > 0 && <span title="Flashcards">🗂️</span>}
                  {point.tutor_messages_count > 0 && <span title="Tutor">💬</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
