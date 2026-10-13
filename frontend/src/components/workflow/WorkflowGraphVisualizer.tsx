import { useState, useRef } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Clock,
} from 'lucide-react';

export interface WorkflowStageNode {
  id: string;
  stage_code: string;
  stage_name: string;
  stage_type: 'START' | 'PROCESS' | 'DECISION' | 'TERMINAL';
  sequence_order: number;
  sla_duration_days: number;
  is_active: boolean;
  responsible_role?: string;
}

export interface WorkflowTransitionEdge {
  id: string;
  from_stage_id: string;
  to_stage_id: string;
  transition_code: string;
  transition_name: string;
  is_active: boolean;
}

interface WorkflowGraphVisualizerProps {
  stages: WorkflowStageNode[];
  transitions: WorkflowTransitionEdge[];
  currentStageCode?: string;
  onSelectStage?: (stage: WorkflowStageNode) => void;
  className?: string;
}

export const WorkflowGraphVisualizer: React.FC<WorkflowGraphVisualizerProps> = ({
  stages,
  transitions,
  currentStageCode,
  onSelectStage,
  className = '',
}) => {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 40, y: 40 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  // Sort stages by sequence order
  const sortedStages = [...stages].sort((a, b) => a.sequence_order - b.sequence_order);

  // Layout positions: 2 rows or serpentine grid layout for readable DAG representation
  const NODE_WIDTH = 200;
  const NODE_HEIGHT = 100;
  const X_GAP = 100;
  const Y_GAP = 140;

  // Compute node coordinates:
  // Sequential pipeline across horizontal columns with terminal/branch nodes nicely arranged
  const nodePositions = new Map<string, { x: number; y: number }>();
  sortedStages.forEach((stage, index) => {
    // 2-row layout: stages 0-4 on top row (left to right), stages 5-9 on bottom row
    let x = 0;
    let y = 0;

    if (stage.stage_code === 'LOST') {
      // Place LOST under DECISION
      x = 4 * (NODE_WIDTH + X_GAP);
      y = 2 * (NODE_HEIGHT + Y_GAP);
    } else if (stage.stage_code === 'ON_HOLD') {
      x = 3 * (NODE_WIDTH + X_GAP);
      y = 2 * (NODE_HEIGHT + Y_GAP);
    } else if (index < 5) {
      x = index * (NODE_WIDTH + X_GAP);
      y = 0;
    } else {
      // Second row
      x = (index - 5) * (NODE_WIDTH + X_GAP);
      y = NODE_HEIGHT + Y_GAP;
    }

    nodePositions.set(stage.id, { x, y });
  });

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleFit = () => {
    setZoom(0.85);
    setPan({ x: 50, y: 50 });
  };

  return (
    <div
      className={`relative w-full h-[580px] bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden select-none ${className}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
    >
      {/* Background Blueprint Grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, #06b6d4 1px, transparent 0)`,
          backgroundSize: '24px 24px',
        }}
      />

      {/* Floating Canvas Controls */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5 p-1 rounded-xl bg-slate-900/90 border border-slate-800 shadow-xl backdrop-blur-md">
        <button
          onClick={() => setZoom(prev => Math.min(prev + 0.15, 2.0))}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => setZoom(prev => Math.max(prev - 0.15, 0.4))}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={handleFit}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition"
          title="Fit Canvas"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
        <div className="px-2 text-[11px] font-mono text-slate-500 border-l border-slate-800">
          {Math.round(zoom * 100)}%
        </div>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-20 flex items-center gap-3 p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-[11px] font-mono text-slate-400 backdrop-blur-md shadow-xl">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" /> Start
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-400" /> Process
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Decision
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> Won Terminal
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-400" /> Lost Terminal
        </span>
      </div>

      {/* Interactive Transform Canvas */}
      <div
        className="w-full h-full relative origin-top-left transition-transform duration-75"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        }}
      >
        {/* SVG Transition Arrows */}
        <svg
          className="absolute top-0 left-0 w-[2400px] h-[1600px] pointer-events-none"
          style={{ overflow: 'visible' }}
        >
          <defs>
            <marker
              id="arrow-default"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 8 5 L 0 9 z" fill="#06b6d4" />
            </marker>
            <marker
              id="arrow-terminal"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 8 5 L 0 9 z" fill="#f43f5e" />
            </marker>
          </defs>

          {transitions.map(tr => {
            const fromPos = nodePositions.get(tr.from_stage_id);
            const toPos = nodePositions.get(tr.to_stage_id);
            if (!fromPos || !toPos) return null;

            const startX = fromPos.x + NODE_WIDTH;
            const startY = fromPos.y + NODE_HEIGHT / 2;
            const endX = toPos.x;
            const endY = toPos.y + NODE_HEIGHT / 2;

            // Direct line or cubic bezier curved line
            const midX = (startX + endX) / 2;
            const d =
              Math.abs(startY - endY) < 10
                ? `M ${startX} ${startY} L ${endX} ${endY}`
                : `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;

            const isLostEdge = tr.transition_code.includes('LOST');

            return (
              <g key={tr.id}>
                <path
                  d={d}
                  fill="none"
                  stroke={isLostEdge ? '#f43f5e' : '#06b6d4'}
                  strokeWidth="2"
                  strokeDasharray={isLostEdge ? '4 4' : 'none'}
                  strokeOpacity="0.65"
                  markerEnd={isLostEdge ? 'url(#arrow-terminal)' : 'url(#arrow-default)'}
                />
              </g>
            );
          })}
        </svg>

        {/* Stage Nodes */}
        {sortedStages.map(stage => {
          const pos = nodePositions.get(stage.id) || { x: 0, y: 0 };
          const isCurrent = currentStageCode?.toUpperCase() === stage.stage_code.toUpperCase();
          const isTerminalWon = stage.stage_code === 'WON';
          const isTerminalLost = stage.stage_code === 'LOST';

          let typeColor = 'border-indigo-500/40 bg-slate-900/90 text-indigo-300';
          if (stage.stage_type === 'START') {
            typeColor = 'border-cyan-400 bg-cyan-950/60 text-cyan-200';
          } else if (stage.stage_type === 'DECISION') {
            typeColor = 'border-amber-400 bg-amber-950/60 text-amber-200';
          } else if (isTerminalWon) {
            typeColor = 'border-emerald-500 bg-emerald-950/60 text-emerald-200';
          } else if (isTerminalLost) {
            typeColor = 'border-rose-500 bg-rose-950/60 text-rose-200';
          }

          return (
            <div
              key={stage.id}
              onClick={() => onSelectStage && onSelectStage(stage)}
              style={{
                position: 'absolute',
                left: `${pos.x}px`,
                top: `${pos.y}px`,
                width: `${NODE_WIDTH}px`,
                height: `${NODE_HEIGHT}px`,
              }}
              className={`p-3.5 rounded-2xl border backdrop-blur-md shadow-xl transition-all cursor-pointer flex flex-col justify-between ${typeColor} ${
                isCurrent
                  ? 'ring-4 ring-cyan-400/30 scale-105 z-10 shadow-cyan-500/20'
                  : 'hover:scale-[1.02] hover:border-slate-600'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950/60 font-bold">
                  #{stage.sequence_order} • {stage.stage_type}
                </span>
                {isCurrent && (
                  <span className="flex items-center gap-1 text-[10px] font-mono text-cyan-300 font-bold animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" /> ACTIVE
                  </span>
                )}
              </div>

              <div>
                <h5 className="font-bold text-xs text-slate-100 truncate">{stage.stage_name}</h5>
                <p className="text-[10px] font-mono text-slate-400 truncate">{stage.stage_code}</p>
              </div>

              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 border-t border-slate-800/80 pt-1.5">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-500" />
                  {stage.sla_duration_days > 0 ? `${stage.sla_duration_days}d SLA` : 'Terminal'}
                </span>
                <span className="text-slate-500">
                  {stage.responsible_role || 'Cross-Func'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
