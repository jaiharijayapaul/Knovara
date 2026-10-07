import { useEffect, useState, useCallback } from 'react';
import { fetchCourseMastery, fetchAdaptiveRecommendations, generateAssessment, createRemediationSession } from '@/services/api';
import type {
  CourseMastery,
  ConceptMastery,
  AdaptiveRecommendationsResponse,
  MasteryStatus,
} from '@/types/mastery';
import {
  MASTERY_STATUS_CONFIG,
  BLOOM_LEVEL_COLORS,
} from '@/types/mastery';
import { ConceptMindMap } from './ConceptMindMap';

// ─── Sparkline mini-chart ─────────────────────────────────────────────────
function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length < 2) {
    return (
      <div style={{ height: 32, display: 'flex', alignItems: 'center', opacity: 0.4 }}>
        <span style={{ fontSize: 11, color: '#6b7280' }}>No trend data yet</span>
      </div>
    );
  }
  const W = 80, H = 32;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 0.001;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((v - min) / range) * (H - 4) - 2;
    return `${x},${y}`;
  });
  return (
    <svg width={W} height={H} style={{ overflow: 'visible' }}>
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.9}
      />
      {/* Last point dot */}
      <circle
        cx={W}
        cy={H - ((data[data.length - 1] - min) / range) * (H - 4) - 2}
        r={2.5}
        fill={color}
      />
    </svg>
  );
}

// ─── BKT Gauge ring ────────────────────────────────────────────────────────
function MasteryGauge({ pKnow, status }: { pKnow: number; status: MasteryStatus }) {
  const cfg = MASTERY_STATUS_CONFIG[status];
  const r = 24, cx = 30, cy = 30;
  const circumference = 2 * Math.PI * r;
  const filled = circumference * pKnow;

  return (
    <svg width={60} height={60}>
      {/* Track */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={6} />
      {/* Fill */}
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke={cfg.color}
        strokeWidth={6}
        strokeDasharray={`${filled} ${circumference}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition: 'stroke-dasharray 0.8s ease' }}
      />
      {/* Status icon */}
      <text
        x={cx} y={cy + 5}
        textAnchor="middle"
        fill={cfg.color}
        fontSize={13}
        fontWeight="700"
        fontFamily="Inter, sans-serif"
      >
        {Math.round(pKnow * 100)}
      </text>
    </svg>
  );
}

// ─── Concept Card ──────────────────────────────────────────────────────────
function ConceptCard({ concept, onClick }: { concept: ConceptMastery; onClick: () => void }) {
  const cfg = MASTERY_STATUS_CONFIG[concept.mastery_status];

  return (
    <button
      onClick={onClick}
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: `1px solid ${cfg.border}`,
        borderRadius: 14,
        padding: '16px 18px',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 0.2s ease',
        width: '100%',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)';
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
        (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <MasteryGauge pKnow={concept.p_know} status={concept.mastery_status} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13,
            fontWeight: 600,
            color: '#f1f5f9',
            textTransform: 'capitalize',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            marginBottom: 4,
          }}>
            {concept.concept_label.replace(/^understand:|^apply:|^analyze:|^remember:|^evaluate:|^create:/, '')}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{
              fontSize: 10,
              fontWeight: 600,
              color: cfg.color,
              background: cfg.bg,
              border: `1px solid ${cfg.border}`,
              borderRadius: 4,
              padding: '1px 6px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              {cfg.icon} {cfg.label}
            </span>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>
              {concept.correct_attempts}/{concept.total_attempts} correct
            </span>
          </div>

          {/* BKT probability bar */}
          <div style={{
            height: 4,
            background: 'rgba(255,255,255,0.08)',
            borderRadius: 2,
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${concept.mastery_percentage}%`,
              background: cfg.gradient,
              borderRadius: 2,
              transition: 'width 0.8s ease',
            }} />
          </div>
        </div>

        <div style={{ flexShrink: 0 }}>
          <Sparkline data={concept.p_know_history} color={cfg.color} />
        </div>
      </div>
    </button>
  );
}

