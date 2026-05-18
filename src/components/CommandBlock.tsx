import { Copy, Check, TerminalSquare } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function CommandBlock({ cmd = "npx reality-map" }: { cmd?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="glass-strong group inline-flex items-center gap-3 rounded-xl border px-4 py-3 font-mono text-sm">
      <TerminalSquare className="h-4 w-4 text-cyan" />
      <span className="text-muted-foreground">$</span>
      <span className="text-foreground">{cmd}</span>
      <button
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(cmd);
            setCopied(true);
            toast.success("Copied", { description: cmd });
            setTimeout(() => setCopied(false), 1200);
          } catch {
            toast.error("Copy failed", { description: "Select the command and copy manually." });
          }
        }}
        className="ml-2 grid h-7 w-7 place-items-center rounded-md border border-border bg-surface-2 transition hover:bg-surface"
        aria-label="Copy"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-emerald" />
        ) : (
          <Copy className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>
    </div>
  );
}
