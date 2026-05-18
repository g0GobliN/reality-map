export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="relative grid h-8 w-8 place-items-center rounded-lg border border-border bg-surface-2 ring-aurora">
        <svg viewBox="0 0 24 24" className="h-4 w-4">
          <defs>
            <linearGradient id="lg" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0" stopColor="oklch(0.82 0.16 210)" />
              <stop offset="1" stopColor="oklch(0.72 0.19 295)" />
            </linearGradient>
          </defs>
          <circle cx="6" cy="6" r="2" fill="url(#lg)" />
          <circle cx="18" cy="6" r="2" fill="url(#lg)" />
          <circle cx="12" cy="14" r="2.4" fill="url(#lg)" />
          <circle cx="6" cy="20" r="1.6" fill="url(#lg)" />
          <circle cx="18" cy="20" r="1.6" fill="url(#lg)" />
          <path d="M6 6 L12 14 L18 6 M12 14 L6 20 M12 14 L18 20" stroke="url(#lg)" strokeWidth="1.2" fill="none" />
        </svg>
      </span>
      <span className="font-display text-[15px] font-semibold tracking-tight">
        Reality<span className="text-gradient">Map</span>
      </span>
    </div>
  );
}
