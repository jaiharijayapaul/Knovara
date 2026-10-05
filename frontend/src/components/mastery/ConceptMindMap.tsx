import React, { useState, useMemo, useRef } from 'react';
import type { ConceptMastery, MasteryStatus } from '@/types/mastery';
import { MASTERY_STATUS_CONFIG } from '@/types/mastery';
import {
  BrainCircuit,
  Sparkles,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Bot,
  PlayCircle,
  X,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

interface ConceptMindMapProps {
  concepts: ConceptMastery[];
  onAskTutor?: (conceptLabel: string) => void;
  onPracticeConcept?: (conceptLabel: string) => void;
}

interface NodePosition {
  concept: ConceptMastery;
  x: number;
  y: number;
  id: string;
}

export const ConceptMindMap: React.FC<ConceptMindMapProps> = ({
  concepts,
  onAskTutor,
  onPracticeConcept,
}) => {
  const [selectedConcept, setSelectedConcept] = useState<ConceptMastery | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [filterStatus, setFilterStatus] = useState<MasteryStatus | 'all'>('all');

  const containerRef = useRef<HTMLDivElement>(null);

  // Filter concepts if user selected a status filter
  const displayedConcepts = useMemo(() => {
    if (filterStatus === 'all') return concepts;
    return concepts.filter((c) => c.mastery_status === filterStatus);
  }, [concepts, filterStatus]);

  // Layout calculations: arrange nodes in an organic winding curriculum DAG layout
  const { nodes, edges, width, height } = useMemo(() => {
    const list = displayedConcepts;
    const n = list.length;
    if (n === 0) return { nodes: [], edges: [], width: 700, height: 400 };

    const cols = Math.min(3, Math.max(2, Math.ceil(Math.sqrt(n))));
    const nodeWidth = 240;
    const nodeHeight = 110;
    const gapX = 140;
    const gapY = 130;
    const paddingX = 80;
    const paddingY = 80;

    const computedNodes: NodePosition[] = [];
    const computedEdges: { from: NodePosition; to: NodePosition; id: string }[] = [];

    list.forEach((concept, index) => {
      const row = Math.floor(index / cols);
      // Alternate left-to-right and right-to-left for a winding learning path
      const col = row % 2 === 0 ? index % cols : (cols - 1 - (index % cols));
      const x = paddingX + col * (nodeWidth + gapX);
      const y = paddingY + row * (nodeHeight + gapY);

      computedNodes.push({
        concept,
        x,
        y,
        id: concept.concept_label,
      });
    });

    // Create sequential prerequisite edges
    for (let i = 0; i < computedNodes.length - 1; i++) {
      computedEdges.push({
        from: computedNodes[i],
        to: computedNodes[i + 1],
        id: `edge-${i}-${i + 1}`,
      });
    }

    const maxRow = Math.floor((n - 1) / cols);
    const canvasWidth = paddingX * 2 + cols * (nodeWidth + gapX);
    const canvasHeight = paddingY * 2 + (maxRow + 1) * (nodeHeight + gapY) + 50;

    return {
      nodes: computedNodes,
      edges: computedEdges,
      width: Math.max(800, canvasWidth),
      height: Math.max(500, canvasHeight),
    };
  }, [displayedConcepts]);

  const handleZoom = (delta: number) => {
    setZoomLevel((prev) => Math.min(1.8, Math.max(0.6, Number((prev + delta).toFixed(1)))));
  };

  const resetView = () => {
    setZoomLevel(1);
    setSelectedConcept(null);
  };

  return (
    <div className="relative rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden shadow-2xl">
      {/* Top Floating Control Toolbar */}
      <div className="absolute top-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        {/* Left: Legend and Title */}
        <div className="pointer-events-auto bg-slate-900/90 backdrop-blur-md border border-slate-800/90 rounded-xl px-3.5 py-2 flex items-center space-x-3 shadow-lg">
          <div className="flex items-center space-x-1.5 text-xs font-bold text-white">
            <BrainCircuit className="w-4 h-4 text-teal-400" />
            <span>Interactive Knowledge Map</span>
          </div>
          <div className="h-4 w-px bg-slate-800" />
          <div className="flex items-center space-x-2 text-[11px]">
            <span className="flex items-center space-x-1 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981]" />
              <span>Mastered (≥80%)</span>
            </span>
            <span className="flex items-center space-x-1 text-amber-400">
              <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_#f59e0b]" />
              <span>Developing</span>
            </span>
            <span className="flex items-center space-x-1 text-rose-400">
              <span className="w-2 h-2 rounded-full bg-rose-400 shadow-[0_0_8px_#ef4444]" />
              <span>Needs Work</span>
            </span>
          </div>
        </div>

        {/* Right: Filters & Zoom Buttons */}
        <div className="pointer-events-auto bg-slate-900/90 backdrop-blur-md border border-slate-800/90 rounded-xl p-1 flex items-center space-x-1 shadow-lg">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as MasteryStatus | 'all')}
            className="bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 px-2 py-1 focus:outline-none focus:border-teal-500 mr-1"
          >
            <option value="all">All Concepts ({concepts.length})</option>
            <option value="mastered">Mastered Only</option>
            <option value="developing">Developing</option>
            <option value="needs_work">Needs Work</option>
            <option value="not_started">Not Started</option>
          </select>

          <button
            onClick={() => handleZoom(0.1)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleZoom(-0.1)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={resetView}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Reset View"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Graph Viewport */}
      <div
        ref={containerRef}
        className="w-full h-[620px] overflow-auto cursor-grab active:cursor-grabbing p-8 select-none relative bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px]"
      >
        <div
          style={{
            transform: `scale(${zoomLevel})`,
            transformOrigin: 'top left',
            width: `${width}px`,
            height: `${height}px`,
            transition: 'transform 0.2s ease-out',
          }}
          className="relative"
        >
          {/* SVG Connection Edges Layer */}
          <svg className="absolute inset-0 pointer-events-none" width={width} height={height}>
            <defs>
              <linearGradient id="edgeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.4" />
              </linearGradient>
              <marker
                id="arrowhead"
                markerWidth="8"
                markerHeight="6"
                refX="7"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 8 3, 0 6" fill="#14b8a6" opacity="0.6" />
              </marker>
            </defs>

            {edges.map((edge) => {
              const startX = edge.from.x + 120;
              const startY = edge.from.y + 55;
              const endX = edge.to.x + 120;
              const endY = edge.to.y + 55;

              // Smooth curved bezier line
              const midY = (startY + endY) / 2;
              const pathD = `M ${startX} ${startY} C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${endY}`;

              return (
                <path
                  key={edge.id}
                  d={pathD}
                  fill="none"
                  stroke="url(#edgeGradient)"
                  strokeWidth="2.5"
                  strokeDasharray="6 4"
                  markerEnd="url(#arrowhead)"
                  className="transition-all"
                />
              );
            })}
          </svg>

          {/* Interactive Mind Map Nodes */}
          {nodes.map((node) => {
            const isSelected = selectedConcept?.concept_label === node.concept.concept_label;
            const cfg = MASTERY_STATUS_CONFIG[node.concept.mastery_status];
            const pPct = Math.round(node.concept.mastery_percentage);

            let nodeBorder = 'border-slate-800';
            let glowShadow = '';
            let ringColor = cfg.color;

            if (node.concept.mastery_status === 'mastered') {
              nodeBorder = 'border-emerald-500/60 bg-emerald-950/20';
              glowShadow = 'shadow-[0_0_20px_rgba(16,185,129,0.25)]';
            } else if (node.concept.mastery_status === 'developing') {
              nodeBorder = 'border-amber-500/60 bg-amber-950/20';
              glowShadow = 'shadow-[0_0_18px_rgba(245,158,11,0.2)]';
            } else if (node.concept.mastery_status === 'needs_work') {
              nodeBorder = 'border-rose-500/60 bg-rose-950/20';
              glowShadow = 'shadow-[0_0_18px_rgba(239,68,68,0.2)]';
            } else {
              nodeBorder = 'border-slate-700 bg-slate-900/40';
            }

            return (
              <div
                key={node.id}
                style={{
                  left: `${node.x}px`,
                  top: `${node.y}px`,
                  width: '240px',
                }}
                onClick={() => setSelectedConcept(node.concept)}
                className={`absolute rounded-2xl border p-4 cursor-pointer transition-all duration-200 backdrop-blur-md ${nodeBorder} ${glowShadow} ${
                  isSelected ? 'ring-2 ring-teal-400 scale-105 z-30' : 'hover:scale-105 hover:z-20'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 flex-1 min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                      Topic #{node.concept.concept_label.slice(0, 15)}
                    </span>
                    <h4 className="text-xs font-bold text-white leading-tight line-clamp-2">
                      {node.concept.concept_label}
                    </h4>
                  </div>

                  {/* Circular Mastery Meter */}
                  <div className="relative w-10 h-10 shrink-0 flex items-center justify-center">
                    <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                      <path
                        className="text-slate-800"
                        strokeWidth="3.5"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      <path
                        style={{ stroke: ringColor }}
                        strokeDasharray={`${pPct}, 100`}
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                    </svg>
                    <span className="absolute text-[10px] font-bold text-white">
                      {pPct}%
                    </span>
                  </div>
                </div>

                {/* Sub status pill */}
                <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                  <span className="flex items-center space-x-1" style={{ color: ringColor }}>
                    {node.concept.mastery_status === 'mastered' ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : node.concept.mastery_status === 'needs_work' ? (
                      <AlertTriangle className="w-3.5 h-3.5" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    <span className="font-semibold capitalize">
                      {cfg.label}
                    </span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {node.concept.total_attempts} attempts
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating Concept Detail Inspector Drawer */}
      {selectedConcept && (
        <div className="absolute top-4 right-4 w-80 max-w-[calc(100%-2rem)] bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl p-5 shadow-2xl z-40 space-y-4 animate-in slide-in-from-right duration-200">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-teal-400">
                Concept Inspector
              </span>
              <h3 className="text-sm font-bold text-white leading-tight">
                {selectedConcept.concept_label}
              </h3>
            </div>
            <button
              onClick={() => setSelectedConcept(null)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Mastery Big Percentage Bar */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Mastery Level:</span>
              <span className="font-bold text-white">
                {Math.round(selectedConcept.mastery_percentage)}%
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  selectedConcept.mastery_status === 'mastered'
                    ? 'bg-emerald-400'
                    : selectedConcept.mastery_status === 'developing'
                    ? 'bg-amber-400'
                    : 'bg-rose-400'
                }`}
                style={{ width: `${selectedConcept.mastery_percentage}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-400">
              {selectedConcept.mastery_status === 'mastered'
                ? 'Strong retention demonstrated across questions.'
                : selectedConcept.mastery_status === 'developing'
                ? 'Building intuition. Keep practicing to reach 80% mastery.'
                : 'Needs a quick refresher with your AI Tutor.'}
            </p>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 gap-2 text-center text-xs">
            <div className="p-2.5 rounded-xl bg-slate-950/50 border border-slate-800/80">
              <div className="text-sm font-bold text-white">
                {Math.round((selectedConcept.accuracy_rate || 0) * 100)}%
              </div>
              <div className="text-[10px] text-slate-400">Accuracy Rate</div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950/50 border border-slate-800/80">
              <div className="text-sm font-bold text-white">
                {selectedConcept.total_attempts}
              </div>
              <div className="text-[10px] text-slate-400">Total Attempts</div>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="pt-2 space-y-2">
            {onAskTutor && (
              <button
                onClick={() => onAskTutor(selectedConcept.concept_label)}
                className="w-full py-2.5 px-3 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 text-xs font-semibold flex items-center justify-center space-x-2 transition-all cursor-pointer"
              >
                <Bot className="w-4 h-4 text-indigo-400" />
                <span>Ask AI Tutor About This</span>
              </button>
            )}

            {onPracticeConcept && (
              <button
                onClick={() => onPracticeConcept(selectedConcept.concept_label)}
                className="w-full py-2.5 px-3 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center justify-center space-x-2 transition-all cursor-pointer"
              >
                <PlayCircle className="w-4 h-4 text-emerald-400" />
                <span>Practice Quiz Questions</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
