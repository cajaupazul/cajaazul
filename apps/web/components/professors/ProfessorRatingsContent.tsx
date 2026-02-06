'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Star, MessageCircle, TrendingUp, ArrowLeft, Trophy, Sparkles, Share2, Instagram, User, Info, ArrowRight, Upload, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { supabase, Professor, Profile, getStorageUrl } from '@/lib/supabase';
import { useTheme } from '@/lib/theme-context';
import BouncingBalls from '@/components/BouncingBalls';
import { motion, Variants, AnimatePresence } from 'framer-motion';
import { AvatarWithFrame } from '@/components/ui/AvatarWithFrame';
import { StickerCanvas } from '@/components/ui/StickerCanvas';
import { PLACEHOLDERS } from '@/lib/constants';
import SecureFileModal from '@/components/secure/SecureFileModal';
import { UserHoverCard } from '@/components/ui/UserHoverCard';
import { FileText, LayoutPanelLeft, FolderRoot } from 'lucide-react';

interface ProfessorComment {
    id: string;
    professor_id: string;
    user_id: string;
    contenido: string;
    parent_id: string | null;
    likes: number;
    created_at: string;
    profiles?: {
        nombre: string;
        avatar_url: string | null;
        active_frame_key?: string | null;
        background_url?: string | null;
        bio?: string | null;
        created_at?: string;
        puntos?: number;
        es_vip?: boolean;
    };
}

interface Rating {
    id: string;
    puntuacion: number;
    claridad: number | null;
    facilidad: number | null;
    created_at: string;
    profiles?: {
        nombre: string;
        avatar_url: string | null;
        active_frame_key?: string | null;
        background_url?: string | null;
        bio?: string | null;
        created_at?: string;
        puntos?: number;
        es_vip?: boolean;
    };
}

const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.1 }
    }
};

const itemVariants: Variants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
        y: 0,
        opacity: 1,
        transition: { type: 'spring', stiffness: 100 }
    }
};

const getColorFromName = (nombre: string) => {
    const colors = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];
    let hash = 0;
    for (let i = 0; i < nombre.length; i++) {
        hash = nombre.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
};

// Function to upgrade old low-quality images to high-quality Unsplash
const getHighQualityBackgroundImage = (url: string | null, professorName: string): string => {
    // If URL is from Picsum (old low quality), replace with Unsplash
    if (!url || url.includes('picsum.photos') || url.includes('source.unsplash.com') || url.includes('unsplash.com/featured')) {
        const NATURE_BG_IDS = [
            'photo-1501854140801-50d01698950b',
            'photo-1470074184345-d97a063efcf9',
            'photo-1441974231531-c6227db76b6e',
            'photo-1501785888041-af3ef285b470',
            'photo-1472214103451-9374bd1c798e',
            'photo-1500382017468-9049fed747ef',
            'photo-1469474968028-56623f02e42e',
            'photo-1447752875215-b2761acb3c5d',
            'photo-1433086966358-54859d0ed716',
            'photo-1511497584788-8767ef7299b2',
        ];
        // Use professor name to generate consistent seed for same professor
        const seed = professorName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const randomId = NATURE_BG_IDS[seed % NATURE_BG_IDS.length];
        return `https://images.unsplash.com/${randomId}?auto=format&fit=crop&q=80&w=1600&h=900`;
    }
    // If already Unsplash but low resolution, upgrade it
    if (url.includes('source.unsplash.com') && !url.includes('1600x900')) {
        return url.replace(/\d+x\d+/, '1600x900');
    }
    return url || PLACEHOLDERS.BACKGROUND;
};

interface ProfessorRatingsContentProps {
    professor: Professor;
    initialRatings: Rating[];
    courseMapping?: Record<string, string>;
    professorLinkMapping?: Record<string, string>;
    aggregatedOtherCourses?: string[];
    relatedProfessors?: Array<{
        id: string;
        nombre: string;
        especialidad: string;
        facultad?: string;
    }>;
    initialMaterials?: any[];
    coursesTaught?: { id: string; nombre: string }[];
    initialComments: ProfessorComment[];
    profile: Profile | null;
    frameMap?: Record<string, any>;
}

