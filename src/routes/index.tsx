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
  Eye,
  MousePointer2,
  Map as MapIcon,
  Compass,
  PackageSearch,
  ShieldAlert,
  Trash2,
  TrendingDown,
  Package,
  Github,
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
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-border glass px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground animate-in fade-in slide-in-from-top-1 duration-500">
              <Sparkles className="h-3 w-3 text-cyan" />v{__APP_VERSION__} · now with interactive
              architecture graphs
            </div>
            <a
              href="https://www.npmjs.com/package/reality-map"
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 rounded-full border border-border glass px-3 py-1 text-[11px] text-muted-foreground transition hover:border-cyan/50 hover:bg-surface-2 hover:text-foreground animate-in fade-in slide-in-from-top-1 duration-500 delay-100"
            >
              <Package className="h-3 w-3" />
              npm package
            </a>
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
              asChild
            >
              <a
                href="https://www.npmjs.com/package/reality-map"
                target="_blank"
                rel="noreferrer noopener"
                className="flex items-center gap-2"
              >
                <Package className="h-4 w-4" />
                <span>npm install</span>
              </a>
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
              <span className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-surface-2">
                <Icon className="h-4 w-4 text-cyan" />
              </span>
              <div className="mt-3 text-sm font-medium">{t}</div>
              <div className="mt-1 text-xs text-muted-foreground">{d}</div>
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
              <RotateCw className="h-3.5 w-3.5" /> cycle highlighted in rose
            </div>
          </div>
        </div>
        <div className="col-span-12 space-y-3 lg:col-span-5">
          {[
            {
              t: "Real-time scanner",
              d: "Re-scan on demand or with --watch; the graph updates live in the browser.",
            },
            {
              t: "Edge-level visibility",
              d: "Hover any node to highlight its edges. Click to lock focus — neighbours glow, everything else fades.",
            },
            {
              t: "Cycle list panel",
              d: "All detected cycles listed by file. Click a cycle entry to highlight the ring in the graph.",
            },
            {
              t: "CI integration",
              d: "Pass --fail-on-cycles to exit 1 on any new circular dependency. Safe for legacy debt — fails only when cycles grow.",
            },
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
              <div className="text-muted-foreground">→ analyzing 128 dependencies…</div>
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

function DependencySection() {
  const packages = [
    { name: "moment", risk: 7.5, tags: ["unused", "deprecated", "outdated (major)"], tone: "rose" },
    { name: "firebase-admin", risk: 5.0, tags: ["high"], tone: "amber" },
    { name: "lodash", risk: 3.5, tags: ["outdated (major)"], tone: "amber" },
    { name: "date-fns", risk: 0, tags: ["safe"], tone: "emerald" },
    { name: "eslint", risk: 0, tags: ["config-only"], tone: "cyan" },
    { name: "uuid", risk: 1.0, tags: ["unused"], tone: "cyan" },
  ] as const;

  const toneTag: Record<string, string> = {
    rose: "text-rose border-rose/40 bg-rose/10",
    amber: "text-amber border-amber/40 bg-amber/10",
    emerald: "text-emerald border-emerald/40 bg-emerald/10",
    cyan: "text-cyan border-cyan/40 bg-cyan/10",
  };

  const summary = [
    { label: "Total", value: "128", color: "text-foreground" },
    { label: "Safe", value: "103", color: "text-emerald" },
    { label: "Medium", value: "17", color: "text-amber" },
    { label: "High Risk", value: "6", color: "text-rose" },
    { label: "Unused", value: "14", color: "text-muted-foreground" },
    { label: "Outdated", value: "21", color: "text-amber" },
    { label: "Deprecated", value: "3", color: "text-violet" },
  ] as const;

  return (
    <Section
      id="dependency-intelligence"
      eyebrow="Dependency Intelligence"
      title={
        <>
          Know exactly what's in <span className="text-gradient">your dependency graph.</span>
        </>
      }
      sub="Local analysis of every package — unused, vulnerable, deprecated, and outdated — without uploading a single file."
    >
      <div className="grid grid-cols-12 gap-6">
        {/* left: package table mockup */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="col-span-12 lg:col-span-7"
        >
          <div className="glass-strong overflow-hidden rounded-2xl">
            {/* summary bar */}
            <div className="flex flex-wrap gap-3 border-b border-border px-5 py-4">
              {summary.map((s) => (
                <div key={s.label} className="flex flex-col items-center">
                  <span className={`font-mono text-lg font-semibold ${s.color}`}>{s.value}</span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {s.label}
                  </span>
                </div>
              ))}
            </div>

            {/* table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {["Package", "Risk", "Status"].map((h) => (
                      <th
                        key={h}
                        className="px-5 py-2.5 text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {packages.map((pkg) => (
                    <tr
                      key={pkg.name}
                      className="border-b border-border/50 transition hover:bg-surface"
                    >
                      <td className="px-5 py-3 font-mono text-[13px] font-medium">{pkg.name}</td>
                      <td className="px-5 py-3">
                        <span
                          className={`font-mono text-sm font-bold ${pkg.risk >= 6 ? "text-rose" : pkg.risk >= 3 ? "text-amber" : pkg.risk > 0 ? "text-amber/70" : "text-emerald"}`}
                        >
                          {pkg.risk > 0 ? pkg.risk.toFixed(1) : "—"}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {pkg.tags.map((tag) => (
                            <span
                              key={tag}
                              className={`inline-flex items-center rounded border px-1.5 py-px font-mono text-[10px] font-semibold ${toneTag[pkg.tone]}`}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* footer hint */}
            <div className="flex items-center justify-between px-5 py-3 font-mono text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald animate-pulse-glow" />
                fully local · no upload
              </span>
              <span>click any row for importing files</span>
            </div>
          </div>

          {/* ecosystem warning */}
          <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-amber/30 bg-amber/5 px-4 py-3">
            <AlertTriangle className="h-4 w-4 flex-none text-amber" />
            <p className="font-mono text-[11px] text-amber">
              Overlapping ecosystems detected —{" "}
              <span className="font-semibold">moment · date-fns · dayjs</span> all installed
            </p>
          </div>
        </motion.div>

        {/* right: feature cards */}
        <div className="col-span-12 grid gap-3 lg:col-span-5">
          {[
            {
              Icon: Trash2,
              t: "Unused package detection",
              d: "Finds declared deps with zero source imports. Distinguishes runtime-unused from config-only (eslint, vite, etc.).",
              tone: "rose",
            },
            {
              Icon: ShieldAlert,
              t: "Vulnerability scoring",
              d: "Runs npm audit locally. Critical → +4 pts. High → +3 pts. Surfaces the worst severity per package.",
              tone: "amber",
            },
            {
              Icon: TrendingDown,
              t: "Outdated with severity",
              d: "Major version behind is flagged amber. Minor is dimmed. Patch is silent — only breaking gaps get noise.",
              tone: "cyan",
            },
            {
              Icon: PackageSearch,
              t: "Risk score per package",
              d: "0–10 score combining vulns, deprecated status, unused, and version gap. Sort by risk to find what to fix first.",
              tone: "violet",
            },
          ].map(({ Icon, t, d, tone }) => (
            <div key={t} className="glass rounded-xl p-4 transition hover:bg-surface-2">
              <div className="flex items-start gap-3">
                <span
                  className={`mt-0.5 grid h-8 w-8 flex-none place-items-center rounded-lg border border-${tone}/40 bg-${tone}/10 text-${tone}`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div>
                  <div className="text-sm font-medium">{t}</div>
                  <div className="mt-1 text-xs text-muted-foreground leading-relaxed">{d}</div>
                </div>
              </div>
            </div>
          ))}

          {/* CLI snippet */}
          <div className="glass-strong rounded-xl p-4">
            <div className="font-mono text-[11px] text-muted-foreground">terminal</div>
            <div className="mt-2 space-y-1 font-mono text-[12px]">
              <div>
                <span className="text-muted-foreground">$</span>{" "}
                <span className="text-foreground">npx reality-map --deps</span>
              </div>
              <div className="text-muted-foreground">
                → moment <span className="text-rose">risk 7.5</span> [unused, deprecated]
              </div>
              <div className="text-muted-foreground">
                → lodash <span className="text-amber">risk 3.5</span> [outdated (major)]
              </div>
              <div className="text-muted-foreground">
                → date-fns <span className="text-emerald">risk 0 </span> [safe]
              </div>
              <div className="mt-2 text-muted-foreground">
                →{" "}
                <span className="text-amber">
                  ⚠ overlapping ecosystems: moment + date-fns + dayjs
                </span>
              </div>
            </div>
          </div>
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
        <CircularSection />
        <DependencySection />
        <LocalFirst />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
