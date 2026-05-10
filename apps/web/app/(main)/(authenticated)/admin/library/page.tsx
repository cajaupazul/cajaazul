'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/lib/theme-context';
import { useProfile } from '@/lib/profile-context';
import { supabase } from '@/lib/supabase';
import { uploadFileToR2 } from '@/lib/r2-storage';
import {
  Plus,
  Trash2,
  Save,
  Image as ImageIcon,
  FileText,
  ChevronLeft,
  BookOpen,
  Link as LinkIcon,
  Star
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Link from 'next/link';

export default function AdminLibraryPage() {
  const { colors } = useTheme();
  const { profile } = useProfile();
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [form, setForm] = useState({
    title: '',
    author: '',
    year: new Date().getFullYear(),
    editorial: '',
    synopsis: '',
    rating: 5,
    buy_links: [] as { store: string; url: string }[],
    metadata: {
      pages: '',
      collection: '',
      genres: [] as string[]
    }
  });

  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [currentGenre, setCurrentGenre] = useState('');

  // Protect route
  useEffect(() => {
    if (profile && profile.role !== 'admin' && profile.role !== 'superadmin') {
      router.push('/dashboard');
    }
  }, [profile, router]);

  const addBuyLink = () => {
    setForm({ ...form, buy_links: [...form.buy_links, { store: '', url: '' }] });
  };

  const removeBuyLink = (index: number) => {
    const newLinks = [...form.buy_links];
    newLinks.splice(index, 1);
    setForm({ ...form, buy_links: newLinks });
  };

  const updateBuyLink = (index: number, field: 'store' | 'url', value: string) => {
    const newLinks = [...form.buy_links];
    newLinks[index][field] = value;
    setForm({ ...form, buy_links: newLinks });
  };

  const addGenre = () => {
    if (currentGenre && !form.metadata.genres.includes(currentGenre)) {
      setForm({
        ...form,
        metadata: {
          ...form.metadata,
          genres: [...form.metadata.genres, currentGenre]
        }
      });
      setCurrentGenre('');
    }
  };

  const removeGenre = (genre: string) => {
    setForm({
      ...form,
      metadata: {
        ...form.metadata,
        genres: form.metadata.genres.filter(g => g !== genre)
      }
    });
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!form.title || !form.author) {
      alert('Título y Autor son obligatorios');
      return;
    }

    setIsSaving(true);
    try {
      let cover_url = '';
      let pdf_url = '';

      // 1. Upload Cover
      if (coverFile) {
        const path = `covers/${Date.now()}_${coverFile.name}`;
        cover_url = await uploadFileToR2('library', path, coverFile);
      }

      // 2. Upload PDF
      if (pdfFile) {
        const path = `pdfs/${Date.now()}_${pdfFile.name}`;
        pdf_url = await uploadFileToR2('library', path, pdfFile);
      }

      // 3. Insert into DB
      const { error } = await supabase
        .from('library_books')
        .insert([{
          ...form,
          cover_url: cover_url || null,
          pdf_url: pdf_url || null,
        }]);

      if (error) throw error;

      alert('Libro añadido con éxito');
      router.push('/dashboard/library');
      router.refresh();
    } catch (error: any) {
      console.error('Error saving book:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (!profile || (profile.role !== 'admin' && profile.role !== 'superadmin')) return null;

  return (
    <div className="min-h-screen bg-bb-darker p-4 sm:p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button variant="ghost" size="icon" className="rounded-full bg-bb-sidebar/50 hover:bg-bb-sidebar">
                <ChevronLeft className="w-6 h-6" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-extrabold text-bb-text tracking-tight flex items-center gap-3">
                <BookOpen className="text-faculty-primary" /> Añadir Libro
              </h1>
              <p className="text-bb-text-secondary font-medium uppercase text-[10px] tracking-widest">Biblioteca Digital de CampusLink</p>
            </div>
          </div>
          <Button
            onClick={() => handleSave()}
            className="font-black h-12 px-8 rounded-xl shadow-lg shadow-faculty-primary/20 hidden md:flex"
            style={{ backgroundColor: colors?.primary }}
            disabled={isSaving}
          >
            {isSaving ? 'Subiendo...' : 'Publicar Libro'}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-bb-card border border-bb-border rounded-3xl p-8 shadow-xl space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-bb-text-secondary">Título del Libro</Label>
                  <Input 
                    value={form.title} 
                    onChange={e => setForm({ ...form, title: e.target.value })} 
                    className="bg-bb-sidebar/50 border-bb-border h-12 rounded-xl"
                    placeholder="Ej: Economía para todos"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-bb-text-secondary">Nombre del Autor/a</Label>
                  <Input 
                    value={form.author} 
                    onChange={e => setForm({ ...form, author: e.target.value })} 
                    className="bg-bb-sidebar/50 border-bb-border h-12 rounded-xl"
                    placeholder="Ej: John Doe"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-bb-text-secondary">Editorial</Label>
                  <Input 
                    value={form.editorial} 
                    onChange={e => setForm({ ...form, editorial: e.target.value })} 
                    className="bg-bb-sidebar/50 border-bb-border h-12 rounded-xl"
                    placeholder="Ej: Pearson"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-bb-text-secondary">Año de Publicación</Label>
                  <Input 
                    type="number" 
                    value={form.year} 
                    onChange={e => setForm({ ...form, year: parseInt(e.target.value) })} 
                    className="bg-bb-sidebar/50 border-bb-border h-12 rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-bb-text-secondary">Sinopsis</Label>
                <Textarea 
                  value={form.synopsis} 
                  onChange={e => setForm({ ...form, synopsis: e.target.value })} 
                  className="bg-bb-sidebar/50 border-bb-border min-h-[150px] rounded-xl"
                  placeholder="Escribe un breve resumen del libro..."
                />
              </div>

              {/* Buy Links */}
              <div className="space-y-4 pt-4 border-t border-bb-border">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <LinkIcon className="w-4 h-4 text-faculty-primary" /> Tiendas Oficiales
                  </h3>
                  <Button variant="ghost" size="sm" onClick={addBuyLink} className="text-faculty-primary font-bold">
                    + Añadir Tienda
                  </Button>
                </div>
                <div className="space-y-3">
                  {form.buy_links.map((link, index) => (
                    <div key={index} className="flex gap-3 items-end bg-bb-sidebar/30 p-4 rounded-2xl border border-bb-border">
                      <div className="flex-1 space-y-2">
                        <Label className="text-[10px] uppercase text-bb-text-secondary">Nombre Tienda</Label>
                        <Input 
                          value={link.store} 
                          onChange={e => updateBuyLink(index, 'store', e.target.value)}
                          className="bg-bb-darker border-bb-border h-10"
                          placeholder="Amazon, BuscaLibre, etc."
                        />
                      </div>
                      <div className="flex-[2] space-y-2">
                        <Label className="text-[10px] uppercase text-bb-text-secondary">Enlace (URL)</Label>
                        <Input 
                          value={link.url} 
                          onChange={e => updateBuyLink(index, 'url', e.target.value)}
                          className="bg-bb-darker border-bb-border h-10"
                          placeholder="https://..."
                        />
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => removeBuyLink(index)} className="text-red-400 hover:text-red-300 hover:bg-red-400/10 mb-0.5">
                        <Trash2 className="w-5 h-5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar - Media & Extras */}
          <div className="space-y-6">
            {/* Cover Upload */}
            <div className="bg-bb-card border border-bb-border rounded-3xl p-6 shadow-xl space-y-4">
              <h2 className="font-bold text-sm flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-faculty-primary" /> Portada del Libro
              </h2>
              <div 
                className="relative aspect-[2/3] w-full rounded-2xl border-2 border-dashed border-bb-border bg-bb-sidebar/30 flex flex-col items-center justify-center cursor-pointer hover:bg-bb-sidebar/50 transition-all overflow-hidden"
                onClick={() => document.getElementById('cover-input')?.click()}
              >
                {coverPreview ? (
                  <img src={coverPreview} className="w-full h-full object-cover" alt="Preview" />
                ) : (
                  <div className="text-center space-y-2">
                    <Plus className="w-8 h-8 text-bb-text-secondary mx-auto" />
                    <p className="text-xs text-bb-text-secondary font-bold uppercase tracking-widest">Subir Imagen</p>
                  </div>
                )}
                <input 
                  id="cover-input"
                  type="file" 
                  className="hidden" 
                  accept="image/*" 
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setCoverFile(file);
                      setCoverPreview(URL.createObjectURL(file));
                    }
                  }} 
                />
              </div>
            </div>

            {/* PDF Upload */}
            <div className="bg-bb-card border border-bb-border rounded-3xl p-6 shadow-xl space-y-4">
              <h2 className="font-bold text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-faculty-primary" /> Archivo PDF
              </h2>
              <div 
                className={`p-6 rounded-2xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center gap-2 ${pdfFile ? 'border-green-500/50 bg-green-500/5' : 'border-bb-border bg-bb-sidebar/30 hover:bg-bb-sidebar/50'}`}
                onClick={() => document.getElementById('pdf-input')?.click()}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${pdfFile ? 'bg-green-500 text-white' : 'bg-bb-darker text-bb-text-secondary'}`}>
                  <FileText className="w-6 h-6" />
                </div>
                <div className="text-center">
                  <p className="text-xs font-bold text-bb-text">{pdfFile ? pdfFile.name : 'Seleccionar PDF'}</p>
                  <p className="text-[10px] text-bb-text-secondary uppercase tracking-widest mt-1">{pdfFile ? `${(pdfFile.size / 1024 / 1024).toFixed(2)} MB` : 'Máx. 128MB'}</p>
                </div>
                <input 
                  id="pdf-input"
                  type="file" 
                  className="hidden" 
                  accept="application/pdf" 
                  onChange={e => setPdfFile(e.target.files?.[0] || null)} 
                />
              </div>
            </div>

            {/* Rating & Metadata */}
            <div className="bg-bb-card border border-bb-border rounded-3xl p-6 shadow-xl space-y-6">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-bb-text-secondary flex items-center gap-2">
                  <Star className="w-3 h-3 text-yellow-400" /> Calificación
                </Label>
                <select 
                  value={form.rating} 
                  onChange={e => setForm({ ...form, rating: parseFloat(e.target.value) })}
                  className="w-full bg-bb-sidebar/50 border-bb-border h-12 rounded-xl px-4 text-sm"
                >
                  {[5, 4.5, 4, 3.5, 3, 2, 1].map(r => (
                    <option key={r} value={r} className="bg-bb-card">{r} Estrellas</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-bb-text-secondary">Páginas</Label>
                <Input 
                  value={form.metadata.pages} 
                  onChange={e => setForm({ ...form, metadata: { ...form.metadata, pages: e.target.value } })}
                  className="bg-bb-sidebar/50 border-bb-border h-11 rounded-xl"
                  placeholder="Ej: 350"
                />
              </div>

              <div className="space-y-3">
                <Label className="text-xs font-bold uppercase tracking-wider text-bb-text-secondary">Géneros</Label>
                <div className="flex gap-2">
                  <Input 
                    value={currentGenre} 
                    onChange={e => setCurrentGenre(e.target.value)}
                    onKeyPress={e => e.key === 'Enter' && addGenre()}
                    className="bg-bb-sidebar/50 border-bb-border h-10 rounded-xl"
                    placeholder="Ej: Ciencia"
                  />
                  <Button size="sm" onClick={addGenre} className="bg-faculty-primary h-10 px-4 rounded-xl">Add</Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {form.metadata.genres.map(g => (
                    <span key={g} className="px-3 py-1 rounded-full bg-bb-sidebar border border-bb-border text-[10px] font-bold text-bb-text flex items-center gap-2">
                      {g}
                      <button onClick={() => removeGenre(g)} className="text-bb-text-secondary hover:text-red-400">×</button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Save */}
        <div className="md:hidden pt-4">
          <Button
            onClick={() => handleSave()}
            className="w-full h-14 rounded-2xl font-black text-lg shadow-xl"
            style={{ backgroundColor: colors?.primary }}
            disabled={isSaving}
          >
            {isSaving ? 'Subiendo...' : 'Publicar Libro'}
          </Button>
        </div>
      </div>
    </div>
  );
}
