import { Logo } from "./Logo";
import { Button } from "@/components/ui/button";
import { Github } from "lucide-react";

export function Nav() {
  return (
    <header className="sticky top-0 z-50">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan/40 to-transparent" />
      <div className="glass border-x-0 border-t-0">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
          <Logo />
          <nav className="hidden items-center gap-7 md:flex">
            {["Product", "Architecture", "Heatmap", "Changelog", "Docs"].map((l) => (
              <a key={l} href={`#${l.toLowerCase()}`} className="text-sm text-muted-foreground transition hover:text-foreground">
                {l}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <a href="#" className="hidden h-9 items-center gap-1.5 rounded-md px-3 text-sm text-muted-foreground transition hover:text-foreground sm:inline-flex">
              <Github className="h-4 w-4" /> Star
            </a>
            <Button size="sm" className="h-9 rounded-md bg-foreground text-background hover:bg-foreground/90">
              Open Dashboard
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
