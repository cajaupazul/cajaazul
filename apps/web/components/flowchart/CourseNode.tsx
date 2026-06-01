import { Handle, Position, NodeProps, Node } from '@xyflow/react';
import { CourseCategory } from '../../lib/data/flowcharts/administracion';

export type CourseNodeData = {
  label: string;
  credits: number;
  category: CourseCategory;
  status: 'locked' | 'unlocked' | 'completed';
  onToggle: (id: string) => void;
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
  const { label, credits, category, status, onToggle } = data;

  // Determinar colores basados en el estado
  let bgClass = 'bg-white';
  let borderClass = 'border-gray-200';
  let textClass = 'text-gray-700';

  if (status === 'completed') {
    bgClass = 'bg-yellow-300';
    borderClass = 'border-yellow-500';
    textClass = 'text-yellow-900';
  } else if (status === 'unlocked') {
    bgClass = 'bg-green-100';
    borderClass = 'border-green-500';
    textClass = 'text-green-900';
  } else {
    // Locked (default)
    bgClass = 'bg-gray-50';
    borderClass = 'border-gray-200';
    textClass = 'text-gray-400';
  }

  return (
    <div 
      className={`relative w-44 rounded-md border-2 shadow-sm flex flex-col overflow-hidden transition-all duration-200 cursor-pointer hover:shadow-md hover:scale-105 ${bgClass} ${borderClass}`}
      onClick={() => onToggle(id)}
    >
      <Handle type="target" position={Position.Left} className="w-2 h-2 !bg-gray-400" />
      
      {/* Category Header */}
      <div className={`h-2 w-full ${categoryColors[category]} opacity-80`} />
      
      <div className="p-3 flex flex-col items-center justify-center text-center min-h-[80px]">
        <p className={`font-bold text-xs leading-tight mb-1 ${textClass}`}>
          {label}
        </p>
        <span className={`text-[10px] px-2 py-0.5 rounded-full bg-white/50 font-medium ${textClass}`}>
          {credits} créd.
        </span>
      </div>

      <Handle type="source" position={Position.Right} className="w-2 h-2 !bg-gray-400" />
    </div>
  );
}
