'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Plus, Trash2, Edit2, MessageSquare, Heart, Share2, MessageCircle } from 'lucide-react';
import { supabase, Post, Profile } from '@/lib/supabase';
import { useProfile } from '@/lib/profile-context';
import { useRouter } from 'next/navigation';

export default function CommunityPage() {
  const router = useRouter();
  const { profile, loading: profileLoading } = useProfile();
  const [posts, setPosts] = useState<(Post & { profiles?: Profile })[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [postContent, setPostContent] = useState('');
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());

  useEffect(() => {
    // 1. Initial Fetch on Mount (Optimistic)
    fetchPosts();

    // 2. Auth Check
    if (!profileLoading && !profile) {
      router.push('/auth/login');
    }

    // Safety timeout
    const timer = setTimeout(() => setLoading(false), 3000);
    return () => clearTimeout(timer);
  }, [profile, profileLoading, router]);

  const fetchPosts = async () => {
    try {
      if (posts.length === 0) {
        setLoading(true);
      }
      const { data, error } = await supabase
        .from('posts')
        .select('*, profiles(*)')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      if (data) setPosts(data);
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postContent.trim() || !profile) return;

    const { error } = await supabase.from('posts').insert({
      user_id: profile.id,
      contenido: postContent,
    });

    if (!error) {
      setCreateDialogOpen(false);
      setPostContent('');
      fetchPosts();
    }
  };

  const handleLikePost = async (postId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (likedPosts.has(postId)) {
      await supabase
        .from('likes')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', user.id);
      setLikedPosts((prev) => {
        const newSet = new Set(prev);
        newSet.delete(postId);
        return newSet;
      });
    } else {
      await supabase.from('likes').insert({
        post_id: postId,
        user_id: user.id,
      });
      setLikedPosts((prev) => new Set([...prev, postId]));
    }

    fetchPosts();
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm('¿Estás seguro?')) return;
    await supabase.from('posts').delete().eq('id', postId);
    fetchPosts();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-4 md:p-8 bg-bb-dark relative">
      {/* Header */}
      <div className="mb-8 md:mb-12">
        <h1 className="text-3xl md:text-5xl font-black text-bb-text tracking-tight leading-tight">Comunidad</h1>
        <p className="text-bb-text-secondary mt-2 text-sm md:text-lg">Comparte tips, preguntas y experiencias con tus compañeros</p>
      </div>

      <div className="max-w-2xl mx-auto">
        {/* Create Post Card */}
        <Card className="bg-bb-card border-bb-border mb-6 md:mb-8 shadow-xl rounded-2xl overflow-hidden">
          <CardContent className="p-4 md:p-6">
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <div className="flex items-center gap-3 md:gap-4 cursor-pointer group">
                  <Avatar className="h-10 w-10 md:h-12 md:w-12 flex-shrink-0 ring-2 ring-bb-border group-hover:ring-blue-500/50 transition-all">
                    <AvatarImage src={profile?.avatar_url || ''} />
                    <AvatarFallback className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-bold">
                      {profile?.nombre?.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 px-4 py-2.5 md:py-3 rounded-xl bg-bb-darker border border-bb-border text-bb-text-secondary text-sm group-hover:border-blue-500/30 transition-all">
                    ¿Qué quieres compartir?
                  </div>
                  <div className="bg-blue-600 p-2 md:p-2.5 rounded-xl text-white shadow-lg shadow-blue-600/20 group-hover:scale-110 transition-transform">
                    <Plus className="h-5 w-5" />
                  </div>
                </div>
              </DialogTrigger>
              <DialogContent className="bg-bb-card border-bb-border z-[200]">
                <DialogHeader>
                  <DialogTitle className="text-bb-text font-bold text-xl md:text-2xl">Crear Publicación</DialogTitle>
                  <DialogDescription className="text-bb-text-secondary">
                    Comparte tus conocimientos y experiencias con la comunidad
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreatePost} className="space-y-4">
                  <Textarea
                    value={postContent}
                    onChange={(e) => setPostContent(e.target.value)}
                    placeholder="Escribe tu publicación..."
                    className="bg-bb-darker border-bb-border text-bb-text focus:border-blue-500/50 transition-all rounded-xl min-h-[150px] resize-none"
                    required
                  />
                  <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold h-12 rounded-xl">
                    Publicar
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        {/* Posts Feed */}
        <div className="space-y-6">
          {posts.length > 0 ? (
            posts.map((post) => (
              <Card key={post.id} className="hover:border-blue-500/30 transition-all bg-bb-card border-bb-border shadow-lg rounded-2xl overflow-hidden group">
                <CardContent className="p-5 md:p-6">
                  {/* Post Header */}
                  <div className="flex items-start justify-between mb-4 md:mb-5">
                    <div className="flex items-center gap-3 md:gap-4 flex-1">
                      <Avatar className="h-10 w-10 md:h-12 md:w-12 flex-shrink-0 ring-2 ring-bb-border group-hover:ring-blue-500/20 transition-all">
                        <AvatarImage src={post.profiles?.avatar_url || ''} />
                        <AvatarFallback className="bg-bb-darker text-bb-text font-bold">
                          {post.profiles?.nombre?.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-bb-text text-sm md:text-base group-hover:text-blue-400 transition-colors">
                          {post.profiles?.nombre}
                        </h3>
                        <p className="text-[10px] md:text-xs text-bb-text-secondary mt-0.5 md:mt-1 flex items-center gap-2">
                          {new Date(post.created_at).toLocaleDateString('es-ES', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                    {profile?.id === post.user_id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeletePost(post.id)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  {/* Post Content */}
                  <p className="text-bb-text text-sm md:text-base mb-5 whitespace-pre-wrap leading-relaxed">
                    {post.contenido}
                  </p>

                  {/* Hashtags */}
                  {post.hashtags && post.hashtags.length > 0 && (
                    <div className="mb-5 flex flex-wrap gap-2">
                      {post.hashtags.map((hashtag) => (
                        <span key={hashtag} className="text-blue-400 text-xs md:text-sm font-bold bg-blue-500/10 px-2 py-0.5 rounded-md hover:bg-blue-500/20 cursor-pointer transition-colors">
                          #{hashtag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Post Actions */}
                  <div className="flex items-center gap-4 md:gap-8 pt-4 border-t border-bb-border">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleLikePost(post.id)}
                      className={`text-bb-text-secondary hover:text-red-400 hover:bg-red-400/10 transition-all ${likedPosts.has(post.id) ? 'text-red-400 bg-red-400/5' : ''
                        }`}
                    >
                      <Heart
                        className={`h-4 w-4 mr-2 ${likedPosts.has(post.id) ? 'fill-current' : ''
                          }`}
                      />
                      <span className="text-xs font-bold">{post.likes || 0}</span>
                    </Button>
                    <Button variant="ghost" size="sm" className="text-bb-text-secondary hover:text-blue-400 hover:bg-blue-400/10 transition-all">
                      <MessageCircle className="h-4 w-4 mr-2" />
                      <span className="text-xs font-bold">Comentar</span>
                    </Button>
                    <Button variant="ghost" size="sm" className="text-bb-text-secondary hover:text-indigo-400 hover:bg-indigo-400/10 transition-all">
                      <Share2 className="h-4 w-4 mr-2" />
                      <span className="text-xs font-bold">Compartir</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="bg-bb-card border-bb-border rounded-3xl">
              <CardContent className="py-16 md:py-24 text-center">
                <div className="bg-bb-darker p-8 rounded-full w-24 h-24 mx-auto mb-6 flex items-center justify-center">
                  <MessageCircle className="h-10 w-10 text-bb-text-secondary" />
                </div>
                <p className="text-bb-text-secondary text-lg font-bold">
                  Aún no hay publicaciones.
                </p>
                <p className="text-bb-text-secondary/60 text-sm mt-1">¡Sé el primero en compartir algo!</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
