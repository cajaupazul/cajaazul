'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, X, CheckCheck, ExternalLink, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

type Notification = {
  id: string;
  kind: string;
  title: string;
  body: string;
  href: string | null;
  read_at: string | null;
  expires_at: string | null;
  created_at: string;
};

const KIND_STYLES: Record<string, string> = {
  welcome: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  report: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  system: 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Ahora';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const unread = notifications.filter(n => !n.read_at).length;

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const currentUserId = authData?.user?.id;
      if (!currentUserId) {
        setNotifications([]);
        return;
      }

      void supabase.rpc('cleanup_my_expired_notifications');
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('user_notifications')
        .select('id, kind, title, body, href, read_at, expires_at, created_at')
        .eq('user_id', currentUserId)
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .order('created_at', { ascending: false })
        .limit(30);

      if (!error && data) {
        setNotifications(data as Notification[]);
      }
    } catch (err) {
      console.error('Error loading notifications:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const markAllRead = useCallback(async (notifsToMark?: Notification[]) => {
    const targetNotifs = notifsToMark || notifications;
    const unreadIds = targetNotifs.filter(n => !n.read_at).map(n => n.id);
    if (!unreadIds.length) return;

    const { data: authData } = await supabase.auth.getUser();
    const currentUserId = authData?.user?.id;
    if (!currentUserId) return;

    const now = new Date().toISOString();

    // Actualización optimista inmediata en UI
    setNotifications(prev =>
      prev.map(n => unreadIds.includes(n.id) ? { ...n, read_at: now } : n)
    );

    try {
      const { error } = await supabase
        .from('user_notifications')
        .update({ read_at: now })
        .in('id', unreadIds)
        .eq('user_id', currentUserId);

      if (error) {
        console.error('Error marking notifications as read:', error);
      }
    } catch (err) {
      console.error('Failed to update read_at:', err);
    }
  }, [notifications]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  // Al abrir el modal, marcamos como leídas
  useEffect(() => {
    if (open && unread > 0) {
      void markAllRead();
    }
  }, [open, unread, markAllRead]);

  // Cerrar al hacer clic afuera
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-bb-text-secondary transition-colors hover:bg-white/5 hover:text-bb-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        aria-label={`Notificaciones${unread > 0 ? ` (${unread} sin leer)` : ''}`}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Bell size={20} aria-hidden="true" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-black leading-none text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Centro de notificaciones"
          className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-bb-border bg-bb-card shadow-2xl shadow-black/40 sm:w-96"
          style={{ maxHeight: '80vh' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-bb-border px-4 py-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-blue-400">CajaAzul</p>
              <h2 className="text-sm font-bold text-bb-text">Notificaciones</h2>
            </div>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button
                  type="button"
                  onClick={() => void markAllRead()}
                  className="rounded-lg px-2 py-1 text-[11px] font-semibold text-blue-400 hover:bg-blue-500/10 transition-colors"
                  title="Marcar todas como leídas"
                >
                  Marcar leídas
                </button>
              )}
              <button
                type="button"
                onClick={() => void loadNotifications()}
                className="rounded-lg p-1.5 text-bb-text-secondary transition-colors hover:bg-white/5 hover:text-bb-text"
                aria-label="Actualizar notificaciones"
                title="Actualizar"
              >
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-bb-text-secondary transition-colors hover:bg-white/5 hover:text-bb-text"
                aria-label="Cerrar notificaciones"
              >
                <X size={13} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(80vh - 60px)' }}>
            {loading && notifications.length === 0 ? (
              <div className="flex items-center justify-center py-10">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-blue-400" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                <CheckCheck size={32} className="mb-3 text-bb-text-secondary/40" />
                <p className="text-sm font-bold text-bb-text-secondary">Todo al día</p>
                <p className="mt-1 text-xs text-bb-text-secondary/60">No tienes notificaciones pendientes.</p>
              </div>
            ) : (
              <ul className="divide-y divide-bb-border/50">
                {notifications.map(n => {
                  const colorClass = KIND_STYLES[n.kind] ?? KIND_STYLES.system;
                  const isUnread = !n.read_at;
                  return (
                    <li key={n.id} className={`px-4 py-3.5 transition-colors ${isUnread ? 'bg-white/[0.03]' : ''}`}>
                      <div className="flex items-start gap-3">
                        {isUnread && (
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" aria-hidden="true" />
                        )}
                        <div className={`min-w-0 flex-1 ${!isUnread ? 'pl-[18px]' : ''}`}>
                          <div className="mb-0.5 flex items-center justify-between gap-2">
                            <span className={`inline-block rounded-md border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest ${colorClass}`}>
                              {n.kind}
                            </span>
                            <span className="shrink-0 text-[10px] text-bb-text-secondary/60">{timeAgo(n.created_at)}</span>
                          </div>
                          <p className="text-xs font-bold text-bb-text">{n.title}</p>
                          <p className="mt-0.5 text-xs leading-relaxed text-bb-text-secondary">{n.body}</p>
                          {n.href && (
                            <Link
                              href={n.href}
                              onClick={() => {
                                setOpen(false);
                                if (!n.read_at) {
                                  void markAllRead([n]);
                                }
                              }}
                              className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-blue-400 transition-colors hover:text-blue-300"
                            >
                              Ver <ExternalLink size={10} />
                            </Link>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
