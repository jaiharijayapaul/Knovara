import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { 
  AssessmentDetail, 
  AssessmentSubmitRequest, 
  AssessmentAttemptDetail,
  BloomLevel 
} from '@/types/assessment';
import { BLOOM_LEVELS } from '@/types/assessment';
import { submitAssessment } from '@/services/api';
import {
  Clock,
  Timer,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Loader2,
  Award,
  HelpCircle,
  Flag,
  Flame,
  Check
} from 'lucide-react';

interface AssessmentTestRunnerProps {
  courseId: string;
  assessment: AssessmentDetail;
  isTimedMode?: boolean;
  timeLimitMinutes?: number;
  onCompleted: (attempt: AssessmentAttemptDetail) => void;
  onCancel: () => void;
}

export const AssessmentTestRunner: React.FC<AssessmentTestRunnerProps> = ({
  courseId,
  assessment,
  isTimedMode = false,
  timeLimitMinutes,
  onCompleted,
  onCancel,
}) => {
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string[]>>({});
  const [secondsElapsed, setSecondsElapsed] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<string>>(new Set());
  const [timedModeActive, setTimedModeActive] = useState<boolean>(isTimedMode);

  const hasAutoSubmittedRef = useRef(false);

  const questions = assessment.questions || [];
  const currentQuestion = questions[currentIndex];
  const totalQuestions = questions.length;

  const totalTimeLimitSeconds = (timeLimitMinutes || assessment.time_limit_minutes || 15) * 60;
  const secondsRemaining = Math.max(0, totalTimeLimitSeconds - secondsElapsed);

  // Deterministically rotate display order so correct answers are not always in slot A
  const displayOptions = React.useMemo(() => {
    if (!currentQuestion?.options || currentQuestion.options.length <= 1) {
      return currentQuestion?.options || [];
    }
    const qSeed = currentQuestion.id
      ? currentQuestion.id.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0)
      : currentIndex;
    const offset = qSeed % currentQuestion.options.length;
    return [
      ...currentQuestion.options.slice(offset),
      ...currentQuestion.options.slice(0, offset),
    ];
  }, [currentQuestion, currentIndex]);

  // Active elapsed timer
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSelectOption = (questionId: string, optionId: string) => {
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionId]: [optionId],
    }));
  };

  const toggleFlagQuestion = (questionId: string) => {
    setFlaggedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }
      return next;
    });
  };

  const answeredCount = Object.keys(selectedAnswers).filter(
    (qid) => (selectedAnswers[qid] || []).length > 0
  ).length;

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);
    setSubmitError(null);

    const answersMap: Record<string, string[]> = {};
    for (const q of questions) {
      answersMap[q.id] = selectedAnswers[q.id] || [];
    }

    const payload: AssessmentSubmitRequest = {
      time_spent_seconds: secondsElapsed,
      answers: answersMap,
      responses: questions.map((q) => ({
        question_id: q.id,
        selected_answers: selectedAnswers[q.id] || [],
      })),
    };

    try {
      const attempt = await submitAssessment(courseId, assessment.id, payload);
      onCompleted(attempt);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to submit assessment for scoring.';
      setSubmitError(msg);
      setIsSubmitting(false);
      setShowConfirmModal(false);
    }
  }, [courseId, assessment.id, questions, selectedAnswers, secondsElapsed, onCompleted]);

  // Auto-submit when countdown hits zero in Timed Mock Exam mode
  useEffect(() => {
    if (timedModeActive && secondsRemaining === 0 && !hasAutoSubmittedRef.current && !isSubmitting) {
      hasAutoSubmittedRef.current = true;
      handleSubmit();
    }
  }, [timedModeActive, secondsRemaining, isSubmitting, handleSubmit]);

  if (!currentQuestion) {
    return (
      <div className="p-12 text-center text-slate-400 bg-slate-900/60 rounded-2xl border border-slate-800">
        <HelpCircle className="w-10 h-10 text-slate-600 mx-auto mb-3" />
        <p>No questions found in this assessment.</p>
        <button
          onClick={onCancel}
          className="mt-4 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors cursor-pointer"
        >
          Return to Studio
        </button>
      </div>
    );
  }

  const bloomMeta = BLOOM_LEVELS[currentQuestion.bloom_level as BloomLevel] || BLOOM_LEVELS.understand;
  const currentAnswers = selectedAnswers[currentQuestion.id] || [];
  const isCurrentFlagged = flaggedQuestions.has(currentQuestion.id);

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Exam Header */}
      <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Exit Exam"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              {timedModeActive ? (
                <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-md bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 border border-amber-500/30 uppercase tracking-wider flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                  <span>Timed Mock Exam</span>
                </span>
              ) : (
                <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-md bg-teal-500/20 text-teal-300 border border-teal-500/30 uppercase tracking-wider">
                  Practice Quiz
                </span>
              )}

              <h2 className="text-sm md:text-base font-bold text-white tracking-tight">
                {assessment.title}
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Topic: <span className="text-slate-300 font-medium">{assessment.topic || 'General Material'}</span> &bull; {totalQuestions} Questions &bull; {assessment.total_points} Points
            </p>
          </div>
        </div>

        {/* Timer, Live Progress & Submit Button */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Countdown Timer (or Elapsed Timer) */}
          {timedModeActive ? (
            <div
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border shadow-inner transition-colors ${
                secondsRemaining <= 60
                  ? 'bg-rose-500/20 border-rose-500/50 text-rose-300 animate-pulse'
                  : secondsRemaining <= 120
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                  : 'bg-slate-950 border-slate-800 text-slate-200'
              }`}
              title="Time Remaining"
            >
              <Timer className={`w-4 h-4 ${secondsRemaining <= 60 ? 'text-rose-400 animate-spin' : secondsRemaining <= 120 ? 'text-amber-400' : 'text-teal-400'}`} />
              <div className="text-xs font-mono font-bold">
                {formatTime(secondsRemaining)} left
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 shadow-inner" title="Time Elapsed">
              <Clock className="w-4 h-4 text-teal-400 animate-pulse" />
              <div className="text-xs font-mono font-bold text-slate-200">
                {formatTime(secondsElapsed)}
              </div>
            </div>
          )}

          {/* Mode Switch Pill */}
          <button
            type="button"
            onClick={() => setTimedModeActive(!timedModeActive)}
            className="text-[11px] font-semibold px-2.5 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition-colors cursor-pointer"
            title="Toggle between Timed Countdown and Relaxed Untimed Mode"
          >
            {timedModeActive ? 'Switch to Untimed' : 'Switch to Timed'}
          </button>

          <div className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-800/80 text-slate-300 border border-slate-700/50">
            <span className="text-teal-400 font-bold">{answeredCount}</span> of {totalQuestions} Answered
          </div>

          <button
            onClick={() => setShowConfirmModal(true)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-teal-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Finish Quiz</span>
          </button>
        </div>
      </div>

      {/* Auto-Submit / Urgent Final Minute Warning */}
      {timedModeActive && secondsRemaining <= 60 && (
        <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs flex items-center justify-between gap-3 animate-pulse shadow-lg">
          <div className="flex items-center gap-2 font-medium">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>⚠️ Final Minute Alert: Under 60 seconds remaining! Your mock exam will automatically submit when time expires.</span>
          </div>
          <span className="font-mono font-bold text-xs text-white px-2 py-0.5 rounded bg-rose-500/40">
            {formatTime(secondsRemaining)}
          </span>
        </div>
      )}

      {submitError && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{submitError}</span>
        </div>
      )}

      {/* Question Number Strip Navigator Palette */}
      <div className="p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin py-1">
          <span className="text-[11px] font-bold text-slate-400 px-2 shrink-0 uppercase tracking-wider">
            Palette:
          </span>
          <div className="flex items-center gap-1.5">
            {questions.map((q, idx) => {
              const isCurrent = idx === currentIndex;
              const isAnswered = (selectedAnswers[q.id] || []).length > 0;
              const isFlagged = flaggedQuestions.has(q.id);

              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentIndex(idx)}
                  className={`relative w-8 h-8 rounded-xl text-xs font-bold transition-all flex items-center justify-center shrink-0 cursor-pointer ${
                    isCurrent
                      ? 'bg-teal-500 text-slate-950 ring-2 ring-teal-400 shadow-md shadow-teal-500/20'
                      : isFlagged
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/60 hover:bg-amber-500/30'
                      : isAnswered
                      ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 hover:bg-teal-500/30'
                      : 'bg-slate-950 text-slate-400 border border-slate-800 hover:border-slate-700 hover:text-slate-200'
                  }`}
                  title={`Question ${idx + 1}${isAnswered ? ' (Answered)' : ''}${isFlagged ? ' (Flagged for Review)' : ''}`}
                >
                  {idx + 1}
                  {isFlagged && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-slate-900" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-[11px] text-slate-400 px-2 shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-500" />
            <span>Answered ({answeredCount})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span>Flagged ({flaggedQuestions.size})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-700" />
            <span>Unanswered ({totalQuestions - answeredCount})</span>
          </div>
        </div>
      </div>

      {/* Question Display Card */}
      <div className="p-6 md:p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />

        {/* Question Header Meta */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-800/80">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Question {currentIndex + 1} of {totalQuestions}
            </span>
            <span className="text-slate-600">&bull;</span>
            <span
              className={`px-2.5 py-0.5 text-xs font-bold rounded-full border ${bloomMeta.tagClass}`}
            >
              {bloomMeta.label} ({bloomMeta.badge})
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Flag for Review Button */}
            <button
              type="button"
              onClick={() => toggleFlagQuestion(currentQuestion.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                isCurrentFlagged
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 hover:bg-amber-500/30'
                  : 'bg-slate-950 text-slate-400 border border-slate-800 hover:border-slate-700 hover:text-slate-200'
              }`}
              title={isCurrentFlagged ? 'Click to unflag' : 'Flag this question to review later'}
            >
              <Flag className={`w-3.5 h-3.5 ${isCurrentFlagged ? 'fill-amber-400 text-amber-400' : ''}`} />
              <span>{isCurrentFlagged ? 'Flagged for Review' : 'Flag for Review'}</span>
            </button>

            <span className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-950 border border-slate-800 text-slate-300 flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-amber-400" />
              <span>{currentQuestion.points} Points</span>
            </span>
          </div>
        </div>

        {/* Question Text */}
        <div className="mb-8">
          <h3 className="text-base md:text-lg font-medium text-slate-100 leading-relaxed">
            {currentQuestion.question_text}
          </h3>
        </div>

        {/* Options Grid */}
        <div className="space-y-3 mb-8">
          {displayOptions.map((option, optIdx) => {
            const letter = String.fromCharCode(65 + optIdx);
            const isSelected = currentAnswers.includes(option.id);

            return (
              <button
                key={option.id}
                onClick={() => handleSelectOption(currentQuestion.id, option.id)}
                className={`w-full p-4 rounded-2xl border text-left transition-all flex items-start gap-4 group cursor-pointer ${
                  isSelected
                    ? 'bg-teal-500/10 border-teal-500/80 text-white shadow-lg shadow-teal-500/10 ring-1 ring-teal-500/50'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-950 text-slate-300'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-xl font-bold text-xs flex items-center justify-center shrink-0 transition-all ${
                    isSelected
                      ? 'bg-teal-500 text-slate-950 font-extrabold shadow'
                      : 'bg-slate-800 border border-slate-700 text-slate-400 group-hover:border-slate-600 group-hover:text-slate-200'
                  }`}
                >
                  {letter}
                </div>

                <div className="flex-1 pt-0.5 text-sm leading-relaxed">
                  {option.text}
                </div>
              </button>
            );
          })}
        </div>

        {/* Bottom Pagination & Navigation Controls */}
        <div className="flex items-center justify-between pt-6 border-t border-slate-800/80">
          <button
            onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
            disabled={currentIndex === 0}
            className="px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 disabled:opacity-30 disabled:hover:border-slate-800 text-xs font-semibold text-slate-300 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Previous</span>
          </button>

          <div className="text-xs text-slate-500 font-medium">
            {currentAnswers.length > 0 ? (
              <span className="text-teal-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Answer selected
              </span>
            ) : (
              <span>Select an answer above</span>
            )}
          </div>

          {currentIndex < totalQuestions - 1 ? (
            <button
              onClick={() => setCurrentIndex((prev) => Math.min(totalQuestions - 1, prev + 1))}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
            >
              <span>Next</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={() => setShowConfirmModal(true)}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-lg shadow-teal-500/20 cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Review & Submit</span>
            </button>
          )}
        </div>
      </div>

      {/* Confirmation & Submit Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-teal-500/20 border border-teal-500/30 text-teal-400 flex items-center justify-center mx-auto">
                <Sparkles className="w-6 h-6" />
              </div>

              <div>
                <h3 className="text-lg font-bold text-white tracking-tight">
                  Ready to Submit Your Quiz?
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  We will calculate your score and give you clear, step-by-step explanations for each question.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-left space-y-2 text-xs">
                <div className="flex justify-between items-center text-slate-300">
                  <span>Total Questions:</span>
                  <span className="font-semibold text-white">{totalQuestions}</span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span>Answered Questions:</span>
                  <span className="font-semibold text-teal-400">{answeredCount}</span>
                </div>
                {flaggedQuestions.size > 0 && (
                  <div className="flex justify-between items-center text-amber-400 font-medium">
                    <span>Flagged for Review:</span>
                    <span>{flaggedQuestions.size}</span>
                  </div>
                )}
                {answeredCount < totalQuestions && (
                  <div className="flex justify-between items-center text-rose-400 font-medium pt-1 border-t border-slate-800">
                    <span>Unanswered (marked wrong):</span>
                    <span>{totalQuestions - answeredCount}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-slate-300 pt-1 border-t border-slate-800">
                  <span>{timedModeActive ? 'Time Remaining:' : 'Time Spent:'}</span>
                  <span className="font-mono text-slate-200">
                    {timedModeActive ? formatTime(secondsRemaining) : formatTime(secondsElapsed)}
                  </span>
                </div>
              </div>

              {flaggedQuestions.size > 0 && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] text-left">
                  Note: You still have {flaggedQuestions.size} flagged question(s). You can return to review them now or submit.
                </div>
              )}

              {answeredCount < totalQuestions && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] text-left">
                  Note: You have {totalQuestions - answeredCount} unanswered question(s). Are you ready to submit now?
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors cursor-pointer"
                >
                  Keep Reviewing
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Scoring...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 stroke-[2.5]" />
                      <span>Submit & View Results</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
