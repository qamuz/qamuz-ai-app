import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { FolderOpen, Trash2, X } from 'lucide-react';
import { deleteProject, listProjects } from '@/lib/daw/projects';
import type { DawProjectSummary } from '@/lib/daw/types';
import { timeAgo } from '@/lib/social';
import { useI18n } from '@/hooks/useI18n';

interface ProjectsDialogProps {
  userId: string;
  currentId: string | null;
  onOpen: (id: string) => void;
  onDeleted: (id: string) => void;
  onClose: () => void;
}

export function ProjectsDialog({ userId, currentId, onOpen, onDeleted, onClose }: ProjectsDialogProps) {
  const { t } = useI18n();
  const [items, setItems] = useState<DawProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    void listProjects(userId).then((data) => {
      if (!alive) return;
      setItems(data);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [userId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function remove(id: string) {
    if (!window.confirm(t('Delete this project?'))) return;
    await deleteProject(id);
    setItems((list) => list.filter((p) => p.id !== id));
    onDeleted(id);
  }

  return createPortal(
    <div data-ev-id="ev_e8bfb7f999" className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
			<div data-ev-id="ev_5fdcd52ddf"
      role="dialog"
      aria-modal="true"
      aria-label={t('Your projects')}
      onClick={(e) => e.stopPropagation()}
      className="flex max-h-[80vh] w-full max-w-lg flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-2xl shadow-black/60">
        
				<div data-ev-id="ev_be78c0db49" className="flex items-center justify-between">
					<h2 data-ev-id="ev_71da928d90" className="text-lg font-bold">{t('Your projects')}</h2>
					<button data-ev-id="ev_192b8427b9" type="button" onClick={onClose} aria-label={t('Close')} className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-3 hover:text-foreground">
						<X className="h-4 w-4" />
					</button>
				</div>

				{loading ?
        <div data-ev-id="ev_ccc9d8e093" className="flex justify-center py-10">
						<div data-ev-id="ev_a33968760f" className="h-7 w-7 animate-spin rounded-full border-2 border-border border-t-primary" />
					</div> :
        items.length === 0 ?
        <p data-ev-id="ev_e72d42cb9e" className="py-8 text-center text-sm text-muted-foreground">{t('No saved projects yet.')}</p> :

        <ul data-ev-id="ev_dd315918d3" className="no-scrollbar flex flex-col gap-1 overflow-y-auto">
						{items.map((item) =>
          <li data-ev-id="ev_5c6c12ea14" key={item.id} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${item.id === currentId ? 'bg-surface-3' : 'hover:bg-surface-2'}`}>
								<button data-ev-id="ev_005e954fa7" type="button" onClick={() => onOpen(item.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
									<span data-ev-id="ev_c139b47e39" className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-primary/15 text-primary">
										<FolderOpen className="h-4 w-4" />
									</span>
									<span data-ev-id="ev_10eae289be" className="flex min-w-0 flex-col">
										<span data-ev-id="ev_244b9e6b00" className="truncate text-sm font-semibold">{item.name}</span>
										<span data-ev-id="ev_7ec1981e5c" className="text-xs text-muted-foreground">
											{t('{bpm} BPM', { bpm: item.bpm })} · {timeAgo(item.updated_at)}
										</span>
									</span>
								</button>
								<button data-ev-id="ev_a2ac0468bc"
            type="button"
            onClick={() => void remove(item.id)}
            aria-label={t('Delete project')}
            title={t('Delete project')}
            className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-muted-foreground hover:bg-surface-3 hover:text-destructive">
              
									<Trash2 className="h-4 w-4" />
								</button>
							</li>
          )}
					</ul>
        }
			</div>
		</div>,
    document.body
  );
}