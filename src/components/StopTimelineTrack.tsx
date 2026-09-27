/** Draw the shared vertical stop rail used by journey choices and line browsing. */
export function StopTimelineTrack({
  first,
  last,
  highlighted,
  highlightStart,
  highlightEnd,
}: {
  first: boolean;
  last: boolean;
  highlighted: boolean;
  highlightStart: boolean;
  highlightEnd: boolean;
}) {
  return (
    <span aria-hidden="true" className="relative self-stretch">
      <span
        className={`absolute left-1/2 w-0.5 -translate-x-1/2 bg-line-brand ${first ? 'top-2.5' : '-top-2'} ${last ? 'bottom-[calc(100%-0.625rem)]' : '-bottom-2'}`}
      />
      {highlighted && (
        <span
          className={`motion-segment absolute left-1/2 w-0.5 -translate-x-1/2 bg-accent ${highlightStart ? 'top-2.5' : '-top-2'} ${highlightEnd ? 'bottom-[calc(100%-0.625rem)]' : '-bottom-2'}`}
        />
      )}
      <span
        className={`motion-timeline-color absolute top-[5px] left-1/2 size-2.5 -translate-x-1/2 rounded-full border-2 ${highlighted ? 'border-accent bg-accent' : 'border-icon-muted bg-surface-input'}`}
      />
    </span>
  );
}
