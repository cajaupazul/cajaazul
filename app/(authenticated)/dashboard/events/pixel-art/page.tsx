'use client';
import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '@/lib/theme-context';
import { useProfile } from '@/lib/profile-context';
import {
  Download,
  RotateCcw,
  Palette,
  Plus,
  Minus,
  Share2,
} from 'lucide-react';

const GRID_SIZE = 32;
const CELL_SIZE = 20;
const COLORS = [
  '#FFFFFF', '#000000', '#FF0000', '#00FF00', '#0000FF',
  '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#800080',
  '#FFC0CB', '#A52A2A', '#808080', '#C0C0C0', '#FFD700',
];

export default function EventosPixelArtPage() {
  const { colors } = useTheme();
  const { profile } = useProfile();
  const canvasRef = useRef(null);
  const [grid, setGrid] = useState(Array(GRID_SIZE * GRID_SIZE).fill('#FFFFFF'));
  const [selectedColor, setSelectedColor] = useState('#000000');
  const [isDrawing, setIsDrawing] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);

  const handleCanvasMouseDown = (e) => {
    setIsDrawing(true);
    handleCanvasClick(e);
  };

  const handleCanvasMouseUp = () => {
    setIsDrawing(false);
  };

  const handleCanvasMouseMove = (e) => {
    if (!isDrawing) return;
    handleCanvasClick(e);
  };

  const handleCanvasClick = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const cellSize = CELL_SIZE * zoomLevel;
    const col = Math.floor(x / cellSize);
    const row = Math.floor(y / cellSize);

    if (col >= 0 && col < GRID_SIZE && row >= 0 && row < GRID_SIZE) {
      const index = row * GRID_SIZE + col;
      const newGrid = [...grid];
      newGrid[index] = selectedColor;
      setGrid(newGrid);
    }
  };

  const resetCanvas = () => {
    setGrid(Array(GRID_SIZE * GRID_SIZE).fill('#FFFFFF'));
  };

  const downloadImage = () => {
    const canvas = document.createElement('canvas');
    const cellSize = 20;
    canvas.width = GRID_SIZE * cellSize;
    canvas.height = GRID_SIZE * cellSize;
    const ctx = canvas.getContext('2d');

    grid.forEach((color, index) => {
      const row = Math.floor(index / GRID_SIZE);
      const col = index % GRID_SIZE;
      ctx.fillStyle = color;
      ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
      ctx.strokeStyle = '#e5e7eb';
      ctx.strokeRect(col * cellSize, row * cellSize, cellSize, cellSize);
    });

    const link = document.createElement('a');
    link.href = canvas.toDataURL();
    link.download = `pixel-art-${Date.now()}.png`;
    link.click();
  };

  const shareImage = async () => {
    const canvas = document.createElement('canvas');
    const cellSize = 20;
    canvas.width = GRID_SIZE * cellSize;
    canvas.height = GRID_SIZE * cellSize;
    const ctx = canvas.getContext('2d');

    grid.forEach((color, index) => {
      const row = Math.floor(index / GRID_SIZE);
      const col = index % GRID_SIZE;
      ctx.fillStyle = color;
      ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
      ctx.strokeStyle = '#e5e7eb';
      ctx.strokeRect(col * cellSize, row * cellSize, cellSize, cellSize);
    });

    const text = `¡Mira mi arte de píxeles! Creado en CampusLink Pixel Art por ${profile?.nombre || 'un usuario'}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Mi Pixel Art',
          text: text,
        });
      } catch (err) {
        console.log('Error compartiendo:', err);
      }
    } else {
      alert(text);
    }
  };

  const canvasWidth = GRID_SIZE * CELL_SIZE * zoomLevel;
  const canvasHeight = GRID_SIZE * CELL_SIZE * zoomLevel;

  return (
    <div className="min-h-screen bg-bb-dark p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Pixel Art Event</h1>
          <p className="text-gray-400">¡Crea tu propia obra maestra de píxeles! Colabora con otros estudiantes en este evento interactivo.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Canvas */}
          <div className="lg:col-span-3">
            <div className="bg-bb-card rounded-xl p-6 border border-gray-700">
              <h2 className="text-xl font-bold text-white mb-4">Lienzo</h2>
              
              <div className="flex justify-center mb-6 bg-bb-dark rounded-lg p-4 overflow-auto max-h-96">
                <canvas
                  ref={canvasRef}
                  width={canvasWidth}
                  height={canvasHeight}
                  onMouseDown={handleCanvasMouseDown}
                  onMouseUp={handleCanvasMouseUp}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseLeave={() => setIsDrawing(false)}
                  className="border-2 border-gray-600 cursor-crosshair"
                  style={{
                    display: 'block',
                    imageRendering: 'pixelated',
                  }}
                />
              </div>

              {/* Canvas Controls */}
              <div className="flex gap-3 justify-center flex-wrap">
                <button
                  onClick={() => setZoomLevel(Math.max(0.5, zoomLevel - 0.5))}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-all"
                >
                  <Minus className="w-4 h-4" />
                  Alejar
                </button>
                <span className="px-4 py-2 text-white font-semibold">Zoom: {(zoomLevel * 100).toFixed(0)}%</span>
                <button
                  onClick={() => setZoomLevel(Math.min(3, zoomLevel + 0.5))}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Acercar
                </button>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            {/* Color Picker */}
            <div className="bg-bb-card rounded-xl p-6 border border-gray-700 mb-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Palette className="w-5 h-5" />
                Colores
              </h3>
              
              <div className="grid grid-cols-3 gap-3 mb-4">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    className={`w-full h-10 rounded-lg border-2 transition-all ${
                      selectedColor === color
                        ? 'border-white scale-110'
                        : 'border-gray-600 hover:border-gray-400'
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>

              <div className="text-sm text-gray-400">
                <p>Color seleccionado:</p>
                <div className="flex items-center gap-2 mt-2">
                  <div
                    className="w-8 h-8 rounded border border-gray-600"
                    style={{ backgroundColor: selectedColor }}
                  />
                  <span className="font-mono">{selectedColor}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="bg-bb-card rounded-xl p-6 border border-gray-700">
              <h3 className="text-lg font-bold text-white mb-4">Acciones</h3>
              
              <div className="space-y-3">
                <button
                  onClick={downloadImage}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-semibold transition-all"
                >
                  <Download className="w-4 h-4" />
                  Descargar
                </button>
                
                <button
                  onClick={shareImage}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white font-semibold transition-all"
                >
                  <Share2 className="w-4 h-4" />
                  Compartir
                </button>
                
                <button
                  onClick={resetCanvas}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-semibold transition-all"
                >
                  <RotateCcw className="w-4 h-4" />
                  Limpiar
                </button>
              </div>
            </div>

            {/* Stats */}
            <div className="bg-bb-card rounded-xl p-6 border border-gray-700 mt-6">
              <h3 className="text-lg font-bold text-white mb-4">Estadísticas</h3>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Dimensiones:</span>
                  <span className="text-white font-semibold">{GRID_SIZE}x{GRID_SIZE}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Píxeles:</span>
                  <span className="text-white font-semibold">{grid.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Colores únicos:</span>
                  <span className="text-white font-semibold">{new Set(grid).size}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="mt-8 bg-bb-card rounded-xl p-6 border border-gray-700">
          <h3 className="text-lg font-bold text-white mb-3">Cómo usar</h3>
          <ul className="text-gray-300 space-y-2 text-sm">
            <li>✓ Selecciona un color de la paleta</li>
            <li>✓ Haz clic en el lienzo para pintar píxeles</li>
            <li>✓ Arrastra para pintar múltiples píxeles</li>
            <li>✓ Usa los botones de zoom para acercar/alejar</li>
            <li>✓ Descarga tu obra como PNG o compártela con otros</li>
          </ul>
        </div>
      </div>
    </div>
  );
}