// ─── Concept Detail Drawer ─────────────────────────────────────────────────
function ConceptDetailDrawer({
  concept,
  onClose,
}: {
  concept: ConceptMastery;
  onClose: () => void;
}) {
  const cfg = MASTERY_STATUS_CONFIG[concept.mastery_status];

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 200,
      display: 'flex',
      justifyContent: 'flex-end',
    }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} />
      <div style={{
        position: 'relative',
        width: 400,
        maxWidth: '100%',
        height: '100%',
        background: '#0f172a',
        borderLeft: '1px solid rgba(255,255,255,0.1)',
        overflowY: 'auto',
        padding: 28,
        boxShadow: '-20px 0 60px rgba(0,0,0,0.5)',
        animation: 'slideIn 0.25s ease',
      }}>
        <style>{`@keyframes slideIn { from { transform: translateX(40px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>

        <button onClick={onClose} style={{
          position: 'absolute', top: 16, right: 16,
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 8, width: 32, height: 32,
          cursor: 'pointer', color: '#94a3b8', fontSize: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>×</button>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{
            fontSize: 11, color: cfg.color, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6,
          }}>
            Concept Mastery Detail
          </div>
          <h3 style={{
            fontSize: 18, fontWeight: 700, color: '#f1f5f9', margin: 0,
            textTransform: 'capitalize', lineHeight: 1.3,
          }}>
            {concept.concept_label.replace(/^[a-z]+:/, '')}
          </h3>
        </div>

        {/* Big gauge */}
        <div style={{
          textAlign: 'center',
          background: cfg.bg,
          border: `1px solid ${cfg.border}`,
          borderRadius: 16,
          padding: '24px 16px',
          marginBottom: 20,
        }}>
          <svg width={100} height={100} style={{ display: 'block', margin: '0 auto' }}>
            <circle cx={50} cy={50} r={42} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={8} />
            <circle
              cx={50} cy={50} r={42}
              fill="none"
              stroke={cfg.color}
              strokeWidth={8}
              strokeDasharray={`${2 * Math.PI * 42 * concept.p_know} ${2 * Math.PI * 42}`}
              strokeLinecap="round"
              transform="rotate(-90 50 50)"
            />
            <text x={50} y={44} textAnchor="middle" fill={cfg.color} fontSize={22} fontWeight={700} fontFamily="Inter">
              {Math.round(concept.mastery_percentage)}%
            </text>
            <text x={50} y={60} textAnchor="middle" fill="#94a3b8" fontSize={10} fontFamily="Inter">
              P(mastery)
            </text>
          </svg>
          <div style={{ marginTop: 8, fontSize: 13, color: cfg.color, fontWeight: 600 }}>
            {cfg.icon} {cfg.label}
          </div>
        </div>

        {/* BKT Parameters */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            BKT Parameters
          </div>
          {[
            { label: 'P(L₀) — Current Mastery', value: concept.p_know, key: 'p_know', desc: 'Probability you know this concept right now' },
            { label: 'P(T) — Learning Rate', value: concept.p_learn, key: 'p_learn', desc: 'Prob. of learning when you attempt a question' },
            { label: 'P(G) — Guess Rate', value: concept.p_guess, key: 'p_guess', desc: 'Prob. of correct despite not knowing' },
            { label: 'P(S) — Slip Rate', value: concept.p_slip, key: 'p_slip', desc: 'Prob. of error despite knowing' },
          ].map(param => (
            <div key={param.key} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontSize: 12, color: '#cbd5e1', fontWeight: 500 }}>{param.label}</span>
                <span style={{ fontSize: 12, color: cfg.color, fontFamily: 'monospace', fontWeight: 700 }}>
                  {(param.value * 100).toFixed(1)}%
                </span>
              </div>
              <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${param.value * 100}%`,
                  background: cfg.color,
                  borderRadius: 3,
                  opacity: 0.8,
                }} />
              </div>
              <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>{param.desc}</div>
            </div>
          ))}
        </div>

        {/* Evidence */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            Evidence
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { label: 'Total Attempts', value: concept.total_attempts },
              { label: 'Correct', value: concept.correct_attempts },
              { label: 'Accuracy', value: `${(concept.accuracy_rate * 100).toFixed(0)}%` },
              { label: 'Threshold', value: `${concept.mastery_threshold * 100}%` },
            ].map(stat => (
              <div key={stat.label} style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 10, padding: '10px 14px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#f1f5f9' }}>{stat.value}</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Sparkline */}
        <div>
          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            Confidence Trend
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12,
            padding: 16,
          }}>
            <Sparkline data={concept.p_know_history} color={cfg.color} />
            <div style={{ fontSize: 10, color: '#475569', marginTop: 6 }}>
              {concept.p_know_history.length} data point{concept.p_know_history.length !== 1 ? 's' : ''} recorded
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Adaptive Recommendation Card ─────────────────────────────────────────
function RecommendationCard({
  rec,
  rank,
  onPractice,
  isPracticing,
  onAskTutor,
}: {
  rec: AdaptiveRecommendationsResponse['recommendations'][0];
  rank: number;
  onPractice?: (concept: string) => void;
  isPracticing?: boolean;
  onAskTutor?: (concept: string) => void;
}) {
  const cfg = MASTERY_STATUS_CONFIG[rec.mastery_status];

  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: `1px solid ${cfg.border}`,
      borderRadius: 14,
      padding: '16px 18px',
      display: 'flex',
      gap: 14,
      alignItems: 'flex-start',
    }}>
      {/* Rank badge */}
      <div style={{
        width: 32, height: 32, borderRadius: 8,
        background: cfg.gradient,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, fontWeight: 800, color: '#fff', flexShrink: 0,
      }}>
        {rank}
      </div>

      <div style={{ flex: 1 }}>
        <div style={{
          fontSize: 13, fontWeight: 700, color: '#f1f5f9',
          textTransform: 'capitalize', marginBottom: 4,
        }}>
          {rec.concept_label.replace(/^[a-z]+:/, '')}
        </div>

        <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8, lineHeight: 1.5 }}>
          {rec.reason}
        </div>

        {/* Bloom badges */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
          {rec.recommended_bloom_levels.map(bl => (
            <span key={bl} style={{
              fontSize: 9,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              background: `${BLOOM_LEVEL_COLORS[bl] || '#6b7280'}22`,
              border: `1px solid ${BLOOM_LEVEL_COLORS[bl] || '#6b7280'}44`,
              color: BLOOM_LEVEL_COLORS[bl] || '#6b7280',
              borderRadius: 4,
              padding: '2px 6px',
            }}>
              {bl}
            </span>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 10, color: cfg.color, fontWeight: 600 }}>
            Confidence: {(rec.p_know * 100).toFixed(0)}%
          </span>
          {rec.estimated_questions_to_mastery > 0 && (
            <span style={{ fontSize: 10, color: '#64748b' }}>
              ~{rec.estimated_questions_to_mastery}Q to master
            </span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
        <button
          onClick={() => onPractice?.(rec.concept_label)}
          disabled={isPracticing}
          style={{
            background: 'linear-gradient(135deg, rgba(139,92,246,0.3), rgba(99,102,241,0.2))',
            border: '1px solid rgba(139,92,246,0.5)',
            borderRadius: 8,
            padding: '6px 10px',
            color: '#c4b5fd',
            fontSize: 11,
            fontWeight: 700,
            cursor: isPracticing ? 'not-allowed' : 'pointer',
            opacity: isPracticing ? 0.6 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            transition: 'all 0.2s',
            whiteSpace: 'nowrap',
          }}
        >
          <span>{isPracticing ? '⏳ Generating…' : '⚡ Practice'}</span>
        </button>

        {onAskTutor && (
          <button
            onClick={() => onAskTutor(rec.concept_label)}
            style={{
              background: 'rgba(99,102,241,0.15)',
              border: '1px solid rgba(99,102,241,0.35)',
              borderRadius: 8,
              padding: '5px 8px',
              color: '#a5b4fc',
              fontSize: 10,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
            }}
          >
            <span>🧠 Ask AI Tutor</span>
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main Dashboard Component ──────────────────────────────────────────────
interface MasteryDashboardProps {
  courseId: string;
  onNavigateToAssessment?: (assessmentId?: string) => void;
  onNavigateToTutor?: (sessionId: string) => void;
}

export function MasteryDashboard({
  courseId,
  onNavigateToAssessment,
  onNavigateToTutor,
}: MasteryDashboardProps) {
  const [mastery, setMastery] = useState<CourseMastery | null>(null);
  const [recommendations, setRecommendations] = useState<AdaptiveRecommendationsResponse | null>(null);
  const [selectedConcept, setSelectedConcept] = useState<ConceptMastery | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleRemediateWithTutor = async (conceptLabel: string) => {
    try {
      const session = await createRemediationSession(courseId, {
        source_type: 'bkt_concept',
        concept_label: conceptLabel,
        pedagogical_mode: 'socratic',
      });
      if (onNavigateToTutor) {
        onNavigateToTutor(session.id);
      }
    } catch (err) {
      console.error('Failed to create remediation session for concept:', err);
    }
  };
  const [activeTab, setActiveTab] = useState<'concepts' | 'mindmap' | 'recommendations'>('mindmap');
  const [statusFilter, setStatusFilter] = useState<MasteryStatus | 'all'>('all');
  const [generatingExam, setGeneratingExam] = useState(false);
  const [practicingConcept, setPracticingConcept] = useState<string | null>(null);

  const handleStartAdaptive = async (conceptTopic?: string) => {
    try {
      if (conceptTopic) {
        setPracticingConcept(conceptTopic);
      } else {
        setGeneratingExam(true);
      }
      const created = await generateAssessment(courseId, {
        title: conceptTopic ? `Adaptive Drill: ${conceptTopic.replace(/^[a-z]+:/, '')}` : undefined,
        topic: conceptTopic || undefined,
        num_questions: 5,
        difficulty: 'adaptive',
        adaptive_mode: true,
      });
      if (onNavigateToAssessment) {
        onNavigateToAssessment(created.id);
      }
    } catch (err) {
      console.error('Failed to generate adaptive assessment:', err);
    } finally {
      setGeneratingExam(false);
      setPracticingConcept(null);
    }
  };

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [m, r] = await Promise.all([
        fetchCourseMastery(courseId),
        fetchAdaptiveRecommendations(courseId, 8),
      ]);
      setMastery(m);
      setRecommendations(r);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setError(err?.response?.data?.detail || 'Failed to load mastery data.');
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => { load(); }, [load]);

  const filteredConcepts = mastery?.concepts.filter(c =>
    statusFilter === 'all' ? true : c.mastery_status === statusFilter
  ) ?? [];

  const statusCounts = mastery
    ? {
        mastered:     mastery.concepts.filter(c => c.mastery_status === 'mastered').length,
        developing:   mastery.concepts.filter(c => c.mastery_status === 'developing').length,
        needs_work:   mastery.concepts.filter(c => c.mastery_status === 'needs_work').length,
        not_started:  mastery.concepts.filter(c => c.mastery_status === 'not_started').length,
      }
    : {};

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ marginBottom: 12, color: '#8b5cf6', fontSize: 24 }}>⟳</div>
        <div style={{ color: '#94a3b8', fontSize: 14 }}>Loading mastery model…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ color: '#ef4444', marginBottom: 8 }}>⚠ {error}</div>
        <button onClick={load} style={{
          background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.5)',
          borderRadius: 8, padding: '8px 16px', color: '#a78bfa', cursor: 'pointer', fontSize: 13,
        }}>Retry</button>
      </div>
    );
  }

  if (!mastery || mastery.total_concepts === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🧠</div>
        <h3 style={{ color: '#f1f5f9', margin: '0 0 8px' }}>No Mastery Data Yet</h3>
        <p style={{ color: '#64748b', fontSize: 14, margin: '0 0 20px' }}>
          Complete at least one diagnostic assessment to start building your mastery model.
        </p>
        {onNavigateToAssessment && (
          <button onClick={() => onNavigateToAssessment()} style={{
            background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
            border: 'none', borderRadius: 10, padding: '12px 24px',
            color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer',
          }}>
            Take a Diagnostic Assessment
          </button>
        )}
      </div>
    );
  }

  const overallPct = mastery.overall_mastery_percentage;
  const masteredPct = mastery.total_concepts > 0
    ? (mastery.mastered_concepts / mastery.total_concepts * 100)
    : 0;

  return (
    <div style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* ── Hero Stats Row ──────────────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
        gap: 14,
        marginBottom: 24,
      }}>
        {/* Overall Mastery */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(139,92,246,0.25), rgba(99,102,241,0.15))',
          border: '1px solid rgba(139,92,246,0.35)',
          borderRadius: 16, padding: '20px 18px', textAlign: 'center',
        }}>
          <svg width={80} height={80} style={{ display: 'block', margin: '0 auto 8px' }}>
            <circle cx={40} cy={40} r={32} fill="none" stroke="rgba(139,92,246,0.2)" strokeWidth={8} />
            <circle
              cx={40} cy={40} r={32}
              fill="none"
              stroke="#8b5cf6"
              strokeWidth={8}
              strokeDasharray={`${2 * Math.PI * 32 * overallPct / 100} ${2 * Math.PI * 32}`}
              strokeLinecap="round"
              transform="rotate(-90 40 40)"
            />
            <text x={40} y={36} textAnchor="middle" fill="#a78bfa" fontSize={18} fontWeight={800} fontFamily="Inter">
              {Math.round(overallPct)}%
            </text>
            <text x={40} y={50} textAnchor="middle" fill="#7c3aed" fontSize={9} fontFamily="Inter">
              overall
            </text>
          </svg>
          <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>Average Confidence</div>
        </div>

        {/* Concepts Mastered */}
        <div style={{
          background: 'rgba(16,185,129,0.12)',
          border: '1px solid rgba(16,185,129,0.3)',
          borderRadius: 16, padding: '20px 18px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 36, fontWeight: 800, color: '#10b981', lineHeight: 1 }}>
            {mastery.mastered_concepts}
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Concepts Mastered</div>
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
            of {mastery.total_concepts} total
          </div>
          <div style={{ marginTop: 10, height: 4, background: 'rgba(16,185,129,0.15)', borderRadius: 2 }}>
            <div style={{ height: '100%', width: `${masteredPct}%`, background: '#10b981', borderRadius: 2 }} />
          </div>
        </div>

        {/* Status breakdown */}
        {(Object.entries(statusCounts) as [MasteryStatus, number][]).map(([status, count]) => {
          const cfg = MASTERY_STATUS_CONFIG[status];
          return (
            <button
              key={status}
              onClick={() => setStatusFilter(statusFilter === status ? 'all' : status)}
              style={{
                background: statusFilter === status ? cfg.bg : 'rgba(255,255,255,0.03)',
                border: `1px solid ${statusFilter === status ? cfg.border : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 16, padding: '20px 18px', textAlign: 'center',
                cursor: 'pointer', transition: 'all 0.2s',
              }}
            >
              <div style={{ fontSize: 28, fontWeight: 800, color: cfg.color, lineHeight: 1 }}>{count}</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{cfg.label}</div>
              <div style={{ marginTop: 8, fontSize: 9, color: cfg.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {statusFilter === status ? '▸ Active filter' : 'Click to filter'}
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Personalized Practice Quiz Trigger Banner ──────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(139,92,246,0.18), rgba(99,102,241,0.1))',
        border: '1px solid rgba(139,92,246,0.3)',
        borderRadius: 14,
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 260 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'rgba(139,92,246,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, color: '#a78bfa'
          }}>⚡</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>
              Personalized Practice Quiz
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>
              Generates questions that focus on the concepts you need to review the most.
            </div>
          </div>
        </div>

        <button
          onClick={() => handleStartAdaptive()}
          disabled={generatingExam}
          style={{
            background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
            border: 'none',
            borderRadius: 10,
            padding: '10px 18px',
            color: '#fff',
            fontSize: 12,
            fontWeight: 700,
            cursor: generatingExam ? 'not-allowed' : 'pointer',
            opacity: generatingExam ? 0.6 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            boxShadow: '0 4px 14px rgba(139,92,246,0.3)',
          }}
        >
          {generatingExam ? '✨ Creating Practice Quiz…' : '⚡ Start Practice Quiz'}
        </button>
      </div>

      {/* ── Tab Bar ─────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: 8, marginBottom: 20,
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12, padding: 4,
      }}>
        {[
          { id: 'mindmap', label: `🕸️ Knowledge Mastery Graph (Visual BKT) (${mastery.total_concepts})` },
          { id: 'concepts', label: `📊 Concept Cards (${mastery.total_concepts})` },
          { id: 'recommendations', label: `🎯 Recommended Practice (${recommendations?.recommendations.length ?? 0})` },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            style={{
              flex: 1,
              padding: '10px 16px',
              borderRadius: 9,
              border: 'none',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'Inter, sans-serif',
              transition: 'all 0.2s',
              background: activeTab === tab.id
                ? 'linear-gradient(135deg, rgba(139,92,246,0.4), rgba(99,102,241,0.3))'
                : 'transparent',
              color: activeTab === tab.id ? '#c4b5fd' : '#64748b',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Concepts Tab ────────────────────────────────────────────────── */}
      {activeTab === 'concepts' && (
        <div>
          {statusFilter !== 'all' && (
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: 12, padding: '8px 14px',
              background: `${MASTERY_STATUS_CONFIG[statusFilter].bg}`,
              border: `1px solid ${MASTERY_STATUS_CONFIG[statusFilter].border}`,
              borderRadius: 10,
            }}>
              <span style={{ fontSize: 13, color: MASTERY_STATUS_CONFIG[statusFilter].color, fontWeight: 600 }}>
                Filtering: {MASTERY_STATUS_CONFIG[statusFilter].label} ({filteredConcepts.length} concepts)
              </span>
              <button onClick={() => setStatusFilter('all')} style={{
                background: 'none', border: 'none', color: '#94a3b8',
                cursor: 'pointer', fontSize: 12,
              }}>
                Clear filter ×
              </button>
            </div>
          )}

          {filteredConcepts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
              No concepts match this filter.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {filteredConcepts.map(concept => (
                <ConceptCard
                  key={concept.id}
                  concept={concept}
                  onClick={() => setSelectedConcept(concept)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Recommendations Tab ──────────────────────────────────────────── */}
      {activeTab === 'recommendations' && (
        <div>
          {!recommendations || recommendations.recommendations.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🎯</div>
              No recommendations yet. Complete more assessments to generate your adaptive plan.
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 16 }}>
                <p style={{ margin: 0, fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>
                  Your personalized study plan — sorted by <strong style={{ color: '#8b5cf6' }}>remediation priority</strong>.
                  Concepts you've attempted but haven't mastered rank highest. Bloom levels are scaffolded to your current mastery level.
                </p>
              </div>
              <div style={{ display: 'grid', gap: 12 }}>
                {recommendations.recommendations.map((rec, idx) => (
                  <RecommendationCard
                    key={rec.concept_label}
                    rec={rec}
                    rank={idx + 1}
                    onPractice={handleStartAdaptive}
                    isPracticing={practicingConcept === rec.concept_label}
                    onAskTutor={handleRemediateWithTutor}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Interactive Mind Map Tab ───────────────────────────────────── */}
      {activeTab === 'mindmap' && (
        <ConceptMindMap
          concepts={mastery.concepts}
          onAskTutor={(conceptLabel) => handleRemediateWithTutor(conceptLabel)}
          onPracticeConcept={(conceptLabel) => handleStartAdaptive(conceptLabel)}
        />
      )}

      {/* ── Concept Detail Drawer ────────────────────────────────────────── */}
      {selectedConcept && (
        <ConceptDetailDrawer
          concept={selectedConcept}
          onClose={() => setSelectedConcept(null)}
        />
      )}
    </div>
  );
}
