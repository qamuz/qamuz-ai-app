import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Send, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useAccount } from '@/hooks/useAccount';
import { addComment, deleteComment, fetchComments, timeAgo, type TrackComment } from '@/lib/social';
import { useI18n } from '@/hooks/useI18n';
import { trackEvent } from '@/lib/engagement';

export function TrackComments({ trackId, fill = false }: {trackId: string;fill?: boolean;}) {
  const { user } = useAuth();
  const { isAdmin } = useAccount();
  const [comments, setComments] = useState<TrackComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t } = useI18n();

  const load = useCallback(async () => {
    setComments(await fetchComments(trackId));
    setLoading(false);
  }, [trackId]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const body = text.trim();
    if (!user || !body) return;
    setSending(true);
    setError(null);
    const err = await addComment(trackId, user.id, body);
    setSending(false);
    if (err) {
      setError(t('Could not post the comment'));
      return;
    }
    setText('');
    void load();
    void trackEvent(trackId, 'sync');
  }

  async function remove(id: string) {
    setComments((prev) => prev.filter((c) => c.id !== id));
    await deleteComment(id);
    void trackEvent(trackId, 'sync');
  }

  return (
    <div data-ev-id="ev_6386e5fe82" className={`flex flex-col gap-4 ${fill ? 'min-h-0 flex-1' : 'max-h-[55vh]'}`}>
			{user ?
      <form data-ev-id="ev_558ffd018c" onSubmit={submit} className="flex items-end gap-2">
					<label data-ev-id="ev_f2208fc8a3" className="sr-only" htmlFor="comment-input">
						{t('Write a comment')}
					</label>
					<textarea data-ev-id="ev_f93d9bf743"
        id="comment-input"
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, 500))}
        rows={2}
        placeholder={t('What do you think of this song?')}
        className="min-h-11 flex-1 resize-none rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary" />
        
					<button data-ev-id="ev_eaa1113b18"
        type="submit"
        disabled={sending || !text.trim()}
        aria-label={t('Post comment')}
        className="flex h-11 w-11 flex-none items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity disabled:opacity-40">
          
						<Send className="h-4 w-4" />
					</button>
				</form> :

      <p data-ev-id="ev_591ec45cdc" className="text-sm text-muted-foreground">
					<Link data-ev-id="ev_b10efdd5c2" to="/login" className="font-semibold text-primary hover:underline">
						{t('Log in')}
					</Link>{' '}
					{t('to comment.')}
				</p>
      }
			{error && <p data-ev-id="ev_a19823848c" className="text-xs text-destructive">{error}</p>}

			<div data-ev-id="ev_c4b2644b22" className="no-scrollbar flex flex-col gap-3 overflow-y-auto">
				{loading && <p data-ev-id="ev_9955df207b" className="text-sm text-muted-foreground">{t('Loading comments...')}</p>}
				{!loading && comments.length === 0 && <p data-ev-id="ev_9f0905bce4" className="text-sm text-muted-foreground">{t('No comments yet. Be the first.')}</p>}
				{comments.map((c) =>
        <article data-ev-id="ev_7666c972ac" key={c.id} className="flex gap-3 rounded-lg bg-surface-2/60 p-3">
						<span data-ev-id="ev_3a339a6aa3" className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-primary/15 text-xs font-black uppercase text-primary">
							{(c.author_name ?? '?').slice(0, 1)}
						</span>
						<div data-ev-id="ev_f7de860071" className="flex min-w-0 flex-1 flex-col gap-0.5">
							<div data-ev-id="ev_ae09bfb28d" className="flex items-baseline gap-2">
								<span data-ev-id="ev_e58db1589f" className="truncate text-sm font-semibold">{c.author_name ?? t('Listener')}</span>
								<span data-ev-id="ev_8712058331" className="text-[11px] text-muted-foreground">{timeAgo(c.created_at)}</span>
							</div>
							<p data-ev-id="ev_751163a910" className="text-sm text-pretty break-words text-foreground/90">{c.body}</p>
						</div>
						{(c.user_id === user?.id || isAdmin) &&
          <button data-ev-id="ev_74a2662734" type="button" onClick={() => void remove(c.id)} aria-label={t('Delete comment')} className="flex h-8 w-8 flex-none items-center justify-center rounded-md text-muted-foreground hover:text-destructive">
								<Trash2 className="h-3.5 w-3.5" />
							</button>
          }
					</article>
        )}
			</div>
		</div>);

}