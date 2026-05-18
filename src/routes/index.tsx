import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Sparkles,
  AlertTriangle,
  RotateCw,
  Activity,
  Boxes,
  GitGraph,
  Layers,
  Network,
  Workflow,
  FileWarning,
  Wand2,
  Clock,
  Eye,
  MousePointer2,
  Map as MapIcon,
  Compass,
} from "lucide-react";
import { Nav } from "@/components/Nav";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { ArchitectureGraph } from "@/components/ArchitectureGraph";
import { CommandBlock } from "@/components/CommandBlock";
import { scrollToSection } from "@/lib/scroll-to";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RealityMap — Visual architecture for AI-generated codebases" },
      {
        name: "description",
        content:
          "RealityMap turns complex AI-generated repositories into interactive visual architecture maps. Run npx reality-map and instantly see your code.",
      },
      { property: "og:title", content: "RealityMap — Understand your AI-generated codebase" },
      {
        property: "og:description",
        content:
          "Google Maps for codebases. Visualize file relationships, dependencies, API flows and complexity hotspots.",
      },
    ],
  }),
  component: Landing,
});

const fade = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 0.8, 0.36, 1] as const } },
};

function Section({
  id,
  eyebrow,
  title,
  sub,
  children,
}: {
  id?: string;
  eyebrow?: string;
  title: React.ReactNode;
  sub?: string;
  children?: React.ReactNode;
}) {
  return (
    <section id={id} className="relative mx-auto max-w-7xl px-6 py-28">
      <motion.div
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.3 }}
        variants={fade}
        className="mb-14 max-w-2xl"
      >
        {eyebrow && (
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border glass px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan animate-pulse-glow" />
            {eyebrow}
          </div>
        )}
        <h2 className="text-balance text-4xl font-semibold tracking-tight md:text-5xl">{title}</h2>
        {sub && <p className="mt-4 text-base text-muted-foreground md:text-lg">{sub}</p>}
      </motion.div>
      {children}
    </section>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="grid-bg absolute inset-0 -z-10" />
      <div
        className="pointer-events-none absolute inset-x-0 -top-40 -z-10 h-[600px]"
        style={{ background: "var(--gradient-aurora)" }}
      />
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-14 px-6 pt-20 pb-28 lg:grid-cols-12 lg:gap-10 lg:pt-28">
        <motion.div initial="hidden" animate="show" variants={fade} className="lg:col-span-5">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border glass px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <Sparkles className="h-3 w-3 text-cyan" />
            v0.4 · for AI-generated repos
          </div>
          <h1 className="text-balance text-5xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
            Understand your <br />
            <span className="text-gradient">AI-generated codebase.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground">
            RealityMap turns complex repositories into interactive visual architecture maps. See
            files, services, APIs and hidden dependencies — in motion, in seconds.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              className="h-11 rounded-lg bg-foreground px-5 text-background hover:bg-foreground/90"
              onClick={() => scrollToSection("local-first")}
            >
              Try local demo <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-lg border-border bg-transparent px-5 hover:bg-surface"
              onClick={() => scrollToSection("architecture")}
            >
              View architecture
            </Button>
          </div>

          <div className="mt-7">
            <CommandBlock />
            <p className="mt-2 font-mono text-[11px] text-muted-foreground">
              opens localhost:4870 — no signup, no upload, fully local.
            </p>
            <p className="mt-1 font-mono text-[11px] text-cyan/80">
              Tip:{" "}
              <kbd className="rounded border border-border/80 bg-surface-2 px-1 py-px font-mono text-[10px]">
                ⌘
              </kbd>
              <kbd className="ml-0.5 rounded border border-border/80 bg-surface-2 px-1 py-px font-mono text-[10px]">
                K
              </kbd>{" "}
              opens the command palette — jump anywhere on the page.
            </p>
          </div>

          <dl className="mt-10 grid grid-cols-3 gap-4 border-t border-border pt-6">
            {[
              ["120k", "files mapped daily"],
              ["8.2s", "avg. scan time"],
              ["100%", "local · zero upload"],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-2xl font-semibold tracking-tight">{k}</dt>
                <dd className="text-xs text-muted-foreground">{v}</dd>
              </div>
            ))}
          </dl>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.15 }}
          className="lg:col-span-7"
        >
          <ArchitectureGraph />
          <div className="mt-3 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <MousePointer2 className="h-3 w-3" /> drag nodes · wheel zoom · pan
            </span>
            <span>render @ 60fps</span>
          </div>
        </motion.div>
      </div>

      {/* logo strip */}
      <div className="mx-auto max-w-7xl px-6 pb-16">
        <div className="scroll-marquee flex items-center justify-between gap-10 border-y border-border py-5 text-xs uppercase tracking-[0.25em] text-muted-foreground">
          {[
            "acme/platform",
            "lattice-ui",
            "northwind-ai",
            "kepler/edge",
            "monolith→mesh",
            "stellar.dev",
          ].map((s) => (
            <span key={s} className="font-mono">
              {s}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProblemSection() {
  const issues = [
    {
      Icon: Layers,
      title: "Duplicated logic",
      body: "The same util reinvented across four folders, each slightly different.",
      tone: "rose",
    },
    {
      Icon: Network,
      title: "Hidden dependencies",
      body: "Modules quietly importing across boundaries you swore were sealed.",
      tone: "violet",
    },
    {
      Icon: Workflow,
      title: "Spaghetti architecture",
      body: "Generated routes calling generated routes calling generated routes.",
      tone: "amber",
    },
    {
      Icon: FileWarning,
      title: "Dead code zones",
      body: "Whole directories no entrypoint has touched in months.",
      tone: "rose",
    },
    {
      Icon: GitGraph,
      title: "Unknown flows",
      body: "Nobody — including the AI — remembers how the auth path actually works.",
      tone: "cyan",
    },
    {
      Icon: Boxes,
      title: "Module sprawl",
      body: "200 components, 40 of which render the same button.",
      tone: "violet",
    },
  ] as const;
  return (
    <Section
      id="product"
      eyebrow="The reality of AI codebases"
      title={
        <>
          Generated fast. <span className="text-gradient">Understood never.</span>
        </>
      }
      sub="AI ships code at a speed humans can't read. Architecture rots invisibly until something breaks in production."
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {issues.map(({ Icon, title, body, tone }) => (
          <motion.div
            key={title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="glass group relative overflow-hidden rounded-2xl p-6 transition hover:bg-surface-2"
          >
            <div
              className={`absolute -right-10 -top-10 h-32 w-32 rounded-full bg-${tone}/15 blur-2xl transition group-hover:scale-125`}
            />
            <span
              className={`relative grid h-10 w-10 place-items-center rounded-lg border border-${tone}/40 bg-${tone}/10 text-${tone}`}
            >
              <Icon className="h-5 w-5" />
            </span>
            <h3 className="mt-4 text-base font-medium">{title}</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
          </motion.div>
        ))}
      </div>
    </Section>
  );
}

function VisualizationSection() {
  return (
    <Section
      id="architecture"
      eyebrow="Architecture visualization"
      title={
        <>
          Every file. Every flow. <span className="text-gradient">In one map.</span>
        </>
      }
      sub="A live, zoomable graph of your project. Click a node to drill in, drag to rearrange, follow the lines to understand the system."
    >
      <div className="grid grid-cols-12 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="col-span-12 lg:col-span-8"
        >
          <ArchitectureGraph compact />
        </motion.div>
        <div className="col-span-12 grid gap-4 lg:col-span-4">
          {[
            { Icon: MapIcon, t: "File relationships", d: "Imports, exports, shared symbols." },
            { Icon: Network, t: "Service topology", d: "Containers, queues, databases, edges." },
            { Icon: GitGraph, t: "Dependency chains", d: "Trace any call from UI to DB." },
            { Icon: Compass, t: "API communication", d: "REST, RPC, websockets — drawn." },
          ].map(({ Icon, t, d }) => (
            <div key={t} className="glass rounded-xl p-4">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-surface-2">
                  <Icon className="h-4 w-4 text-cyan" />
                </span>
                <div>
                  <div className="text-sm font-medium">{t}</div>
                  <div className="text-xs text-muted-foreground">{d}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

function Heatmap() {
  // 16x8 grid heatmap
  const cells = Array.from({ length: 16 * 8 }, (_, i) => {
    const x = i % 16,
      y = Math.floor(i / 16);
    const noise = Math.sin(x * 0.7) * Math.cos(y * 0.9) + Math.sin((x + y) * 0.4);
    const v = (noise + 1.5) / 3; // 0..1
    return v;
  });
  return (
    <Section
      id="heatmap"
      eyebrow="AI complexity heatmap"
      title={
        <>
          See where the code <span className="text-gradient">gets dangerous.</span>
        </>
      }
      sub="Cyclomatic complexity, churn and AI-cluster density — surfaced as colors, not buried in CI."
    >
      <div className="glass-strong relative overflow-hidden rounded-2xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-rose" />
            <span className="text-sm font-medium">complexity_map.json</span>
            <span className="font-mono text-[11px] text-muted-foreground">· src/**</span>
          </div>
          <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
            <span className="h-2 w-6 rounded bg-emerald" /> low
            <span className="h-2 w-6 rounded bg-amber" /> warm
            <span className="h-2 w-6 rounded bg-rose" /> hot
          </div>
        </div>
        <div
          className="mt-6 grid grid-cols-16 gap-1.5"
          style={{ gridTemplateColumns: "repeat(16, minmax(0, 1fr))" }}
        >
          {cells.map((v, i) => {
            const color =
              v > 0.78
                ? "bg-rose"
                : v > 0.6
                  ? "bg-amber"
                  : v > 0.4
                    ? "bg-cyan/70"
                    : v > 0.25
                      ? "bg-cyan/30"
                      : "bg-surface-2";
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.6 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.004, duration: 0.4 }}
                className={`aspect-square rounded-md ${color} ring-1 ring-border/50`}
                style={{ filter: v > 0.7 ? `drop-shadow(0 0 8px var(--rose))` : undefined }}
              />
            );
          })}
        </div>
        <div className="mt-6 grid grid-cols-1 gap-4 border-t border-border pt-5 md:grid-cols-3">
          {[
            { k: "ai-clusters/payment-flow", v: "complexity 9.2", tone: "rose" },
            { k: "auth/session-rotate", v: "complexity 7.8", tone: "amber" },
            { k: "ui/components/forms", v: "duplication 41%", tone: "amber" },
          ].map((r) => (
            <div
              key={r.k}
              className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2 font-mono text-[12px]"
            >
              <span className="truncate text-muted-foreground">{r.k}</span>
              <span className={`text-${r.tone}`}>{r.v}</span>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

function CircularSection() {
  return (
    <Section
      eyebrow="Circular dependency detection"
      title={
        <>
          Cycles, exposed. <span className="text-gradient">Before they explode.</span>
        </>
      }
      sub="RealityMap walks your import graph and surfaces circular paths visually — with the exact files, the exact lines, and a one-click fix proposal."
    >
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-7">
          <div className="glass-strong relative aspect-[16/10] overflow-hidden rounded-2xl">
            <svg viewBox="0 0 600 360" className="absolute inset-0 h-full w-full">
              <defs>
                <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="oklch(0.72 0.20 18)" />
                  <stop offset="1" stopColor="oklch(0.82 0.16 75)" />
                </linearGradient>
              </defs>
              {/* circular path */}
              <circle
                cx="300"
                cy="180"
                r="120"
                fill="none"
                stroke="url(#ring)"
                strokeWidth="1.6"
                strokeDasharray="6 8"
                className="animate-flow"
              />
              <circle
                cx="300"
                cy="180"
                r="120"
                fill="none"
                stroke="oklch(0.72 0.20 18 / 0.15)"
                strokeWidth="22"
              />
              {[
                { x: 300, y: 60, label: "auth/session.ts" },
                { x: 420, y: 180, label: "core/utils.ts" },
                { x: 300, y: 300, label: "api/middleware.ts" },
                { x: 180, y: 180, label: "auth/jwt.ts" },
              ].map((n) => (
                <g key={n.label}>
                  <circle cx={n.x} cy={n.y} r="9" fill="oklch(0.72 0.20 18)" />
                  <circle cx={n.x} cy={n.y} r="16" fill="none" stroke="oklch(0.72 0.20 18 / 0.5)" />
                  <text
                    x={n.x + 18}
                    y={n.y + 4}
                    fill="currentColor"
                    className="fill-foreground"
                    fontSize="11"
                    fontFamily="ui-monospace, monospace"
                  >
                    {n.label}
                  </text>
                </g>
              ))}
            </svg>
            <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-md border border-rose/40 bg-rose/15 px-2.5 py-1 font-mono text-[11px] text-rose">
              <AlertTriangle className="h-3.5 w-3.5" /> cycle detected · 4 files
            </div>
            <div className="absolute right-4 bottom-4 inline-flex items-center gap-2 rounded-md glass px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
              <RotateCw className="h-3.5 w-3.5" /> auto-resolved suggestion ready
            </div>
          </div>
        </div>
        <div className="col-span-12 space-y-3 lg:col-span-5">
          {[
            { t: "Real-time scanner", d: "Re-scans on save with incremental graph diffs." },
            {
              t: "Exact-line traces",
              d: "Click an edge — jump to the import that closed the loop.",
            },
            { t: "Refactor proposals", d: "Suggested seam to break the cycle, generated locally." },
            { t: "CI integration", d: "Fail builds on new cycles, not on legacy debt." },
          ].map((f) => (
            <div key={f.t} className="glass rounded-xl p-5">
              <div className="text-sm font-medium">{f.t}</div>
              <div className="mt-1 text-sm text-muted-foreground">{f.d}</div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

function EvolutionSection() {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"];
  const data = [12, 18, 26, 31, 44, 58, 72, 96, 121, 158];
  const max = Math.max(...data);
  return (
    <Section
      id="changelog"
      eyebrow="Time evolution"
      title={
        <>
          Watch your codebase <span className="text-gradient">grow up.</span>
        </>
      }
      sub="Replay architecture history week by week. See when complexity spiked, who shipped it, and what it touched."
    >
      <div className="glass-strong rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-cyan" />
            <span className="text-sm font-medium">timeline · 2025</span>
          </div>
          <div className="font-mono text-[11px] text-muted-foreground">modules over time</div>
        </div>
        <div className="mt-6 grid grid-cols-10 items-end gap-3 h-56">
          {data.map((v, i) => (
            <motion.div
              key={i}
              initial={{ height: 0, opacity: 0 }}
              whileInView={{ height: `${(v / max) * 100}%`, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.05 }}
              className="relative w-full rounded-md bg-linear-to-t from-cyan/30 to-violet/60 ring-1 ring-border"
              style={{
                filter: i >= 7 ? "drop-shadow(0 0 12px oklch(0.72 0.19 295 / 0.45))" : undefined,
              }}
            >
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 font-mono text-[10px] text-muted-foreground">
                {v}
              </div>
            </motion.div>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-10 gap-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {months.map((m) => (
            <div key={m} className="text-center">
              {m}
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-border pt-4 font-mono text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-violet" /> AI-generated commits +312%
          </span>
          <span className="mx-2">·</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-rose" /> complexity x4 since Jul
          </span>
        </div>
      </div>
    </Section>
  );
}

function LocalFirst() {
  return (
    <Section
      id="local-first"
      eyebrow="Local-first workflow"
      title={
        <>
          One command. <span className="text-gradient">Your whole map.</span>
        </>
      }
      sub="No cloud upload. No source code leaves your machine. Run it in any repo — JavaScript, Python, Go, or polyglot."
    >
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-5">
          <div className="glass-strong rounded-2xl p-6">
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-rose/70" />
              <span className="h-3 w-3 rounded-full bg-amber/70" />
              <span className="h-3 w-3 rounded-full bg-emerald/70" />
              <span className="ml-3 font-mono text-[11px] text-muted-foreground">
                ~/acme-platform
              </span>
            </div>
            <div className="mt-5 space-y-2 font-mono text-[13px] leading-relaxed">
              <div>
                <span className="text-muted-foreground">$</span>{" "}
                <span className="text-foreground">npx reality-map</span>
              </div>
              <div className="text-muted-foreground">→ scanning 4,128 files…</div>
              <div className="text-muted-foreground">→ resolving import graph…</div>
              <div className="text-muted-foreground">→ detecting 2 circular paths</div>
              <div className="text-cyan">✓ map ready in 8.2s</div>
              <div className="text-muted-foreground">→ opening http://localhost:4870</div>
              <div className="mt-3 inline-flex items-center gap-2 rounded-md border border-emerald/40 bg-emerald/10 px-2 py-1 text-emerald">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald animate-pulse-glow" />
                live · watching for changes
              </div>
            </div>
          </div>
        </div>
        <div className="col-span-12 grid grid-cols-1 gap-4 lg:col-span-7 sm:grid-cols-2">
          {[
            {
              Icon: Eye,
              t: "Zero upload",
              d: "Everything stays on your machine. No telemetry by default.",
            },
            {
              Icon: Wand2,
              t: "Polyglot aware",
              d: "Understands TS, Python, Go, Rust and Docker topology.",
            },
            {
              Icon: Activity,
              t: "Hot reload graph",
              d: "Edit a file, watch the map redraw in real time.",
            },
            { Icon: Layers, t: "Drillable", d: "Folder → file → function → exact import line." },
          ].map(({ Icon, t, d }) => (
            <div key={t} className="glass rounded-xl p-5 transition hover:bg-surface-2">
              <span className="grid h-10 w-10 place-items-center rounded-lg border border-border bg-surface-2">
                <Icon className="h-4 w-4 text-cyan" />
              </span>
              <div className="mt-4 text-sm font-medium">{t}</div>
              <div className="mt-1 text-sm text-muted-foreground">{d}</div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

function FinalCTA() {
  return (
    <section className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ background: "var(--gradient-aurora)" }}
      />
      <div className="mx-auto max-w-5xl px-6 py-32 text-center">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-balance text-5xl font-semibold tracking-tight md:text-6xl"
        >
          See what your codebase <br className="hidden md:block" />
          <span className="text-gradient">actually became.</span>
        </motion.h2>
        <p className="mx-auto mt-5 max-w-xl text-muted-foreground">
          One command. No signup. Open your reality.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <CommandBlock />
          <Button
            type="button"
            className="h-11 rounded-lg bg-foreground px-5 text-background hover:bg-foreground/90"
            onClick={() => scrollToSection("local-first")}
          >
            Open live demo <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-6 py-10 md:flex-row md:items-center">
        <Logo />
        <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm text-muted-foreground">
          {["Docs", "Changelog", "GitHub", "Discord", "Privacy"].map((l) => (
            <a key={l} href="#" className="transition hover:text-foreground">
              {l}
            </a>
          ))}
        </div>
        <div className="font-mono text-[11px] text-muted-foreground">
          © 2026 RealityMap · local-first
        </div>
      </div>
    </footer>
  );
}

function Landing() {
  return (
    <div className="min-h-screen">
      <Nav />
      <main>
        <Hero />
        <ProblemSection />
        <VisualizationSection />
        <Heatmap />
        <CircularSection />
        <EvolutionSection />
        <LocalFirst />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
