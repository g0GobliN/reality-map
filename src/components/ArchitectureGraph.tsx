import { useMemo } from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
} from "reactflow";
import {
  Globe, Server, ShieldCheck, Database, Container, Boxes,
  Cpu, GitBranch, AlertTriangle, FlameKindling,
} from "lucide-react";

type NData = {
  label: string;
  sub?: string;
  Icon: React.ComponentType<{ className?: string }>;
  tone?: "cyan" | "violet" | "amber" | "rose" | "emerald";
  badge?: string;
  warn?: boolean;
};

const toneMap: Record<NonNullable<NData["tone"]>, string> = {
  cyan: "from-cyan/30 to-cyan/5 text-cyan border-cyan/40",
  violet: "from-violet/30 to-violet/5 text-violet border-violet/40",
  amber: "from-amber/30 to-amber/5 text-amber border-amber/40",
  rose: "from-rose/30 to-rose/5 text-rose border-rose/40",
  emerald: "from-emerald/30 to-emerald/5 text-emerald border-emerald/40",
};

function ModuleNode({ data }: NodeProps<NData>) {
  const { Icon } = data;
  const tone = data.tone ?? "cyan";
  return (
    <div className={`group relative w-[200px] rounded-xl border bg-gradient-to-b ${toneMap[tone]} p-px shadow-[0_10px_40px_-10px_rgba(0,0,0,0.6)]`}>
      <div className="rounded-[11px] glass-strong p-3">
        <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-0 !bg-foreground/40" />
        <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-0 !bg-foreground/40" />
        <div className="flex items-center gap-2">
          <span className={`grid h-8 w-8 place-items-center rounded-lg border border-border/60 bg-background/60`}>
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-foreground">{data.label}</div>
            {data.sub && (
              <div className="truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {data.sub}
              </div>
            )}
          </div>
          {data.warn && (
            <span className="ml-auto grid h-6 w-6 place-items-center rounded-md border border-rose/40 bg-rose/15 text-rose animate-pulse-glow">
              <AlertTriangle className="h-3.5 w-3.5" />
            </span>
          )}
        </div>
        {data.badge && (
          <div className="mt-2 flex items-center justify-between">
            <span className="font-mono text-[10px] text-muted-foreground">{data.badge}</span>
            <span className="h-1.5 w-1.5 rounded-full bg-foreground/40" />
          </div>
        )}
      </div>
    </div>
  );
}

const nodeTypes = { mod: ModuleNode };

export function ArchitectureGraph({ compact = false }: { compact?: boolean }) {
  const { nodes, edges } = useMemo(() => {
    const nodes: Node<NData>[] = [
      { id: "web", type: "mod", position: { x: 40, y: 40 }, data: { label: "web/", sub: "Next.js · 14 routes", Icon: Globe, tone: "cyan", badge: "42 files" } },
      { id: "ui", type: "mod", position: { x: 40, y: 180 }, data: { label: "ui/components", sub: "design system", Icon: Boxes, tone: "cyan", badge: "118 files" } },
      { id: "api", type: "mod", position: { x: 360, y: 40 }, data: { label: "api/", sub: "edge functions", Icon: Server, tone: "violet", badge: "23 routes" } },
      { id: "auth", type: "mod", position: { x: 360, y: 200 }, data: { label: "auth/", sub: "session · oauth", Icon: ShieldCheck, tone: "violet", badge: "JWT · OAuth" } },
      { id: "core", type: "mod", position: { x: 360, y: 360 }, data: { label: "core/utils", sub: "circular dep", Icon: GitBranch, tone: "rose", badge: "cycle: 4 nodes", warn: true } },
      { id: "db", type: "mod", position: { x: 700, y: 110 }, data: { label: "db/postgres", sub: "12 tables", Icon: Database, tone: "emerald", badge: "RLS · pgvector" } },
      { id: "worker", type: "mod", position: { x: 700, y: 280 }, data: { label: "workers/", sub: "queue · cron", Icon: Cpu, tone: "amber", badge: "hot: 38%", warn: true } },
      { id: "docker", type: "mod", position: { x: 700, y: 430 }, data: { label: "infra/docker", sub: "5 services", Icon: Container, tone: "cyan", badge: "compose.yml" } },
      { id: "legacy", type: "mod", position: { x: 40, y: 360 }, data: { label: "legacy/v1", sub: "dead code", Icon: FlameKindling, tone: "rose", badge: "0 imports", warn: true } },
    ];

    const e = (id: string, source: string, target: string, tone: "cyan" | "violet" | "amber" | "rose" = "cyan", animated = true): Edge => ({
      id, source, target, animated,
      style: {
        stroke: `var(--${tone})`,
        strokeWidth: 1.4,
        filter: `drop-shadow(0 0 6px var(--${tone}))`,
      },
      type: "smoothstep",
    });

    const edges: Edge[] = [
      e("e1", "web", "api", "cyan"),
      e("e2", "web", "ui", "cyan", false),
      e("e3", "api", "auth", "violet"),
      e("e4", "api", "db", "violet"),
      e("e5", "auth", "db", "violet"),
      e("e6", "api", "worker", "amber"),
      e("e7", "worker", "db", "amber"),
      e("e8", "docker", "worker", "cyan", false),
      e("e9", "docker", "db", "cyan", false),
      e("e10", "core", "api", "rose"),
      e("e11", "auth", "core", "rose"),
      e("e12", "ui", "core", "rose"),
    ];
    return { nodes, edges };
  }, []);

  return (
    <div className={`relative w-full ${compact ? "h-[420px]" : "h-[560px]"} overflow-hidden rounded-2xl glass ring-aurora`}>
      {/* heatmap overlays */}
      <div className="pointer-events-none absolute -left-16 top-40 h-64 w-64 rounded-full bg-rose/20 blur-3xl" />
      <div className="pointer-events-none absolute right-10 top-10 h-56 w-56 rounded-full bg-violet/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-cyan/15 blur-3xl" />

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        proOptions={{ hideAttribution: true }}
        panOnDrag
        zoomOnScroll
        minZoom={0.35}
        maxZoom={1.65}
        nodesDraggable
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color="var(--grid)" />
      </ReactFlow>

      {/* HUD overlay */}
      <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-2">
        <div className="glass rounded-md px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
          <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-emerald animate-pulse-glow align-middle" />
          live · 9 modules · 12 edges
        </div>
      </div>
      <div className="pointer-events-none absolute right-4 top-4 glass rounded-md px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
        complexity 7.4 · 2 cycles
      </div>
      <div className="pointer-events-none absolute bottom-4 left-4 glass rounded-md px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
        ~/acme-platform
      </div>
    </div>
  );
}
