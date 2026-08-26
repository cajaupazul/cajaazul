'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTheme } from '@/lib/theme-context';
import { useProfile } from '@/lib/profile-context';
import { LibraryBook, supabase } from '@/lib/supabase';
import {
  deleteFileFromR2WithRetry,
  uploadFileToR2,
} from '@/lib/r2-storage';
import {
  Plus,
  Trash2,
  Image as ImageIcon,
  FileText,
  ChevronLeft,
  BookOpen,
  Link as LinkIcon,
  Loader2,
  Pencil,
  Star,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Link from 'next/link';

type BookForm = {
  title: string;
  author: string;
  year: string;
  editorial: string;
  synopsis: string;
  rating: number;
  buy_links: { store: string; url: string }[];
  metadata: {
    pages: string;
    collection: string;
    genres: string[];
  };
};

const createEmptyForm = (): BookForm => ({
  title: '',
  author: '',
  year: String(new Date().getFullYear()),
  editorial: '',
  synopsis: '',
  rating: 5,
  buy_links: [],
  metadata: {
    pages: '',
    collection: '',
    genres: [],
  },
});

const sanitizeFileName = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

const isHttpUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

const getAssetFileName = (url: string | null) => {
  if (!url) return '';
  try {
    const parsedUrl = new URL(url);
    const path = parsedUrl.searchParams.get('path') || parsedUrl.pathname;
    return decodeURIComponent(path.split('/').pop() || 'Archivo actual');
  } catch {
    return 'Archivo actual';
  }
};

export default function AdminLibraryPage() {
  const { colors } = useTheme();
  const { profile } = useProfile();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editBookId = searchParams.get('edit');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingBook, setIsLoadingBook] = useState(Boolean(editBookId));
  const [loadError, setLoadError] = useState('');
  const [editingBook, setEditingBook] = useState<LibraryBook | null>(null);
  const [preservedMetadata, setPreservedMetadata] = useState<Record<string, unknown>>({});

  const [form, setForm] = useState<BookForm>(createEmptyForm);

  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [removeCover, setRemoveCover] = useState(false);
  const [removePdf, setRemovePdf] = useState(false);
  const [currentGenre, setCurrentGenre] = useState('');

  // Protect route
  useEffect(() => {
    if (profile && profile.role !== 'admin' && profile.role !== 'superadmin') {
      router.push('/dashboard');
    }
  }, [profile, router]);

  useEffect(() => {
    if (!editBookId || !profile || (profile.role !== 'admin' && profile.role !== 'superadmin')) {
      setIsLoadingBook(false);
      return;
    }

    let active = true;
    const loadBook = async () => {
      setIsLoadingBook(true);
      setLoadError('');

      const { data, error } = await supabase
        .from('library_books')
        .select('*')
        .eq('id', editBookId)
        .single();

      if (!active) return;

      if (error || !data) {
        console.error('Error loading book:', error);
        setLoadError('No pudimos cargar este libro. Puede que haya sido eliminado o que el enlace ya no sea válido.');
        setIsLoadingBook(false);
        return;
      }

      const book = data as LibraryBook;
      const bookMetadata = book.metadata && typeof book.metadata === 'object' ? book.metadata : {};
      const genres = Array.isArray(bookMetadata.genres)
        ? bookMetadata.genres.filter((genre): genre is string => typeof genre === 'string')
        : [];
      const buyLinks = Array.isArray(book.buy_links)
        ? book.buy_links.filter((link) => link && typeof link.store === 'string' && typeof link.url === 'string')
        : [];

      setEditingBook(book);
      setPreservedMetadata(bookMetadata);
      setForm({
        title: book.title || '',
        author: book.author || '',
        year: book.year ? String(book.year) : '',
        editorial: book.editorial || '',
        synopsis: book.synopsis || '',
        rating: Number(book.rating) || 0,
        buy_links: buyLinks,
        metadata: {
          pages: bookMetadata.pages == null ? '' : String(bookMetadata.pages),
          collection: typeof bookMetadata.collection === 'string' ? bookMetadata.collection : '',
          genres,
        },
      });
      setCoverPreview(book.cover_url || null);
      setIsLoadingBook(false);
    };

    void loadBook();
    return () => {
      active = false;
    };
  }, [editBookId, profile]);

  useEffect(() => {
    return () => {
      if (coverPreview?.startsWith('blob:')) URL.revokeObjectURL(coverPreview);
    };
  }, [coverPreview]);

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
    const normalizedGenre = currentGenre.trim();
    if (normalizedGenre && !form.metadata.genres.some((genre) => genre.toLowerCase() === normalizedGenre.toLowerCase())) {
      setForm({
        ...form,
        metadata: {
          ...form.metadata,
          genres: [...form.metadata.genres, normalizedGenre]
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
    const title = form.title.trim();
    const author = form.author.trim();
    const year = form.year.trim() ? Number(form.year) : null;
    const cleanedLinks = form.buy_links
      .map((link) => ({ store: link.store.trim(), url: link.url.trim() }))
      .filter((link) => link.store || link.url);

    if (!title || !author) {
      alert('El título y el autor son obligatorios.');
      return;
    }
    if (year !== null && (!Number.isInteger(year) || year < 1000 || year > new Date().getFullYear() + 2)) {
      alert('Ingresa un año de publicación válido.');
      return;
    }
    if (cleanedLinks.some((link) => !link.store || !isHttpUrl(link.url))) {
      alert('Cada tienda debe tener un nombre y una URL válida que empiece con http:// o https://.');
      return;
    }

    setIsSaving(true);
    const bookId = editingBook?.id || crypto.randomUUID();
    const newlyUploadedUrls: string[] = [];
    let databaseSaved = false;
    try {
      let coverUrl = removeCover ? null : editingBook?.cover_url || null;
      let pdfUrl = removePdf ? null : editingBook?.pdf_url || null;

      if (coverFile) {
        const path = `books/${bookId}/cover/${Date.now()}-${sanitizeFileName(coverFile.name) || 'cover'}`;
        coverUrl = await uploadFileToR2('library', path, coverFile);
        newlyUploadedUrls.push(coverUrl);
      }

      if (pdfFile) {
        const path = `books/${bookId}/document/${Date.now()}-${sanitizeFileName(pdfFile.name) || 'book.pdf'}`;
        pdfUrl = await uploadFileToR2('library', path, pdfFile);
        newlyUploadedUrls.push(pdfUrl);
      }

      const payload = {
        title,
        author,
        year,
        editorial: form.editorial.trim() || null,
        synopsis: form.synopsis.trim() || null,
        rating: Math.min(5, Math.max(0, Number(form.rating) || 0)),
        buy_links: cleanedLinks,
        metadata: {
          ...preservedMetadata,
          pages: form.metadata.pages.trim() || null,
          collection: form.metadata.collection.trim() || null,
          genres: form.metadata.genres,
        },
        cover_url: coverUrl,
        pdf_url: pdfUrl,
      };

      const query = editingBook
        ? supabase.from('library_books').update(payload).eq('id', editingBook.id)
        : supabase.from('library_books').insert([{ id: bookId, ...payload }]);
      const { data: savedBook, error } = await query.select('id').single();

      if (error || !savedBook) throw error || new Error('La base de datos no confirmó los cambios.');
      databaseSaved = true;

      if (editingBook) {
        const replacedAssets = [
          editingBook.cover_url && editingBook.cover_url !== coverUrl ? editingBook.cover_url : null,
          editingBook.pdf_url && editingBook.pdf_url !== pdfUrl ? editingBook.pdf_url : null,
        ].filter((url): url is string => Boolean(url));

        for (const oldUrl of replacedAssets) {
          try {
            await deleteFileFromR2WithRetry('library', oldUrl);
          } catch (cleanupError) {
            console.warn('El libro se actualizó, pero un archivo anterior quedó pendiente de limpieza:', cleanupError);
          }
        }
      }

      alert(editingBook ? 'Libro actualizado correctamente.' : 'Libro añadido correctamente.');
      router.push('/dashboard/library');
      router.refresh();
    } catch (error: unknown) {
      if (!databaseSaved) {
        for (const uploadedUrl of newlyUploadedUrls) {
          try {
            await deleteFileFromR2WithRetry('library', uploadedUrl);
          } catch (cleanupError) {
            console.warn('No se pudo revertir un archivo recién subido:', cleanupError);
          }
        }
      }
      console.error('Error saving book:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'No se pudieron guardar los cambios.'}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (!profile || (profile.role !== 'admin' && profile.role !== 'superadmin')) return null;

  if (isLoadingBook) {
    return (
      <div className="min-h-[70dvh] bg-bb-darker flex items-center justify-center p-6 text-bb-text">
        <div className="flex items-center gap-3 text-sm font-bold">
          <Loader2 className="h-5 w-5 animate-spin text-faculty-primary" />
          Cargando ficha del libro…
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-[70dvh] bg-bb-darker flex items-center justify-center p-6 text-bb-text">
        <div className="w-full max-w-lg rounded-2xl border border-bb-border bg-bb-card p-8 text-center">
          <BookOpen className="mx-auto mb-4 h-9 w-9 text-faculty-primary" />
          <h1 className="text-xl font-black">No encontramos el libro</h1>
          <p className="mt-2 text-sm text-bb-text-secondary">{loadError}</p>
          <Button className="mt-6" onClick={() => router.push('/dashboard/library')}>Volver a la biblioteca</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bb-darker p-4 sm:p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href={editingBook ? '/dashboard/library' : '/admin'}>
              <Button variant="ghost" size="icon" className="rounded-full bg-bb-sidebar/50 hover:bg-bb-sidebar">
                <ChevronLeft className="w-6 h-6" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-extrabold text-bb-text tracking-tight flex items-center gap-3">
                {editingBook ? <Pencil className="text-faculty-primary" /> : <BookOpen className="text-faculty-primary" />}
                {editingBook ? 'Editar libro' : 'Añadir libro'}
              </h1>
              <p className="text-bb-text-secondary font-medium uppercase text-[10px] tracking-widest">
                {editingBook ? 'Actualiza su ficha y archivos' : 'Biblioteca Digital de CampusLink'}
              </p>
            </div>
          </div>
          <Button
            onClick={() => handleSave()}
            className="font-black h-12 px-8 rounded-xl shadow-lg shadow-faculty-primary/20 hidden md:flex"
            style={{ backgroundColor: colors?.primary }}
            disabled={isSaving}
          >
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isSaving ? 'Guardando…' : editingBook ? 'Guardar cambios' : 'Publicar libro'}
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
                    min={1000}
                    max={new Date().getFullYear() + 2}
                    onChange={e => setForm({ ...form, year: e.target.value })}
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
                  {form.buy_links.length === 0 && (
                    <p className="rounded-xl border border-dashed border-bb-border px-4 py-5 text-center text-xs text-bb-text-secondary">
                      Sin tiendas asociadas. Añade solo enlaces oficiales o autorizados.
                    </p>
                  )}
                  {form.buy_links.map((link, index) => (
                    <div key={index} className="grid grid-cols-1 gap-3 rounded-2xl border border-bb-border bg-bb-sidebar/30 p-4 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
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
                      <Button variant="ghost" size="icon" onClick={() => removeBuyLink(index)} className="text-red-400 hover:text-red-300 hover:bg-red-400/10 sm:mb-0.5" title="Quitar tienda">
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
                <ImageIcon className="w-4 h-4 text-faculty-primary" /> Portada del libro
              </h2>
              <div 
                className="relative aspect-[2/3] w-full rounded-2xl border-2 border-dashed border-bb-border bg-bb-sidebar/30 flex flex-col items-center justify-center cursor-pointer hover:bg-bb-sidebar/50 transition-all overflow-hidden"
                onClick={() => document.getElementById('cover-input')?.click()}
              >
                {coverPreview ? (
                  <img src={coverPreview} className="w-full h-full object-cover" alt={`Vista previa de la portada de ${form.title || 'este libro'}`} />
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
                      setRemoveCover(false);
                      setCoverPreview(URL.createObjectURL(file));
                    }
                  }}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1 border-bb-border bg-bb-sidebar/40"
                  onClick={() => document.getElementById('cover-input')?.click()}
                >
                  <Pencil className="mr-2 h-3.5 w-3.5" />
                  {coverPreview ? 'Reemplazar' : 'Seleccionar'}
                </Button>
                {coverPreview && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-red-500/40 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                    onClick={() => {
                      setCoverFile(null);
                      setCoverPreview(null);
                      setRemoveCover(true);
                    }}
                    title="Quitar portada"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {editingBook?.cover_url && !coverFile && !removeCover && (
                <p className="truncate text-[10px] text-bb-text-secondary" title={getAssetFileName(editingBook.cover_url)}>
                  Actual: {getAssetFileName(editingBook.cover_url)}
                </p>
              )}
              {removeCover && <p className="text-[10px] font-bold text-amber-400">La portada se quitará al guardar.</p>}
              {removeCover && editingBook?.cover_url && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full text-bb-text-secondary"
                  onClick={() => {
                    setRemoveCover(false);
                    setCoverPreview(editingBook.cover_url);
                  }}
                >
                  Conservar portada actual
                </Button>
              )}
            </div>

            {/* PDF Upload */}
            <div className="bg-bb-card border border-bb-border rounded-3xl p-6 shadow-xl space-y-4">
              <h2 className="font-bold text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-faculty-primary" /> Archivo PDF
              </h2>
              <div 
                className={`p-6 rounded-2xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center gap-2 ${pdfFile || (editingBook?.pdf_url && !removePdf) ? 'border-green-500/50 bg-green-500/5' : 'border-bb-border bg-bb-sidebar/30 hover:bg-bb-sidebar/50'}`}
                onClick={() => document.getElementById('pdf-input')?.click()}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${pdfFile || (editingBook?.pdf_url && !removePdf) ? 'bg-green-600 text-white' : 'bg-bb-darker text-bb-text-secondary'}`}>
                  <FileText className="w-6 h-6" />
                </div>
                <div className="text-center">
                  <p className="max-w-[220px] truncate text-xs font-bold text-bb-text">
                    {pdfFile
                      ? pdfFile.name
                      : editingBook?.pdf_url && !removePdf
                        ? getAssetFileName(editingBook.pdf_url)
                        : 'Seleccionar PDF'}
                  </p>
                  <p className="text-[10px] text-bb-text-secondary uppercase tracking-widest mt-1">
                    {pdfFile ? `${(pdfFile.size / 1024 / 1024).toFixed(2)} MB · reemplazo` : editingBook?.pdf_url && !removePdf ? 'Documento actual' : 'Máx. 128MB'}
                  </p>
                </div>
                <input 
                  id="pdf-input"
                  type="file" 
                  className="hidden" 
                  accept="application/pdf" 
                  onChange={e => {
                    const file = e.target.files?.[0] || null;
                    setPdfFile(file);
                    if (file) setRemovePdf(false);
                  }}
                />
              </div>
              {(pdfFile || (editingBook?.pdf_url && !removePdf)) && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full border-red-500/40 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                  onClick={() => {
                    setPdfFile(null);
                    setRemovePdf(true);
                  }}
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5" /> Quitar documento
                </Button>
              )}
              {removePdf && <p className="text-[10px] font-bold text-amber-400">El PDF se quitará al guardar.</p>}
              {removePdf && editingBook?.pdf_url && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full text-bb-text-secondary"
                  onClick={() => setRemovePdf(false)}
                >
                  Conservar documento actual
                </Button>
              )}
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
                  {[5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1, 0.5, 0].map(r => (
                    <option key={r} value={r} className="bg-bb-card">{r} {r === 1 ? 'estrella' : 'estrellas'}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-bb-text-secondary">Colección</Label>
                <Input
                  value={form.metadata.collection}
                  onChange={e => setForm({ ...form, metadata: { ...form.metadata, collection: e.target.value } })}
                  className="bg-bb-sidebar/50 border-bb-border h-11 rounded-xl"
                  placeholder="Ej: Biblioteca CampusLink"
                />
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
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addGenre();
                      }
                    }}
                    className="bg-bb-sidebar/50 border-bb-border h-10 rounded-xl"
                    placeholder="Ej: Ciencia"
                  />
                  <Button type="button" size="sm" onClick={addGenre} className="bg-faculty-primary h-10 px-4 rounded-xl">Añadir</Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {form.metadata.genres.map(g => (
                    <span key={g} className="px-3 py-1 rounded-full bg-bb-sidebar border border-bb-border text-[10px] font-bold text-bb-text flex items-center gap-2">
                      {g}
                      <button type="button" onClick={() => removeGenre(g)} className="text-bb-text-secondary hover:text-red-400" aria-label={`Quitar ${g}`}>×</button>
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
            {isSaving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
            {isSaving ? 'Guardando…' : editingBook ? 'Guardar cambios' : 'Publicar libro'}
          </Button>
        </div>
      </div>
    </div>
  );
}
