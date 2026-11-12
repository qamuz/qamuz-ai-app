import { useMemo } from 'react';
import { Link } from 'react-router';
import { Clapperboard } from 'lucide-react';
import { EmptyNote, MoreButton } from '@/components/home/MoreButton';
import { useI18n } from '@/hooks/useI18n';
import { matchesQuery, usePaged } from '@/hooks/usePaged';
import { videoSourceOf, type Creation } from '@/lib/studio';
import { formatStamp } from '@/lib/library';

const PAGE = 12;

/** Videos tab: the user's finished music videos. */
export function LibraryVideos({ videos, query, songPathByKey }: {videos: Creation[];query: string;songPathByKey: Map<string, string>;}) {
  const { t } = useI18n();
  const filtered = useMemo(() => videos.filter((v) => matchesQuery(query, v.title, videoSourceOf(v)?.title, v.prompt)), [videos, query]);
  const { shown, hasMore, more } = usePaged(filtered, PAGE, query);

  if (filtered.length === 0) {
    return query ?
    <EmptyNote searching text="" /> :

    <div data-ev-id="ev_lv_empty" className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-14 text-center">
        <Clapperboard className="h-7 w-7 text-muted-foreground" />
        <p data-ev-id="ev_lv_empty_t" className="text-sm font-semibold text-foreground">{t('No videos yet')}</p>
        <p data-ev-id="ev_lv_empty_s" className="text-sm text-muted-foreground">{t('Make a video from any of your songs.')}</p>
        <Link data-ev-id="ev_lv_empty_cta" to="/estudio?kind=video" className="mt-1 inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground">{t('Make video')}</Link>
      </div>;

  }

  return (
    <div data-ev-id="ev_lv_root" className="flex flex-col gap-6">
      <div data-ev-id="ev_lv_grid" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {shown.map((v) => {
          const src = videoSourceOf(v);
          const path = src?.song_key ? songPathByKey.get(src.song_key) : songPathByKey.get(`video:${v.id}`);
          const title = src?.title || v.title || t('Untitled');
          return (
            <article data-ev-id="ev_lv_card" key={v.id} className="flex flex-col gap-2 overflow-hidden rounded-xl border border-border bg-surface">
              <video data-ev-id="ev_lv_video" src={v.result_urls[0]} poster={v.thumbnail_url ?? src?.cover_url ?? undefined} controls preload="metadata" className="aspect-video w-full bg-black object-cover" />
              <div data-ev-id="ev_lv_info" className="flex flex-col gap-0.5 px-3 pb-3">
                {path ?
                <Link data-ev-id="ev_lv_title_l" to={path} className="truncate text-sm font-semibold text-foreground hover:text-primary">{title}</Link> :
                <p data-ev-id="ev_lv_title" className="truncate text-sm font-semibold text-foreground">{title}</p>
                }
                <p data-ev-id="ev_lv_date" className="text-xs text-muted-foreground">{formatStamp(v.created_at)}</p>
              </div>
            </article>);

        })}
      </div>
      {hasMore && <MoreButton onClick={more} />}
    </div>);

}
