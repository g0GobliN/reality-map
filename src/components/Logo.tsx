import logoUrl from "../img/logo.PNG";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="relative grid h-8 w-8 place-items-center rounded-lg border border-border bg-surface-2 ring-aurora overflow-hidden">
        <img src={logoUrl} alt="RealityMap Logo" className="h-full w-full object-cover" />
      </span>
      <span className="font-display text-[15px] font-semibold tracking-tight">
        Reality<span className="text-gradient">Map</span>
      </span>
    </div>
  );
}
