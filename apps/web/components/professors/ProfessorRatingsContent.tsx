'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Star, MessageCircle, TrendingUp, ArrowLeft, Trophy, Sparkles, Share2, Instagram, User, Info, ArrowRight, Upload, Trash2, Bold, Italic, Underline, Strikethrough, Quote, Eye, Image as ImageIcon, Plus, ThumbsUp, MessageSquare, FileText, LayoutPanelLeft, FolderRoot } from 'lucide-react';
import Link from 'next/link';
import { supabase, Professor, Profile, getStorageUrl } from '@/lib/supabase';
import { useTheme } from '@/lib/theme-context';
import BouncingBalls from '@/components/BouncingBalls';
import { motion, Variants, AnimatePresence } from 'framer-motion';
import { AvatarWithFrame } from '@/components/ui/AvatarWithFrame';
import { StickerCanvas } from '@/components/ui/StickerCanvas';
import { PLACEHOLDERS, getDiversifiedProfessorBackground, getStringHash } from '@/lib/constants';
import SecureFileModal from '@/components/secure/SecureFileModal';
import { UserHoverCard } from '@/components/ui/UserHoverCard';

interface ProfessorComment {
    id: string;
    professor_id: string;
    user_id: string;
    contenido: string;
    parent_id: string | null;
    likes: number;
    created_at: string;
    profiles?: {
        id?: string;
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

const REACTIONS = [
    { type: 'like', label: 'Me gusta', emoji: '👍', color: 'text-blue-400', bgColor: 'bg-blue-400' },
    { type: 'love', label: 'Me encanta', emoji: '❤️', color: 'text-red-400', bgColor: 'bg-red-400' },
    { type: 'haha', label: 'Me divierte', emoji: '😆', color: 'text-yellow-400', bgColor: 'bg-yellow-400' },
    { type: 'wow', label: 'Me asombra', emoji: '😮', color: 'text-yellow-400', bgColor: 'bg-yellow-400' },
    { type: 'sad', label: 'Me entristece', emoji: '😢', color: 'text-blue-300', bgColor: 'bg-blue-300' },
    { type: 'angry', label: 'Me enoja', emoji: '😡', color: 'text-orange-600', bgColor: 'bg-orange-600' }
];

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
const ProfessorBackground = ({ url, name, specialty }: { url: string | null; name: string; specialty?: string | null }) => {
    const [currentUrl, setCurrentUrl] = useState(() => getDiversifiedProfessorBackground(name, specialty, url));
    const [isLoaded, setIsLoaded] = useState(false);

    const handleError = () => {
        // Fallback to LoremFlickr for guaranteed uniqueness on error
        const hash = getStringHash(`${name}-${specialty || ''}-fallback`);
        setCurrentUrl(`https://loremflickr.com/1600/900/nature,landscape,forest,mountain/all?lock=${hash}`);
    };

    return (
        <>
            <img
                src={currentUrl}
                alt=""
                className="hidden"
                onLoad={() => setIsLoaded(true)}
                onError={handleError}
            />
            <div
                className={`absolute inset-0 bg-cover bg-center transition-all duration-1000 ${isLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-110 blur-sm'}`}
                style={{ backgroundImage: `url("${currentUrl}")` }}
            />
        </>
    );
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

const ReplyToggler = ({ count, children, onToggle }: { count: number; children: React.ReactNode; onToggle: (show: boolean) => void }) => {
    const [isVisible, setIsVisible] = useState(false);

    return (
        <div className="space-y-2">
            {!isVisible && (
                <button
                    onClick={() => {
                        setIsVisible(true);
                        onToggle(true);
                    }}
                    className="flex items-center gap-2 text-bb-text-secondary hover:text-white transition-colors ml-2 mt-2 group"
                >
                    <div className="w-5 h-5 rounded-full border border-bb-border flex items-center justify-center group-hover:border-blue-500/50 transition-colors">
                        <Plus className="w-3 h-3 text-bb-text-secondary group-hover:text-blue-400" />
                    </div>
                    <span className="text-[11px] font-bold uppercase tracking-wider opacity-60 group-hover:opacity-100">Ver mas respuestas ({count})</span>
                </button>
            )}
            {isVisible && (
                <>
                    {children}
                    <button
                        onClick={() => {
                            setIsVisible(false);
                            onToggle(false);
                        }}
                        className="text-[10px] font-bold text-bb-text-secondary hover:text-bb-text transition-colors ml-14 md:ml-20 mt-2 uppercase tracking-tighter"
                    >
                        Contraer respuestas
                    </button>
                </>
            )}
        </div>
    );
};

const CommentItem = ({
    comment,
    profile,
    frameMap,
    onReaction,
    onDelete,
    onReply,
    isReply = false,
    hasReplies = false,
    reactions = { counts: {}, userReaction: null },
    depth = 0
}: {
    comment: ProfessorComment;
    profile: Profile | null;
    frameMap: Record<string, any>;
    onReaction: (id: string, type: string) => void;
    onDelete: (id: string) => void;
    onReply: () => void;
    isReply?: boolean;
    hasReplies?: boolean;
    reactions?: { counts: Record<string, number>, userReaction: string | null };
    depth?: number;
}) => {
    const isOwner = profile?.id === comment.user_id || profile?.role === 'admin';
    const [showReactions, setShowReactions] = useState(false);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const handleMouseEnter = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setShowReactions(true);
    };

    const handleMouseLeave = () => {
        timeoutRef.current = setTimeout(() => setShowReactions(false), 500);
    };

    const currentReaction = REACTIONS.find(r => r.type === reactions.userReaction);
    const sortedReactions = Object.entries(reactions.counts)
        .filter(([_, count]) => count > 0)
        .sort(([_, a], [__, b]) => b - a);

    const totalReactions = Object.values(reactions.counts).reduce((a, b) => a + b, 0);
    const [isExpanded, setIsExpanded] = useState(false);
    const contentRef = useRef<HTMLDivElement>(null);
    const [isTruncated, setIsTruncated] = useState(false);

    useEffect(() => {
        if (contentRef.current && contentRef.current.scrollHeight > 150) {
            setIsTruncated(true);
        }
    }, [comment.contenido]);

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
                "relative group transition-all duration-300",
                depth === 0 && "mb-8",
                depth > 0 && "mt-4",
                "pl-10 md:pl-12"
            )}
            style={{
                marginLeft: depth === 0 ? 0 : `${depth * 56}px`,
                paddingLeft: depth === 0 ? "4.5rem" : "3.5rem"
            }}
        >
            {/* Branch Connector (Perfectly Aligned with Continuous Parent Line) */}
            {depth > 0 && (
                <div
                    className="absolute border-l-[1.5px] border-b-[1.5px] border-bb-text/50 rounded-bl-xl z-0"
                    style={{
                        top: "-2.5rem",
                        left: "-2.25rem", // Indent(56px) - LineX(20px) = 36px (2.25rem)
                        width: "2.25rem",
                        height: "4rem"
                    }}
                />
            )}

