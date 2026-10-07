import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
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
  Search,
  Target,
  Maximize2,
  Minimize2,
  Layers,
  Activity,
  ArrowRight,
  Info,
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
  tier: 'foundation' | 'core' | 'advanced';
}

interface GraphEdge {
  from: NodePosition;
  to: NodePosition;
  id: string;
}

// ─── Sparkline mini-chart inside node ──────────────────────────────────────
function NodeSparkline({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length < 2) return null;
  const W = 64;
  const H = 20;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 0.001;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((v - min) / range) * (H - 4) - 2;
    return `${x},${y}`;
  });

  return (
    <svg width={W} height={H} className="overflow-visible opacity-80">
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={W}
        cy={H - ((data[data.length - 1] - min) / range) * (H - 4) - 2}
        r={2.5}
        fill={color}
      />
    </svg>
  );
}

export const ConceptMindMap: React.FC<ConceptMindMapProps> = ({
  concepts,
  onAskTutor,
  onPracticeConcept,
}) => {
  const [selectedConcept, setSelectedConcept] = useState<ConceptMastery | null>(null);
  const [hoveredConceptId, setHoveredConceptId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<MasteryStatus | 'all'>('all');
  const [viewMode, setViewMode] = useState<'roadmap' | 'constellation'>('roadmap');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Viewport transforms (pan & zoom)
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 40, y: 30 });
  const [zoomLevel, setZoomLevel] = useState<number>(0.95);
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Custom dragged positions for individual nodes
  const [draggedNodePositions, setDraggedNodePositions] = useState<Record<string, { x: number; y: number }>>({});
  const [activeDraggingNodeId, setActiveDraggingNodeId] = useState<string | null>(null);
  const [nodeDragOffset, setNodeDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Filter concepts based on status and search query
  const displayedConcepts = useMemo(() => {
    let list = concepts;
    if (filterStatus !== 'all') {
      list = list.filter((c) => c.mastery_status === filterStatus);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((c) => c.concept_label.toLowerCase().includes(q));
    }
    return list;
  }, [concepts, filterStatus, searchQuery]);

  // Find the highest-priority remediation gap
  const weakestConcept = useMemo(() => {
    if (concepts.length === 0) return null;
    const sorted = [...concepts].sort((a, b) => {
      // Prioritize needs_work with attempts first, then lowest p_know
      if (a.mastery_status === 'needs_work' && b.mastery_status !== 'needs_work') return -1;
      if (b.mastery_status === 'needs_work' && a.mastery_status !== 'needs_work') return 1;
      return a.p_know - b.p_know;
    });
    return sorted[0];
  }, [concepts]);

  // Compute Layout: Roadmap DAG vs Radial Constellation
  const { nodes, edges, bounds } = useMemo(() => {
    const list = displayedConcepts;
    const n = list.length;
    if (n === 0) {
      return {
        nodes: [],
        edges: [],
        bounds: { width: 900, height: 600 },
      };
    }

    const nodeWidth = 260;
    const nodeHeight = 135;
    const computedNodes: NodePosition[] = [];

    if (viewMode === 'roadmap') {
      // 3-Tier Pedagogical Roadmap DAG: Foundation -> Core Mechanics -> Advanced
      const tier1Count = Math.max(1, Math.ceil(n * 0.3));
      const tier2Count = Math.max(1, Math.ceil(n * 0.4));

      const tiers: { tier: 'foundation' | 'core' | 'advanced'; concepts: ConceptMastery[] }[] = [
        { tier: 'foundation', concepts: [] },
        { tier: 'core', concepts: [] },
        { tier: 'advanced', concepts: [] },
      ];

      list.forEach((concept, index) => {
        if (index < tier1Count) {
          tiers[0].concepts.push(concept);
        } else if (index < tier1Count + tier2Count) {
          tiers[1].concepts.push(concept);
        } else {
          tiers[2].concepts.push(concept);
        }
      });

      const colGap = 160;
      const rowGap = 50;
      const startX = 60;
      const startY = 80;

      tiers.forEach((t, colIdx) => {
        const x = startX + colIdx * (nodeWidth + colGap);
        const totalHeight = t.concepts.length * (nodeHeight + rowGap);
        const offsetY = Math.max(0, (550 - totalHeight) / 2);

        t.concepts.forEach((concept, rowIdx) => {
          const y = startY + offsetY + rowIdx * (nodeHeight + rowGap);
          const customPos = draggedNodePositions[concept.concept_label];

          computedNodes.push({
            concept,
            x: customPos ? customPos.x : x,
            y: customPos ? customPos.y : y,
            id: concept.concept_label,
            tier: t.tier,
          });
        });
      });
    } else {
      // Constellation / Radial Orbital View
      const centerX = 550;
      const centerY = 360;
      const orbitalRadii = [140, 290, 420];

      list.forEach((concept, index) => {
        let orbitTier: 'foundation' | 'core' | 'advanced' = 'core';
        let radius = orbitalRadii[1];

        if (concept.p_know >= 0.8 || index < Math.ceil(n * 0.3)) {
          orbitTier = 'foundation';
          radius = orbitalRadii[0];
        } else if (concept.p_know < 0.45) {
          orbitTier = 'advanced';
          radius = orbitalRadii[2];
        }

        const angle = (index * 2 * Math.PI) / n - Math.PI / 2;
        const x = centerX + radius * Math.cos(angle) - nodeWidth / 2;
        const y = centerY + radius * Math.sin(angle) - nodeHeight / 2;
        const customPos = draggedNodePositions[concept.concept_label];

        computedNodes.push({
          concept,
          x: customPos ? customPos.x : x,
          y: customPos ? customPos.y : y,
          id: concept.concept_label,
          tier: orbitTier,
        });
      });
    }

    // Generate directed prerequisite edges between tiers/adjacent concepts
    const computedEdges: GraphEdge[] = [];
    for (let i = 0; i < computedNodes.length; i++) {
      const fromNode = computedNodes[i];
      // Connect to logically subsequent concepts
      for (let j = i + 1; j < computedNodes.length; j++) {
        const toNode = computedNodes[j];
        const isRoadmapNext =
          viewMode === 'roadmap' &&
          ((fromNode.tier === 'foundation' && toNode.tier === 'core') ||
            (fromNode.tier === 'core' && toNode.tier === 'advanced'));

        const isSequential = (j === i + 1 && (fromNode.tier === toNode.tier || list.length <= 4));

        if (isRoadmapNext || isSequential) {
          // Limit fan-out to 2 edges per source for clean visual graph
          const existingFromCount = computedEdges.filter((e) => e.from.id === fromNode.id).length;
          if (existingFromCount < 2) {
            computedEdges.push({
              from: fromNode,
              to: toNode,
              id: `edge-${fromNode.id}-${toNode.id}`,
            });
          }
        }
      }
    }

    // Calculate canvas boundaries
    let maxX = 900;
    let maxY = 650;
    computedNodes.forEach((n) => {
      maxX = Math.max(maxX, n.x + nodeWidth + 100);
      maxY = Math.max(maxY, n.y + nodeHeight + 100);
    });

    return {
      nodes: computedNodes,
      edges: computedEdges,
      bounds: { width: maxX, height: maxY },
    };
  }, [displayedConcepts, viewMode, draggedNodePositions]);

  // Center on a specific concept node
  const centerOnNode = useCallback(
    (conceptLabel: string) => {
      const targetNode = nodes.find((n) => n.id.toLowerCase() === conceptLabel.toLowerCase());
      if (targetNode && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const targetCenterX = targetNode.x + 130;
        const targetCenterY = targetNode.y + 65;
        const newPanX = rect.width / 2 - targetCenterX * zoomLevel;
        const newPanY = rect.height / 2 - targetCenterY * zoomLevel;
        setPan({ x: newPanX, y: newPanY });
        const conceptObj = concepts.find((c) => c.concept_label.toLowerCase() === conceptLabel.toLowerCase());
        if (conceptObj) setSelectedConcept(conceptObj);
      }
    },
    [nodes, zoomLevel, concepts]
  );

  // Zoom handlers
  const handleZoom = (delta: number) => {
    setZoomLevel((prev) => Math.min(2.0, Math.max(0.5, Number((prev + delta).toFixed(2)))));
  };

  const resetView = () => {
    setZoomLevel(0.95);
    setPan({ x: 40, y: 30 });
    setSelectedConcept(null);
    setDraggedNodePositions({});
  };

  // Canvas Pan Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only pan if clicking canvas background, not on a node or button
    if ((e.target as HTMLElement).closest('.interactive-node') || (e.target as HTMLElement).closest('.control-panel')) {
      return;
    }
    setIsPanning(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    } else if (activeDraggingNodeId && containerRef.current) {
      // Handle node repositioning drag
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left - pan.x) / zoomLevel;
      const mouseY = (e.clientY - rect.top - pan.y) / zoomLevel;

      setDraggedNodePositions((prev) => ({
        ...prev,
        [activeDraggingNodeId]: {
          x: mouseX - nodeDragOffset.x,
          y: mouseY - nodeDragOffset.y,
        },
      }));
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setActiveDraggingNodeId(null);
  };

  // Handle Wheel Zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 0.08 : -0.08;
    handleZoom(zoomFactor);
  };

  // Node Drag Initiation
  const startNodeDrag = (e: React.MouseEvent, node: NodePosition) => {
    e.stopPropagation();
    setActiveDraggingNodeId(node.id);
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left - pan.x) / zoomLevel;
      const mouseY = (e.clientY - rect.top - pan.y) / zoomLevel;
      setNodeDragOffset({
        x: mouseX - node.x,
        y: mouseY - node.y,
      });
    }
  };

  // Escape key closes inspector
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedConcept(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div
      ref={cardRef}
      className={`relative rounded-3xl bg-slate-950 border border-slate-800 overflow-hidden shadow-2xl transition-all duration-300 ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none' : 'w-full h-[720px]'
      }`}
    >
      {/* ── Top Floating Navigation & Telemetry Toolbar ────────────────────────── */}
      <div className="absolute top-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3 pointer-events-none control-panel">
        {/* Left Badge & Telemetry Bar */}
        <div className="pointer-events-auto bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-2xl px-4 py-2.5 flex items-center space-x-3 shadow-xl">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-teal-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-teal-500/20">
            <BrainCircuit className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-white tracking-tight">Interactive Knowledge Mastery Graph</span>
              <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-teal-500/10 text-teal-300 border border-teal-500/30">
                Visual BKT Engine
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Drag nodes &bull; Click to inspect Bayesian metrics &bull; Prerequisite DAG flow
            </p>
          </div>
        </div>

        {/* Right Action Tools: Search, Weak-Spot Radar, Layout Modes & Zoom */}
        <div className="pointer-events-auto flex items-center space-x-2">
          {/* Quick Concept Search Bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search concept..."
              className="pl-8 pr-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-md border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 w-36 md:w-44 transition-all"
            />
          </div>

          {/* Weak-Spot Radar Button */}
          {weakestConcept && (
            <button
              onClick={() => centerOnNode(weakestConcept.concept_label)}
              title={`Focus on weakest concept: ${weakestConcept.concept_label}`}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 text-xs font-semibold shadow-lg transition-all cursor-pointer"
            >
              <Target className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
              <span className="hidden sm:inline">Target Weakest Gap</span>
            </button>
          )}

          {/* View Mode Toggle: Roadmap DAG vs Constellation */}
          <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl p-1 flex items-center space-x-1 shadow-lg">
            <button
              onClick={() => setViewMode('roadmap')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center space-x-1 transition-all ${
                viewMode === 'roadmap'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Layers className="w-3 h-3" />
              <span className="hidden md:inline">Roadmap</span>
            </button>
            <button
              onClick={() => setViewMode('constellation')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center space-x-1 transition-all ${
                viewMode === 'constellation'
                  ? 'bg-teal-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Sparkles className="w-3 h-3" />
              <span className="hidden md:inline">Constellation</span>
            </button>
          </div>

          {/* Zoom & Fullscreen Controls */}
          <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl p-1 flex items-center space-x-0.5 shadow-lg">
            <button
              onClick={() => handleZoom(0.12)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleZoom(-0.12)}
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
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* ── Status Filter Pills Bar (Bottom Left) ────────────────────────────── */}
      <div className="absolute bottom-4 left-4 z-20 flex items-center space-x-1.5 bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-2xl p-1.5 shadow-xl text-xs pointer-events-auto">
        <button
          onClick={() => setFilterStatus('all')}
          className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all ${
            filterStatus === 'all'
              ? 'bg-slate-800 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          All ({concepts.length})
        </button>
        <button
          onClick={() => setFilterStatus('needs_work')}
          className={`px-2.5 py-1 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-all ${
            filterStatus === 'needs_work'
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
              : 'text-rose-400/80 hover:text-rose-300'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_#ef4444]" />
          <span>Gaps Only</span>
        </button>
        <button
          onClick={() => setFilterStatus('developing')}
          className={`px-2.5 py-1 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-all ${
            filterStatus === 'developing'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'text-amber-400/80 hover:text-amber-300'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_#f59e0b]" />
          <span>Developing</span>
        </button>
        <button
          onClick={() => setFilterStatus('mastered')}
          className={`px-2.5 py-1 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-all ${
            filterStatus === 'mastered'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              : 'text-emerald-400/80 hover:text-emerald-300'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981]" />
          <span>Mastered</span>
        </button>
      </div>

      {/* ── Interactive Viewport Canvas ──────────────────────────────────────── */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        className="w-full h-full overflow-hidden cursor-grab active:cursor-grabbing select-none relative bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:28px_28px]"
      >
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoomLevel})`,
            transformOrigin: '0 0',
            width: `${bounds.width}px`,
            height: `${bounds.height}px`,
            transition: isPanning || activeDraggingNodeId ? 'none' : 'transform 0.15s ease-out',
          }}
          className="relative"
        >
          {/* SVG Directed Prerequisite Flow Layer */}
          <svg className="absolute inset-0 pointer-events-none" width={bounds.width} height={bounds.height}>
            <defs>
              <linearGradient id="edgeGradientFlow" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#6366f1" stopOpacity="0.45" />
              </linearGradient>
              <linearGradient id="edgeActiveGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#818cf8" stopOpacity="0.9" />
              </linearGradient>
              <marker id="flowArrow" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto">
                <polygon points="0 0, 9 3.5, 0 7" fill="#6366f1" opacity="0.8" />
              </marker>
              <marker id="flowArrowActive" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
                <polygon points="0 0, 10 4, 0 8" fill="#2dd4bf" opacity="1.0" />
              </marker>
            </defs>

            {edges.map((edge) => {
              const startX = edge.from.x + 260;
              const startY = edge.from.y + 68;
              const endX = edge.to.x;
              const endY = edge.to.y + 68;

              const isConnectedToHover =
                hoveredConceptId && (edge.from.id === hoveredConceptId || edge.to.id === hoveredConceptId);
              const isConnectedToSelect =
                selectedConcept &&
                (edge.from.concept.concept_label === selectedConcept.concept_label ||
                  edge.to.concept.concept_label === selectedConcept.concept_label);

              const isHighlighted = isConnectedToHover || isConnectedToSelect;

              // Smooth cubic bezier connection
              const midX = (startX + endX) / 2;
              const pathD = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;

              return (
                <g key={edge.id}>
                  <path
                    d={pathD}
                    fill="none"
                    stroke={isHighlighted ? 'url(#edgeActiveGradient)' : 'url(#edgeGradientFlow)'}
                    strokeWidth={isHighlighted ? 3.5 : 2.0}
                    strokeDasharray={isHighlighted ? 'none' : '6 4'}
                    markerEnd={isHighlighted ? 'url(#flowArrowActive)' : 'url(#flowArrow)'}
                    className="transition-all duration-200"
                  />
                  {/* Subtle pulsing energy dot along active highlighted path */}
                  {isHighlighted && (
                    <circle r="4" fill="#2dd4bf" className="shadow-[0_0_8px_#2dd4bf]">
                      <animateMotion dur="2.5s" repeatCount="indefinite" path={pathD} />
                    </circle>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Interactive BKT Concept Nodes */}
          {nodes.map((node) => {
            const isSelected = selectedConcept?.concept_label === node.concept.concept_label;
            const isHovered = hoveredConceptId === node.id;
            const cfg = MASTERY_STATUS_CONFIG[node.concept.mastery_status];
            const pPct = Math.round(node.concept.mastery_percentage);

            let nodeBorder = 'border-slate-800 bg-slate-900/80';
            let glowShadow = '';
            let ringColor = cfg.color;
            let statusBadgeClass = 'bg-slate-800 text-slate-300 border-slate-700';

            if (node.concept.mastery_status === 'mastered') {
              nodeBorder = 'border-emerald-500/60 bg-emerald-950/20';
              glowShadow = 'shadow-[0_0_24px_rgba(16,185,129,0.22)]';
              statusBadgeClass = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
            } else if (node.concept.mastery_status === 'developing') {
              nodeBorder = 'border-amber-500/60 bg-amber-950/20';
              glowShadow = 'shadow-[0_0_20px_rgba(245,158,11,0.2)]';
              statusBadgeClass = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
            } else if (node.concept.mastery_status === 'needs_work') {
              nodeBorder = 'border-rose-500/70 bg-rose-950/30 animate-pulse';
              glowShadow = 'shadow-[0_0_24px_rgba(239,68,68,0.3)]';
              statusBadgeClass = 'bg-rose-500/25 text-rose-300 border-rose-500/40';
            }

            const isDimmed =
              hoveredConceptId &&
              hoveredConceptId !== node.id &&
              !edges.some(
                (e) =>
                  (e.from.id === hoveredConceptId && e.to.id === node.id) ||
                  (e.to.id === hoveredConceptId && e.from.id === node.id)
              );

            return (
              <div
                key={node.id}
                style={{
                  left: `${node.x}px`,
                  top: `${node.y}px`,
                  width: '260px',
                }}
                onMouseDown={(e) => startNodeDrag(e, node)}
                onClick={() => setSelectedConcept(node.concept)}
                onMouseEnter={() => setHoveredConceptId(node.id)}
                onMouseLeave={() => setHoveredConceptId(null)}
                className={`interactive-node absolute rounded-2xl border p-4 cursor-pointer backdrop-blur-xl transition-all duration-200 select-none ${nodeBorder} ${glowShadow} ${
                  isSelected
                    ? 'ring-2 ring-teal-400 scale-[1.04] z-30 shadow-2xl'
                    : isHovered
                    ? 'scale-[1.03] z-20 shadow-xl'
                    : isDimmed
                    ? 'opacity-40'
                    : 'hover:scale-[1.02]'
                }`}
              >
                {/* Node Header: Category and BKT Circular Meter */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center space-x-1.5">
                      <span className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-md border ${statusBadgeClass}`}>
                        {cfg.label}
                      </span>
                      {node.concept.mastery_status === 'needs_work' && (
                        <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                      )}
                    </div>
                    <h4 className="text-xs font-bold text-white leading-snug line-clamp-2 pt-0.5">
                      {node.concept.concept_label}
                    </h4>
                  </div>

                  {/* Circular BKT Posterior Probability Meter */}
                  <div className="relative w-11 h-11 shrink-0 flex items-center justify-center">
                    <svg className="w-11 h-11 -rotate-90" viewBox="0 0 36 36">
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
                    <div className="absolute flex flex-col items-center">
                      <span className="text-[10px] font-extrabold text-white leading-none">
                        {pPct}%
                      </span>
                      <span className="text-[8px] text-slate-400 leading-none">P(L)</span>
                    </div>
                  </div>
                </div>

                {/* Sub Telemetry Row: Attempts & Mini Sparkline Trajectory */}
                <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                  <div className="flex items-center space-x-1.5 text-slate-400">
                    <Activity className="w-3 h-3 text-slate-500" />
                    <span>{node.concept.total_attempts} {node.concept.total_attempts === 1 ? 'quiz turn' : 'quiz turns'}</span>
                  </div>

                  {/* Sparkline curve */}
                  {node.concept.p_know_history && node.concept.p_know_history.length > 1 ? (
                    <NodeSparkline data={node.concept.p_know_history} color={ringColor} />
                  ) : (
                    <span className="text-[10px] text-slate-500 font-mono">
                      {node.concept.accuracy_rate ? `${Math.round(node.concept.accuracy_rate * 100)}% acc` : 'new topic'}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Slide-Out BKT Diagnostic Inspector Drawer ─────────────────────────── */}
      {selectedConcept && (
        <div className="absolute top-4 right-4 w-96 max-w-[calc(100%-2rem)] max-h-[calc(100%-2rem)] overflow-y-auto bg-slate-900/95 backdrop-blur-2xl border border-slate-700/80 rounded-3xl p-5 shadow-2xl z-40 space-y-4 animate-in slide-in-from-right duration-200">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-teal-400">
                  Concept Inspector
                </span>
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border"
                  style={{
                    color: MASTERY_STATUS_CONFIG[selectedConcept.mastery_status].color,
                    borderColor: `${MASTERY_STATUS_CONFIG[selectedConcept.mastery_status].color}40`,
                    background: `${MASTERY_STATUS_CONFIG[selectedConcept.mastery_status].color}15`,
                  }}
                >
                  {MASTERY_STATUS_CONFIG[selectedConcept.mastery_status].label}
                </span>
              </div>
              <h3 className="text-base font-bold text-white leading-snug">
                {selectedConcept.concept_label}
              </h3>
            </div>
            <button
              onClick={() => setSelectedConcept(null)}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Big Bayesian Mastery Meter Card */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Bayesian Mastery Probability P(L_t):</span>
              <span className="font-extrabold text-white text-sm">
                {Math.round(selectedConcept.mastery_percentage)}%
              </span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  selectedConcept.mastery_status === 'mastered'
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                    : selectedConcept.mastery_status === 'developing'
                    ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
                    : 'bg-gradient-to-r from-rose-500 to-red-400'
                }`}
                style={{ width: `${selectedConcept.mastery_percentage}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              {selectedConcept.mastery_status === 'mastered'
                ? 'High stability: The model has strong statistical confidence that you know this concept well.'
                : selectedConcept.mastery_status === 'developing'
                ? 'Intermediate acquisition: Keep practicing to transition your belief probability above 80%.'
                : 'Identified Learning Gap: The model recommends dedicated Socratic remediation to target common misconceptions.'}
            </p>
          </div>

          {/* Bayesian Knowledge Tracing Hyperparameters Explorer */}
          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
            <div className="flex items-center space-x-1.5 text-xs font-bold text-indigo-300">
              <Info className="w-3.5 h-3.5" />
              <span>Corbett & Anderson (1994) BKT Telemetry</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs pt-1">
              <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                <div className="text-[10px] text-slate-400">P(T) Learning Rate</div>
                <div className="font-mono font-bold text-teal-300">{selectedConcept.p_learn ?? 0.25}</div>
              </div>
              <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                <div className="text-[10px] text-slate-400">P(S) Slip Probability</div>
                <div className="font-mono font-bold text-amber-300">{selectedConcept.p_slip ?? 0.10}</div>
              </div>
              <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                <div className="text-[10px] text-slate-400">P(G) Guess Probability</div>
                <div className="font-mono font-bold text-cyan-300">{selectedConcept.p_guess ?? 0.15}</div>
              </div>
              <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                <div className="text-[10px] text-slate-400">Threshold for Mastery</div>
                <div className="font-mono font-bold text-emerald-300">
                  {selectedConcept.mastery_threshold ?? 0.95}
                </div>
              </div>
            </div>
          </div>

          {/* Performance & Historical Sparkline Trajectory */}
          <div className="grid grid-cols-2 gap-2 text-center text-xs">
            <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800">
              <div className="text-sm font-bold text-white">
                {Math.round((selectedConcept.accuracy_rate || 0) * 100)}%
              </div>
              <div className="text-[10px] text-slate-400">Accuracy Rate</div>
            </div>
            <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800">
              <div className="text-sm font-bold text-white">{selectedConcept.total_attempts}</div>
              <div className="text-[10px] text-slate-400">Assessment Turns</div>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="pt-2 space-y-2">
            {onAskTutor && (
              <button
                onClick={() => onAskTutor(selectedConcept.concept_label)}
                className="w-full py-3 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center space-x-2 shadow-lg shadow-indigo-600/25 transition-all cursor-pointer"
              >
                <Bot className="w-4 h-4" />
                <span>Launch Socratic AI Tutor on this Topic</span>
                <ArrowRight className="w-3.5 h-3.5 opacity-70" />
              </button>
            )}

            {onPracticeConcept && (
              <button
                onClick={() => onPracticeConcept(selectedConcept.concept_label)}
                className="w-full py-2.5 px-4 rounded-2xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center justify-center space-x-2 transition-all cursor-pointer"
              >
                <PlayCircle className="w-4 h-4 text-emerald-400" />
                <span>Practice Targeted Adaptive Quiz</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
