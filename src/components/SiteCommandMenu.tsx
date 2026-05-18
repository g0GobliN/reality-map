"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ClipboardCopy,
  LayoutDashboard,
  Map,
  Sparkles,
  TerminalSquare,
  ThermometerSun,
} from "lucide-react";
import { toast } from "sonner";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { COMMAND_PALETTE_OPEN } from "@/lib/command-palette";
import { scrollToSection } from "@/lib/scroll-to";

const INSTALL_CMD = "npx reality-map";

export function SiteCommandMenu() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  useEffect(() => {
    const onPalette = () => setOpen(true);
    window.addEventListener(COMMAND_PALETTE_OPEN, onPalette);
    return () => window.removeEventListener(COMMAND_PALETTE_OPEN, onPalette);
  }, []);

  const go = useCallback((id: string) => {
    setOpen(false);
    requestAnimationFrame(() => scrollToSection(id));
  }, []);

  const copyInstall = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(INSTALL_CMD);
      toast.success("Copied to clipboard", { description: INSTALL_CMD });
      setOpen(false);
    } catch {
      toast.error("Could not copy", { description: "Select and copy manually." });
    }
  }, []);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search sections, actions, and shortcuts…" />
      <CommandList className="max-h-[min(420px,70vh)]">
        <CommandEmpty>No matches. Try “map”, “install”, or “heatmap”.</CommandEmpty>
        <CommandGroup heading="Navigate">
          <CommandItem onSelect={() => go("product")}>
            <LayoutDashboard className="text-cyan" />
            Product overview
            <CommandShortcut>#product</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => go("architecture")}>
            <Map className="text-violet" />
            Architecture map
            <CommandShortcut>#architecture</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => go("heatmap")}>
            <ThermometerSun className="text-amber" />
            Complexity heatmap
            <CommandShortcut>#heatmap</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => go("changelog")}>
            <Sparkles className="text-rose" />
            Timeline & evolution
            <CommandShortcut>#changelog</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => go("local-first")}>
            <TerminalSquare className="text-emerald" />
            Install & quick start
            <CommandShortcut>#local-first</CommandShortcut>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem onSelect={copyInstall}>
            <ClipboardCopy />
            Copy install command
            <CommandShortcut>⏎</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
