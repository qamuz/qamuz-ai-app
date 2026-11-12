import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Bell, Heart, MessageCircle, UserPlus, Info } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { fetchNotifications, markAllRead, timeAgo, type AppNotification } from '@/lib/social';
import { useI18n } from '@/hooks/useI18n';

const ICONS = { follow: UserPlus, comment: MessageCircle, like: Heart, system: Info };

export function NotificationsBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { t } = useI18n();

  const load = useCallback(async () => {
    if (!user) return;
    setItems(await fetchNotifications(user.id));
  }, [user]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 60000);
    return () => window.clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const unread = items.filter((n) => !n.read_at).length;

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0 && user) {
      void markAllRead(user.id);
      window.setTimeout(() => setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() }))), 1500);
    }
  }

  return (
    <div data-ev-id="ev_b3d72fc472" ref={ref} className="relative">
			<button data-ev-id="ev_74ec8a2fb4"
      type="button"
      onClick={toggle}
      aria-label={unread > 0 ? t('Notifications, {count} unread', { count: unread }) : t('Notifications')}
      className="relative flex h-10 w-10 items-center justify-center rounded-full bg-surface text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground">
        
				<Bell className="h-4 w-4" />
				{unread > 0 &&
        <span data-ev-id="ev_a5a9315279" className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-black text-primary-foreground">
						{unread > 9 ? '9+' : unread}
					</span>
        }
			</button>
			{open &&
      <div data-ev-id="ev_ca6caaf078" className="absolute right-0 top-full z-40 mt-2 flex w-80 max-w-[calc(100vw-2rem)] flex-col rounded-xl border border-border bg-surface shadow-xl shadow-black/40">
					<p data-ev-id="ev_14daee89e4" className="border-b border-border px-4 py-3 text-sm font-bold">{t('Notifications')}</p>
					<div data-ev-id="ev_9a943a07c2" className="no-scrollbar flex max-h-96 flex-col overflow-y-auto p-1">
						{items.length === 0 && <p data-ev-id="ev_5c3590548c" className="px-3 py-6 text-center text-sm text-muted-foreground">{t('You have no notifications yet.')}</p>}
						{items.map((n) => {
            const Icon = ICONS[n.type] ?? Info;
            return (
              <button data-ev-id="ev_d1589e5d14"
              key={n.id}
              type="button"
              onClick={() => {
                setOpen(false);
                if (n.link) navigate(n.link);
              }}
              className={`flex gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-surface-2 ${n.read_at ? '' : 'bg-primary/5'}`}>
                
									<span data-ev-id="ev_88f13a5964" className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-full bg-surface-3 text-primary">
										<Icon className="h-4 w-4" />
									</span>
									<span data-ev-id="ev_2f3a8861fe" className="flex min-w-0 flex-col gap-0.5">
										<span data-ev-id="ev_564461ff18" className="text-sm text-pretty">{t(n.title, n.meta ?? undefined)}</span>
										{n.body && <span data-ev-id="ev_2fbf3bde83" className="line-clamp-2 text-xs text-muted-foreground">{n.body}</span>}
										<span data-ev-id="ev_450b5d8414" className="text-[11px] text-muted-foreground">{timeAgo(n.created_at)}</span>
									</span>
								</button>);

          })}
					</div>
				</div>
      }
		</div>);

}