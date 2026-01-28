import * as React from 'react';
import { cn } from '@/lib/utils';

// Card base para uso general
const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('rounded-lg bg-white shadow-sm', className)}
    {...props}
  />
));
Card.displayName = 'Card';

// Tarjeta de curso con imagen de fondo
const CourseCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    imageUrl?: string;
    title?: string;
    courseCode?: string;
    professor?: string;
    status?: 'Abierto' | 'Cerrado';
    onStarClick?: () => void;
  }
>(({ className, imageUrl, title, courseCode, professor, status, onStarClick, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('group cursor-pointer overflow-hidden rounded-lg shadow-md transition-all hover:shadow-lg', className)}
    {...props}
  >
    {/* Imagen de fondo */}
    <div className="relative h-40 overflow-hidden bg-gray-200">
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={title}
          className="h-full w-full object-cover transition-transform group-hover:scale-105"
        />
      ) : (
        <div className="h-full w-full bg-gradient-to-br from-blue-400 to-blue-600" />
      )}
    </div>

    {/* Contenido */}
    <div className="bg-white p-4">
      {/* Código del curso */}
      <p className="text-xs font-semibold text-gray-500 uppercase">{courseCode}</p>

      {/* Título del curso */}
      <h3 className="mt-1 line-clamp-2 text-sm font-semibold text-gray-900">{title}</h3>

      {/* Profesor */}
      <p className="mt-2 text-xs text-gray-600">{professor}</p>

      {/* Footer con estado y estrella */}
      <div className="mt-3 flex items-center justify-between pt-3 border-t border-gray-100">
        <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
          {status || 'Abierto'}
        </span>
        <button
          onClick={onStarClick}
          className="text-gray-300 transition-colors hover:text-yellow-400"
          aria-label="Guardar curso"
        >
          ★
        </button>
      </div>
    </div>
  </div>
));
CourseCard.displayName = 'CourseCard';

// Componentes auxiliares para estructura general
const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />
));
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h2
    ref={ref}
    className={cn('text-2xl font-semibold leading-none tracking-tight', className)}
    {...props}
  />
));
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('text-sm text-gray-500', className)} {...props} />
));
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
));
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('flex items-center p-6 pt-0', className)} {...props} />
));
CardFooter.displayName = 'CardFooter';

export {
  Card,
  CourseCard,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
};