const CommentItem = ({
    comment,
    profile,
    frameMap,
    onLike,
    onDelete,
    onReply,
    isReply = false,
    hasReplies = false
}: {
    comment: ProfessorComment;
    profile: Profile | null;
    frameMap: Record<string, any>;
    onLike: (id: string, current: number) => void;
    onDelete: (id: string) => void;
    onReply: () => void;
    isReply?: boolean;
    hasReplies?: boolean;
}) => {
    const isOwner = profile?.id === comment.user_id || profile?.role === 'admin';

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
                "relative group transition-all duration-300",
                !isReply && "pl-[4.5rem] md:pl-20 mb-10",
                isReply && "pl-12 md:pl-16 mt-6 first:mt-8"
            )}
        >
            {/* Threading Line Connectors */}
            {!isReply && (hasReplies || true) && (
                <div className="absolute left-6 md:left-9 top-14 bottom-0 w-[1.5px] bg-white/10 group-hover:bg-blue-500/30 transition-colors" />
            )}

            {isReply && (
                <div className="absolute left-[-2rem] top-[-1rem] w-8 h-10 border-l-[1.5px] border-b-[1.5px] border-white/10 opacity-50 rounded-bl-2xl" />
            )}

            <div className="absolute left-0 top-0 z-20">
                <UserHoverCard profile={{
                    nombre: comment.profiles?.nombre || 'Usuario',
                    avatar_url: comment.profiles?.avatar_url,
                    background_url: comment.profiles?.background_url,
                    bio: comment.profiles?.bio,
                    created_at: comment.profiles?.created_at,
                    puntos: comment.profiles?.puntos,
                    es_vip: comment.profiles?.es_vip,
                    role: 'user'
                }}>
                    <AvatarWithFrame
                        avatarUrl={comment.profiles?.avatar_url || PLACEHOLDERS.AVATAR}
                        name={comment.profiles?.nombre || 'Usuario'}
                        frameUrl={comment.profiles?.active_frame_key ? frameMap[comment.profiles.active_frame_key]?.image_url : null}
                        frameScale={comment.profiles?.active_frame_key ? frameMap[comment.profiles.active_frame_key]?.frame_settings?.profile?.scale : 1}
                        offsetX={comment.profiles?.active_frame_key ? frameMap[comment.profiles.active_frame_key]?.frame_settings?.profile?.x : 0}
                        offsetY={comment.profiles?.active_frame_key ? frameMap[comment.profiles.active_frame_key]?.frame_settings?.profile?.y : 0}
                        size={isReply ? "sm" : "md"}
                        className="ring-2 ring-bb-dark shadow-xl"
                    />
                </UserHoverCard>
            </div>

            <div className="flex flex-col">
                <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                        <UserHoverCard profile={{
                            id: comment.user_id,
                            nombre: comment.profiles?.nombre || 'Usuario',
                            avatar_url: comment.profiles?.avatar_url,
                            background_url: comment.profiles?.background_url,
                            bio: comment.profiles?.bio,
                            created_at: comment.profiles?.created_at,
                            puntos: comment.profiles?.puntos,
                            es_vip: comment.profiles?.es_vip,
                            role: 'user'
                        }}>
                            <p className="font-bold text-white text-sm md:text-base hover:text-blue-400 cursor-pointer transition-colors tracking-tight">
                                {comment.profiles?.nombre}
                            </p>
                        </UserHoverCard>
                        <span className="text-bb-text-secondary opacity-40 text-xs">•</span>
                        <p className="text-[10px] md:text-xs font-medium text-bb-text-secondary opacity-60">
                            {new Date(comment.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}
                        </p>
                    </div>

                    {isOwner && (
                        <button
                            onClick={() => onDelete(comment.id)}
                            className="text-bb-text-secondary hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-red-500/10 opacity-100 md:opacity-0 md:group-hover:opacity-100"
                            title="Eliminar"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>

                <div className={cn(
                    "text-bb-text leading-relaxed whitespace-pre-wrap font-medium kerning-normal",
                    isReply ? "text-sm opacity-90" : "text-[15px] md:text-base"
                )}>
                    {comment.contenido}
                </div>

                <div className="flex items-center gap-6 mt-4 opacity-70 hover:opacity-100 transition-opacity">
                    <button
                        onClick={() => onLike(comment.id, comment.likes || 0)}
                        className="flex items-center gap-1.5 text-bb-text-secondary hover:text-blue-400 transition-all text-[11px] font-bold uppercase tracking-tight group/btn"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 group-hover/btn:scale-110 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M7 10v12" /><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z" />
                        </svg>
                        Me gusta
                        {(comment.likes || 0) > 0 && <span className="text-blue-400 ml-0.5">{comment.likes}</span>}
                    </button>

                    {!isReply && (
                        <button
                            onClick={onReply}
                            className="flex items-center gap-1.5 text-bb-text-secondary hover:text-blue-400 transition-all text-[11px] font-bold uppercase tracking-tight group/btn"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 group-hover/btn:scale-110 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
                            </svg>
                            Responder
                        </button>
                    )}
                </div>
            </div>
        </motion.div>
    );
};

// Add cn helper if not present or just use a simple one
const cn = (...classes: any[]) => classes.filter(Boolean).join(' ');

export default function ProfessorRatingsContent({
    professor,
    initialRatings,
    courseMapping = {},
    professorLinkMapping = {},
    aggregatedOtherCourses = [],
    relatedProfessors = [],
    initialMaterials = [],
    coursesTaught = [],
    initialComments = [],
    profile,
    frameMap = {}
}: ProfessorRatingsContentProps) {
    const router = useRouter();
    const { colors } = useTheme();
    const [ratings, setRatings] = useState<Rating[]>(initialRatings);
    const [comments, setComments] = useState<ProfessorComment[]>(initialComments);
    const [commentText, setCommentText] = useState('');
    const [isSubmittingComment, setIsSubmittingComment] = useState(false);
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [materials, setMaterials] = useState<any[]>(initialMaterials);
    const [viewingFile, setViewingFile] = useState<{ path: string; name: string } | null>(null);
    const [replyToId, setReplyToId] = useState<string | null>(null);
    const [replyText, setReplyText] = useState('');
    const [isSubmittingReply, setIsSubmittingReply] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [commentToDelete, setCommentToDelete] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Sync state with props when Server Component re-renders
    useEffect(() => {
        setMaterials(initialMaterials);
        setComments(initialComments);
    }, [initialMaterials, initialComments]);

    // Realtime Subscriptions
    useEffect(() => {
        const channel = supabase
            .channel(`professor_comments:${professor.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'professor_comments',
                    filter: `professor_id=eq.${professor.id}`
                },
                async (payload) => {
                    const newComment = payload.new as ProfessorComment;

                    // Avoid duplicates if refresh already happened
                    setComments(prev => {
                        if (prev.some(c => c.id === newComment.id)) return prev;

                        // To show the profile properly, we need to fetch it
                        // Realtime payloads don't include joined data
                        const fetchProfile = async () => {
                            const { data: profileData } = await supabase
                                .from('profiles')
                                .select('nombre, avatar_url, active_frame_key, background_url, bio, created_at, puntos, es_vip')
                                .eq('id', newComment.user_id)
                                .single();

                            if (profileData) {
                                setComments(current =>
                                    current.map(c =>
                                        c.id === newComment.id
                                            ? { ...c, profiles: profileData }
                                            : c
                                    )
                                );
                            }
                        };

                        fetchProfile();

                        // Add to top (reverse chronological order)
                        return [newComment, ...prev];
                    });
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'DELETE',
                    schema: 'public',
                    table: 'professor_comments',
                    filter: `professor_id=eq.${professor.id}`
                },
                (payload) => {
                    setComments(prev => prev.filter(c => c.id !== payload.old.id));
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'professor_comments',
                    filter: `professor_id=eq.${professor.id}`
                },
                (payload) => {
                    const updated = payload.new as ProfessorComment;
                    setComments(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c));
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [professor.id]);

    // Pre-fill rating if user has already rated
    useEffect(() => {
        const fetchUserRating = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const userRating = ratings.find(r => (r as any).user_id === user.id);
                if (userRating) {
                    setFormData({
                        puntuacion: userRating.puntuacion,
                        claridad: userRating.claridad || 5,
                        facilidad: userRating.facilidad || 5,
                    });
                }
            }
        };
        fetchUserRating();
    }, [ratings]);

    const [formData, setFormData] = useState({
        puntuacion: 5,
        claridad: 5,
        facilidad: 5,
    });

    const handleSubmitRating = async (e: React.FormEvent) => {
        e.preventDefault();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { error } = await supabase.from('professor_ratings').upsert({
            professor_id: professor.id,
            user_id: user.id,
            puntuacion: formData.puntuacion,
            claridad: formData.claridad,
            facilidad: formData.facilidad,
        }, { onConflict: 'professor_id,user_id' });

        if (!error) {
            setCreateDialogOpen(false);
            router.refresh();
        }
    };

    const handleSubmitComment = async (e: React.FormEvent, parentId: string | null = null) => {
        e.preventDefault();
        const textToSubmit = parentId ? replyText : commentText;
        if (!textToSubmit.trim()) return;

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        if (parentId) setIsSubmittingReply(true);
        else setIsSubmittingComment(true);

        const { error } = await supabase.from('professor_comments').insert({
            professor_id: professor.id,
            user_id: user.id,
            contenido: textToSubmit.trim(),
            parent_id: parentId
        });

        if (!error) {
            if (parentId) {
                setReplyText('');
                setReplyToId(null);
            } else {
                setCommentText('');
            }
            router.refresh();
        } else {
            console.error('Error submitting comment:', error);
            alert(`Error al publicar: ${error.message}`);
        }

        if (parentId) setIsSubmittingReply(false);
        else setIsSubmittingComment(false);
    };

    const handleDeleteComment = async (commentId: string) => {
        setCommentToDelete(commentId);
        setIsDeleteDialogOpen(true);
    };

    const confirmDelete = async () => {
        if (!commentToDelete) return;

        const idToDelete = commentToDelete;
        setIsDeleting(true);

        // Optimistic update
        const previousComments = [...comments];
        setComments(prev => prev.filter(c => c.id !== idToDelete));

        try {
            const { error } = await supabase
                .from('professor_comments')
                .delete()
                .eq('id', idToDelete);

            if (error) {
                // Rollback on error
                setComments(previousComments);
                alert(`Error al eliminar: ${error.message}`);
            } else {
                // Sucessfully deleted, Realtime will handle other tabs
                // but we stay optimistic here.
                setIsDeleteDialogOpen(false);
                setCommentToDelete(null);
            }
        } catch (err) {
            setComments(previousComments);
            console.error('Delete error:', err);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleLikeComment = async (commentId: string, currentLikes: number) => {
        const { error } = await supabase
            .from('professor_comments')
            .update({ likes: currentLikes + 1 })
            .eq('id', commentId);

        if (!error) {
            router.refresh();
        }
    };

    const avgRating = ratings.length > 0
        ? (ratings.reduce((sum, r) => sum + r.puntuacion, 0) / ratings.length).toFixed(1)
        : '0.0';

    const avgClaridad = ratings.filter(r => r.claridad).length > 0
        ? (ratings.filter(r => r.claridad).reduce((sum, r) => sum + (r.claridad || 0), 0) / ratings.filter(r => r.claridad).length).toFixed(1)
        : '0.0';

    const avgFacilidad = ratings.filter(r => r.facilidad).length > 0
        ? (ratings.filter(r => r.facilidad).reduce((sum, r) => sum + (r.facilidad || 0), 0) / ratings.filter(r => r.facilidad).length).toFixed(1)
        : '0.0';




    return (
        <div className="min-h-screen bg-bb-dark p-8 relative overflow-hidden transition-colors duration-300">
            <BouncingBalls />
            <StickerCanvas
                targetType="professor"
                targetId={professor.id}
                canEdit={true}
            />

            <motion.div
                initial="hidden"
                animate="visible"
                variants={containerVariants}
                className="max-w-7xl mx-auto relative z-10"
            >
                <motion.div variants={itemVariants} className="mb-8">
                    <Link href="/dashboard/professors">
                        <Button variant="ghost" className="text-bb-text-secondary hover:text-bb-text hover:bg-bb-hover group pl-0">
                            <ArrowLeft className="h-5 w-5 mr-1 group-hover:-translate-x-1 transition-transform" />
                            Volver a Profesores
                        </Button>
                    </Link>
                </motion.div>

                <motion.div
                    variants={itemVariants}
                    className="mb-10 relative overflow-hidden rounded-3xl bg-bb-card border border-bb-border"
                >
                    {professor.background_image_url && (
                        <div className="relative h-32 overflow-hidden">
                            <div
                                className="absolute inset-0 bg-cover bg-center"
                                style={{ backgroundImage: `url("${getHighQualityBackgroundImage(professor.background_image_url, professor.nombre)}")` }}
                            />
                            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-bb-card/20 to-bb-card" />
                        </div>
                    )}

                    <div className={`relative z-10 p-8 flex flex-col md:flex-row gap-8 items-center md:items-start text-center md:text-left ${professor.background_image_url ? '-mt-16' : ''}`}>
                        <div className="relative group">
                            <div className="h-24 w-24 md:h-32 md:w-32 rounded-2xl md:rounded-3xl flex items-center justify-center bg-bb-sidebar border-4 border-bb-card shadow-2xl overflow-hidden relative z-20 transition-transform duration-500 hover:scale-105">
                                <img
                                    src={getStorageUrl(professor.avatar_url || '/profes/tl.webp', 'profile-avatars', PLACEHOLDERS.AVATAR)}
                                    alt={professor.nombre}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src = '/profes/tl.webp';
                                    }}
                                />
                            </div>
                            <div className="absolute -bottom-2 -right-2 bg-yellow-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-xl flex items-center gap-1 border border-yellow-400/50 z-30">
                                <Star className="w-3.5 h-3.5 fill-white" /> {avgRating}
                            </div>
                        </div>

                        <div className="flex-1 space-y-2">
                            <h1 className="text-3xl md:text-5xl font-black text-bb-text drop-shadow-md">{professor.nombre}</h1>
                            <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                                {professor.especialidad && professorLinkMapping[professor.especialidad.toLowerCase()] ? (
                                    <Link
                                        href={`/dashboard/professors/view?id=${professorLinkMapping[professor.especialidad.toLowerCase()]}`}
                                        className="bg-black/40 backdrop-blur-md text-white px-3 py-1 rounded-full text-xs border border-white/10 hover:bg-white/10 transition-colors font-bold uppercase tracking-wider"
                                    >
                                        {professor.especialidad}
                                    </Link>
                                ) : (
                                    professor.especialidad && (
                                        <span className="bg-black/40 backdrop-blur-md text-white/50 px-3 py-1 rounded-full text-xs border border-white/5 uppercase tracking-wider">
                                            {professor.especialidad}
                                        </span>
                                    )
                                )}

                                {professor.facultad && (
                                    <span className="bg-black/40 backdrop-blur-md text-white px-3 py-1 rounded-full text-xs border border-white/10 flex items-center gap-1 font-medium">
                                        <Info className="w-3 h-3" />
                                        {professor.facultad}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Actions moved out of here to clear space for stickers */}
                    </div>

                    {/* New Action Bar & Stats Combined */}
                    <div className="bg-bb-card/50 backdrop-blur-md border-t border-bb-border grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-bb-border">
                        {/* Stats Section */}
                        <div className="grid grid-cols-3 divide-x divide-bb-border py-2">
                            {[
                                { label: 'Calificación', value: avgRating, icon: Star, color: 'text-yellow-400' },
                                { label: 'Claridad', value: avgClaridad, icon: Sparkles, color: 'text-blue-400' },
                                { label: 'Facilidad', value: avgFacilidad, icon: TrendingUp, color: 'text-green-400' },
                            ].map((stat, i) => (
                                <div key={i} className="p-3 flex flex-col items-center justify-center hover:bg-white/5 transition-colors">
                                    <span className="text-xl md:text-2xl font-black text-bb-text mb-0.5">{stat.value}</span>
                                    <div className="flex items-center gap-1 text-[10px] md:text-xs text-bb-text-secondary uppercase tracking-tight font-bold">
                                        <stat.icon className={`w-3 h-3 md:w-3.5 md:h-3.5 ${stat.color}`} />
                                        <span className="truncate">{stat.label}</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Actions Section */}
                        <div className="p-3 flex items-center justify-center gap-3">
                            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button className="flex-1 bg-blue-600 hover:bg-blue-500 font-bold h-10 shadow-lg shadow-blue-500/20 text-white active:scale-95 transition-transform text-xs uppercase tracking-wide">
                                        <Star className="h-4 w-4 mr-2" />
                                        Calificar
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="bg-bb-card border-bb-border text-bb-text sm:max-w-md">
                                    <DialogHeader>
                                        <DialogTitle className="text-2xl font-bold">Califica a {professor.nombre.split(' ')[0]}</DialogTitle>
                                        <DialogDescription className="text-bb-text-secondary">
                                            Tu opinión ayuda a futuros estudiantes.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <form onSubmit={handleSubmitRating} className="space-y-6 mt-4">
                                        <div className="space-y-6">
                                            {([
                                                { label: 'Puntuación General', key: 'puntuacion', icon: Trophy, color: 'text-yellow-400' },
                                                { label: 'Claridad en Clase', key: 'claridad', icon: Sparkles, color: 'text-blue-400' },
                                                { label: 'Facilidad para Aprobar', key: 'facilidad', icon: TrendingUp, color: 'text-green-400' }
                                            ] as const).map((field) => (
                                                <div key={field.key} className="space-y-3 bg-bb-darker/50 p-4 rounded-2xl border border-bb-border/50">
                                                    <Label className="flex items-center gap-2 text-bb-text font-bold">
                                                        <field.icon className={`w-4 h-4 ${field.color}`} /> {field.label}
                                                    </Label>
                                                    <div className="flex justify-between px-2">
                                                        {[1, 2, 3, 4, 5].map((star) => (
                                                            <button
                                                                key={star}
                                                                type="button"
                                                                onClick={() => setFormData({ ...formData, [field.key]: star })}
                                                                className="group p-1 focus:outline-none transition-all active:scale-90"
                                                            >
                                                                <Star className={`w-10 h-10 md:w-11 md:h-11 transition-all ${star <= (formData as any)[field.key]
                                                                    ? 'fill-yellow-400 text-yellow-400 filter drop-shadow-[0_0_8px_rgba(250,204,21,0.4)]'
                                                                    : 'text-bb-border fill-bb-darker'
                                                                    }`} />
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 font-bold h-14 text-white text-lg rounded-2xl shadow-xl shadow-blue-500/20 active:scale-95 transition-all">
                                            Guardar Calificación
                                        </Button>
                                    </form>
                                </DialogContent>
                            </Dialog>

                            <Button
                                className="flex-1 bg-bb-darker border border-bb-border hover:bg-bb-hover font-bold h-10 text-bb-text active:scale-95 transition-transform text-xs uppercase tracking-wide"
                                onClick={() => {
                                    const primaryCourseId = professor.especialidad ? courseMapping[professor.especialidad.toLowerCase()] : null;
                                    const uploadUrl = `/dashboard/professors/upload?id=${professor.id}${primaryCourseId ? `&courseId=${primaryCourseId}` : ''}`;
                                    router.push(uploadUrl);
                                }}
                            >
                                <Upload className="h-4 w-4 mr-2" />
                                Subir
                            </Button>

                            <Button variant="ghost" size="icon" className="h-10 w-10 text-bb-text-secondary hover:text-bb-text hover:bg-bb-hover border border-transparent hover:border-bb-border rounded-lg">
                                <Share2 className="h-5 w-5" />
                            </Button>
                        </div>
                    </div>



                </motion.div>

                <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
                    <div className="lg:col-span-2 space-y-6">
                        {professor.email && (
                            <div className="bg-bb-card border border-bb-border rounded-2xl p-6">
                                <h3 className="text-lg font-bold text-bb-text mb-4 flex items-center gap-2">
                                    <MessageCircle className="w-5 h-5 text-blue-400" />
                                    Contacto
                                </h3>
                                <a
                                    href={`mailto:${professor.email}`}
                                    className="flex items-center gap-3 text-bb-text hover:text-blue-400 transition-colors group"
                                >
                                    <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <rect width="20" height="16" x="2" y="4" rx="2" />
                                            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="text-sm text-bb-text-secondary">Correo Electrónico</p>
                                        <p className="font-medium">{professor.email}</p>
                                    </div>
                                </a>
                            </div>
                        )}

                        {/* Moved Materials Section here - prominent position */}
                        {materials.length > 0 && (
                            <div className="bg-bb-card border border-bb-border rounded-2xl p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-bold text-bb-text flex items-center gap-2">
                                        <FolderRoot className="w-5 h-5 text-purple-400" />
                                        Materiales del Profesor
                                    </h3>
                                    <span className="text-xs font-bold text-bb-text-secondary bg-bb-darker px-2 py-1 rounded-lg">
                                        {materials.length} total
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {materials.slice(0, 4).map((material) => {
                                        let bgColor = 'bg-blue-500/10';
                                        let borderColor = 'border-blue-500/20';
                                        let textColor = 'text-blue-400';
                                        let icon = <LayoutPanelLeft className="w-5 h-5" />;

                                        if (material.tipo?.toLowerCase().includes('ppt')) {
                                            bgColor = 'bg-orange-500/10';
                                            borderColor = 'border-orange-500/20';
                                            textColor = 'text-orange-400';
                                        } else if (material.tipo?.toLowerCase().includes('examen')) {
                                            bgColor = 'bg-red-500/10';
                                            borderColor = 'border-red-500/20';
                                            textColor = 'text-red-400';
                                            icon = <FileText className="w-5 h-5" />;
                                        }

                                        const firstMaterialCourseId = material.courses?.id;

                                        return (
                                            <div
                                                key={material.id}
                                                onClick={() => setViewingFile({ path: material.url_archivo, name: material.titulo })}
                                                className={`p-3 ${bgColor} rounded-xl hover:bg-opacity-20 transition-all border ${borderColor} flex flex-col items-center gap-2 group cursor-pointer active:scale-95`}
                                            >
                                                <div className={`${textColor} group-hover:scale-110 transition-transform`}>
                                                    {icon}
                                                </div>
                                                <div className="text-center min-w-0 w-full">
                                                    <p className="text-[10px] font-bold text-bb-text truncate group-hover:text-white leading-tight">
                                                        {material.titulo}
                                                    </p>
                                                    {material.courses?.nombre && (
                                                        <p className="text-[8px] text-bb-text-secondary truncate mt-0.5 uppercase tracking-tighter">
                                                            {material.courses.nombre}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {materials.length > 0 && (
                                    <div className="mt-4 pt-4 border-t border-bb-border flex justify-center">
                                        <Link
                                            href={materials[0].courses?.id ? `/dashboard/courses/view?id=${materials[0].courses.id}&professor=${professor.id}` : '#'}
                                            className="text-xs font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1.5 group"
                                        >
                                            Ver todos los materiales en el curso
                                            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                                        </Link>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="bg-bb-card border border-bb-border rounded-2xl p-6">
                            <h3 className="text-lg font-bold text-bb-text mb-4 flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                                </svg>
                                Otros Cursos
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {aggregatedOtherCourses.length > 0 ? (
                                    aggregatedOtherCourses.map((curso: string, idx: number) => {
                                        const trimmedCurso = curso.trim();
                                        const professorId = professorLinkMapping[trimmedCurso.toLowerCase()];

                                        // Only link if professor profile exists
                                        if (professorId) {
                                            return (
                                                <Link
                                                    key={idx}
                                                    href={`/dashboard/professors/view?id=${professorId}`}
                                                    className="px-4 py-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 text-sm font-medium hover:bg-purple-500/20 transition-colors"
                                                >
                                                    {trimmedCurso}
                                                </Link>
                                            );
                                        }

                                        // If no professor profile exists, show as disabled/grayed out
                                        return (
                                            <span key={idx} className="px-4 py-2 rounded-xl bg-bb-darker/50 text-bb-text-secondary/40 border border-bb-border/50 text-sm font-medium opacity-50 cursor-not-allowed">
                                                {trimmedCurso}
                                            </span>
                                        );
                                    })
                                ) : (
                                    <p className="text-sm text-bb-text-secondary">No se encontraron otros cursos.</p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-bb-card border border-bb-border rounded-2xl p-6">
                            <h3 className="text-lg font-bold text-bb-text mb-4 flex items-center gap-2">
                                <User className="w-5 h-5 text-green-400" />
                                Otros Profesores de {professor.especialidad}
                            </h3>

                            {relatedProfessors.length > 0 ? (
                                <div className="space-y-3">
                                    {relatedProfessors.map((prof) => (
                                        <Link
                                            key={prof.id}
                                            href={`/dashboard/professors/view?id=${prof.id}`}
                                            className="block p-4 rounded-xl bg-bb-darker border border-bb-border hover:border-green-500/50 hover:bg-green-500/5 transition-all group"
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500/20 to-blue-500/20 flex items-center justify-center text-green-400 font-bold text-sm shrink-0 group-hover:scale-110 transition-transform">
                                                    {prof.nombre.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-bold text-bb-text group-hover:text-green-400 transition-colors truncate">
                                                        {prof.nombre}
                                                    </p>
                                                    {prof.facultad && (
                                                        <p className="text-xs text-bb-text-secondary truncate mt-0.5">
                                                            {prof.facultad}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <Info className="w-8 h-8 text-bb-text-secondary mx-auto mb-2 opacity-20" />
                                    <p className="text-sm text-bb-text-secondary">
                                        No hay otros profesores de {professor.especialidad}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Summary Card Below */}
                        <div className="bg-bb-card border border-bb-border rounded-2xl p-6">
                            <h3 className="text-lg font-bold text-bb-text mb-4 flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-blue-400" />
                                Resumen
                            </h3>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-bb-text-secondary text-sm">Total de Reseñas</span>
                                    <span className="text-bb-text font-bold text-lg">{ratings.length}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>

                <motion.div variants={itemVariants} className="space-y-8 mt-12">
                    <div className="flex items-center justify-between border-b border-bb-border pb-4">
                        <h2 className="text-2xl font-black text-bb-text flex items-center gap-3">
                            <MessageCircle className="w-7 h-7 text-blue-500" />
                            Sección de Comentarios
                            <span className="text-sm font-bold bg-bb-card px-2 py-1 rounded-lg text-bb-text-secondary border border-bb-border">
                                {comments.length}
                            </span>
                        </h2>
                    </div>

                    {/* New Comment Input Box - Social Style (Polished) */}
                    <div className="bg-bb-darker/30 border border-white/5 rounded-[32px] p-4 md:p-6 mb-12 hover:bg-bb-darker/50 transition-all group/input shadow-xl">
                        <div className="flex flex-col sm:flex-row gap-4 md:gap-6">
                            <div className="shrink-0 pt-1 flex justify-center sm:block">
                                <AvatarWithFrame
                                    avatarUrl={profile?.avatar_url || PLACEHOLDERS.AVATAR}
                                    name={profile?.nombre || 'Usuario'}
                                    frameUrl={profile?.active_frame_key ? frameMap[profile.active_frame_key]?.image_url : null}
                                    frameScale={profile?.active_frame_key ? frameMap[profile.active_frame_key]?.frame_settings?.profile?.scale : 1}
                                    offsetX={profile?.active_frame_key ? frameMap[profile.active_frame_key]?.frame_settings?.profile?.x : 0}
                                    offsetY={profile?.active_frame_key ? frameMap[profile.active_frame_key]?.frame_settings?.profile?.y : 0}
                                    size="md"
                                    className="ring-4 ring-bb-dark shadow-2xl transition-transform group-hover/input:scale-105"
                                />
                            </div>
                            <div className="flex-1">
                                <form onSubmit={handleSubmitComment}>
                                    <Textarea
                                        value={commentText}
                                        onChange={(e) => setCommentText(e.target.value)}
                                        placeholder="Comparte tu opinión o haz una pregunta sobre este profesor..."
                                        className="bg-transparent border-none text-bb-text min-h-[140px] rounded-none resize-none focus:ring-0 text-base md:text-lg placeholder:text-bb-text/30 p-0 shadow-none scrollbar-hide font-medium leading-relaxed"
                                    />
                                    <div className="flex flex-col sm:flex-row items-center justify-between border-t border-white/5 mt-4 pt-4 gap-4 sm:gap-0">
                                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-bb-text/20 group-hover/input:text-bb-text/40 transition-colors">
                                            Tu opinión importa
                                        </p>
                                        <Button
                                            type="submit"
                                            disabled={isSubmittingComment || !commentText.trim()}
                                            className="bg-blue-600 hover:bg-blue-500 text-white font-black px-10 h-10 rounded-full shadow-lg shadow-blue-500/10 active:scale-95 transition-all flex items-center gap-2.5 text-xs uppercase tracking-wider"
                                        >
                                            {isSubmittingComment ? (
                                                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                            ) : (
                                                <>
                                                    Publicar
                                                    <ArrowRight className="w-4 h-4" />
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>

                    {/* Delete Confirmation Modal */}
                    <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                        <DialogContent className="bg-bb-card border-bb-border text-bb-text sm:max-w-md text-center">
                            <DialogHeader>
                                <DialogTitle className="text-xl font-bold">¿Eliminar comentario?</DialogTitle>
                                <DialogDescription className="text-bb-text-secondary pt-2">
                                    Esta acción no se puede deshacer. El comentario desaparecerá permanentemente.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="flex flex-col gap-3 mt-4">
                                <Button
                                    disabled={isDeleting}
                                    onClick={confirmDelete}
                                    className="w-full bg-red-600 hover:bg-red-500 text-white font-bold h-12 rounded-xl shadow-lg active:scale-95 transition-all"
                                >
                                    {isDeleting ? (
                                        <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        "Eliminar permanentemente"
                                    )}
                                </Button>
                                <Button
                                    variant="ghost"
                                    disabled={isDeleting}
                                    onClick={() => setIsDeleteDialogOpen(false)}
                                    className="w-full text-bb-text-secondary hover:text-white font-bold h-12 rounded-xl transition-all"
                                >
                                    Cancelar
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>

                    {/* Social Wall Style Comments (Cleaned) */}
                    {comments.length > 0 ? (
                        <div className="space-y-4">
                            {comments
                                .filter(c => !c.parent_id)
                                .map((comment) => {
                                    const replies = comments.filter(r => r.parent_id === comment.id);
                                    return (
                                        <div key={comment.id} className="relative group/parent">
                                            <CommentItem
                                                comment={comment}
                                                profile={profile}
                                                frameMap={frameMap}
                                                onLike={handleLikeComment}
                                                onDelete={handleDeleteComment}
                                                onReply={() => setReplyToId(comment.id)}
                                                isReply={false}
                                                hasReplies={replies.length > 0}
                                            />

                                            {replyToId === comment.id && (
                                                <div className="ml-14 md:ml-20 mt-4 mb-10">
                                                    <div className="bg-bb-darker border border-white/5 rounded-3xl p-5 shadow-2xl relative overflow-hidden">
                                                        <div className="absolute top-0 left-0 w-1 h-full bg-blue-500/30" />
                                                        <form onSubmit={(e) => handleSubmitComment(e, comment.id)} className="space-y-4">
                                                            <Textarea
                                                                value={replyText}
                                                                onChange={(e) => setReplyText(e.target.value)}
                                                                placeholder="Escribe una respuesta amable..."
                                                                className="bg-transparent border-none text-bb-text min-h-[100px] rounded-none resize-none focus:ring-0 p-0 text-sm md:text-base placeholder:text-bb-text/20 shadow-none font-medium"
                                                                autoFocus
                                                            />
                                                            <div className="flex justify-end gap-3 pt-2 border-t border-white/5">
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    onClick={() => {
                                                                        setReplyToId(null);
                                                                        setReplyText('');
                                                                    }}
                                                                    className="text-bb-text-secondary h-9 px-6 rounded-full hover:bg-white/5 transition-colors font-bold text-xs"
                                                                >
                                                                    Cancelar
                                                                </Button>
                                                                <Button
                                                                    type="submit"
                                                                    disabled={isSubmittingReply || !replyText.trim()}
                                                                    className="bg-blue-600 hover:bg-blue-500 text-white font-black h-9 px-8 rounded-full shadow-lg active:scale-95 transition-all text-xs uppercase tracking-wider"
                                                                >
                                                                    {isSubmittingReply ? 'Enviando...' : 'Responder'}
                                                                </Button>
                                                            </div>
                                                        </form>
                                                    </div>
                                                </div>
                                            )}

                                            {replies.length > 0 && (
                                                <div className="ml-14 md:ml-20 space-y-2">
                                                    {replies.map((reply) => (
                                                        <CommentItem
                                                            key={reply.id}
                                                            comment={reply}
                                                            profile={profile}
                                                            frameMap={frameMap}
                                                            onLike={handleLikeComment}
                                                            onDelete={handleDeleteComment}
                                                            onReply={() => setReplyToId(reply.id)}
                                                            isReply={true}
                                                            hasReplies={false}
                                                        />
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                        </div>
                    ) : (
                        <div className="text-center py-20 bg-bb-card/30 rounded-[40px] border-2 border-dashed border-bb-border/50 group hover:border-blue-500/30 transition-all">
                            <div className="w-20 h-20 rounded-full bg-bb-darker flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                                <MessageCircle className="w-10 h-10 text-bb-text-secondary opacity-30" />
                            </div>
                            <h3 className="text-xl font-bold text-bb-text mb-2">Aún no hay comentarios</h3>
                            <p className="text-bb-text-secondary max-w-xs mx-auto text-sm">
                                Sé el primero en compartir tu experiencia o preguntar algo sobre este profesor.
                            </p>
                        </div>
                    )}
                </motion.div>
            </motion.div>

            <SecureFileModal
                isOpen={!!viewingFile}
                onClose={() => setViewingFile(null)}
                filePath={viewingFile?.path || null}
                fileName={viewingFile?.name || null}
            />
        </div>
    );
}
