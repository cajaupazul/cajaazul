-- ==========================================
-- USER STATS AGGREGATION LAYER
-- ==========================================

-- 1. Create table
CREATE TABLE IF NOT EXISTS public.user_stats (
    user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    messages_count integer DEFAULT 0,
    reaction_score integer DEFAULT 0,
    updated_at timestamptz DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User stats are viewable by everyone"
    ON public.user_stats FOR SELECT
    TO authenticated
    USING (true);

-- 3. Initial baseline (seed existing data)
INSERT INTO public.user_stats (user_id, messages_count, reaction_score)
SELECT 
    p.id as user_id,
    (
        SELECT COUNT(*) FROM professor_comments pc WHERE pc.user_id = p.id
    ) + (
        SELECT COUNT(*) FROM comments c WHERE c.user_id = p.id
    ) as messages_count,
    (
        SELECT COALESCE(SUM(likes), 0) FROM professor_comments pc WHERE pc.user_id = p.id
    ) + (
        SELECT COUNT(*) FROM likes l 
        JOIN posts po ON l.post_id = po.id 
        WHERE po.user_id = p.id
    ) as reaction_score
FROM public.profiles p
ON CONFLICT (user_id) DO UPDATE SET
    messages_count = EXCLUDED.messages_count,
    reaction_score = EXCLUDED.reaction_score,
    updated_at = now();

-- 4. Synchronization Logic (Functions)

-- Function to handle message counts
CREATE OR REPLACE FUNCTION public.sync_user_messages_count()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO public.user_stats (user_id, messages_count)
        VALUES (NEW.user_id, 1)
        ON CONFLICT (user_id) DO UPDATE SET
            messages_count = user_stats.messages_count + 1,
            updated_at = now();
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.user_stats 
        SET messages_count = GREATEST(0, messages_count - 1),
            updated_at = now()
        WHERE user_id = OLD.user_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle reaction score (from professor_comments.likes)
CREATE OR REPLACE FUNCTION public.sync_comment_likes_score()
RETURNS TRIGGER AS $$
BEGIN
    -- This trigger handles professor_comments.likes updates
    IF (NEW.likes <> OLD.likes) THEN
        UPDATE public.user_stats
        SET reaction_score = GREATEST(0, reaction_score + (NEW.likes - OLD.likes)),
            updated_at = now()
        WHERE user_id = NEW.user_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle reaction score (from post likes)
CREATE OR REPLACE FUNCTION public.sync_post_likes_score()
RETURNS TRIGGER AS $$
DECLARE
    v_post_author uuid;
BEGIN
    -- Get the author of the post being liked
    SELECT user_id INTO v_post_author FROM public.posts WHERE id = COALESCE(NEW.post_id, OLD.post_id);
    
    IF v_post_author IS NULL THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    IF (TG_OP = 'INSERT') THEN
        INSERT INTO public.user_stats (user_id, reaction_score)
        VALUES (v_post_author, 1)
        ON CONFLICT (user_id) DO UPDATE SET
            reaction_score = user_stats.reaction_score + 1,
            updated_at = now();
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.user_stats
        SET reaction_score = GREATEST(0, reaction_score - 1),
            updated_at = now()
        WHERE user_id = v_post_author;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Attach Triggers

-- Message Counts
DROP TRIGGER IF EXISTS tr_sync_professor_comments_count ON public.professor_comments;
CREATE TRIGGER tr_sync_professor_comments_count
AFTER INSERT OR DELETE ON public.professor_comments
FOR EACH ROW EXECUTE FUNCTION public.sync_user_messages_count();

DROP TRIGGER IF EXISTS tr_sync_posts_comments_count ON public.comments;
CREATE TRIGGER tr_sync_posts_comments_count
AFTER INSERT OR DELETE ON public.comments
FOR EACH ROW EXECUTE FUNCTION public.sync_user_messages_count();

-- Reaction Scores
DROP TRIGGER IF EXISTS tr_sync_comment_likes_score ON public.professor_comments;
CREATE TRIGGER tr_sync_comment_likes_score
AFTER UPDATE OF likes ON public.professor_comments
FOR EACH ROW EXECUTE FUNCTION public.sync_comment_likes_score();

DROP TRIGGER IF EXISTS tr_sync_post_likes_score ON public.likes;
CREATE TRIGGER tr_sync_post_likes_score
AFTER INSERT OR DELETE ON public.likes
FOR EACH ROW EXECUTE FUNCTION public.sync_post_likes_score();
