'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Heart, MessageCircle, Share2, Plus, Trash2 } from 'lucide-react';
import { supabase, Post, Profile } from '@/lib/supabase';

export default function CommunityPage() {
  const [posts, setPosts] = useState<(Post & { profiles?: Profile })[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [postContent, setPostContent] = useState('');
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());

  useEffect(() => {
    const initializePage = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();
        if (profile) setCurrentUser(profile);
      }
      fetchPosts();
    };
    initializePage();
  }, []);

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
    if (!postContent.trim() || !currentUser) return;

    const { error } = await supabase.from('posts').insert({
      user_id: currentUser.id,
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
    <div className="flex-1 overflow-auto p-8 bg-slate-50">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-slate-900">Comunidad</h1>
        <p className="text-slate-600 mt-2">Comparte tips, preguntas y experiencias con tus compañeros</p>
      </div>

      <div className="max-w-2xl mx-auto">
        {/* Create Post Card */}
        <Card className="bg-white mb-6 shadow-sm">
          <CardContent className="p-6">
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <div className="flex items-center gap-4 cursor-pointer">
                  <Avatar className="h-12 w-12 flex-shrink-0">
                    <AvatarImage src={currentUser?.avatar_url || ''} />
                    <AvatarFallback className="bg-gradient-to-r from-blue-500 to-cyan-400 text-white font-semibold">
                      {currentUser?.nombre?.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <Input
                    placeholder="¿Qué quieres compartir?"
                    disabled
                    className="flex-1 cursor-pointer bg-slate-100 border-0"
                  />
                  <Plus className="h-5 w-5 text-slate-400 flex-shrink-0" />
                </div>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Crear Publicación</DialogTitle>
                  <DialogDescription>
                    Comparte tus conocimientos y experiencias con la comunidad
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreatePost} className="space-y-4">
                  <Textarea
                    value={postContent}
                    onChange={(e) => setPostContent(e.target.value)}
                    placeholder="Escribe tu publicación..."
                    rows={6}
                    required
                  />
                  <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
                    Publicar
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        {/* Posts Feed */}
        <div className="space-y-4">
          {posts.length > 0 ? (
            posts.map((post) => (
              <Card key={post.id} className="hover:shadow-md transition-all bg-white">
                <CardContent className="p-6">
                  {/* Post Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start gap-4 flex-1">
                      <Avatar className="h-12 w-12 flex-shrink-0">
                        <AvatarImage src={post.profiles?.avatar_url || ''} />
                        <AvatarFallback className="bg-gradient-to-r from-blue-500 to-cyan-400 text-white font-semibold">
                          {post.profiles?.nombre?.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-slate-900">
                          {post.profiles?.nombre}
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">
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
                    {currentUser?.id === post.user_id && (
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
                  <p className="text-slate-700 mb-4 whitespace-pre-wrap leading-relaxed">
                    {post.contenido}
                  </p>

                  {/* Hashtags */}
                  {post.hashtags && post.hashtags.length > 0 && (
                    <div className="mb-4 flex flex-wrap gap-2">
                      {post.hashtags.map((hashtag) => (
                        <span key={hashtag} className="text-blue-600 text-sm hover:underline cursor-pointer">
                          #{hashtag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Post Actions */}
                  <div className="flex items-center gap-6 pt-4 border-t border-slate-100">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleLikePost(post.id)}
                      className={`text-slate-500 hover:text-red-600 hover:bg-red-50 ${likedPosts.has(post.id) ? 'text-red-600' : ''
                        }`}
                    >
                      <Heart
                        className={`h-4 w-4 mr-2 ${likedPosts.has(post.id) ? 'fill-current' : ''
                          }`}
                      />
                      <span className="text-xs font-medium">{post.likes || 0}</span>
                    </Button>
                    <Button variant="ghost" size="sm" className="text-slate-500 hover:text-blue-600 hover:bg-blue-50">
                      <MessageCircle className="h-4 w-4 mr-2" />
                      <span className="text-xs font-medium">Comentar</span>
                    </Button>
                    <Button variant="ghost" size="sm" className="text-slate-500 hover:text-cyan-600 hover:bg-cyan-50">
                      <Share2 className="h-4 w-4 mr-2" />
                      <span className="text-xs font-medium">Compartir</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="bg-white">
              <CardContent className="py-12 text-center">
                <MessageCircle className="h-16 w-16 mx-auto text-slate-300 mb-4" />
                <p className="text-slate-500 text-lg">
                  Aún no hay publicaciones. ¡Sé el primero en compartir!
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}