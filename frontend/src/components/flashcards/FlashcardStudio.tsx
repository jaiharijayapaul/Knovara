import React, { useEffect, useState, useCallback } from 'react';
import {
  fetchFlashcards,
  fetchSRSStats,
  reviewFlashcard,
  generateFlashcards,
  createFlashcard,
  deleteFlashcard,
  fetchFlashcardDecks,
  createFlashcardDeck,
} from '@/services/api';
import type {
  Flashcard,
  FlashcardDeck,
  SRSStats,
  FlashcardGeneratePayload,
  FlashcardCreatePayload,
} from '@/types/flashcard';
import {
  Brain,
  RotateCw,
  Sparkles,
  Plus,
  BookOpen,
  CheckCircle2,
  Clock,
  Layers,
  Search,
  Trash2,
  FileText,
  Lightbulb,
  Target,
  BarChart3,
  Flame,
  FolderPlus,
  Loader2,
} from 'lucide-react';

interface FlashcardStudioProps {
  courseId: string;
  onNavigateToMastery?: () => void;
}

export const FlashcardStudio: React.FC<FlashcardStudioProps> = ({
  courseId,
  onNavigateToMastery,
}) => {
  // State
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [decks, setDecks] = useState<FlashcardDeck[]>([]);
  const [stats, setStats] = useState<SRSStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Active View Mode: 'review' | 'library'
  const [viewMode, setViewMode] = useState<'review' | 'library'>('review');

  // Review Queue State
  const [dueQueue, setDueQueue] = useState<Flashcard[]>([]);
  const [currentQueueIndex, setCurrentQueueIndex] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [showHint, setShowHint] = useState<boolean>(false);
  const [isSubmittingReview, setIsSubmittingReview] = useState<boolean>(false);
  const [reviewSuccessMessage, setReviewSuccessMessage] = useState<string | null>(null);

  // Filter & Search in Library Mode
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTopic, setSelectedTopic] = useState<string>('all');
  const [selectedDeckId, setSelectedDeckId] = useState<string>('all');

  // Modals
  const [showGenerateModal, setShowGenerateModal] = useState<boolean>(false);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showDeckModal, setShowDeckModal] = useState<boolean>(false);

  // Generator form
  const [genTopic, setGenTopic] = useState<string>('');
  const [genNumCards, setGenNumCards] = useState<number>(6);
  const [genPrioritizeWeak, setGenPrioritizeWeak] = useState<boolean>(true);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  // Manual creation form
  const [newFront, setNewFront] = useState<string>('');
  const [newBack, setNewBack] = useState<string>('');
  const [newTopic, setNewTopic] = useState<string>('');
  const [newHint, setNewHint] = useState<string>('');
  const [newCitation, setNewCitation] = useState<string>('');
  const [newDocName, setNewDocName] = useState<string>('');
  const [newPageNum, setNewPageNum] = useState<string>('');
  const [newSnippet, setNewSnippet] = useState<string>('');
  const [isCreating, setIsCreating] = useState<boolean>(false);

  // Deck creation form
  const [newDeckTitle, setNewDeckTitle] = useState<string>('');
  const [newDeckDesc, setNewDeckDesc] = useState<string>('');

  // Initial Data Fetch
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [allCards, deckList, srsStats] = await Promise.all([
        fetchFlashcards(courseId),
        fetchFlashcardDecks(courseId),
        fetchSRSStats(courseId),
      ]);
      setCards(allCards);
      setDecks(deckList);
      setStats(srsStats);

      // Filter due cards for review queue
      const due = allCards.filter((c) => c.is_due);
      setDueQueue(due);
      setCurrentQueueIndex(0);
      setIsFlipped(false);
      setShowHint(false);
    } catch (err: any) {
      console.error('Failed to load flashcards:', err);
      setError(err?.response?.data?.detail || 'Failed to load flashcards and SRS stats.');
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Review handler
  const handleReview = useCallback(async (quality: number) => {
    if (dueQueue.length === 0 || isSubmittingReview) return;
    const currentCard = dueQueue[currentQueueIndex];
    if (!currentCard) return;

    try {
      setIsSubmittingReview(true);
      const result = await reviewFlashcard(courseId, currentCard.id, { quality });

      const qualityLabels = ['Blackout', 'Failed', 'Hard', 'Passed', 'Good', 'Easy'];
      setReviewSuccessMessage(
        `Recorded: ${qualityLabels[quality]} · Next review in ${result.interval_days} day${result.interval_days === 1 ? '' : 's'}${result.bkt_synced ? ' · BKT mastery updated' : ''}`
      );

      // Clear message after 2.5s
      setTimeout(() => setReviewSuccessMessage(null), 2500);

      // Move to next card in queue
      if (currentQueueIndex + 1 < dueQueue.length) {
        setCurrentQueueIndex((prev) => prev + 1);
        setIsFlipped(false);
        setShowHint(false);
      } else {
        // Queue completed: refresh full data
        await loadData();
      }
    } catch (err: any) {
      console.error('Failed to review card:', err);
      alert(err?.response?.data?.detail || 'Failed to record card review.');
    } finally {
      setIsSubmittingReview(false);
    }
  }, [dueQueue, isSubmittingReview, currentQueueIndex, courseId, loadData]);

  // Keyboard shortcut handler for card flip and SM-2 quality ratings
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (viewMode !== 'review' || dueQueue.length === 0 || isSubmittingReview) return;
      if (showGenerateModal || showCreateModal || showDeckModal) return;

      if (e.code === 'Space') {
        e.preventDefault();
        setIsFlipped((prev) => !prev);
      } else if (isFlipped && ['0', '1', '2', '3', '4', '5'].includes(e.key)) {
        e.preventDefault();
        handleReview(parseInt(e.key, 10));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, dueQueue, isFlipped, isSubmittingReview, showGenerateModal, showCreateModal, showDeckModal, handleReview]);

  // Generate cards handler
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsGenerating(true);
      const payload: FlashcardGeneratePayload = {
        topic: genTopic.trim() || undefined,
        num_cards: genNumCards,
        target_weak_concepts: genPrioritizeWeak,
      };
      await generateFlashcards(courseId, payload);
      setShowGenerateModal(false);
      setGenTopic('');
      await loadData();
    } catch (err: any) {
      console.error('Failed to generate cards:', err);
      alert(err?.response?.data?.detail || 'Failed to generate flashcards.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Manual card creation handler
  const handleCreateCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFront.trim() || !newBack.trim()) return;

    try {
      setIsCreating(true);
      const payload: FlashcardCreatePayload = {
        front: newFront.trim(),
        back: newBack.trim(),
        topic: newTopic.trim() || undefined,
        hint: newHint.trim() || undefined,
        citation_label: newCitation.trim() || undefined,
        document_name: newDocName.trim() || undefined,
        page_number: newPageNum ? parseInt(newPageNum, 10) : undefined,
        source_snippet: newSnippet.trim() || undefined,
      };
      await createFlashcard(courseId, payload);
      setShowCreateModal(false);
      setNewFront('');
      setNewBack('');
      setNewTopic('');
      setNewHint('');
      setNewCitation('');
      setNewDocName('');
      setNewPageNum('');
      setNewSnippet('');
      await loadData();
    } catch (err: any) {
      console.error('Failed to create flashcard:', err);
      alert(err?.response?.data?.detail || 'Failed to create flashcard.');
    } finally {
      setIsCreating(false);
    }
  };

  // Deck creation handler
  const handleCreateDeck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeckTitle.trim()) return;

    try {
      await createFlashcardDeck(courseId, {
        title: newDeckTitle.trim(),
        description: newDeckDesc.trim() || undefined,
      });
      setShowDeckModal(false);
      setNewDeckTitle('');
      setNewDeckDesc('');
      await loadData();
    } catch (err: any) {
      console.error('Failed to create deck:', err);
      alert(err?.response?.data?.detail || 'Failed to create deck.');
    }
  };

  // Delete card handler
  const handleDeleteCard = async (cardId: string) => {
    if (!confirm('Are you sure you want to delete this flashcard?')) return;
    try {
      await deleteFlashcard(courseId, cardId);
      await loadData();
    } catch (err: any) {
      console.error('Failed to delete card:', err);
      alert('Failed to delete card.');
    }
  };

  // Filtered cards for library view
  const filteredCards = cards.filter((card) => {
    const matchesSearch =
      searchQuery === '' ||
      card.front.toLowerCase().includes(searchQuery.toLowerCase()) ||
      card.back.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (card.topic && card.topic.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesTopic = selectedTopic === 'all' || card.topic === selectedTopic;
    const matchesDeck = selectedDeckId === 'all' || card.deck_id === selectedDeckId;

    return matchesSearch && matchesTopic && matchesDeck;
  });

  const uniqueTopics = Array.from(new Set(cards.map((c) => c.topic).filter(Boolean))) as string[];
  const currentCard = dueQueue[currentQueueIndex];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
        <p className="text-xs">Loading spaced repetition flashcards...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3.5 bg-rose-950/40 border border-rose-800/60 rounded-xl text-rose-300 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button onClick={loadData} className="underline font-semibold ml-2">
            Retry
          </button>
        </div>
      )}

      {/* ── Header & Action Controls ────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-700/60 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Brain className="w-7 h-7 text-indigo-400" />
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Study Flashcards (Active Memory)
            </h1>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Practice active recall with smart flashcards. Cards are scheduled right when you need to review them so you remember for exams.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowGenerateModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-colors shadow-lg shadow-indigo-500/20"
          >
            <Sparkles className="w-4 h-4" />
            Generate with AI
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-medium text-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Card
          </button>
          <button
            onClick={() => setShowDeckModal(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-medium text-sm transition-colors"
          >
            <FolderPlus className="w-4 h-4" />
            New Deck
          </button>
          <button
            onClick={loadData}
            title="Refresh Flashcards & Telemetry"
            className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── SRS Telemetry Cards ─────────────────────────────────────────── */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Total Cards
            </span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl font-bold text-white">{stats.total_cards ?? cards.length}</span>
              <Layers className="w-4 h-4 text-indigo-400 opacity-80" />
            </div>
          </div>

          <div
            className={`border rounded-xl p-3.5 flex flex-col justify-between transition-colors ${
              (stats.cards_due_today ?? 0) > 0
                ? 'bg-amber-950/20 border-amber-500/30'
                : 'bg-slate-900/60 border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                Due Today
              </span>
              {(stats.cards_due_today ?? 0) > 0 && (
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </span>
              )}
            </div>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl font-bold text-amber-300">{stats.cards_due_today ?? dueQueue.length}</span>
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Retention Rate
            </span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl font-bold text-emerald-400">
                {stats.retention_rate ?? 100}%
              </span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400 opacity-80" />
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Learning Stage
            </span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl font-bold text-sky-400">{stats.cards_learning ?? 0}</span>
              <Flame className="w-4 h-4 text-sky-400 opacity-80" />
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Mastered
            </span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl font-bold text-purple-400">{stats.cards_mastered ?? 0}</span>
              <Target className="w-4 h-4 text-purple-400 opacity-80" />
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Memory Ease
            </span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl font-bold text-indigo-300">
                {(stats.average_ease_factor ?? 2.5).toFixed(2)}
              </span>
              <BarChart3 className="w-4 h-4 text-indigo-400 opacity-80" />
            </div>
          </div>
        </div>
      )}

      {/* ── Mode Navigation Tabs ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-slate-800">
        <div className="flex gap-4">
          <button
            onClick={() => setViewMode('review')}
            className={`pb-3 text-sm font-semibold transition-colors border-b-2 flex items-center gap-2 ${
              viewMode === 'review'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            Review Queue
            {dueQueue.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {dueQueue.length} due
              </span>
            )}
          </button>

          <button
            onClick={() => setViewMode('library')}
            className={`pb-3 text-sm font-semibold transition-colors border-b-2 flex items-center gap-2 ${
              viewMode === 'library'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            All Cards ({cards.length})
          </button>
        </div>

        {onNavigateToMastery && (
          <button
            onClick={onNavigateToMastery}
            className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors pb-3"
          >
            <Target className="w-3.5 h-3.5" />
            View BKT Mastery Model &rarr;
          </button>
        )}
      </div>

      {/* ── Active Review Queue Mode ─────────────────────────────────────── */}
      {viewMode === 'review' && (
        <div className="max-w-2xl mx-auto py-4">
          {dueQueue.length === 0 ? (
            <div className="text-center py-16 px-4 bg-slate-900/40 border border-slate-800 rounded-2xl">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-white">All Caught Up!</h3>
              <p className="text-slate-400 mt-2 max-w-md mx-auto text-sm leading-relaxed">
                You have reviewed all due cards for this session. SuperMemo-2 will schedule your next retention intervals automatically.
              </p>
              <div className="mt-6 flex items-center justify-center gap-3">
                <button
                  onClick={() => setShowGenerateModal(true)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Generate More Cards
                </button>
                <button
                  onClick={() => setViewMode('library')}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors"
                >
                  Browse Card Library
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Review Queue Progress & Counter */}
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>
                  Card {currentQueueIndex + 1} of {dueQueue.length}
                </span>
                <span className="flex items-center gap-1 text-slate-400">
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                  Repetition #{currentCard?.repetitions || 0}
                </span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-indigo-500 h-full transition-all duration-300"
                  style={{
                    width: `${((currentQueueIndex + 1) / dueQueue.length) * 100}%`,
                  }}
                />
              </div>

              {/* Toast Notification */}
              {reviewSuccessMessage && (
                <div className="p-3 bg-indigo-950/60 border border-indigo-500/40 rounded-xl text-center text-xs text-indigo-300 font-medium animate-fade-in">
                  {reviewSuccessMessage}
                </div>
              )}

              {/* 3D Interactive Flip Card */}
              <div
                onClick={() => setIsFlipped((prev) => !prev)}
                className="cursor-pointer min-h-[340px] perspective"
              >
                <div
                  className={`w-full min-h-[340px] bg-slate-900/90 border border-slate-700/80 rounded-2xl p-6 sm:p-8 flex flex-col justify-between shadow-2xl transition-all duration-300 hover:border-indigo-500/50 ${
                    isFlipped ? 'ring-1 ring-indigo-500/40' : ''
                  }`}
                >
                  {/* Card Header */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        {currentCard?.topic && (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            {currentCard.topic}
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold uppercase tracking-wider bg-slate-800 text-slate-400 border border-slate-700">
                          {currentCard?.bloom_level || 'Concept'}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500 font-medium">
                        {isFlipped ? 'BACK / ANSWER' : 'FRONT / PROMPT'}
                      </span>
                    </div>

                    {/* Card Content */}
                    <div className="mt-4">
                      {!isFlipped ? (
                        <div>
                          <p className="text-lg sm:text-xl font-medium text-white leading-relaxed">
                            {currentCard?.front}
                          </p>
                          {currentCard?.hint && (
                            <div className="mt-6">
                              {!showHint ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowHint(true);
                                  }}
                                  className="inline-flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
                                >
                                  <Lightbulb className="w-3.5 h-3.5" />
                                  Need a hint?
                                </button>
                              ) : (
                                <div
                                  onClick={(e) => e.stopPropagation()}
                                  className="p-3 bg-amber-950/30 border border-amber-500/30 rounded-lg text-xs text-amber-200"
                                >
                                  <strong>Hint:</strong> {currentCard.hint}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <p className="text-base sm:text-lg text-slate-100 leading-relaxed whitespace-pre-wrap">
                            {currentCard?.back}
                          </p>

                          {/* Grounding Source Citation Box */}
                          {(currentCard?.document_name || currentCard?.citation_label) && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="mt-4 p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl"
                            >
                              <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-400 mb-1">
                                <FileText className="w-3.5 h-3.5" />
                                {currentCard.citation_label || 'Syllabus Citation'}
                                {currentCard.page_number && (
                                  <span className="text-slate-400">· Page {currentCard.page_number}</span>
                                )}
                              </div>
                              {currentCard.document_name && (
                                <p className="text-xs text-slate-400 font-mono">
                                  {currentCard.document_name}
                                </p>
                              )}
                              {currentCard.source_snippet && (
                                <p className="mt-1.5 text-xs italic text-slate-300 border-l-2 border-indigo-500/40 pl-2">
                                  "{currentCard.source_snippet}"
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Footer Cue */}
                  <div className="pt-6 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
                    <span>Click card or Press Space to flip</span>
                    <span>Ease: {(currentCard?.ease_factor ?? 2.5).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* SM-2 Recall Quality Buttons */}
              {isFlipped ? (
                <div className="space-y-2 pt-2 animate-fade-in">
                  <p className="text-xs font-medium text-slate-400 text-center uppercase tracking-wider">
                    Rate Recall Accuracy (SuperMemo-2)
                  </p>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    <button
                      disabled={isSubmittingReview}
                      onClick={() => handleReview(0)}
                      className="p-2.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/50 border border-rose-800/50 text-rose-300 text-xs font-medium transition-all text-center flex flex-col items-center gap-1"
                    >
                      <span className="font-bold">0 · Blackout</span>
                      <span className="text-[10px] opacity-75">Forgot (reset)</span>
                    </button>

                    <button
                      disabled={isSubmittingReview}
                      onClick={() => handleReview(1)}
                      className="p-2.5 rounded-xl bg-orange-950/40 hover:bg-orange-900/50 border border-orange-800/50 text-orange-300 text-xs font-medium transition-all text-center flex flex-col items-center gap-1"
                    >
                      <span className="font-bold">1 · Wrong</span>
                      <span className="text-[10px] opacity-75">Remembered back</span>
                    </button>

                    <button
                      disabled={isSubmittingReview}
                      onClick={() => handleReview(2)}
                      className="p-2.5 rounded-xl bg-amber-950/40 hover:bg-amber-900/50 border border-amber-800/50 text-amber-300 text-xs font-medium transition-all text-center flex flex-col items-center gap-1"
                    >
                      <span className="font-bold">2 · Hard</span>
                      <span className="text-[10px] opacity-75">Familiar only</span>
                    </button>

                    <button
                      disabled={isSubmittingReview}
                      onClick={() => handleReview(3)}
                      className="p-2.5 rounded-xl bg-yellow-950/40 hover:bg-yellow-900/50 border border-yellow-800/50 text-yellow-300 text-xs font-medium transition-all text-center flex flex-col items-center gap-1"
                    >
                      <span className="font-bold">3 · Pass</span>
                      <span className="text-[10px] opacity-75">Struggled</span>
                    </button>

                    <button
                      disabled={isSubmittingReview}
                      onClick={() => handleReview(4)}
                      className="p-2.5 rounded-xl bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-800/50 text-emerald-300 text-xs font-medium transition-all text-center flex flex-col items-center gap-1"
                    >
                      <span className="font-bold">4 · Good</span>
                      <span className="text-[10px] opacity-75">Hesitated</span>
                    </button>

                    <button
                      disabled={isSubmittingReview}
                      onClick={() => handleReview(5)}
                      className="p-2.5 rounded-xl bg-indigo-950/40 hover:bg-indigo-900/50 border border-indigo-800/50 text-indigo-300 text-xs font-medium transition-all text-center flex flex-col items-center gap-1"
                    >
                      <span className="font-bold">5 · Easy</span>
                      <span className="text-[10px] opacity-75">Immediate recall</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-center text-slate-500">
                    Shortcut: Press keys 0 to 5 on your keyboard
                  </p>
                </div>
              ) : (
                <div className="text-center pt-2">
                  <button
                    onClick={() => setIsFlipped(true)}
                    className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-semibold border border-slate-700 shadow-md transition-all"
                  >
                    Show Answer (Space)
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Library & Search Mode ────────────────────────────────────────── */}
      {viewMode === 'library' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row items-center gap-3 bg-slate-900/60 border border-slate-800 p-3 rounded-xl">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search flashcards by question, answer, or concept..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {uniqueTopics.length > 0 && (
              <select
                value={selectedTopic}
                onChange={(e) => setSelectedTopic(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-indigo-500"
              >
                <option value="all">All Topics</option>
                {uniqueTopics.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            )}

            {decks.length > 0 && (
              <select
                value={selectedDeckId}
                onChange={(e) => setSelectedDeckId(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-indigo-500"
              >
                <option value="all">All Decks</option>
                {decks.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Cards Grid */}
          {filteredCards.length === 0 ? (
            <div className="text-center py-12 bg-slate-900/30 border border-slate-800 rounded-xl">
              <p className="text-slate-400 text-sm">No flashcards found matching your filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCards.map((card) => (
                <div
                  key={card.id}
                  className="bg-slate-900/70 border border-slate-800 hover:border-slate-700 rounded-xl p-4 flex flex-col justify-between transition-colors"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 truncate max-w-[160px]">
                        {card.topic || 'General'}
                      </span>
                      <div className="flex items-center gap-1.5 text-xs text-slate-400">
                        {card.is_due ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            Due
                          </span>
                        ) : (
                          <span className="text-[11px]">
                            In {card.interval_days}d
                          </span>
                        )}
                      </div>
                    </div>

                    <h4 className="text-sm font-semibold text-white mb-2 leading-snug">
                      {card.front}
                    </h4>
                    <p className="text-xs text-slate-300 line-clamp-3 mb-3 leading-relaxed">
                      {card.back}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
                    <div className="flex items-center gap-2">
                      <span>Reps: {card.repetitions ?? 0}</span>
                      <span>·</span>
                      <span>Ease: {(card.ease_factor ?? 2.5).toFixed(2)}</span>
                    </div>

                    <button
                      onClick={() => handleDeleteCard(card.id)}
                      title="Delete Flashcard"
                      className="p-1 hover:text-rose-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Modal: AI Generate Flashcards ───────────────────────────────── */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2 text-indigo-400">
                <Sparkles className="w-5 h-5" />
                <h3 className="font-bold text-white text-base">Generate Flashcards with AI</h3>
              </div>
              <button
                onClick={() => setShowGenerateModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleGenerate} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Target Topic / Concept (Optional)
                </label>
                <input
                  type="text"
                  value={genTopic}
                  onChange={(e) => setGenTopic(e.target.value)}
                  placeholder="e.g. Decision Trees, Neural Networks..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Leave blank to synthesize across all indexed course documents.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Number of Cards
                </label>
                <select
                  value={genNumCards}
                  onChange={(e) => setGenNumCards(parseInt(e.target.value, 10))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value={4}>4 Flashcards</option>
                  <option value={6}>6 Flashcards (Recommended)</option>
                  <option value={10}>10 Flashcards</option>
                  <option value={15}>15 Flashcards</option>
                </select>
              </div>

              <div className="p-3 bg-indigo-950/30 border border-indigo-500/20 rounded-xl">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={genPrioritizeWeak}
                    onChange={(e) => setGenPrioritizeWeak(e.target.checked)}
                    className="mt-0.5 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div className="text-xs">
                    <span className="font-semibold text-indigo-300">
                      Target Weakest Concepts (BKT Integration)
                    </span>
                    <p className="text-slate-400 mt-0.5 leading-relaxed">
                      Consults your Bayesian Knowledge Tracing mastery model to focus questions on concepts where mastery probability is lowest.
                    </p>
                  </div>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowGenerateModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isGenerating}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-colors disabled:opacity-50"
                >
                  {isGenerating ? (
                    <>
                      <RotateCw className="w-4 h-4 animate-spin" />
                      Synthesizing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Generate Cards
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Manual Card Creation ─────────────────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto animate-fade-in">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="font-bold text-white text-base">Create Grounded Flashcard</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateCard} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Front / Question / Term *
                </label>
                <textarea
                  rows={2}
                  required
                  value={newFront}
                  onChange={(e) => setNewFront(e.target.value)}
                  placeholder="e.g. What is the difference between bagging and boosting?"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Back / Explanation / Definition *
                </label>
                <textarea
                  rows={3}
                  required
                  value={newBack}
                  onChange={(e) => setNewBack(e.target.value)}
                  placeholder="Full detailed explanation..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Concept / Topic
                  </label>
                  <input
                    type="text"
                    value={newTopic}
                    onChange={(e) => setNewTopic(e.target.value)}
                    placeholder="e.g. Ensemble Learning"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Hint (Optional)
                  </label>
                  <input
                    type="text"
                    value={newHint}
                    onChange={(e) => setNewHint(e.target.value)}
                    placeholder="e.g. Think parallel vs sequential"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Grounding Source Coordinates */}
              <div className="pt-2 border-t border-slate-800">
                <span className="block text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-2">
                  Document Grounding (Optional)
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <input
                      type="text"
                      value={newDocName}
                      onChange={(e) => setNewDocName(e.target.value)}
                      placeholder="Doc name (e.g. ML_Textbook.pdf)"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500"
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      value={newPageNum}
                      onChange={(e) => setNewPageNum(e.target.value)}
                      placeholder="Page #"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500"
                    />
                  </div>
                </div>
                <div className="mt-2">
                  <textarea
                    rows={2}
                    value={newSnippet}
                    onChange={(e) => setNewSnippet(e.target.value)}
                    placeholder="Excerpt quote from document source..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-colors disabled:opacity-50"
                >
                  {isCreating ? 'Saving...' : 'Save Flashcard'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Create Flashcard Deck ────────────────────────────────── */}
      {showDeckModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-sm w-full p-6 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="font-bold text-white text-base">Create Flashcard Deck</h3>
              <button
                onClick={() => setShowDeckModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateDeck} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Deck Title *
                </label>
                <input
                  type="text"
                  required
                  value={newDeckTitle}
                  onChange={(e) => setNewDeckTitle(e.target.value)}
                  placeholder="e.g. Midterm Core Formulas"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  value={newDeckDesc}
                  onChange={(e) => setNewDeckDesc(e.target.value)}
                  placeholder="e.g. Quick review before quiz"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowDeckModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-colors"
                >
                  Create Deck
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default FlashcardStudio;
