import { Handle, Position, NodeProps, Node } from '@xyflow/react';
import { CourseCategory } from '../../lib/data/flowcharts/administracion';
import { Lock, CheckCircle2, Unlock } from 'lucide-react';

export type CourseNodeData = {
  label: string;
  credits: number;
  category: CourseCategory;
  status: 'locked' | 'unlocked' | 'completed';
  isEditMode?: boolean;
  id: string;
};

const categoryColors: Record<CourseCategory, string> = {
  nivelacion: 'bg-gray-500',
  economia: 'bg-orange-500',
  finanzas: 'bg-blue-800',
  marketing: 'bg-yellow-600',
  sello_up: 'bg-blue-900',
  administracion: 'bg-green-600',
  contabilidad: 'bg-red-700',
  derecho: 'bg-teal-600',
};

export default function CourseNode({ data, id }: NodeProps<Node<CourseNodeData>>) {
  const { label, credits, category, status, isEditMode } = data;

  let bgClass = 'bg-white';
  let borderClass = 'border-gray-200';
  let textClass = 'text-gray-700';
  let opacityClass = 'opacity-100';

  if (status === 'completed') {
    bgClass = 'bg-yellow-100/90'; // Amarillo más suave para ver texto
    borderClass = 'border-yellow-500';
    textClass = 'text-yellow-900';
  } else if (status === 'unlocked') {
    bgClass = 'bg-green-50';
    borderClass = 'border-green-500 shadow-emerald-500/20 shadow-lg';
    textClass = 'text-green-900';
  } else {
    // Locked (default)
    bgClass = 'bg-gray-100/50';
    borderClass = 'border-gray-300 border-dashed';
    textClass = 'text-gray-400';
    opacityClass = 'opacity-60 saturate-50'; // Opaco y desaturado
  }

  return (
    <div 
      className={`relative w-48 rounded-md border-2 flex flex-col overflow-hidden transition-all duration-300 ${isEditMode ? 'cursor-move' : 'cursor-pointer hover:shadow-md hover:scale-105'} ${bgClass} ${borderClass} ${opacityClass}`}
    >
      <Handle 
        type="target" 
        position={Position.Left} 
        className={`w-1.5 h-6 rounded-r bg-gray-400 border-0 -ml-0.5 transition-opacity duration-300 ${isEditMode ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
      />
      
      {/* Category Header */}
      <div className={`h-1.5 w-full ${categoryColors[category]}`} />
      
      <div className="p-3 flex flex-col items-center justify-center text-center min-h-[80px] relative z-10">
        <p className={`font-bold text-xs leading-tight mb-1 drop-shadow-sm ${textClass}`}>
          {label}
        </p>
        <div className="flex items-center gap-1 mt-1">
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold shadow-sm ${status === 'locked' ? 'bg-gray-200' : 'bg-white/80'} ${textClass}`}>
            {credits} créd.
          </span>
          {status === 'locked' && <Lock className="w-3 h-3 text-gray-400" />}
          {status === 'unlocked' && <Unlock className="w-3 h-3 text-green-500 animate-pulse" />}
        </div>
      </div>

      {/* Completed Watermark */}
      {status === 'completed' && (
        <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none z-0">
          <CheckCircle2 className="w-20 h-20 text-yellow-600" />
        </div>
      )}

      <Handle 
        type="source" 
        position={Position.Right} 
        className={`w-1.5 h-6 rounded-l bg-gray-400 border-0 -mr-0.5 transition-opacity duration-300 ${isEditMode ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
      />
    </div>
  );
}
