import React, { useState, useEffect } from 'react';
import type { Course } from '@/types/course';
import type { DocumentItem } from '@/types/document';
import type { CourseMastery } from '@/types/mastery';
import type { Flashcard } from '@/types/flashcard';
import { fetchCourseMastery, fetchFlashcards } from '@/services/api';
import {
  Printer,
  Copy,
  Check,
  X,
  BookOpen,
  AlertTriangle,
  CheckCircle2,
  ListChecks,
  HelpCircle,
  Lightbulb,
  FileText,
  Loader2,
  Eye,
  EyeOff
} from 'lucide-react';

interface ExamRevisionSheetModalProps {
  course: Course;
  documents: DocumentItem[];
  studentName?: string;
  onClose: () => void;
}

export const ExamRevisionSheetModal: React.FC<ExamRevisionSheetModalProps> = ({
  course,
  documents,
  studentName = 'Student',
  onClose,
}) => {
  const [mastery, setMastery] = useState<CourseMastery | null>(null);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [showAnswers, setShowAnswers] = useState<boolean>(true);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({
    'weak-concepts': false,
    'mock-exam': false,
    'misconceptions': false,
    'flashcard-recall': false,
    'rest-prep': false,
  });

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      setLoading(true);
      try {
        const [masteryData, cardsData] = await Promise.allSettled([
          fetchCourseMastery(course.id),
          fetchFlashcards(course.id),
        ]);

        if (!isMounted) return;

        if (masteryData.status === 'fulfilled') {
          setMastery(masteryData.value);
        }
        if (cardsData.status === 'fulfilled') {
          setFlashcards(cardsData.value);
        }
      } catch (err) {
        console.error('Failed to load study guide data:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadData();
    return () => {
      isMounted = false;
    };
  }, [course.id]);

  const toggleCheck = (key: string) => {
    setCheckedItems((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handlePrint = () => {
    window.print();
  };

  // High priority concepts (mastery < 70% or marked needs_work / developing)
  const weakConcepts = mastery?.concepts.filter(
    (c) => c.mastery_status === 'needs_work' || c.mastery_status === 'developing' || c.mastery_percentage < 70
  ) || [];

  const masteredConcepts = mastery?.concepts.filter(
    (c) => c.mastery_status === 'mastered' || c.mastery_percentage >= 85
  ) || [];

  const handleCopyMarkdown = () => {
    let content = `# Exam Revision Sheet: ${course.name}\n`;
    content += `**Subject:** ${course.subject} | **Student:** ${studentName} | **Date:** ${currentDate}\n\n`;

    if (weakConcepts.length > 0) {
      content += `## 🚨 High-Priority Focus Areas (Needs Review)\n`;
      weakConcepts.forEach((c) => {
        const action = c.accuracy_rate > 0
          ? `Current accuracy: ${Math.round(c.accuracy_rate * 100)}% (${c.correct_attempts}/${c.total_attempts} correct). Review core definitions.`
          : 'Needs practice: review definitions and take practice questions.';
        content += `- **${c.concept_label}** (Mastery: ${Math.round(c.mastery_percentage)}%) - ${action}\n`;
      });
      content += `\n`;
    }

    content += `## 📚 Core Topics & Concepts\n`;
    (course.topics || []).forEach((t) => {
      content += `- **${t.name}**: ${t.description || 'Core syllabus topic'}\n`;
    });
    content += `\n`;

    if (flashcards.length > 0) {
      content += `## 🧠 High-Yield Quick Q&A\n`;
      flashcards.slice(0, 10).forEach((f, idx) => {
        content += `${idx + 1}. **Q: ${f.front}**\n   **A:** ${f.back}\n\n`;
      });
    }

    content += `## ✅ Exam Readiness Checklist\n`;
    content += `- [ ] Review all high-priority weak concepts\n`;
    content += `- [ ] Complete a timed mock exam\n`;
    content += `- [ ] Review misconceptions and past mistakes\n`;
    content += `- [ ] Practice rapid flashcard recall\n`;
    content += `- [ ] Rest well before exam day\n`;

    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      {/* Print-specific style tag to ensure ultra-clean PDF export */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .revision-sheet-printable, .revision-sheet-printable * {
            visibility: visible;
          }
          .revision-sheet-printable {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            margin: 0 !important;
            padding: 24px !important;
            background: #ffffff !important;
            color: #0f172a !important;
            box-shadow: none !important;
            border: none !important;
            font-size: 11pt;
            line-height: 1.5;
          }
          .no-print {
            display: none !important;
          }
          .print-border {
            border: 1px solid #cbd5e1 !important;
            background: #f8fafc !important;
            color: #0f172a !important;
          }
          .print-card {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            border: 1px solid #e2e8f0 !important;
            background: #ffffff !important;
            margin-bottom: 16px !important;
          }
          .print-text-dark {
            color: #0f172a !important;
          }
          .print-text-muted {
            color: #475569 !important;
          }
        }
      `}</style>

      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Top Control Bar (Hidden when printing) */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between gap-3 bg-slate-950/80 no-print">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <span>One-Click Exam Revision Sheet</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                  Ready to Print
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                A clean, student-friendly study guide tailored to your course material and focus areas.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAnswers(!showAnswers)}
              className="px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-800 text-xs font-medium text-slate-300 transition-colors flex items-center gap-1.5 cursor-pointer"
              title={showAnswers ? 'Hide Answers for Self-Testing' : 'Show Answers'}
            >
              {showAnswers ? <EyeOff className="w-3.5 h-3.5 text-slate-400" /> : <Eye className="w-3.5 h-3.5 text-teal-400" />}
              <span className="hidden sm:inline">{showAnswers ? 'Hide Answers' : 'Show Answers'}</span>
            </button>

            <button
              onClick={handleCopyMarkdown}
              className="px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-800 text-xs font-medium text-slate-300 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy'}</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 text-xs font-bold transition-all shadow-lg shadow-teal-500/20 flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Print / Save PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Printable Document Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6 revision-sheet-printable text-slate-200">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-500 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-teal-400" />
              <p className="text-xs">Preparing your customized exam revision sheet...</p>
            </div>
          ) : (
            <>
              {/* Document Header */}
              <div className="pb-6 border-b border-slate-800 print-border p-6 rounded-2xl bg-slate-950/60 print-card">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20">
                      {course.subject} &bull; Study Handout
                    </span>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-white print-text-dark tracking-tight">
                      {course.name}
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-400 print-text-muted">
                      {course.description || 'Comprehensive exam preparation sheet generated from verified course material.'}
                    </p>
                  </div>

                  <div className="text-left sm:text-right text-xs text-slate-400 print-text-muted space-y-1 shrink-0">
                    <div>Student: <span className="font-semibold text-slate-200 print-text-dark">{studentName}</span></div>
                    <div>Date: <span className="font-semibold text-slate-200 print-text-dark">{currentDate}</span></div>
                    {mastery && (
                      <div className="inline-block mt-1 px-2.5 py-1 rounded-lg bg-teal-500/15 border border-teal-500/30 text-teal-300 font-bold">
                        Overall Preparedness: {Math.round(mastery.overall_mastery_percentage)}%
                      </div>
                    )}
                  </div>
                </div>

                {/* Quick Stats Pill Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-800/80">
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 print-border">
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider">Key Topics</div>
                    <div className="text-lg font-bold text-white print-text-dark">{course.topics?.length || 0}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 print-border">
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider">Course Notes</div>
                    <div className="text-lg font-bold text-white print-text-dark">{documents.length} Files</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 print-border">
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider">Focus Areas</div>
                    <div className="text-lg font-bold text-amber-400 print-text-dark">{weakConcepts.length} Topics</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 print-border">
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider">Flashcard Q&As</div>
                    <div className="text-lg font-bold text-teal-400 print-text-dark">{flashcards.length} Cards</div>
                  </div>
                </div>
              </div>

              {/* Section 1: 🚨 High-Priority Revision Topics */}
              <div className="p-6 rounded-2xl bg-slate-950/60 border border-slate-800 print-card space-y-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                  <h2 className="text-base font-bold text-white print-text-dark">
                    1. High-Priority Revision Topics (Where to Focus First)
                  </h2>
                </div>
                <p className="text-xs text-slate-400 print-text-muted">
                  These concepts showed lower quiz accuracy or require extra practice based on your learning data. Spend 60% of your study time here.
                </p>

                {weakConcepts.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    {weakConcepts.map((concept) => (
                      <div
                        key={concept.concept_label}
                        className="p-3.5 rounded-xl bg-slate-900/90 border border-amber-500/30 print-border flex flex-col justify-between"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-sm text-slate-200 print-text-dark">
                              {concept.concept_label}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                              {Math.round(concept.mastery_percentage)}% Score
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 print-text-muted leading-relaxed">
                            {concept.accuracy_rate > 0
                              ? `Current accuracy is ${Math.round(concept.accuracy_rate * 100)}% (${concept.correct_attempts} of ${concept.total_attempts} correct). Review key formulas and step-by-step examples.`
                              : 'Needs practice: review core definitions, notes, and take targeted practice questions.'}
                          </p>
                        </div>
                        <div className="mt-2 text-[10px] text-amber-400 font-medium">
                          Priority: High &bull; Needs active recall
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                    <span>Great job! All your tracked concepts are currently at strong mastery levels. Continue general review.</span>
                  </div>
                )}

                {/* Confident / Mastered Concepts Pill Strip */}
                {masteredConcepts.length > 0 && (
                  <div className="pt-2">
                    <div className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1.5 mb-2">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Confirmed Mastered Concepts ({masteredConcepts.length}):</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {masteredConcepts.map((mc) => (
                        <span
                          key={mc.concept_label}
                          className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-xs font-medium"
                        >
                          {mc.concept_label} ({Math.round(mc.mastery_percentage)}%)
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Section 2: 📚 Core Concepts & Principles */}
              <div className="p-6 rounded-2xl bg-slate-950/60 border border-slate-800 print-card space-y-4">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-teal-400 shrink-0" />
                  <h2 className="text-base font-bold text-white print-text-dark">
                    2. Core Concepts & Key Definitions
                  </h2>
                </div>
                <p className="text-xs text-slate-400 print-text-muted">
                  Fundamental building blocks and key takeaways extracted from your course materials.
                </p>

                <div className="space-y-3 pt-1">
                  {(course.topics && course.topics.length > 0) ? (
                    course.topics.map((t, index) => (
                      <div
                        key={t.id || index}
                        className="p-4 rounded-xl bg-slate-900 border border-slate-800/80 print-border space-y-1.5"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-teal-500/20 text-teal-300 font-bold text-xs flex items-center justify-center">
                            {index + 1}
                          </span>
                          <h3 className="font-bold text-sm text-slate-100 print-text-dark">
                            {t.name}
                          </h3>
                        </div>
                        <p className="text-xs text-slate-300 print-text-dark leading-relaxed pl-8">
                          {t.description || 'Important concept for this course. Be prepared to explain the definition and give an example.'}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-400">
                      Upload course documents to automatically synthesize core concepts and key definitions.
                    </div>
                  )}
                </div>
              </div>

              {/* Section 3: 🧠 High-Yield Quick Q&A (Active Recall) */}
              {flashcards.length > 0 && (
                <div className="p-6 rounded-2xl bg-slate-950/60 border border-slate-800 print-card space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <HelpCircle className="w-5 h-5 text-indigo-400 shrink-0" />
                      <h2 className="text-base font-bold text-white print-text-dark">
                        3. High-Yield Quick Q&A (Rapid Testing)
                      </h2>
                    </div>
                    <span className="text-xs text-slate-400 print-text-muted no-print">
                      {showAnswers ? 'Answers visible' : 'Answers hidden (Test yourself)'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 print-text-muted">
                    Practice answering these questions in your head before looking at the answer.
                  </p>

                  <div className="space-y-3 pt-1">
                    {flashcards.slice(0, 12).map((card, idx) => (
                      <div
                        key={card.id || idx}
                        className="p-4 rounded-xl bg-slate-900 border border-slate-800 print-border space-y-2"
                      >
                        <div className="flex items-start gap-2.5">
                          <span className="text-xs font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 shrink-0">
                            Q{idx + 1}
                          </span>
                          <p className="text-xs font-semibold text-slate-200 print-text-dark leading-relaxed">
                            {card.front}
                          </p>
                        </div>
                        {showAnswers ? (
                          <div className="pl-8 text-xs text-emerald-300 print-text-dark bg-emerald-500/5 p-2 rounded-lg border border-emerald-500/20 print-border">
                            <span className="font-bold text-emerald-400 print-text-dark">Answer: </span>
                            {card.back}
                          </div>
                        ) : (
                          <div className="pl-8 text-[11px] text-slate-500 italic no-print">
                            (Hidden for active recall &bull; Click "Show Answers" above to reveal)
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Section 4: ✅ Exam Readiness & Action Checklist */}
              <div className="p-6 rounded-2xl bg-slate-950/60 border border-slate-800 print-card space-y-3">
                <div className="flex items-center gap-2">
                  <ListChecks className="w-5 h-5 text-emerald-400 shrink-0" />
                  <h2 className="text-base font-bold text-white print-text-dark">
                    4. Exam Readiness Checklist
                  </h2>
                </div>
                <p className="text-xs text-slate-400 print-text-muted">
                  Tick off each milestone as you complete your final review before test day.
                </p>

                <div className="space-y-2 pt-1">
                  {[
                    { key: 'weak-concepts', label: 'Reviewed all high-priority weak concepts and their key formulas/terms.' },
                    { key: 'mock-exam', label: 'Completed at least one Timed Mock Exam to practice pacing under time pressure.' },
                    { key: 'misconceptions', label: 'Reviewed past wrong answers and step-by-step explanations in the Quiz Review tab.' },
                    { key: 'flashcard-recall', label: 'Practiced active recall with flashcards without looking at answers first.' },
                    { key: 'rest-prep', label: 'Organized required exam supplies and got sufficient sleep before test day.' },
                  ].map((item) => (
                    <div
                      key={item.key}
                      onClick={() => toggleCheck(item.key)}
                      className="p-3 rounded-xl bg-slate-900 border border-slate-800/80 print-border flex items-center gap-3 cursor-pointer hover:border-slate-700 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={checkedItems[item.key] || false}
                        onChange={() => {}}
                        className="w-4 h-4 rounded text-teal-500 focus:ring-teal-400 border-slate-700 bg-slate-800 cursor-pointer"
                      />
                      <span className={`text-xs ${checkedItems[item.key] ? 'line-through text-slate-500 print-text-muted' : 'text-slate-200 print-text-dark'}`}>
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 5: 💡 Simple Exam-Taking Tips */}
              <div className="p-6 rounded-2xl bg-slate-950/60 border border-slate-800 print-card space-y-3">
                <div className="flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-amber-400 shrink-0" />
                  <h2 className="text-base font-bold text-white print-text-dark">
                    5. Plain-English Exam Strategies
                  </h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 print-border space-y-1">
                    <span className="font-bold text-xs text-teal-300 print-text-dark">1. Do Easy Questions First</span>
                    <p className="text-[11px] text-slate-400 print-text-muted leading-relaxed">
                      Build quick confidence and secure guaranteed points before tackling complex calculation problems.
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 print-border space-y-1">
                    <span className="font-bold text-xs text-indigo-300 print-text-dark">2. Eliminate False Answers</span>
                    <p className="text-[11px] text-slate-400 print-text-muted leading-relaxed">
                      Cross off obviously incorrect choices immediately. Narrowing down to 2 options doubles your odds.
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 print-border space-y-1">
                    <span className="font-bold text-xs text-amber-300 print-text-dark">3. Flag & Return</span>
                    <p className="text-[11px] text-slate-400 print-text-muted leading-relaxed">
                      If you're stuck for more than 90 seconds, flag the question, move on, and return at the end.
                    </p>
                  </div>
                </div>
              </div>

              {/* Print Footer */}
              <div className="pt-4 border-t border-slate-800 text-center text-[10px] text-slate-500 print-text-muted">
                Generated by Knovara Study System &bull; Keep this sheet handy during your final study sessions.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