            <div className="absolute top-0 z-20" style={{ left: depth > 0 ? "4px" : "0" }}>
                <UserHoverCard profile={{
                    id: comment.user_id,
                    nombre: comment.profiles?.nombre || 'Usuario',
                    avatar_url: comment.profiles?.avatar_url,
                    background_url: comment.profiles?.background_url,
                    bio: comment.profiles?.bio,
                    created_at: comment.profiles?.created_at,
                    puntos: comment.profiles?.puntos,
                    es_vip: comment.profiles?.es_vip,
                    active_frame_key: comment.profiles?.active_frame_key,
                    role: 'user'
                }}>
                    <div className="transition-transform group-hover:scale-110 duration-300">
                        <AvatarWithFrame
                            avatarUrl={comment.profiles?.avatar_url || PLACEHOLDERS.AVATAR}
                            name={comment.profiles?.nombre || 'Usuario'}
                            frameUrl={comment.profiles?.active_frame_key ? frameMap[comment.profiles.active_frame_key]?.image_url : null}
                            frameScale={comment.profiles?.active_frame_key ? frameMap[comment.profiles.active_frame_key]?.frame_settings?.profile?.scale : 1}
                            offsetX={comment.profiles?.active_frame_key ? frameMap[comment.profiles.active_frame_key]?.frame_settings?.profile?.x : 0}
                            offsetY={comment.profiles?.active_frame_key ? frameMap[comment.profiles.active_frame_key]?.frame_settings?.profile?.y : 0}
                            size="sm"
                        />
                    </div>
                </UserHoverCard>
            </div>

