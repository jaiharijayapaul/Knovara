import React, { useState } from 'react';
import type { 
  AssessmentDetail, 
  AssessmentAttemptDetail, 
  BloomLevel,
  ErrorCategory
} from '@/types/assessment';
import { BLOOM_LEVELS, ERROR_TAXONOMY_META } from '@/types/assessment';
import {
  Award,
  CheckCircle2,
  RotateCcw,
  ArrowLeft,
  Sparkles,
  AlertTriangle,
  Bookmark,
  FileText,
  Video,
  Presentation,
  BookOpen,
  MessageSquare,
  Check,
  X
} from 'lucide-react';

interface AssessmentAttemptReviewProps {
  courseId: string;
  courseName: string;
  assessment: AssessmentDetail;
  attempt: AssessmentAttemptDetail;
  onRetake: () => void;
  onBackToStudio: () => void;
  onAskTutor?: (questionText: string, misconceptionDiagnosis?: string) => void;
  onRemediate?: (questionId: string, errorCategory?: string) => Promise<void> | void;
}

export const AssessmentAttemptReview: React.FC<AssessmentAttemptReviewProps> = ({
  courseName,
  assessment,
  attempt,
  onRetake,
  onBackToStudio,
  onAskTutor,
  onRemediate,
}) => {
  const [filterMode, setFilterMode] = useState<'all' | 'incorrect' | 'correct'>('all');
  const [inspectedCitationSnippet, setInspectedCitationSnippet] = useState<{
    docName?: string | null;
    label?: string | null;
    snippet?: string | null;
  } | null>(null);

  const questionResults = attempt.question_results || [];
  const totalQuestions = questionResults.length;
  const correctCount = questionResults.filter((r) => r.is_correct).length;
  const incorrectCount = totalQuestions - correctCount;

  const filteredResults = questionResults.filter((r) => {
    if (filterMode === 'incorrect') return !r.is_correct;
    if (filterMode === 'correct') return r.is_correct;
    return true;
  });

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}m ${secs}s`;
  };

  const renderDocIcon = (docName?: string | null) => {
    if (!docName) return <BookOpen className="w-3.5 h-3.5 text-teal-400" />;
    const lower = docName.toLowerCase();
    if (lower.endsWith('.pdf')) return <FileText className="w-3.5 h-3.5 text-rose-400" />;
    if (lower.endsWith('.pptx') || lower.endsWith('.ppt')) return <Presentation className="w-3.5 h-3.5 text-amber-400" />;
    if (lower.endsWith('.vtt') || lower.endsWith('.srt') || lower.endsWith('.mp4')) return <Video className="w-3.5 h-3.5 text-cyan-400" />;
    return <BookOpen className="w-3.5 h-3.5 text-teal-400" />;
  };

  // Find question definition from assessment detail
  const getQuestionDef = (questionId: string) => {
    return assessment.questions.find((q) => q.id === questionId);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Bar Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBackToStudio}
          className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-semibold text-slate-300 flex items-center gap-2 transition-all shadow-sm cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 text-teal-400" />
          <span>Back to Quizzes</span>
        </button>

        <button
          onClick={onRetake}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-lg shadow-teal-500/20 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Retake Quiz</span>
        </button>
      </div>

      {/* Hero Performance Banner */}
      <div className="p-6 md:p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${
                  attempt.passed
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                }`}
              >
                {attempt.passed ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Great Job! You Passed 🎉</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                    <span>Keep Practicing &bull; Review Below 💪</span>
                  </>
                )}
              </span>

              <span className="text-xs text-slate-500 font-medium">
                Pass Mark: {assessment.pass_percentage}%
              </span>
            </div>

            <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">
              {assessment.title} &mdash; Quiz Results
            </h1>

            <p className="text-xs text-slate-400 max-w-xl">
              Subject: <span className="text-slate-200 font-medium">{courseName}</span> &bull; Topic: <span className="text-slate-200 font-medium">{assessment.topic || 'General Overview'}</span>
            </p>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-3 gap-3 md:gap-4 shrink-0">
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-center min-w-[100px]">
              <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1">
                Score
              </div>
              <div
                className={`text-2xl font-black font-mono ${
                  attempt.passed ? 'text-teal-400' : 'text-rose-400'
                }`}
              >
                {Math.round(attempt.percentage)}%
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {attempt.score} / {attempt.total_points} pts
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-center min-w-[100px]">
              <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1">
                Correct
              </div>
              <div className="text-2xl font-black font-mono text-slate-100">
                {correctCount}/{totalQuestions}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                Questions
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-center min-w-[100px]">
              <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1">
                Time Spent
              </div>
              <div className="text-2xl font-black font-mono text-cyan-300">
                {formatTime(attempt.time_spent_seconds)}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                Duration
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Review Feedback Card */}
      <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">
                Review Tips & Concept Feedback
              </h3>
              <p className="text-[11px] text-slate-400">
                Helpful advice to master the concepts from your notes.
              </p>
            </div>
          </div>

          <div className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-950 text-slate-400 border border-slate-800">
            {incorrectCount === 0 ? (
              <span className="text-emerald-400 font-bold">All Questions Correct! Excellent work!</span>
            ) : (
              <span>{incorrectCount} question(s) to review</span>
            )}
          </div>
        </div>

        {/* 5 Taxonomy Mode Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {(
            [
              'factual_misconception',
              'procedural_slip',
              'formula_inversion',
              'dimensionality_confusion',
              'unchecked_assumption',
            ] as ErrorCategory[]
          ).map((cat) => {
            const meta = ERROR_TAXONOMY_META[cat];
            const count = attempt.error_summary?.[cat] || 0;
            const hasErrors = count > 0;

            return (
              <div
                key={cat}
                className={`p-3.5 rounded-2xl border transition-all ${
                  hasErrors
                    ? `${meta.bgLightClass} ${meta.borderClass}`
                    : 'bg-slate-950/60 border-slate-800/80 opacity-70'
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider ${
                      hasErrors ? meta.textClass : 'text-slate-500'
                    }`}
                  >
                    {meta.shortLabel}
                  </span>
                  <span
                    className={`w-5 h-5 rounded-full text-[11px] font-extrabold flex items-center justify-center ${
                      hasErrors
                        ? `${meta.badgeClass}`
                        : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    {count}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 line-clamp-2 leading-snug">
                  {meta.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bloom's Taxonomy Cognitive Performance Bar Chart */}
      <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
          <Award className="w-5 h-5 text-teal-400" />
          <h3 className="text-sm font-bold text-white tracking-tight">
            Cognitive Depth Mastery (Bloom's Taxonomy)
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(Object.keys(BLOOM_LEVELS) as BloomLevel[]).map((level) => {
            const bloomMeta = BLOOM_LEVELS[level];
            const stats = attempt.bloom_summary?.[level];
            if (!stats || stats.total === 0) return null;

            const accuracy = Math.round(stats.percentage);

            return (
              <div
                key={level}
                className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-2"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${bloomMeta.colorClass} bg-current`}
                    />
                    <span className="font-bold text-white">{bloomMeta.label}</span>
                  </div>
                  <span className="font-mono font-bold text-slate-300">
                    {stats.correct} / {stats.total} ({accuracy}%)
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      accuracy >= 80
                        ? 'bg-emerald-400'
                        : accuracy >= 50
                        ? 'bg-amber-400'
                        : 'bg-rose-400'
                    }`}
                    style={{ width: `${accuracy}%` }}
                  />
                </div>

                <div className="text-[10px] text-slate-500">
                  {accuracy === 100
                    ? 'Perfect mastery at this cognitive depth.'
                    : accuracy >= 50
                    ? 'Developing grasp; review edge-case applications.'
                    : 'Targeted remediation required.'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Question By Question Diagnostic Inspection */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-white tracking-tight">
              Questions & Answers Review
            </h3>
            <span className="text-xs text-slate-500">
              ({filteredResults.length} questions)
            </span>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center p-1 rounded-xl bg-slate-900 border border-slate-800 gap-1">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filterMode === 'all'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All ({totalQuestions})
            </button>
            <button
              onClick={() => setFilterMode('incorrect')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filterMode === 'incorrect'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Needs Review ({incorrectCount})
            </button>
            <button
              onClick={() => setFilterMode('correct')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filterMode === 'correct'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Correct ({correctCount})
            </button>
          </div>
        </div>

        {/* Results List */}
        <div className="space-y-4">
          {filteredResults.map((result) => {
            const qDef = getQuestionDef(result.question_id);
            const bloomMeta =
              BLOOM_LEVELS[result.bloom_level as BloomLevel] || BLOOM_LEVELS.understand;
            const errorMeta = ERROR_TAXONOMY_META[result.error_category];

            return (
              <div
                key={result.question_id}
                className={`p-6 rounded-3xl border transition-all ${
                  result.is_correct
                    ? 'bg-slate-900/60 border-slate-800/80'
                    : 'bg-slate-900/90 border-rose-500/30 shadow-lg shadow-rose-950/20'
                }`}
              >
                {/* Question Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs ${
                        result.is_correct
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {result.is_correct ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <X className="w-4 h-4" />
                      )}
                    </span>

                    <span className="text-xs font-bold text-white">
                      Question {result.order_index + 1}
                    </span>

                    <span
                      className={`px-2 py-0.5 text-[11px] font-bold rounded-full border ${bloomMeta.tagClass}`}
                    >
                      {bloomMeta.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-bold font-mono px-2.5 py-1 rounded-lg ${
                        result.is_correct
                          ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                      }`}
                    >
                      {result.points_earned} / {result.points_possible} pts
                    </span>
                  </div>
                </div>

                {/* Prompt */}
                <div className="text-sm font-medium text-slate-100 mb-5 leading-relaxed">
                  {qDef?.question_text || 'Question text unavailable'}
                </div>

                {/* Prominent Error Taxonomy Diagnosis Banner if Wrong */}
                {!result.is_correct && (
                  <div
                    className={`p-4 rounded-2xl mb-5 border space-y-2.5 ${errorMeta.bgLightClass} ${errorMeta.borderClass}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className={`w-4 h-4 ${errorMeta.textClass}`} />
                        <span className={`text-xs font-bold uppercase tracking-wider ${errorMeta.textClass}`}>
                          Taxonomy Diagnosis: {errorMeta.title}
                        </span>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${errorMeta.badgeClass}`}>
                        {errorMeta.shortLabel}
                      </span>
                    </div>

                    {result.misconception_diagnosis && (
                      <p className="text-xs text-slate-200 leading-relaxed font-medium">
                        {result.misconception_diagnosis}
                      </p>
                    )}

                    {result.remediation_hint && (
                      <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-xs space-y-1">
                        <div className="text-[10px] uppercase font-bold text-teal-400">
                          Targeted Remediation Advice:
                        </div>
                        <p className="text-slate-300 leading-relaxed">
                          {result.remediation_hint}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Options List */}
                <div className="space-y-2 mb-5">
                  {qDef?.options.map((opt, optIdx) => {
                    const letter = String.fromCharCode(65 + optIdx);
                    const isSelected = result.selected_answers.includes(opt.id);
                    const isCorrect = result.correct_answers.includes(opt.id);

                    let itemClass = 'bg-slate-950/50 border-slate-800/80 text-slate-400';
                    let badge = null;

                    if (isSelected && isCorrect) {
                      itemClass = 'bg-emerald-500/10 border-emerald-500/50 text-white font-medium';
                      badge = (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          Your Answer &bull; Correct
                        </span>
                      );
                    } else if (isSelected && !isCorrect) {
                      itemClass = 'bg-rose-500/10 border-rose-500/50 text-rose-200';
                      badge = (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/30">
                          Your Answer &bull; Distractor Trap
                        </span>
                      );
                    } else if (!isSelected && isCorrect) {
                      itemClass = 'bg-emerald-500/5 border-emerald-500/30 text-emerald-200 font-medium';
                      badge = (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          Correct Answer
                        </span>
                      );
                    }

                    return (
                      <div
                        key={opt.id}
                        className={`p-3 rounded-xl border flex items-start justify-between gap-3 text-xs ${itemClass}`}
                      >
                        <div className="flex items-start gap-2.5">
                          <span className="font-bold font-mono text-slate-400 shrink-0 mt-0.5">
                            {letter}.
                          </span>
                          <span className="leading-relaxed">{opt.text}</span>
                        </div>
                        {badge && <div className="shrink-0">{badge}</div>}
                      </div>
                    );
                  })}
                </div>

                {/* Explanation */}
                {result.explanation && (
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1 mb-4">
                    <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                      Ground Truth Explanation:
                    </div>
                    <p className="text-slate-300 leading-relaxed">
                      {result.explanation}
                    </p>
                  </div>
                )}

                {/* Footer: Source Coordinate Citation & Ask AI Tutor Action */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800/80">
                  <div className="flex items-center gap-2">
                    {result.citation_label ? (
                      <button
                        onClick={() =>
                          setInspectedCitationSnippet({
                            docName: result.document_name,
                            label: result.citation_label,
                            snippet: result.source_snippet,
                          })
                        }
                        className="px-2.5 py-1 rounded-lg bg-teal-500/10 border border-teal-500/30 hover:bg-teal-500/20 text-[11px] font-mono text-teal-300 flex items-center gap-1.5 transition-colors"
                      >
                        {renderDocIcon(result.document_name)}
                        <span>{result.citation_label}</span>
                        <Bookmark className="w-3 h-3 text-teal-400" />
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-500 italic">
                        General Course Foundation
                      </span>
                    )}
                  </div>

                  {/* Socratic Deep Link */}
                  {onRemediate && !result.is_correct ? (
                    <button
                      onClick={() => onRemediate(result.question_id, result.error_category)}
                      className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center gap-1.5 transition-all shadow-md shadow-indigo-500/20"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-indigo-200" />
                      <span>🧠 Remediate with AI Tutor</span>
                    </button>
                  ) : onAskTutor ? (
                    <button
                      onClick={() =>
                        onAskTutor(
                          qDef?.question_text || '',
                          result.misconception_diagnosis || undefined
                        )
                      }
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-teal-300 hover:text-white flex items-center gap-1.5 transition-all shadow-sm"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-teal-400" />
                      <span>Discuss with AI Socratic Tutor</span>
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Grounded Citation Modal */}
      {inspectedCitationSnippet && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-teal-400" />
                <h4 className="text-sm font-bold text-white">Grounded Citation Excerpt</h4>
              </div>
              <button
                onClick={() => setInspectedCitationSnippet(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">
                  Source Coordinate
                </div>
                <div className="flex items-center gap-1.5 text-teal-300 font-mono font-semibold">
                  {renderDocIcon(inspectedCitationSnippet.docName)}
                  <span>{inspectedCitationSnippet.label}</span>
                </div>
              </div>

              {inspectedCitationSnippet.snippet ? (
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-[10px] uppercase font-bold text-slate-500 mb-1.5">
                    Original Source Text:
                  </div>
                  <p className="text-slate-300 italic font-serif leading-relaxed border-l-2 border-teal-500 pl-3">
                    "{inspectedCitationSnippet.snippet}"
                  </p>
                </div>
              ) : (
                <p className="text-slate-500 italic">No exact snippet saved for this coordinate.</p>
              )}

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setInspectedCitationSnippet(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
