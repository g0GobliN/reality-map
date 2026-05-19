import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
  type NodeMouseHandler,
  type ReactFlowInstance,
  type Viewport,
} from "reactflow";
import {
  Globe,
  Server,
  ShieldCheck,
  Database,
  Container,
  Boxes,
  Cpu,
  GitBranch,
  AlertTriangle,
  FlameKindling,
  Layers,
  ChevronRight,
  LayoutGrid,
  Circle,
  Shuffle,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tone = "cyan" | "violet" | "amber" | "rose" | "emerald";
type Layout = "layered" | "radial" | "force";

type NData = {
  label: string;
  sub?: string;
  Icon: React.ComponentType<{ className?: string }>;
  tone?: Tone;
  badge?: string;
  warn?: boolean;
  dimmed?: boolean;
  highlighted?: boolean;
};

type CData = {
  clusterId: string;
  clusterLabel: string;
  tone: Tone;
  nodeCount: number;
  fileCount: number;
  warnCount: number;
  dimmed?: boolean;
  highlighted?: boolean;
};

type GData = { tone: Tone; width: number; height: number };

// ─── Layouts ──────────────────────────────────────────────────────────────────

const NODE_POSITIONS: Record<Layout, Record<string, { x: number; y: number }>> = {
  layered: {
    web:    { x: 40,  y: 40  },
    ui:     { x: 40,  y: 180 },
    legacy: { x: 40,  y: 360 },
    api:    { x: 360, y: 40  },
    auth:   { x: 360, y: 200 },
    core:   { x: 360, y: 360 },
    db:     { x: 700, y: 110 },
    worker: { x: 700, y: 280 },
    docker: { x: 700, y: 430 },
  },
  radial: {
    // cx=470 cy=240 r=210, 9 nodes, 40° apart starting from top
    web:    { x: 470, y:  30 },  // 270°
    api:    { x: 601, y:  70 },  // 310°
    auth:   { x: 673, y: 203 },  // 350°
    db:     { x: 648, y: 345 },  // 30°
    worker: { x: 537, y: 437 },  // 70°
    docker: { x: 390, y: 437 },  // 110°
    core:   { x: 280, y: 345 },  // 150°
    ui:     { x: 262, y: 203 },  // 190°
    legacy: { x: 333, y:  70 },  // 230°
  },
  force: {
    // organic scatter with cluster proximity
    web:    { x:  60, y:  80 },
    ui:     { x:  90, y: 290 },
    legacy: { x: 180, y: 450 },
    api:    { x: 390, y:  50 },
    auth:   { x: 430, y: 260 },
    core:   { x: 250, y: 370 },
    db:     { x: 670, y: 130 },
    worker: { x: 710, y: 330 },
    docker: { x: 540, y: 470 },
  },
};

// ─── Clusters ─────────────────────────────────────────────────────────────────

type ClusterDef = {
  id: string;
  label: string;
  tone: Tone;
  members: string[];
  collapsedPos: Record<Layout, { x: number; y: number }>;
  groupPos: { x: number; y: number };
  groupSize: { w: number; h: number };
};

const CLUSTERS: ClusterDef[] = [
  {
    id: "c-web",
    label: "web layer",
    tone: "cyan",
    members: ["web", "ui", "legacy"],
    collapsedPos: {
      layered: { x: 40,  y: 190 },
      radial:  { x: 280, y: 180 },
      force:   { x: 100, y: 260 },
    },
    groupPos: { x: 16, y: 16 },
    groupSize: { w: 248, h: 420 },
  },
  {
    id: "c-api",
    label: "api layer",
    tone: "violet",
    members: ["api", "auth", "core"],
    collapsedPos: {
      layered: { x: 360, y: 200 },
      radial:  { x: 430, y: 200 },
      force:   { x: 360, y: 240 },
    },
    groupPos: { x: 336, y: 16 },
    groupSize: { w: 248, h: 420 },
  },
  {
    id: "c-infra",
    label: "infra layer",
    tone: "amber",
    members: ["db", "worker", "docker"],
    collapsedPos: {
      layered: { x: 700, y: 270 },
      radial:  { x: 600, y: 310 },
      force:   { x: 660, y: 290 },
    },
    groupPos: { x: 676, y: 86 },
    groupSize: { w: 248, h: 420 },
  },
];

const MEMBER_TO_CLUSTER = new Map<string, ClusterDef>(
  CLUSTERS.flatMap((c) => c.members.map((m) => [m, c])),
);

// ─── Constants ────────────────────────────────────────────────────────────────

const EDGE_TONES: Tone[] = ["cyan", "violet", "amber", "rose"];

const toneLabel: Record<Tone, string> = {
  cyan: "web", violet: "api", amber: "infra", rose: "cycle", emerald: "db",
};

const toneMap: Record<Tone, string> = {
  cyan:    "from-cyan/30 to-cyan/5 text-cyan border-cyan/40",
  violet:  "from-violet/30 to-violet/5 text-violet border-violet/40",
  amber:   "from-amber/30 to-amber/5 text-amber border-amber/40",
  rose:    "from-rose/30 to-rose/5 text-rose border-rose/40",
  emerald: "from-emerald/30 to-emerald/5 text-emerald border-emerald/40",
};

const LAYOUT_META: Record<Layout, { label: string; Icon: React.ComponentType<{ className?: string }> }> = {
  layered: { label: "layered", Icon: LayoutGrid },
  radial:  { label: "radial",  Icon: Circle    },
  force:   { label: "force",   Icon: Shuffle   },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getEdgeTone(edge: Edge): Tone {
  const stroke = (edge.style?.stroke as string) ?? "";
  for (const t of EDGE_TONES) {
    if (stroke.includes(`--${t}`)) return t;
  }
  return "cyan";
}

function parseFileCount(badge?: string): number {
  const m = badge?.match(/(\d+)\s*(files|routes|tables|services)/);
  return m ? parseInt(m[1]) : 0;
}

function getConnectedNodeIds(nodeId: string, edges: Edge[]): Set<string> {
  const ids = new Set([nodeId]);
  for (const e of edges) {
    if (e.source === nodeId) ids.add(e.target);
    if (e.target === nodeId) ids.add(e.source);
  }
  return ids;
}

// ─── Node components ──────────────────────────────────────────────────────────

function ModuleNode({ data }: NodeProps<NData>) {
  const { Icon } = data;
  const tone = data.tone ?? "cyan";
  return (
    <div
      className={`group relative w-[200px] rounded-xl border bg-gradient-to-b ${toneMap[tone]} p-px shadow-[0_10px_40px_-10px_rgba(0,0,0,0.6)] transition-all duration-300`}
      style={{
        opacity: data.dimmed ? 0.2 : 1,
        filter: data.highlighted ? `drop-shadow(0 0 14px var(--${tone}))` : undefined,
        transform: data.highlighted ? "scale(1.03)" : undefined,
      }}
    >
      <div className="rounded-[11px] glass-strong p-3">
        <Handle type="target" position={Position.Left}  className="!h-2 !w-2 !border-0 !bg-foreground/40" />
        <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-0 !bg-foreground/40" />
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg border border-border/60 bg-background/60">
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

function ClusterNode({ data }: NodeProps<CData>) {
  const tone = data.tone;
  return (
    <div
      className={`relative w-[220px] rounded-xl border bg-gradient-to-b ${toneMap[tone]} p-px shadow-[0_10px_40px_-10px_rgba(0,0,0,0.6)] transition-all duration-300`}
      style={{
        opacity: data.dimmed ? 0.2 : 1,
        filter: `drop-shadow(0 0 ${data.highlighted ? "18px" : "8px"} var(--${tone}))`,
      }}
    >
      <div className="rounded-[11px] glass-strong p-3">
        <Handle type="target" position={Position.Left}  className="!h-2 !w-2 !border-0 !bg-foreground/40" />
        <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-0 !bg-foreground/40" />
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg border border-border/60 bg-background/60">
            <Layers className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-foreground">{data.clusterLabel}</div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {data.nodeCount} modules
            </div>
          </div>
          <span className={`grid h-6 w-6 place-items-center rounded-md border border-${tone}/40 bg-${tone}/15 text-${tone}`}>
            <ChevronRight className="h-3.5 w-3.5" />
          </span>
        </div>
        <div className="mt-2.5 grid grid-cols-2 gap-1.5">
          <div className="rounded-md border border-border/40 bg-background/40 px-2 py-1 text-center">
            <div className="font-mono text-[13px] font-semibold text-foreground">{data.fileCount}</div>
            <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">files</div>
          </div>
          <div className={`rounded-md border px-2 py-1 text-center ${data.warnCount > 0 ? "border-rose/40 bg-rose/10" : "border-border/40 bg-background/40"}`}>
            <div className={`font-mono text-[13px] font-semibold ${data.warnCount > 0 ? "text-rose" : "text-muted-foreground"}`}>
              {data.warnCount}
            </div>
            <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">warn</div>
          </div>
        </div>
        <div className="mt-2 font-mono text-[9px] text-center text-muted-foreground/60">click to expand</div>
      </div>
    </div>
  );
}

function GroupBgNode({ data }: NodeProps<GData>) {
  return (
    <div
      className={`rounded-2xl border border-${data.tone}/15 bg-${data.tone}/[0.04] pointer-events-none`}
      style={{ width: data.width, height: data.height }}
    />
  );
}

const nodeTypes = { mod: ModuleNode, cluster: ClusterNode, group: GroupBgNode };

// ─── Display graph builder ────────────────────────────────────────────────────

function buildDisplayGraph(
  baseNodes: Node<NData>[],
  baseEdges: Edge[],
  collapsedClusters: Set<string>,
  selectedNodeId: string | null,
  hoveredNodeId: string | null,
  activeFilters: Set<Tone>,
  layout: Layout,
  zoomAbstracted: boolean,
) {
  const effectiveCollapsed = zoomAbstracted
    ? new Set(CLUSTERS.map((c) => c.id))
    : collapsedClusters;

  const effectiveId = (id: string): string => {
    const cluster = MEMBER_TO_CLUSTER.get(id);
    return cluster && effectiveCollapsed.has(cluster.id) ? cluster.id : id;
  };

  const edgeMap = new Map<string, Edge>();
  for (const e of baseEdges) {
    if (!activeFilters.has(getEdgeTone(e))) continue;
    const src = effectiveId(e.source);
    const tgt = effectiveId(e.target);
    if (src === tgt) continue;
    const key = `${src}--${tgt}`;
    if (!edgeMap.has(key)) edgeMap.set(key, { ...e, id: key, source: src, target: tgt });
  }
  const routedEdges = Array.from(edgeMap.values());

  const focusId = selectedNodeId ?? hoveredNodeId;
  const connectedNodeIds = focusId ? getConnectedNodeIds(focusId, routedEdges) : null;
  const connectedEdgeKeys = focusId
    ? new Set(routedEdges.filter((e) => e.source === focusId || e.target === focusId).map((e) => e.id))
    : null;

  const displayEdges = routedEdges.map((e) => {
    const connected = connectedEdgeKeys ? connectedEdgeKeys.has(e.id) : true;
    return {
      ...e,
      style: {
        ...e.style,
        opacity:     connectedEdgeKeys && !connected ? 0.08 : 1,
        strokeWidth: connectedEdgeKeys &&  connected ? 2.2  : 1.4,
      },
    };
  });

  const positions = NODE_POSITIONS[layout];
  const displayNodes: Node[] = [];

  for (const cluster of CLUSTERS) {
    if (effectiveCollapsed.has(cluster.id)) {
      const members  = baseNodes.filter((n) => cluster.members.includes(n.id));
      const fileCount = members.reduce((s, n) => s + parseFileCount(n.data.badge), 0);
      const warnCount = members.filter((n) => n.data.warn).length;
      const isConnected = connectedNodeIds ? connectedNodeIds.has(cluster.id) : true;
      displayNodes.push({
        id: cluster.id,
        type: "cluster",
        position: cluster.collapsedPos[layout],
        data: {
          clusterId: cluster.id,
          clusterLabel: cluster.label,
          tone: cluster.tone,
          nodeCount: cluster.members.length,
          fileCount,
          warnCount,
          dimmed:      connectedNodeIds ? !isConnected : false,
          highlighted: connectedNodeIds ?  isConnected : false,
        } satisfies CData,
      });
    } else {
      // Group background only in layered layout
      if (layout === "layered") {
        displayNodes.push({
          id: `bg-${cluster.id}`,
          type: "group",
          position: cluster.groupPos,
          selectable: false,
          draggable: false,
          zIndex: -1,
          data: { tone: cluster.tone, width: cluster.groupSize.w, height: cluster.groupSize.h } satisfies GData,
        });
      }
      for (const n of baseNodes.filter((bn) => cluster.members.includes(bn.id))) {
        const isConnected = connectedNodeIds ? connectedNodeIds.has(n.id) : true;
        displayNodes.push({
          ...n,
          position: positions[n.id] ?? n.position,
          data: {
            ...n.data,
            dimmed:      connectedNodeIds ? !isConnected : false,
            highlighted: connectedNodeIds ?  isConnected : false,
          },
        });
      }
    }
  }

  return { displayNodes, displayEdges };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ArchitectureGraph({ compact = false }: { compact?: boolean }) {
  const [layout, setLayout]                   = useState<Layout>("layered");
  const [collapsedClusters, setCollapsedClusters] = useState<Set<string>>(new Set());
  const [selectedNodeId, setSelectedNodeId]   = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId]     = useState<string | null>(null);
  const [activeFilters, setActiveFilters]     = useState<Set<Tone>>(new Set(EDGE_TONES));
  const [zoomAbstracted, setZoomAbstracted]   = useState(false);
  const rfRef = useRef<ReactFlowInstance | null>(null);
  const prevZoomAbstracted = useRef(false);

  const { baseNodes, baseEdges } = useMemo(() => {
    const e = (id: string, source: string, target: string, tone: Tone = "cyan", animated = true): Edge => ({
      id, source, target, animated,
      style: { stroke: `var(--${tone})`, strokeWidth: 1.4, filter: `drop-shadow(0 0 6px var(--${tone}))` },
      type: "smoothstep",
    });

    const baseNodes: Node<NData>[] = [
      { id: "web",    type: "mod", position: NODE_POSITIONS.layered.web,    data: { label: "web/",         sub: "Next.js · 14 routes", Icon: Globe,         tone: "cyan",    badge: "42 files"       } },
      { id: "ui",     type: "mod", position: NODE_POSITIONS.layered.ui,     data: { label: "ui/components", sub: "design system",      Icon: Boxes,         tone: "cyan",    badge: "118 files"      } },
      { id: "legacy", type: "mod", position: NODE_POSITIONS.layered.legacy, data: { label: "legacy/v1",    sub: "dead code",           Icon: FlameKindling, tone: "rose",    badge: "0 imports",     warn: true } },
      { id: "api",    type: "mod", position: NODE_POSITIONS.layered.api,    data: { label: "api/",          sub: "edge functions",      Icon: Server,        tone: "violet",  badge: "23 routes"      } },
      { id: "auth",   type: "mod", position: NODE_POSITIONS.layered.auth,   data: { label: "auth/",         sub: "session · oauth",    Icon: ShieldCheck,   tone: "violet",  badge: "JWT · OAuth"    } },
      { id: "core",   type: "mod", position: NODE_POSITIONS.layered.core,   data: { label: "core/utils",    sub: "circular dep",       Icon: GitBranch,     tone: "rose",    badge: "cycle: 4 nodes", warn: true } },
      { id: "db",     type: "mod", position: NODE_POSITIONS.layered.db,     data: { label: "db/postgres",   sub: "12 tables",          Icon: Database,      tone: "emerald", badge: "12 tables"      } },
      { id: "worker", type: "mod", position: NODE_POSITIONS.layered.worker, data: { label: "workers/",      sub: "queue · cron",       Icon: Cpu,           tone: "amber",   badge: "hot: 38%",      warn: true } },
      { id: "docker", type: "mod", position: NODE_POSITIONS.layered.docker, data: { label: "infra/docker",  sub: "5 services",         Icon: Container,     tone: "cyan",    badge: "5 services"     } },
    ];

    const baseEdges: Edge[] = [
      e("e1",  "web",    "api",    "cyan"),
      e("e2",  "web",    "ui",     "cyan",   false),
      e("e3",  "api",    "auth",   "violet"),
      e("e4",  "api",    "db",     "violet"),
      e("e5",  "auth",   "db",     "violet"),
      e("e6",  "api",    "worker", "amber"),
      e("e7",  "worker", "db",     "amber"),
      e("e8",  "docker", "worker", "cyan",   false),
      e("e9",  "docker", "db",     "cyan",   false),
      e("e10", "core",   "api",    "rose"),
      e("e11", "auth",   "core",   "rose"),
      e("e12", "ui",     "core",   "rose"),
    ];
    return { baseNodes, baseEdges };
  }, []);

  const { displayNodes, displayEdges } = useMemo(
    () => buildDisplayGraph(baseNodes, baseEdges, collapsedClusters, selectedNodeId, hoveredNodeId, activeFilters, layout, zoomAbstracted),
    [baseNodes, baseEdges, collapsedClusters, selectedNodeId, hoveredNodeId, activeFilters, layout, zoomAbstracted],
  );

  // Smooth fitView after layout/collapse change
  useEffect(() => {
    const t = setTimeout(() => rfRef.current?.fitView({ duration: 550, padding: 0.18 }), 30);
    return () => clearTimeout(t);
  }, [layout, collapsedClusters, zoomAbstracted]);

  // Zoom-based abstraction
  const onMoveEnd = useCallback((_: unknown, viewport: Viewport) => {
    const shouldAbstract = viewport.zoom < 0.5;
    if (shouldAbstract !== prevZoomAbstracted.current) {
      prevZoomAbstracted.current = shouldAbstract;
      setZoomAbstracted(shouldAbstract);
      if (shouldAbstract) setSelectedNodeId(null);
    }
  }, []);

  const toggleCluster = useCallback((clusterId: string) => {
    setCollapsedClusters((prev) => {
      const next = new Set(prev);
      if (next.has(clusterId)) next.delete(clusterId); else next.add(clusterId);
      return next;
    });
    setSelectedNodeId(null);
  }, []);

  const switchLayout = useCallback((l: Layout) => {
    setLayout(l);
    setSelectedNodeId(null);
  }, []);

  const onNodeClick = useCallback<NodeMouseHandler>((_, node) => {
    if (node.id.startsWith("c-")) toggleCluster(node.id);
    else setSelectedNodeId((prev) => (prev === node.id ? null : node.id));
  }, [toggleCluster]);

  const onNodeMouseEnter = useCallback<NodeMouseHandler>((_, node) => {
    if (!node.id.startsWith("c-") && !node.id.startsWith("bg-")) setHoveredNodeId(node.id);
  }, []);
  const onNodeMouseLeave = useCallback<NodeMouseHandler>(() => setHoveredNodeId(null), []);
  const onPaneClick = useCallback(() => setSelectedNodeId(null), []);

  const toggleFilter = (tone: Tone) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(tone)) { if (next.size > 1) next.delete(tone); } else next.add(tone);
      return next;
    });
  };

  const selectedLabel = displayNodes.find((n) => n.id === selectedNodeId)?.data?.label;
  const hudLabel = zoomAbstracted
    ? "abstracted · zoom in to expand"
    : selectedNodeId
      ? `focus · ${selectedLabel ?? selectedNodeId}`
      : "live · 9 modules · 12 edges";

  return (
    <div className={`relative w-full ${compact ? "h-[420px]" : "h-[560px]"} overflow-hidden rounded-2xl glass ring-aurora`}>
      {/* ambient glows */}
      <div className="pointer-events-none absolute -left-16 top-40 h-64 w-64 rounded-full bg-rose/20 blur-3xl" />
      <div className="pointer-events-none absolute right-10 top-10 h-56 w-56 rounded-full bg-violet/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-cyan/15 blur-3xl" />

      <ReactFlow
        nodes={displayNodes}
        edges={displayEdges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        proOptions={{ hideAttribution: true }}
        panOnDrag
        zoomOnScroll
        minZoom={0.3}
        maxZoom={1.65}
        nodesDraggable
        onInit={(instance) => { rfRef.current = instance; }}
        onNodeClick={onNodeClick}
        onNodeMouseEnter={onNodeMouseEnter}
        onNodeMouseLeave={onNodeMouseLeave}
        onPaneClick={onPaneClick}
        onMoveEnd={onMoveEnd}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color="var(--grid)" />
      </ReactFlow>

      {/* top-left HUD */}
      <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-2">
        <div className={`glass rounded-md px-2.5 py-1 font-mono text-[11px] transition-colors duration-300 ${zoomAbstracted ? "text-amber" : "text-muted-foreground"}`}>
          <span className={`mr-2 inline-block h-1.5 w-1.5 rounded-full align-middle animate-pulse-glow ${zoomAbstracted ? "bg-amber" : "bg-emerald"}`} />
          {hudLabel}
        </div>
        {!zoomAbstracted && collapsedClusters.size > 0 && (
          <div className="glass rounded-md px-2 py-1 font-mono text-[10px] text-amber">
            {collapsedClusters.size} collapsed
          </div>
        )}
      </div>

      {/* top-right */}
      <div className="pointer-events-none absolute right-4 top-4 glass rounded-md px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
        complexity 7.4 · 2 cycles
      </div>

      {/* bottom-left path */}
      <div className="pointer-events-none absolute bottom-4 left-4 glass rounded-md px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
        ~/acme-platform
      </div>

      {/* Cluster toggles — top-center */}
      <div className="absolute left-1/2 top-4 -translate-x-1/2 flex items-center gap-1.5">
        {CLUSTERS.map((c) => {
          const collapsed = zoomAbstracted || collapsedClusters.has(c.id);
          return (
            <button
              key={c.id}
              onClick={() => !zoomAbstracted && toggleCluster(c.id)}
              className={`flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider transition-all duration-200 ${
                collapsed
                  ? `border-${c.tone}/50 bg-${c.tone}/20 text-${c.tone}`
                  : `border-border/40 bg-surface/60 text-muted-foreground hover:border-${c.tone}/40 hover:text-${c.tone}`
              } ${zoomAbstracted ? "cursor-default opacity-60" : ""}`}
            >
              <Layers className="h-2.5 w-2.5" />
              {c.label}
              <span className="ml-0.5 font-sans text-[9px] opacity-60">{collapsed ? "▸" : "▾"}</span>
            </button>
          );
        })}
      </div>

      {/* Layout switcher — bottom-center */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
        {(Object.entries(LAYOUT_META) as [Layout, typeof LAYOUT_META[Layout]][]).map(([key, { label, Icon }]) => (
          <button
            key={key}
            onClick={() => switchLayout(key)}
            className={`flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider transition-all duration-150 ${
              layout === key
                ? "border-foreground/30 bg-foreground/10 text-foreground"
                : "border-border/40 bg-surface/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-2.5 w-2.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Edge filters — bottom-right */}
      <div className="absolute bottom-4 right-4 flex items-center gap-1.5">
        {EDGE_TONES.map((tone) => (
          <button
            key={tone}
            onClick={() => toggleFilter(tone)}
            className={`rounded-md border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider transition-all duration-150 ${
              activeFilters.has(tone)
                ? `border-${tone}/50 bg-${tone}/15 text-${tone}`
                : "border-border/40 bg-surface/60 text-muted-foreground opacity-40"
            }`}
          >
            {toneLabel[tone]}
          </button>
        ))}
      </div>
    </div>
  );
}
