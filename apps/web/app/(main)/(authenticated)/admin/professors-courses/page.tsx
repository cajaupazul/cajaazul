'use client';

import React, { useState, useRef, useCallback } from 'react';
import Papa from 'papaparse';
import { supabase } from '@/lib/supabase';
import {
  Upload,
  Save,
  Trash2,
  Plus,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  RefreshCw,
  Users,
  BookOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface Row {
  curso: string;
  profesor: string;
  _status?: 'new' | 'existing' | 'error';
}

interface SaveResult {
  profesores_creados: number;
  cursos_creados: number;
  vinculos_agregados: number;
  errores: string[];
}

export default function ProfessorsCoursesAdminPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<SaveResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // -------------------------------------------------------------------
  // Cargar CSV
  // -------------------------------------------------------------------
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setResult(null);
    setError(null);

    Papa.parse<string[]>(file, {
      header: false,
      skipEmptyLines: true,
      delimiter: '', // auto-detect ; or ,
      complete: (parsed) => {
        const rawRows = parsed.data as string[][];

        // Detectar encabezado: si la primera fila es "Curso;Profesor" o similar, saltarla
        const startIdx =
          rawRows[0]?.[0]?.toLowerCase().includes('curso') ||
          rawRows[0]?.[0]?.toLowerCase().includes('course')
            ? 1
            : 0;

        const mapped: Row[] = rawRows
          .slice(startIdx)
          .map((cols) => {
            // Soporte para ; y , como separadores dentro de una sola columna
            if (cols.length === 1) {
              const parts = cols[0].split(/[;,]/).map((s) => s.trim());
              return { curso: parts[0] || '', profesor: parts[1] || '' };
            }
            return { curso: (cols[0] || '').trim(), profesor: (cols[1] || '').trim() };
          })
          .filter((r) => r.curso && r.profesor);

        setRows(mapped);
      },
      error: (err) => setError(`Error al leer el CSV: ${err.message}`),
    });

    // Reset input para permitir subir el mismo archivo de nuevo
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // -------------------------------------------------------------------
  // Editar celda
  // -------------------------------------------------------------------
  const updateCell = (idx: number, field: 'curso' | 'profesor', value: string) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  };

  // -------------------------------------------------------------------
  // Agregar fila vacía
  // -------------------------------------------------------------------
  const addRow = () => setRows((prev) => [...prev, { curso: '', profesor: '' }]);

  // -------------------------------------------------------------------
  // Eliminar fila
  // -------------------------------------------------------------------
  const deleteRow = (idx: number) => setRows((prev) => prev.filter((_, i) => i !== idx));

  // -------------------------------------------------------------------
  // Guardar en Supabase (lógica aditiva: nunca elimina)
  // -------------------------------------------------------------------
  const handleSave = useCallback(async () => {
    const validRows = rows.filter((r) => r.curso.trim() && r.profesor.trim());
    if (validRows.length === 0) {
      setError('No hay filas válidas para guardar.');
      return;
    }

    setSaving(true);
    setError(null);
    setResult(null);

    const stats: SaveResult = {
      profesores_creados: 0,
      cursos_creados: 0,
      vinculos_agregados: 0,
      errores: [],
    };

    try {
      // 1. Obtener profesores y catalog_courses existentes
      const [{ data: existingProfs }, { data: existingCourses }] = await Promise.all([
        supabase.from('professors').select('id, nombre'),
        supabase.from('catalog_courses').select('id, nombre'),
      ]);

      const profMap = new Map<string, string>(
        (existingProfs || []).map((p) => [p.nombre.trim().toLowerCase(), p.id])
      );
      const courseMap = new Map<string, string>(
        (existingCourses || []).map((c) => [c.nombre.trim().toLowerCase(), c.id])
      );

      for (const row of validRows) {
        const profKey = row.profesor.trim().toLowerCase();
        const courseKey = row.curso.trim().toLowerCase();

        // ── Crear profesor si no existe ──
        if (!profMap.has(profKey)) {
          const { data: newProf, error: profErr } = await supabase
            .from('professors')
            .insert({ nombre: row.profesor.trim() })
            .select('id, nombre')
            .single();

          if (profErr || !newProf) {
            stats.errores.push(`No se pudo crear el profesor: ${row.profesor}`);
            continue;
          }
          profMap.set(profKey, newProf.id);
          stats.profesores_creados++;
        }

        // ── Crear curso en catálogo si no existe ──
        if (!courseMap.has(courseKey)) {
          const { data: newCourse, error: courseErr } = await supabase
            .from('catalog_courses')
            .insert({ nombre: row.curso.trim() })
            .select('id, nombre')
            .single();

          if (courseErr || !newCourse) {
            stats.errores.push(`No se pudo crear el curso: ${row.curso}`);
            continue;
          }
          courseMap.set(courseKey, newCourse.id);
          stats.cursos_creados++;
        }

        const professorId = profMap.get(profKey)!;
        const catalogCourseId = courseMap.get(courseKey)!;

        // ── Agregar vínculo (solo si no existe ya) ──
        const { error: linkErr } = await supabase
          .from('course_professors')
          .upsert(
            { professor_id: professorId, catalog_course_id: catalogCourseId },
            { onConflict: 'professor_id,catalog_course_id', ignoreDuplicates: true }
          );

        if (linkErr) {
          stats.errores.push(`Error vinculando ${row.profesor} ↔ ${row.curso}`);
        } else {
          stats.vinculos_agregados++;
        }
      }

      setResult(stats);
    } catch (err: any) {
      setError(`Error inesperado: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }, [rows]);

  // -------------------------------------------------------------------
  // Filas filtradas
  // -------------------------------------------------------------------
  const filteredRows = rows.filter(
    (r) =>
      filter === '' ||
      r.curso.toLowerCase().includes(filter.toLowerCase()) ||
      r.profesor.toLowerCase().includes(filter.toLowerCase())
  );

  // -------------------------------------------------------------------
  // UI
  // -------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-bb-dark p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-bb-sidebar via-bb-card to-bb-sidebar p-6 rounded-2xl border border-bb-border shadow-xl">
          <div className="flex items-center gap-4">
            <div className="p-3.5 bg-emerald-600/20 border border-emerald-500/30 rounded-2xl text-emerald-400">
              <FileSpreadsheet className="w-9 h-9" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-bb-text tracking-tight">
                Gestión Cursos & Profesores
              </h1>
              <p className="text-sm text-bb-text-secondary mt-0.5">
                Sube un CSV, edita en la tabla y guarda. Los datos se sincronizan automáticamente.
              </p>
            </div>
          </div>

          {/* Acciones principales */}
          <div className="flex items-center gap-3 flex-wrap">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              className="hidden"
              onChange={handleFileUpload}
            />
            <Button
              variant="outline"
              className="border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 gap-2"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-4 h-4" />
              Subir CSV
            </Button>
            <Button
              variant="outline"
              className="border-bb-border text-bb-text-secondary hover:bg-bb-card gap-2"
              onClick={addRow}
            >
              <Plus className="w-4 h-4" />
              Agregar fila
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white gap-2 disabled:opacity-50"
              onClick={handleSave}
              disabled={saving || rows.length === 0}
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {saving ? 'Guardando...' : 'Guardar en BD'}
            </Button>
          </div>
        </div>

        {/* Resultado de guardado */}
        {result && (
          <Card className="border-emerald-500/30 bg-emerald-500/5">
            <CardContent className="p-4 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-emerald-400 font-semibold text-sm">¡Guardado exitosamente!</p>
                <div className="flex flex-wrap gap-4 mt-2">
                  <span className="text-xs text-bb-text-secondary flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-blue-400" />
                    {result.profesores_creados} profesores creados
                  </span>
                  <span className="text-xs text-bb-text-secondary flex items-center gap-1">
                    <BookOpen className="w-3.5 h-3.5 text-purple-400" />
                    {result.cursos_creados} cursos creados
                  </span>
                  <span className="text-xs text-bb-text-secondary flex items-center gap-1">
                    <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                    {result.vinculos_agregados} vínculos sincronizados
                  </span>
                </div>
                {result.errores.length > 0 && (
                  <details className="mt-2">
                    <summary className="text-xs text-amber-400 cursor-pointer">
                      {result.errores.length} errores menores
                    </summary>
                    <ul className="mt-1 space-y-0.5">
                      {result.errores.map((e, i) => (
                        <li key={i} className="text-xs text-bb-text-secondary">• {e}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
              <button onClick={() => setResult(null)} className="text-bb-text-secondary hover:text-bb-text">
                <X className="w-4 h-4" />
              </button>
            </CardContent>
          </Card>
        )}

        {/* Error */}
        {error && (
          <Card className="border-red-500/30 bg-red-500/5">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-400">{error}</p>
              <button onClick={() => setError(null)} className="ml-auto text-bb-text-secondary hover:text-bb-text">
                <X className="w-4 h-4" />
              </button>
            </CardContent>
          </Card>
        )}

        {/* Instrucciones si no hay datos */}
        {rows.length === 0 && (
          <Card className="border-bb-border border-dashed bg-bb-card/50">
            <CardContent className="p-12 text-center">
              <FileSpreadsheet className="w-16 h-16 text-bb-text-secondary/30 mx-auto mb-4" />
              <h3 className="text-bb-text font-semibold mb-2">Sin datos cargados</h3>
              <p className="text-bb-text-secondary text-sm mb-6 max-w-md mx-auto">
                Sube tu archivo CSV con dos columnas: <code className="bg-bb-darker px-1.5 py-0.5 rounded text-blue-400">Curso</code> y <code className="bg-bb-darker px-1.5 py-0.5 rounded text-blue-400">Profesor</code>. Puede usar <code className="bg-bb-darker px-1 rounded">,</code> o <code className="bg-bb-darker px-1 rounded">;</code> como separador.
              </p>
              <Button
                variant="outline"
                className="border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 gap-2"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-4 h-4" />
                Subir CSV ahora
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Tabla editable */}
        {rows.length > 0 && (
          <div className="space-y-3">
            {/* Barra de búsqueda + contador */}
            <div className="flex items-center justify-between gap-4">
              <input
                type="text"
                placeholder="Filtrar por curso o profesor..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="flex-1 max-w-sm px-3 py-2 text-sm rounded-lg bg-bb-card border border-bb-border text-bb-text placeholder:text-bb-text-secondary focus:outline-none focus:border-blue-500/60"
              />
              <span className="text-sm text-bb-text-secondary whitespace-nowrap">
                {filteredRows.length} / {rows.length} filas
              </span>
            </div>

            {/* Tabla */}
            <div className="rounded-xl border border-bb-border overflow-hidden">
              {/* Encabezado fijo */}
              <div className="grid grid-cols-[40px_1fr_1fr_40px] bg-bb-sidebar border-b border-bb-border text-xs font-bold text-bb-text-secondary uppercase tracking-wider">
                <div className="px-3 py-3 text-center">#</div>
                <div className="px-4 py-3 flex items-center gap-2">
                  <BookOpen className="w-3.5 h-3.5 text-purple-400" /> Curso
                </div>
                <div className="px-4 py-3 flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-blue-400" /> Profesor
                </div>
                <div className="px-3 py-3" />
              </div>

              {/* Filas editables (virtualizadas con overflow-y-auto) */}
              <div className="overflow-y-auto max-h-[55vh] divide-y divide-bb-border/40">
                {filteredRows.map((row, visIdx) => {
                  // Encontrar el índice real en `rows` (para ediciones correctas al filtrar)
                  const realIdx = rows.indexOf(row);
                  return (
                    <div
                      key={realIdx}
                      className="grid grid-cols-[40px_1fr_1fr_40px] hover:bg-bb-card/60 group transition-colors"
                    >
                      <div className="px-3 py-2 text-center text-xs text-bb-text-secondary self-center">
                        {realIdx + 1}
                      </div>
                      <div className="px-2 py-1.5">
                        <input
                          type="text"
                          value={row.curso}
                          onChange={(e) => updateCell(realIdx, 'curso', e.target.value)}
                          className="w-full px-2 py-1.5 text-sm bg-transparent rounded border border-transparent hover:border-bb-border focus:border-blue-500/60 focus:bg-bb-card/50 text-bb-text focus:outline-none transition-all"
                          placeholder="Nombre del curso"
                        />
                      </div>
                      <div className="px-2 py-1.5">
                        <input
                          type="text"
                          value={row.profesor}
                          onChange={(e) => updateCell(realIdx, 'profesor', e.target.value)}
                          className="w-full px-2 py-1.5 text-sm bg-transparent rounded border border-transparent hover:border-bb-border focus:border-blue-500/60 focus:bg-bb-card/50 text-bb-text focus:outline-none transition-all"
                          placeholder="Apellido, Nombre"
                        />
                      </div>
                      <div className="flex items-center justify-center">
                        <button
                          onClick={() => deleteRow(realIdx)}
                          className="p-1.5 text-bb-text-secondary/30 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between bg-bb-sidebar border-t border-bb-border px-4 py-2">
                <button
                  onClick={addRow}
                  className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1.5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Agregar fila
                </button>
                <Button
                  className="bg-blue-600 hover:bg-blue-700 text-white gap-2 text-xs h-8 disabled:opacity-50"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  {saving ? 'Guardando...' : `Guardar ${rows.filter(r => r.curso && r.profesor).length} filas`}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
