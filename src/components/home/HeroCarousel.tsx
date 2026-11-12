import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useI18n } from '@/hooks/useI18n';
import type { HomeTab } from '@/components/home/HomeTabs';
import studioImg from '@/assets/generated/banner-studio.webp';
import templatesImg from '@/assets/generated/banner-templates.webp';
import qvImg from '@/assets/generated/banner-qv.webp';
import characterImg from '@/assets/generated/banner-character.webp';
import creatorsImg from '@/assets/generated/banner-creators.webp';

type Slide = { id: string; image: string; kicker: string; title: string; text: string; cta: string; to?: string; tab?: HomeTab };

const SLIDES: Slide[] = [
	{ id: 'studio', image: studioImg, kicker: 'Qamuz AI Studio', title: 'Create songs with AI', text: 'Write an idea and get a full song with vocals in minutes.', cta: 'Open AI Studio', to: '/estudio' },
	{ id: 'templates', image: templatesImg, kicker: 'Templates', title: 'Start from a template', text: 'Reuse the prompt of songs other creators published and make it yours.', cta: 'Browse templates', tab: 'templates' },
	{ id: 'qv', image: qvImg, kicker: 'QV', title: 'Music videos from the community', text: 'Watch the videos creators made public with their songs.', cta: 'Watch QV', tab: 'qv' },
	{ id: 'character', image: characterImg, kicker: 'Character', title: 'Sing with a character', text: 'Pick an AI singer and give your next song its voice.', cta: 'Choose a character', tab: 'character' },
	{ id: 'creators', image: creatorsImg, kicker: 'Creators', title: 'Meet the creators', text: 'Follow the artists making music on Qamuz AI.', cta: 'See creators', tab: 'creators' },
];

const DELAY = 6000;

/** Home banner: five slides that rotate on their own (paused on hover/focus or with reduced motion). */
export function HeroCarousel({ greeting, onTab }: { greeting: string; onTab: (tab: HomeTab) => void }) {
	const { t } = useI18n();
	const [index, setIndex] = useState(0);
	const [paused, setPaused] = useState(false);

	useEffect(() => {
		if (paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		const timer = window.setTimeout(() => setIndex((i) => (i + 1) % SLIDES.length), DELAY);
		return () => window.clearTimeout(timer);
	}, [index, paused]);

	const go = (n: number) => setIndex((n + SLIDES.length) % SLIDES.length);

	return (
		<section
			data-ev-id="ev_hc_root"
			aria-roledescription="carousel"
			aria-label={t('Highlights')}
			className="group relative h-[340px] overflow-hidden rounded-2xl border border-border bg-surface md:h-[400px]"
			onMouseEnter={() => setPaused(true)}
			onMouseLeave={() => setPaused(false)}
			onFocus={() => setPaused(true)}
			onBlur={() => setPaused(false)}
		>
			{SLIDES.map((s, i) => {
				const on = i === index;
				const cls = 'inline-flex h-11 w-fit items-center justify-center rounded-lg bg-primary px-5 text-sm font-bold text-primary-foreground transition-transform hover:scale-[1.02]';
				return (
					<div
						data-ev-id="ev_hc_slide"
						key={s.id}
						role="group"
						aria-roledescription="slide"
						aria-label={`${i + 1} / ${SLIDES.length}`}
						aria-hidden={!on}
						className={`absolute inset-0 transition-opacity duration-700 ${on ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
					>
						<img data-ev-id="ev_hc_img" src={s.image} width={1536} height={640} alt="" loading={i === 0 ? 'eager' : 'lazy'} className={`h-full w-full object-cover object-right transition-transform duration-[7000ms] ease-out ${on ? 'scale-105' : 'scale-100'}`} />
						<div data-ev-id="ev_hc_shade" className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-transparent md:via-background/60" aria-hidden="true" />
						<div data-ev-id="ev_hc_body" className="absolute inset-0 flex max-w-xl flex-col justify-center gap-3 p-6 md:p-10">
							{i === 0 && <p data-ev-id="ev_hc_greet" className="text-sm font-semibold text-muted-foreground">{greeting}</p>}
							<span data-ev-id="ev_hc_kicker" className="text-xs font-bold uppercase tracking-wider text-primary">{t(s.kicker)}</span>
							<h2 data-ev-id="ev_hc_title" className="text-3xl font-black tracking-tight text-balance md:text-5xl">{t(s.title)}</h2>
							<p data-ev-id="ev_hc_text" className="text-sm text-pretty text-muted-foreground md:text-base">{t(s.text)}</p>
							{s.tab ? (
								<button data-ev-id="ev_hc_cta_a" type="button" onClick={() => s.tab && onTab(s.tab)} tabIndex={on ? 0 : -1} className={cls}>{t(s.cta)}</button>
							) : (
								<Link data-ev-id="ev_hc_cta" to={s.to ?? '/'} tabIndex={on ? 0 : -1} className={cls}>{t(s.cta)}</Link>
							)}
						</div>
					</div>
				);
			})}

			<div data-ev-id="ev_hc_controls" className="absolute bottom-4 left-6 flex items-center gap-2 md:left-10">
				{SLIDES.map((s, i) => (
					<button
						data-ev-id="ev_hc_dot"
						key={s.id}
						type="button"
						onClick={() => go(i)}
						aria-label={t('Go to slide {n}', { n: i + 1 })}
						aria-current={i === index}
						className="flex h-6 items-center"
					>
						<span data-ev-id="ev_hc_dot_bar" className={`block h-1.5 rounded-full transition-all ${i === index ? 'w-8 bg-primary' : 'w-3 bg-foreground/30 hover:bg-foreground/60'}`} />
					</button>
				))}
			</div>
			<div data-ev-id="ev_hc_arrows" className="absolute bottom-3 right-4 flex gap-2">
				<button data-ev-id="ev_hc_prev" type="button" onClick={() => go(index - 1)} aria-label={t('Previous')} className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background/70 text-foreground backdrop-blur hover:bg-surface-2">
					<ChevronLeft className="h-5 w-5" />
				</button>
				<button data-ev-id="ev_hc_next" type="button" onClick={() => go(index + 1)} aria-label={t('Next')} className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background/70 text-foreground backdrop-blur hover:bg-surface-2">
					<ChevronRight className="h-5 w-5" />
				</button>
			</div>
		</section>
	);
}
