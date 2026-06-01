"use client";

import { useState } from "react";
import { Logo } from "./Logo";
import { Button } from "@/components/ui/button";
import { Github, Menu, Search, Package, Instagram } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { openCommandPalette } from "@/lib/command-palette";
import { scrollToSection } from "@/lib/scroll-to";

const NAV_LINKS = [
  { label: "Product", hash: "product" },
  { label: "Architecture", hash: "architecture" },
  { label: "Heatmap", hash: "heatmap" },
] as const;

const EXTERNAL_NAV_LINKS = [
  { label: "Changelog", href: "https://github.com/g0GobliN/reality-map/releases" },
  { label: "Docs", href: "https://github.com/g0GobliN/reality-map#readme" },
] as const;

export function Nav() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan/40 to-transparent" />
      <div className="glass border-x-0 border-t-0">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-6">
          <a href="/" className="shrink-0" aria-label="RealityMap home">
            <Logo />
          </a>
          <nav className="hidden items-center gap-7 md:flex" aria-label="Primary">
            {NAV_LINKS.map(({ label, hash }) => (
              <a
                key={hash}
                href={`#${hash}`}
                className="text-sm text-muted-foreground transition hover:text-foreground"
              >
                {label}
              </a>
            ))}
            {EXTERNAL_NAV_LINKS.map(({ label, href }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-muted-foreground transition hover:text-foreground"
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
                  aria-label="Open command palette"
                  onClick={() => openCommandPalette()}
                >
                  <Search className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="flex items-center gap-2">
                Search & jump
                <kbd className="pointer-events-none rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                  ⌘K
                </kbd>
              </TooltipContent>
            </Tooltip>

            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 md:hidden"
                  aria-label="Open menu"
                >
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[min(100%,20rem)]">
                <SheetHeader>
                  <SheetTitle className="text-left">Menu</SheetTitle>
                </SheetHeader>
                <nav className="mt-8 flex flex-col gap-1" aria-label="Mobile">
                  {NAV_LINKS.map(({ label, hash }) => (
                    <a
                      key={hash}
                      href={`#${hash}`}
                      className="rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition hover:bg-surface-2 hover:text-foreground"
                      onClick={() => setMobileOpen(false)}
                    >
                      {label}
                    </a>
                  ))}
                  {EXTERNAL_NAV_LINKS.map(({ label, href }) => (
                    <a
                      key={label}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition hover:bg-surface-2 hover:text-foreground"
                      onClick={() => setMobileOpen(false)}
                    >
                      {label}
                    </a>
                  ))}
                  <button
                    type="button"
                    className="mt-2 rounded-lg px-3 py-2.5 text-left text-sm text-muted-foreground transition hover:bg-surface-2 hover:text-foreground"
                    onClick={() => {
                      setMobileOpen(false);
                      openCommandPalette();
                    }}
                  >
                    Command palette…
                  </button>

                  <div className="mt-6 border-t border-border pt-6">
                    <div className="px-3 mb-2 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                      Connect here
                    </div>
                    <div className="flex flex-col gap-1">
                      <a
                        href="https://www.npmjs.com/package/reality-map"
                        target="_blank"
                        rel="noreferrer noopener"
                        className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition hover:bg-surface-2 hover:text-foreground"
                        onClick={() => setMobileOpen(false)}
                      >
                        <Package className="h-4 w-4" />
                        npm Package
                      </a>
                      <a
                        href="https://github.com/g0GobliN/reality-map"
                        target="_blank"
                        rel="noreferrer noopener"
                        className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition hover:bg-surface-2 hover:text-foreground"
                        onClick={() => setMobileOpen(false)}
                      >
                        <Github className="h-4 w-4" /> GitHub Repository
                      </a>
                      <a
                        href="https://instagram.com/gobblin01_"
                        target="_blank"
                        rel="noreferrer noopener"
                        className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition hover:bg-surface-2 hover:text-foreground"
                        onClick={() => setMobileOpen(false)}
                      >
                        <Instagram className="h-4 w-4" /> Instagram
                      </a>
                    </div>
                  </div>
                </nav>
              </SheetContent>
            </Sheet>

            <a
              href="https://www.npmjs.com/package/reality-map"
              target="_blank"
              rel="noreferrer noopener"
              className="hidden sm:flex h-9 items-center gap-1.5 rounded-md px-2 text-sm text-muted-foreground transition hover:text-foreground"
            >
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">npm</span>
            </a>
            <a
              href="https://github.com/g0GobliN/reality-map"
              target="_blank"
              rel="noreferrer noopener"
              className="hidden sm:flex h-9 items-center gap-1.5 rounded-md px-2 text-sm text-muted-foreground transition hover:text-foreground"
            >
              <Github className="h-4 w-4" />
              <span className="hidden sm:inline">Star</span>
            </a>
            <a
              href="https://instagram.com/gobblin01_"
              target="_blank"
              rel="noreferrer noopener"
              className="hidden sm:flex h-9 items-center gap-1.5 rounded-md px-2 text-sm text-muted-foreground transition hover:text-foreground"
            >
              <Instagram className="h-4 w-4" />
              <span className="hidden sm:inline">Instagram</span>
            </a>
            <Button
              type="button"
              size="sm"
              className="h-9 shrink-0 rounded-md bg-foreground text-background hover:bg-foreground/90"
              asChild
            >
              <a href="/demo/">Open map</a>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
