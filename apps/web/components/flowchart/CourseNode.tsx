import { Handle, Position, NodeProps, Node } from '@xyflow/react';
import { CourseCategory } from '../../lib/data/flowcharts/administracion';
import { Lock, CheckCircle2, Unlock } from 'lucide-react';

export type CourseNodeData = {
  label: string;
  credits: number;
  category: CourseCategory;
  status: 'locked' | 'unlocked' | 'completed';
  isEditMode?: boolean;
  isHighlighted?: boolean; // glows when it's unlocked BY a hovered course
  id: string;
};

const categoryColors: Record<CourseCategory, string> = {
  nivelacion:    'bg-gray-500',
  economia:      'bg-orange-500',
  finanzas:      'bg-blue-800',
  marketing:     'bg-yellow-600',
  sello_up:      'bg-blue-900',
  administracion:'bg-green-600',
  contabilidad:  'bg-red-700',
  derecho:       'bg-teal-600',
};

export default function CourseNode({ data }: NodeProps<Node<CourseNodeData>>) {
  const { label, credits, category, status, isEditMode, isHighlighted } = data;

  /* ── Appearance based on status ── */
  let bgClass      = 'bg-white dark:bg-gray-800';
  let borderClass  = 'border-gray-200 dark:border-gray-600';
  let textClass    = 'text-gray-700 dark:text-gray-200';
  let opacityClass = 'opacity-100';
  let shadowClass  = '';

  if (status === 'completed') {
    bgClass     = 'bg-yellow-100/90';
    borderClass = 'border-yellow-500';
    textClass   = 'text-yellow-900';
    shadowClass = 'shadow-yellow-400/30 shadow-lg';
  } else if (status === 'unlocked') {
    bgClass     = 'bg-green-50 dark:bg-green-950';
    borderClass = 'border-green-500';
    textClass   = 'text-green-900 dark:text-green-200';
    shadowClass = 'shadow-emerald-500/20 shadow-md';
  } else if (!isEditMode) {
    // locked in view mode — faded
    bgClass      = 'bg-gray-100/50 dark:bg-gray-900/50';
    borderClass  = 'border-gray-300 border-dashed dark:border-gray-700';
    textClass    = 'text-gray-400 dark:text-gray-600';
    opacityClass = 'opacity-55 saturate-50';
  }

  // Override with highlight glow when user hovers a course that opens this one
  if (isHighlighted) {
    borderClass  = 'border-sky-400 border-2';
    shadowClass  = 'shadow-sky-400/60 shadow-xl ring-2 ring-sky-300/50';
    opacityClass = 'opacity-100 saturate-100';
    bgClass      = status === 'locked' ? 'bg-sky-50 dark:bg-sky-950' : bgClass;
  }

  /* ── Edit mode: all nodes look neutral ── */
  if (isEditMode) {
    bgClass      = 'bg-slate-800';
    borderClass  = 'border-indigo-400 border-2';
    textClass    = 'text-slate-100';
    opacityClass = 'opacity-100 saturate-100';
    shadowClass  = 'shadow-indigo-500/30 shadow-md';
  }

  return (
    <div
      className={`relative w-48 rounded-lg border-2 flex flex-col overflow-visible transition-all duration-300
        ${isEditMode ? 'cursor-move' : 'cursor-pointer hover:shadow-lg hover:scale-[1.03]'}
        ${bgClass} ${borderClass} ${opacityClass} ${shadowClass}`}
    >
      {/* ── Target handle (LEFT) — big in edit mode ── */}
      <Handle
        type="target"
        position={Position.Left}
        style={isEditMode ? {
          width: 18,
          height: 18,
          background: '#818cf8',
          border: '3px solid #6366f1',
          borderRadius: '50%',
          left: -10,
          boxShadow: '0 0 10px #6366f1aa',
          cursor: 'crosshair',
        } : {
          width: 8,
          height: 8,
          background: 'transparent',
          border: 'none',
          left: 0,
          pointerEvents: 'none',
        }}
      />

      {/* Category color bar */}
      <div className={`h-1.5 w-full rounded-t-md ${categoryColors[category]}`} />

      <div className="p-3 flex flex-col items-center justify-center text-center min-h-[76px] relative z-10">
        <p className={`font-bold text-xs leading-tight mb-1 ${textClass}`}>
          {label}
        </p>
        <div className="flex items-center gap-1 mt-1">
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold shadow-sm
            ${isEditMode ? 'bg-slate-700 text-slate-300'
              : status === 'locked' ? 'bg-gray-200 text-gray-400'
              : 'bg-white/80 ' + textClass}`}>
            {credits} créd.
          </span>
          {!isEditMode && status === 'locked'    && <Lock   className="w-3 h-3 text-gray-400" />}
          {!isEditMode && status === 'unlocked'  && <Unlock className="w-3 h-3 text-green-500 animate-pulse" />}
          {!isEditMode && status === 'completed' && <CheckCircle2 className="w-3 h-3 text-yellow-600" />}
        </div>
      </div>

      {/* Completed watermark */}
      {status === 'completed' && !isEditMode && (
        <div className="absolute inset-0 flex items-center justify-center opacity-[0.07] pointer-events-none z-0">
          <CheckCircle2 className="w-20 h-20 text-yellow-600" />
        </div>
      )}

      {/* ── Source handle (RIGHT) — big in edit mode ── */}
      <Handle
        type="source"
        position={Position.Right}
        style={isEditMode ? {
          width: 18,
          height: 18,
          background: '#34d399',
          border: '3px solid #10b981',
          borderRadius: '50%',
          right: -10,
          boxShadow: '0 0 10px #10b981aa',
          cursor: 'crosshair',
        } : {
          width: 8,
          height: 8,
          background: 'transparent',
          border: 'none',
          right: 0,
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