            <div className="flex flex-col relative z-10 pl-2">
                <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 mb-1">
                        <UserHoverCard profile={{
                            id: comment.user_id,
                            nombre: comment.profiles?.nombre || 'Usuario',
                            avatar_url: comment.profiles?.avatar_url,
                            background_url: comment.profiles?.background_url,
                            bio: comment.profiles?.bio,
                            created_at: comment.profiles?.created_at,
                            puntos: comment.profiles?.puntos,
                            es_vip: comment.profiles?.es_vip,
                            active_frame_key: comment.profiles?.active_frame_key,
                            role: 'user'
                        }}>
                            <p className="font-bold text-white text-[13px] md:text-sm hover:text-blue-400 cursor-pointer transition-colors tracking-tight">
                                {comment.profiles?.nombre}
                            </p>
                        </UserHoverCard>
                        {comment.profiles?.es_vip && (
                            <img src="/vip-icon.png" alt="VIP" className="w-5 h-5 object-contain" />
                        )}
                        <p className="text-[10px] font-medium text-bb-text-secondary uppercase tracking-tighter">
                            hace {new Date(comment.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                        </p>
                    </div>

                    {isOwner && (
                        <button
                            onClick={() => onDelete(comment.id)}
                            className="text-bb-text-secondary hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-red-500/10 opacity-0 group-hover:opacity-100"
                            title="Eliminar"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>

                <div
                    ref={contentRef}
                    className={cn(
                        "text-bb-text leading-relaxed whitespace-pre-wrap font-medium overflow-hidden transition-all duration-500",
                        isReply ? "text-xs opacity-90" : "text-sm md:text-base opacity-80",
                        isTruncated && !isExpanded && "max-h-[150px] relative"
                    )}
                >
                    {comment.contenido}
                    {isTruncated && !isExpanded && (
                        <div className="absolute bottom-0 left-0 w-full h-12 bg-gradient-to-t from-[#0a0a0f] to-transparent" />
                    )}
                </div>

                {isTruncated && (
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="text-[11px] font-bold text-blue-400 hover:text-blue-300 transition-colors mt-2 flex items-center gap-1 group/expand"
                    >
                        {isExpanded ? 'Ver menos' : 'Expandir Comentario'}
                        <ArrowRight className={cn("w-3 h-3 transition-transform", isExpanded ? "rotate-90" : "group-hover:translate-x-1")} />
                    </button>
                )}

                {/* Reactions Display (Stacked) - Repositioned for Flat Style */}
                {totalReactions > 0 && (
                    <div className="flex items-center gap-2 mt-4 pt-1">
                        <div className="flex -space-x-1">
                            {sortedReactions.slice(0, 3).map(([type]) => (
                                <span key={type} className="text-sm transition-transform hover:scale-125 hover:z-10 cursor-default">
                                    {REACTIONS.find(r => r.type === type)?.emoji}
                                </span>
                            ))}
                        </div>
                        <span className="text-[10px] font-bold text-bb-text-secondary tracking-tight">{totalReactions}</span>
                    </div>
                )}
            </div>

            <div className="flex items-center gap-4 mt-2 ml-2">
                <div
                    className="relative"
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                >
                    <button
                        onClick={() => onReaction(comment.id, reactions.userReaction === 'like' ? 'none' : 'like')}
                        className={cn(
                            "flex items-center gap-1.5 transition-all text-[11px] font-bold opacity-60 hover:opacity-100",
                            currentReaction ? currentReaction.color + " opacity-100" : "text-bb-text-secondary"
                        )}
                    >
                        <ThumbsUp className="w-3.5 h-3.5" />
                        {currentReaction ? currentReaction.label : "Me gusta"}
                    </button>

                    {/* Reactions Bar (Facebook style) */}
                    <AnimatePresence>
                        {showReactions && (
                            <motion.div
                                initial={{ opacity: 0, y: 10, scale: 0.8 }}
                                animate={{ opacity: 1, y: -45, scale: 1 }}
                                exit={{ opacity: 0, y: 10, scale: 0.8 }}
                                className="absolute left-0 bottom-full mb-2 bg-bb-sidebar border border-bb-border rounded-full p-1.5 flex items-center gap-1 shadow-2xl z-50 ring-1 ring-bb-border/50"
                            >
                                {REACTIONS.map((r) => (
                                    <button
                                        key={r.type}
                                        onClick={() => {
                                            onReaction(comment.id, r.type);
                                            setShowReactions(false);
                                        }}
                                        className="w-8 h-8 flex items-center justify-center hover:scale-150 transition-transform duration-200 text-lg group/emoji relative"
                                        title={r.label}
                                    >
                                        {r.emoji}
                                        <span className="absolute -top-10 bg-black text-white text-[10px] px-2 py-0.5 rounded opacity-0 group-hover/emoji:opacity-100 transition-opacity pointer-events-none whitespace-nowrap font-bold uppercase tracking-widest border border-white/10">
                                            {r.label}
                                        </span>
                                    </button>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {depth < 2 && (
                    <button
                        onClick={onReply}
                        className="flex items-center gap-1.5 text-bb-text-secondary opacity-60 hover:opacity-100 transition-all text-[11px] font-bold"
                    >
                        <MessageSquare className="w-3.5 h-3.5" />
                        Responder
                    </button>
                )}
            </div>
        </motion.div>
    );
};


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
    const [isDeletingCourse, setIsDeletingCourse] = useState(false);
    const [commentReactions, setCommentReactions] = useState<Record<string, {
        counts: Record<string, number>,
        userReaction: string | null
    }>>({});

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

    // Fetch reactions for all comments
    useEffect(() => {
        const fetchReactions = async () => {
            if (comments.length === 0) return;

            const commentIds = comments.map(c => c.id);
            const { data: reactionData, error } = await supabase
                .from('professor_comment_reactions')
                .select('comment_id, user_id, reaction_type')
                .in('comment_id', commentIds);

            if (!error && reactionData) {
                const grouped: typeof commentReactions = {};

                commentIds.forEach(id => {
                    grouped[id] = { counts: {}, userReaction: null };
                    REACTIONS.forEach(r => grouped[id].counts[r.type] = 0);
                });

                reactionData.forEach(r => {
                    if (!grouped[r.comment_id]) return;
                    grouped[r.comment_id].counts[r.reaction_type] = (grouped[r.comment_id].counts[r.reaction_type] || 0) + 1;
                    if (r.user_id === profile?.id) {
                        grouped[r.comment_id].userReaction = r.reaction_type;
                    }
                });

                setCommentReactions(grouped);
            }
        };

        fetchReactions();
    }, [comments, profile?.id]);

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

    const handleDeleteCourse = async (courseName: string) => {
        if (!profile || profile.role !== 'admin' || isDeletingCourse) return;

        if (!window.confirm(`¿Estás seguro de que deseas eliminar el curso "${courseName}" de este profesor?`)) {
            return;
        }

        setIsDeletingCourse(true);
        try {
            // 1. Update professors table
            let allCourses: string[] = [];
            if (professor.especialidad) {
                allCourses.push(professor.especialidad.trim());
            }
            if (professor.otros_cursos) {
                allCourses = allCourses.concat(professor.otros_cursos.split(',').map(c => c.trim()).filter(Boolean));
            }

            // Remove the target course (case-insensitive)
            allCourses = allCourses.filter(c => c.toLowerCase() !== courseName.toLowerCase());

            // Reassign
            const newEspecialidad = allCourses.length > 0 ? allCourses[0] : null;
            const newOtrosCursos = allCourses.slice(1).join(',') || null;

            // 1. Update professors table for ALL records with this name (to maintain consistency in grouped search UI)
            const { error: updateError } = await supabase
                .from('professors')
                .update({ especialidad: newEspecialidad, otros_cursos: newOtrosCursos })
                .ilike('nombre', professor.nombre.trim());

            if (updateError) throw updateError;

            // 2. Delete from course_professors if mapping exists
            const courseId = courseMapping[courseName.toLowerCase()];
            if (courseId) {
                await supabase
                    .from('course_professors')
                    .delete()
                    .match({ professor_id: professor.id, course_id: courseId });
            }

            alert('Curso eliminado exitosamente del profesor.');
            window.location.reload();
        } catch (error: any) {
            console.error('Error deleting course:', error);
            alert(`Hubo un error al eliminar el curso: ${error.message}`);
            setIsDeletingCourse(false); // only reset on error, reload will reset naturally on success
        }
    };

    const handleReactionComment = async (commentId: string, reactionType: string) => {
        if (!profile) return;

        const currentReaction = commentReactions[commentId]?.userReaction;

        // Optimistic update
        setCommentReactions(prev => {
            const next = { ...prev };
            const existingData = next[commentId];
            const commentData = existingData
                ? { ...existingData, counts: { ...existingData.counts } }
                : { counts: {}, userReaction: null };

            // Remove old reaction if exists
            if (currentReaction) {
                commentData.counts[currentReaction] = Math.max(0, (commentData.counts[currentReaction] || 0) - 1);
            }

            // Add new reaction if not turning off
            if (reactionType !== 'none' && reactionType !== currentReaction) {
                commentData.counts[reactionType] = (commentData.counts[reactionType] || 0) + 1;
                commentData.userReaction = reactionType;
            } else {
                commentData.userReaction = null;
            }

            next[commentId] = commentData;
            return next;
        });

        if (reactionType === 'none' || reactionType === currentReaction) {
            // Remove reaction
            await supabase
                .from('professor_comment_reactions')
                .delete()
                .eq('comment_id', commentId)
                .eq('user_id', profile.id);
        } else {
            // Upsert reaction
            await supabase
                .from('professor_comment_reactions')
                .upsert({
                    comment_id: commentId,
                    user_id: profile.id,
                    reaction_type: reactionType
                }, { onConflict: 'comment_id,user_id' });
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
        <div className="min-h-screen bg-bb-dark relative overflow-hidden transition-colors duration-300">
            {/* Stickers — canvas handles its own z-index and pointer-events */}
            <StickerCanvas
                targetType="professor"
                targetId={professor.id}
                canEdit={true}
            />

            {/* === FULL-WIDTH BANNER (edge-to-edge, like Course Detail) === */}
            <div className="relative h-32 md:h-72 lg:h-80 w-full bg-bb-darker border-b border-bb-border overflow-hidden">
                <ProfessorBackground url={professor.background_image_url} name={professor.nombre} specialty={professor.especialidad} />
                {/* Subtle Cinematic gradient only at the very bottom for name readability if needed, but keeping it minimal as requested */}
                <div className="absolute inset-0 bg-gradient-to-t from-bb-dark/40 to-transparent" />

                {/* Back Button on banner */}
                <Button
                    variant="outline"
                    size="icon"
                    className="absolute top-4 left-4 z-20 bg-bb-dark/50 border-bb-border text-bb-text hover:bg-bb-card backdrop-blur-md transition-all hover:scale-110 shadow-lg"
                    onClick={() => router.back()}
                >
                    <ArrowLeft className="h-5 w-5" />
                </Button>
            </div>

            {/* === MAIN CONTENT (all at z-10, above stickers) === */}
            <div className="relative z-10 w-full">
                <motion.div
                    initial="hidden"
                    animate="visible"
                    variants={containerVariants}
                    className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
                >
                    {/* Professor Identity Card - overlaps the banner */}
                    <motion.div variants={itemVariants} className="-mt-24 md:-mt-28 mb-8">
                        <div className="flex flex-col md:flex-row gap-6 items-center md:items-end">
                            {/* Avatar overlapping banner */}
                            <div className="relative shrink-0 group">
                                <div className="h-32 w-32 md:h-40 md:w-40 rounded-3xl flex items-center justify-center bg-bb-sidebar border-4 border-bb-dark shadow-2xl overflow-hidden relative z-20 transition-transform duration-500 hover:scale-105 hover:rotate-1 group-hover:border-blue-500/30">
                                    <img
                                        src={getStorageUrl(professor.avatar_url || '/profes/tl.webp', 'profile-avatars', PLACEHOLDERS.AVATAR)}
                                        alt={professor.nombre}
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).src = '/profes/tl.webp';
                                        }}
                                    />
                                </div>
                                <div className="absolute -bottom-2 -right-2 bg-yellow-500 text-bb-dark text-sm font-black px-4 py-1.5 rounded-xl shadow-lg flex items-center gap-1.5 border-4 border-bb-dark z-30 transform group-hover:scale-110 transition-transform">
                                    <Star className="w-4 h-4 fill-bb-dark" /> {avgRating}
                                </div>
                            </div>

                            {/* Name & Tags */}
                            <div className="flex-1 space-y-3 text-center md:text-left pb-2">
                                <motion.h1
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2 }}
                                    className="text-4xl md:text-6xl font-black text-white leading-[0.9] tracking-tighter uppercase drop-shadow-2xl"
                                >
                                    {professor.nombre}
                                </motion.h1>

                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.3 }}
                                    className="flex flex-wrap gap-2 justify-center md:justify-start"
                                >
                                    {professor.especialidad && professorLinkMapping[professor.especialidad.toLowerCase()] ? (
                                        <div className="flex items-center gap-1">
                                            <Link
                                                href={`/dashboard/professors/view?id=${professorLinkMapping[professor.especialidad.toLowerCase()]}`}
                                                className="bg-blue-500/20 backdrop-blur-md text-blue-500 px-4 py-1.5 rounded-full border border-blue-500/30 hover:bg-blue-500/30 transition-all uppercase tracking-wider text-xs font-bold shadow-lg shadow-blue-900/10"
                                            >
                                                {professor.especialidad}
                                            </Link>
                                            {profile?.role === 'admin' && (
                                                <button
                                                    onClick={() => handleDeleteCourse(professor.especialidad!)}
                                                    className="p-1.5 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-colors"
                                                    title="Eliminar este curso"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        professor.especialidad && (
                                            <div className="flex items-center gap-1">
                                                <span className="bg-bb-sidebar/50 backdrop-blur-md text-bb-text-secondary px-4 py-1.5 rounded-full border border-bb-border uppercase tracking-wider text-xs font-bold">
                                                    {professor.especialidad}
                                                </span>
                                                {profile?.role === 'admin' && (
                                                    <button
                                                        onClick={() => handleDeleteCourse(professor.especialidad!)}
                                                        className="p-1.5 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-colors"
                                                        title="Eliminar este curso"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        )
                                    )}

                                    {professor.facultad && (
                                        <span className="bg-bb-sidebar/50 backdrop-blur-md text-bb-text-secondary px-4 py-1.5 rounded-full border border-bb-border flex items-center gap-2 text-xs font-medium">
                                            <div className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.5)]" />
                                            {professor.facultad}
                                        </span>
                                    )}
                                </motion.div>
                            </div>
                        </div>
                    </motion.div>

                    {/* Stats & Actions Bar */}
                    <motion.div variants={itemVariants} className="bg-bb-card/60 backdrop-blur-md border border-bb-border rounded-2xl mb-10 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-bb-border overflow-hidden">
                        {/* Stats Section */}
                        <div className="grid grid-cols-3 divide-x divide-bb-border py-4">
                            {[
                                { label: 'Calificación', value: avgRating, icon: Star, color: 'text-yellow-400' },
                                { label: 'Claridad', value: avgClaridad, icon: Sparkles, color: 'text-blue-400' },
                                { label: 'Facilidad', value: avgFacilidad, icon: TrendingUp, color: 'text-green-400' },
                            ].map((stat, i) => (
                                <div key={i} className="p-3 flex flex-col items-center justify-center hover:bg-bb-hover/50 transition-colors">
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
                                                    <div key={idx} className="flex items-center gap-1">
                                                        <Link
                                                            href={`/dashboard/professors/view?id=${professorId}`}
                                                            className="px-4 py-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 text-sm font-medium hover:bg-purple-500/20 transition-colors"
                                                        >
                                                            {trimmedCurso}
                                                        </Link>
                                                        {profile?.role === 'admin' && (
                                                            <button
                                                                onClick={() => handleDeleteCourse(trimmedCurso)}
                                                                className="p-1.5 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-colors"
                                                                title="Eliminar este curso"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            }

                                            // If no professor profile exists, show as disabled/grayed out
                                            return (
                                                <div key={idx} className="flex items-center gap-1">
                                                    <span className="px-4 py-2 rounded-xl bg-bb-darker/50 text-bb-text-secondary/40 border border-bb-border/50 text-sm font-medium opacity-50 cursor-not-allowed">
                                                        {trimmedCurso}
                                                    </span>
                                                    {profile?.role === 'admin' && (
                                                        <button
                                                            onClick={() => handleDeleteCourse(trimmedCurso)}
                                                            className="p-1.5 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-colors"
                                                            title="Eliminar este curso"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>
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
                                        {relatedProfessors.slice(0, 6).map((prof) => (
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

                                        {relatedProfessors.length > 6 && (
                                            <Link
                                                href={`/dashboard/professors?course=${encodeURIComponent(professor.especialidad || '')}`}
                                                className="flex items-center justify-center gap-2 p-3 w-full rounded-xl bg-bb-sidebar border border-bb-border text-bb-text-secondary hover:text-white hover:border-blue-500/50 hover:bg-blue-500/5 transition-all group font-bold text-xs uppercase tracking-widest mt-4"
                                            >
                                                Mostrar más
                                                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                            </Link>
                                        )}
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

                        {/* New Comment Input Box - Crunchyroll style redesign */}
                        <div className="bg-bb-sidebar/30 border border-bb-border rounded-lg overflow-hidden mb-12 shadow-sm">
                            <form onSubmit={handleSubmitComment}>
                                <div className="p-4 md:p-6">
                                    <div className="flex gap-4">
                                        <div className="shrink-0">
                                            <AvatarWithFrame
                                                avatarUrl={profile?.avatar_url || PLACEHOLDERS.AVATAR}
                                                name={profile?.nombre || 'Usuario'}
                                                frameUrl={profile?.active_frame_key ? frameMap[profile.active_frame_key]?.image_url : null}
                                                frameScale={profile?.active_frame_key ? frameMap[profile.active_frame_key]?.frame_settings?.profile?.scale : 1}
                                                offsetX={profile?.active_frame_key ? frameMap[profile.active_frame_key]?.frame_settings?.profile?.x : 0}
                                                offsetY={profile?.active_frame_key ? frameMap[profile.active_frame_key]?.frame_settings?.profile?.y : 0}
                                                size="xs"
                                                className="ring-2 ring-bb-dark"
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <Textarea
                                                value={commentText}
                                                onChange={(e) => setCommentText(e.target.value)}
                                                placeholder="Escribe algo..."
                                                className="bg-transparent border-none text-bb-text min-h-[100px] rounded-none resize-none focus-visible:ring-0 focus-visible:ring-offset-0 text-sm md:text-base placeholder:text-bb-text-secondary/40 p-0 shadow-none font-medium"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Toolbar footer */}
                                <div className="bg-bb-sidebar/50 px-4 py-2 flex items-center justify-between border-t border-bb-border/50">
                                    <div className="flex items-center gap-1 md:gap-4">
                                        {[
                                            { icon: Bold, label: 'Negrita' },
                                            { icon: Italic, label: 'Cursiva' },
                                            { icon: Underline, label: 'Subrayado' },
                                            { icon: Strikethrough, label: 'Tachado' },
                                            { icon: Quote, label: 'Cita' },
                                            { icon: Eye, label: 'Vista previa' },
                                            { icon: ImageIcon, label: 'Imagen' }
                                        ].map((tool, i) => (
                                            <button
                                                key={i}
                                                type="button"
                                                className="p-1.5 text-bb-text-secondary hover:text-bb-text hover:bg-bb-hover rounded transition-all"
                                                title={tool.label}
                                            >
                                                <tool.icon className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                            </button>
                                        ))}
                                    </div>
                                    <Button
                                        type="submit"
                                        disabled={isSubmittingComment || !commentText.trim()}
                                        className="bg-[#3b3b4f] hover:bg-[#4a4a6a] text-white/70 hover:text-white font-bold px-6 h-8 rounded text-[11px] uppercase tracking-wider transition-all"
                                    >
                                        {isSubmittingComment ? '...' : 'Responder'}
                                    </Button>
                                </div>
                            </form>
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
                                            <div className="w-4 h-4 border-2 border-bb-text-secondary/20 border-t-bb-text-secondary rounded-full animate-spin" />
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
                            <div className="space-y-4 pb-12">
                                {(() => {
                                    const renderCommentTree = (parentId: string | null = null, depth = 0) => {
                                        return comments
                                            .filter(c => c.parent_id === parentId)
                                            .map((comment) => {
                                                const replies = comments.filter(r => r.parent_id === comment.id);
                                                return (
                                                    <div key={comment.id} className="relative group/parent">
                                                        {/* Continuous Vertical Line for Threads */}
                                                        {replies.length > 0 && (
                                                            <div
                                                                className="absolute bg-bb-text/50 w-[1px] z-0"
                                                                style={{
                                                                    left: `${depth * 56 + 20}px`,
                                                                    top: '40px',
                                                                    bottom: '20px'
                                                                }}
                                                            />
                                                        )}
                                                        <CommentItem
                                                            comment={comment}
                                                            profile={profile}
                                                            frameMap={frameMap}
                                                            onReaction={handleReactionComment}
                                                            onDelete={handleDeleteComment}
                                                            onReply={() => setReplyToId(comment.id)}
                                                            isReply={depth > 0}
                                                            hasReplies={replies.length > 0}
                                                            reactions={commentReactions[comment.id]}
                                                            depth={depth}
                                                        />

                                                        {replyToId === comment.id && (
                                                            <div
                                                                className="mt-2 mb-8 pr-4"
                                                                style={{ marginLeft: `${(depth + 1) * 56}px` }}
                                                            >
                                                                <div className="bg-bb-sidebar/30 border border-bb-border rounded-lg overflow-hidden shadow-sm">
                                                                    <form onSubmit={(e) => handleSubmitComment(e, comment.id)}>
                                                                        <div className="p-4">
                                                                            <Textarea
                                                                                value={replyText}
                                                                                onChange={(e) => setReplyText(e.target.value)}
                                                                                placeholder="Escribe algo..."
                                                                                className="bg-transparent border-none text-bb-text min-h-[80px] rounded-none resize-none focus-visible:ring-0 focus-visible:ring-offset-0 p-0 text-xs md:text-sm placeholder:text-bb-text-secondary/40 shadow-none font-medium"
                                                                                autoFocus
                                                                            />
                                                                        </div>
                                                                        <div className="bg-bb-sidebar/50 px-4 py-2 flex items-center justify-between border-t border-bb-border/50">
                                                                            <div className="flex items-center gap-2">
                                                                                {[Bold, Italic, Quote, ImageIcon].map((Icon, i) => (
                                                                                    <button key={i} type="button" className="p-1 text-bb-text-secondary/40 hover:text-bb-text transition-colors">
                                                                                        <Icon className="w-3 h-3" />
                                                                                    </button>
                                                                                ))}
                                                                            </div>
                                                                            <div className="flex items-center gap-2">
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        setReplyToId(null);
                                                                                        setReplyText('');
                                                                                    }}
                                                                                    className="text-bb-text-secondary hover:text-bb-text text-[10px] font-bold uppercase transition-colors px-2"
                                                                                >
                                                                                    Cancelar
                                                                                </button>
                                                                                <Button
                                                                                    type="submit"
                                                                                    disabled={isSubmittingReply || !replyText.trim()}
                                                                                    className="bg-[#3b3b4f] hover:bg-[#4a4a6a] text-white/70 hover:text-white font-bold px-5 h-7 rounded text-[10px] uppercase tracking-wider transition-all"
                                                                                >
                                                                                    {isSubmittingReply ? '...' : 'Responder'}
                                                                                </Button>
                                                                            </div>
                                                                        </div>
                                                                    </form>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {replies.length > 0 && depth < 2 && (
                                                            <div className="space-y-1">
                                                                {depth === 0 ? (
                                                                    <ReplyToggler
                                                                        count={replies.length}
                                                                        onToggle={(show: boolean) => { }}
                                                                    >
                                                                        {renderCommentTree(comment.id, depth + 1)}
                                                                    </ReplyToggler>
                                                                ) : (
                                                                    renderCommentTree(comment.id, depth + 1)
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            });
                                    };
                                    return renderCommentTree();
                                })()}
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
            </div>

            <SecureFileModal
                isOpen={!!viewingFile}
                onClose={() => setViewingFile(null)}
                filePath={viewingFile?.path || null}
                fileName={viewingFile?.name || null}
            />
        </div>
    );
}
