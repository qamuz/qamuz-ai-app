export function EqualizerBars({ playing }: {playing: boolean;}) {
  return (
    <span data-ev-id="ev_3bc9b52fa6" className="flex h-4 w-4 items-end justify-center gap-[2px]" aria-hidden="true">
			{[0, 1, 2].map((i) =>
      <span data-ev-id="ev_94cd30f624"
      key={i}
      className={`w-[3px] rounded-full bg-primary ${playing ? 'eq-bar' : ''}`}
      style={{ height: '100%', animationDelay: `${i * 0.15}s`, transform: playing ? undefined : 'scaleY(0.35)' }} />

      )}
		</span>);

}