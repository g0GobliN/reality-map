#!/usr/bin/env node
/* eslint-disable */
import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const ROOT = path.resolve(__dirname, "..");
const PKG_PUBLIC = path.join(ROOT, "packages", "reality-map", "public");
const OUT_DIR = path.join(ROOT, "public", "demo");

const INTERCEPTOR_SCRIPT = `<script>
(function () {
  var MOCK = window.MOCK_DATA;
  if (!MOCK) return;
  var _origFetch = window.fetch.bind(window);
  function jsonResp(data, status) {
    return new Response(JSON.stringify(data), { status: status || 200, headers: { "content-type": "application/json" } });
  }
  function _resolveSpec(fromFile, spec, allFiles) {
    if (!spec.startsWith(".") && !spec.startsWith("/")) return null;
    var fromDir = fromFile.split("/").slice(0, -1).join("/");
    var base = _joinPosix(fromDir, spec);
    var exts = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".vue", ".svelte"];
    var candidates = [base];
    for (var i = 0; i < exts.length; i++) { candidates.push(base + exts[i]); candidates.push(base + "/index" + exts[i]); }
    var fileSet = new Set(allFiles);
    for (var k = 0; k < candidates.length; k++) if (fileSet.has(candidates[k])) return candidates[k];
    return null;
  }
  function _joinPosix(dir, rel) {
    var parts = (dir + "/" + rel).split("/"), out = [];
    for (var i = 0; i < parts.length; i++) { if (parts[i] === "..") out.pop(); else if (parts[i] !== ".") out.push(parts[i]); }
    return out.join("/");
  }
  function _computeImpact(scan, changedPaths) {
    var fd = scan.fileDetails || {}, importsMap = fd.imports || {}, locMap = fd.loc || {}, allFiles = scan.scannedFilePaths || [];
    var importedBy = new Map();
    for (var i = 0; i < allFiles.length; i++) {
      var file = allFiles[i], data = importsMap[file]; if (!data) continue;
      var specs = data.specs || [];
      for (var j = 0; j < specs.length; j++) { var r = _resolveSpec(file, specs[j], allFiles); if (!r) continue; if (!importedBy.has(r)) importedBy.set(r, new Set()); importedBy.get(r).add(file); }
    }
    var changed = new Set(changedPaths.map(function(p){return p.replace(/\\\\/g,"/");})), visited = new Set(changed), queue = Array.from(changed);
    var directDeps = new Set(), transitiveDeps = new Set(), depthMap = new Map();
    changed.forEach(function(c){depthMap.set(c,0);});
    while (queue.length > 0) {
      var f = queue.shift(), cur = depthMap.get(f)||0, deps = importedBy.get(f)||new Set();
      deps.forEach(function(dep){ if(visited.has(dep))return; visited.add(dep); depthMap.set(dep,cur+1); if(cur===0)directDeps.add(dep); else transitiveDeps.add(dep); queue.push(dep); });
    }
    var affected = [];
    visited.forEach(function(file){ if(changed.has(file))return; var d=depthMap.get(file)||1,loc=locMap[file]||0,ic=(importedBy.get(file)||new Set()).size; var risk=Math.round(Math.max(1,Math.min(10,(10/d)*0.6+(Math.min(loc,500)/500)*2+(ic>5?2:0)))); affected.push({path:file,depth:d,loc:loc,risk:risk,direct:directDeps.has(file)}); });
    affected.sort(function(a,b){return b.risk-a.risk||a.depth-b.depth;});
    var mi=new Map(); affected.forEach(function(f){var parts=f.path.split("/"),mod=(parts[0]==="src"||parts[0]==="app")?parts.slice(0,2).join("/"):(parts[0]||"(root)"); if(!mi.has(mod))mi.set(mod,{module:mod,files:0,maxRisk:0}); var m=mi.get(mod);m.files++;m.maxRisk=Math.max(m.maxRisk,f.risk);});
    return {changed:Array.from(changed),totalAffected:affected.length,directCount:directDeps.size,transitiveCount:transitiveDeps.size,affected:affected.slice(0,200),moduleImpact:Array.from(mi.values()).sort(function(a,b){return b.maxRisk-a.maxRisk;}),riskLevel:affected.length===0?"none":affected.some(function(f){return f.risk>=8;})?"high":affected.some(function(f){return f.risk>=5;})?"medium":"low"};
  }
  window.fetch = function(url, opts) {
    try {
      var u=(typeof url==="string")?url:(url&&url.url?url.url:String(url)), parsed=new URL(u,location.href), p=parsed.pathname, s=parsed.searchParams, m=(opts&&opts.method?opts.method:"GET").toUpperCase();
      if(p==="/api/meta") return Promise.resolve(jsonResp(MOCK.meta));
      if(p==="/api/graph") return Promise.resolve(jsonResp(MOCK.graph));
      if(p==="/api/health") return Promise.resolve(jsonResp(MOCK.health));
      if(p==="/api/deadcode") return Promise.resolve(jsonResp(MOCK.deadcode));
      if(p==="/api/deps") return Promise.resolve(jsonResp(MOCK.deps));
      if(p==="/api/unreachable") return Promise.resolve(jsonResp(MOCK.unreachable[s.get("src")||"src"]||{unreachable:[]}));
      if(p==="/api/search"){var q=(s.get("q")||"").toLowerCase(),lim=Math.max(1,Math.min(200,Number(s.get("limit")||50))),idx=(MOCK.graph.insights&&MOCK.graph.insights.filesIndex)||[];return Promise.resolve(jsonResp({q:q,results:!q?[]:idx.filter(function(f){return f.path.toLowerCase().includes(q);}).slice(0,lim)}));}
      if(p.startsWith("/api/file/")){var fp=decodeURIComponent(p.slice(10)),det=MOCK.graph.fileDetails||{};return Promise.resolve(jsonResp({path:fp,imports:(det.imports&&det.imports[fp])||{specs:[],details:[]},symbols:(det.symbols&&det.symbols[fp])||[],loc:(det.loc&&det.loc[fp])||0,lastModified:(det.lastModified&&det.lastModified[fp])||0}));}
      if(p.startsWith("/api/preview/")){var pp=decodeURIComponent(p.slice(13));return Promise.resolve(jsonResp({lines:MOCK.previews[pp]||""}));}
      if(p.startsWith("/api/module/")){var parts=p.split("/");if(parts.length>=5&&parts[4]==="files"){var mid=decodeURIComponent(parts[3]),depth=Number(s.get("depth")||1),g=(MOCK.graph.graphsByDepth&&MOCK.graph.graphsByDepth[depth])||MOCK.graph,node=g.nodes&&g.nodes.find(function(n){return n.id===mid;});if(!node)return Promise.resolve(jsonResp({error:"module not found"},404));var fdd=MOCK.graph.fileDetails||{},files=(node.allPaths||node.pathsPreview||[]).map(function(pp){return{path:pp,symbols:(fdd.symbols&&fdd.symbols[pp])||[],loc:(fdd.loc&&fdd.loc[pp])||0,issues:(node.fileIssues&&node.fileIssues[pp])||[]};});return Promise.resolve(jsonResp({module:mid,files:files}));}}
      if(p==="/api/impact"&&m==="POST"){try{var body=opts&&opts.body?JSON.parse(opts.body):{},paths=Array.isArray(body.paths)?body.paths:(body.path?[body.path]:[]);if(!paths.length)return Promise.resolve(jsonResp({error:"paths array required"},400));return Promise.resolve(jsonResp(_computeImpact(MOCK.graph,paths)));}catch(e){return Promise.resolve(jsonResp({error:String(e.message)},500));}}
      if(p==="/api/rescan"&&m==="POST") return new Promise(function(res){setTimeout(function(){res(jsonResp(MOCK.graph));},600);});
    } catch(e) {}
    return _origFetch(url, opts);
  };
})();
</script>`;

async function main() {
  console.log("📡 Synthesizing Enterprise Architecture Showcase...");

  const allFiles = [
    // storefront
    "apps/storefront/src/pages/index.tsx",
    "apps/storefront/src/components/ProductGrid.tsx",
    "apps/storefront/src/hooks/useCart.ts",
    "apps/storefront/package.json",
    // admin-dashboard
    "apps/admin-dashboard/src/pages/Dashboard.tsx",
    "apps/admin-dashboard/src/components/AnalyticsChart.tsx",
    "apps/admin-dashboard/package.json",
    // api-gateway
    "services/api-gateway/src/main.ts",
    "services/api-gateway/src/middleware/auth.ts",
    "services/api-gateway/src/controllers/gateway.controller.ts",
    "services/api-gateway/package.json",
    // auth-service
    "services/auth-service/main.go",
    "services/auth-service/token/jwt.go",
    "services/auth-service/db/session.go",
    "services/auth-service/go.mod",
    // payment-service
    "services/payment-service/app.py",
    "services/payment-service/stripe/client.py",
    "services/payment-service/models/invoice.py",
    "services/payment-service/requirements.txt",
    // order-service
    "services/order-service/main.go",
    "services/order-service/go.mod",
    // shared-ui
    "packages/shared-ui/src/Button.tsx",
    "packages/shared-ui/src/Modal.tsx",
    "packages/shared-ui/src/ThemeContext.tsx",
    "packages/shared-ui/package.json",
    // db-client
    "packages/db-client/src/index.ts",
    "packages/db-client/prisma/schema.prisma",
    "packages/db-client/package.json",
    // utils-lib
    "packages/utils-lib/src/lib.rs",
    "packages/utils-lib/src/hash.rs",
    "packages/utils-lib/Cargo.toml",
    // infrastructure
    "infrastructure/terraform/main.tf",
    "infrastructure/terraform/variables.tf",
    "infrastructure/docker/docker-compose.yml",
    // legacy
    "legacy/auth-v1/index.js",
    "legacy/auth-v1/crypto.js",
    "legacy/auth-v1/package.json",
    "legacy/billing-v1/index.js",
    "legacy/billing-v1/paypal.js",
    "legacy/billing-v1/package.json"
  ];

  const nowSec = Math.floor(Date.now() / 1000);

  // Define previews
  const previews = {
    "apps/storefront/src/pages/index.tsx": `import React, { useState, useEffect } from 'react';
import { Button, Modal } from '@enterprise/shared-ui';
import { getProducts } from '../hooks/useCart';
import ProductGrid from '../components/ProductGrid';

export default function StorefrontIndex() {
  const [products, setProducts] = useState([]);
  const [activeModal, setActiveModal] = useState(false);

  useEffect(() => {
    getProducts().then(setProducts);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
      <header className="flex justify-between items-center mb-12">
        <h1 className="text-3xl font-bold tracking-tight">Enterprise Commerce Suite</h1>
        <Button onClick={() => setActiveModal(true)} variant="primary">
          View Cart ({products.length})
        </Button>
      </header>
      <main>
        <ProductGrid items={products} />
      </main>
      <Modal isOpen={activeModal} onClose={() => setActiveModal(false)}>
        <h2>Your Cart Overview</h2>
      </Modal>
    </div>
  );
}`,
    "apps/storefront/src/components/ProductGrid.tsx": `import React from 'react';
import { Button } from '@enterprise/shared-ui';

export default function ProductGrid({ items }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {items.map((item) => (
        <div key={item.id} className="border border-slate-800 rounded-lg p-6 bg-slate-900">
          <h3 className="text-xl font-bold mb-2">{item.name}</h3>
          <p className="text-slate-400 mb-4">{item.description}</p>
          <Button variant="secondary">Add to Bag</Button>
        </div>
      ))}
    </div>
  );
}`,
    "apps/storefront/src/hooks/useCart.ts": `export async function getProducts() {
  const res = await fetch('https://api.enterprise.com/products');
  return res.json();
}

export function useCart() {
  return {
    items: [],
    addItem: () => {}
  };
}`,
    "apps/admin-dashboard/src/pages/Dashboard.tsx": `import React from 'react';
import { Button } from '@enterprise/shared-ui';

export default function Dashboard() {
  return (
    <div className="p-8">
      <h2>Admin Control Center</h2>
      <Button variant="danger">Reset Store State</Button>
    </div>
  );
}`,
    "services/api-gateway/src/main.ts": `import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AuthMiddleware } from './middleware/auth';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(new AuthMiddleware().use);
  await app.listen(3000);
}
bootstrap();`,
    "services/api-gateway/src/middleware/auth.ts": `import { Injectable, NestMiddleware } from '@nestjs/common';
import { Button } from '@enterprise/shared-ui'; // CIRCULAR DEPENDENCY CYCLE CAUSE!

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  use(req: any, res: any, next: () => void) {
    console.log('Authenticating incoming API Gateway traffic...');
    next();
  }
}`,
    "services/api-gateway/src/controllers/gateway.controller.ts": `// HUGE FILE (> 500 LOC)
import { Controller, Get, Post, Body } from '@nestjs/common';
import { PrismaService } from '@enterprise/db-client';

@Controller('gateway')
export class GatewayController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('products')
  async getProducts() {
    return this.prisma.product.findMany();
  }

  // ... 800 more lines of microservice endpoint proxy logic ...
}`,
    "services/auth-service/main.go": `package main

import (
	"fmt"
	"log"
	"net/http"
	"github.com/enterprise/auth-service/token"
	"github.com/enterprise/auth-service/db"
)

func main() {
	db.InitSessionStore()
	http.HandleFunc("/oauth/token", func(w http.ResponseWriter, r *http.Request) {
		client := r.FormValue("client_id")
		secret := r.FormValue("client_secret")
		if !db.ValidateClient(client, secret) {
			http.Error(w, "Unauthorized client", http.StatusUnauthorized)
			return
		}
		t, err := token.GenerateJWT(client)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		fmt.Fprintf(w, \`{"access_token": "%s", "token_type": "Bearer"}\`, t)
	})
	log.Fatal(http.ListenAndServe(":8080", nil))
}`,
    "services/payment-service/app.py": `from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from stripe import StripeClient
from models.invoice import generate_invoice

app = FastAPI(title="Payment Billing Service", version="1.2.0")
client = StripeClient(api_key="sk_live_enterprise_secret")

class ChargeRequest(BaseModel):
    amount: int
    currency: str = "usd"
    source: str

@app.post("/charge")
async def process_charge(req: ChargeRequest):
    try:
        charge = client.charges.create(
            amount=req.amount,
            currency=req.currency,
            source=req.source
        )
        invoice = generate_invoice(charge.id, req.amount)
        return {"status": "success", "charge_id": charge.id, "invoice": invoice}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))`,
    "packages/shared-ui/src/Button.tsx": `// Heavily imported God file (> 500 LOC)
import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
}

export const Button: React.FC<ButtonProps> = ({ variant = 'primary', children, ...props }) => {
  const baseStyle = "px-4 py-2 rounded font-medium transition-colors duration-150";
  const styles = {
    primary: "bg-blue-600 hover:bg-blue-700 text-white",
    secondary: "bg-slate-800 hover:bg-slate-700 text-slate-100",
    danger: "bg-red-600 hover:bg-red-700 text-white"
  };
  return (
    <button className={\`\${baseStyle} \${styles[variant]}\`} {...props}>
      {children}
    </button>
  );
};`,
    "packages/db-client/prisma/schema.prisma": `datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String?
  orders    Order[]
  sessions  Session[]
}

model Order {
  id        String   @id @default(uuid())
  total     Float
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  createdAt DateTime @default(now())
}`,
    "packages/utils-lib/src/lib.rs": `pub mod hash;

pub fn encrypt_aes_gcm(data: &[u8], key: &[u8]) -> Result<Vec<u8>, String> {
    if key.len() != 32 {
        return Err("Invalid AES key length".to_string());
    }
    let mut encrypted = Vec::new();
    for byte in data {
        encrypted.push(byte ^ 0x5A);
    }
    Ok(encrypted)
}`,
    "infrastructure/terraform/main.tf": `provider "aws" {
  region = var.aws_region
}

resource "aws_ecs_cluster" "commerce_suite" {
  name = "enterprise-commerce-suite"
}

resource "aws_rds_cluster" "postgres" {
  cluster_identifier      = "commerce-db-cluster"
  engine                  = "aurora-postgresql"
  database_name           = "commercedb"
  master_username         = "admin"
  master_password         = var.db_password
  backup_retention_period = 7
}`,
    "legacy/auth-v1/crypto.js": `// Deprecated encryption mechanism (isolated/dead code)
const crypto = require('crypto');

function oldMD5Hash(data) {
  // Outdated cryptographical signature
  return crypto.createHash('md5').update(data).digest('hex');
}

module.exports = { oldMD5Hash };`
  };

  // Add dummy previews for everything else
  for (const f of allFiles) {
    if (!previews[f]) {
      previews[f] = `// Mock implementation of ${f}\n// Synthesized for RealityMap Enterprise Showcase\n\nconsole.log("Loading module ${f}...");`;
    }
  }

  // Construct Depth 1
  const g1 = {
    root: "enterprise-commerce-suite",
    generatedAt: new Date().toISOString(),
    stats: { files: allFiles.length, loc: 55500 },
    nodes: [
      {
        id: "apps",
        label: "apps",
        sub: "7 files · 15400 loc",
        tone: "violet",
        warn: false,
        warnMsg: null,
        infoMsg: null,
        isOrphan: false,
        isEntry: true,
        x: 200,
        y: 150,
        files: 7,
        loc: 15400,
        lastModified: nowSec - 3600,
        fanIn: 2,
        fanOut: 3,
        allPaths: allFiles.filter(f => f.startsWith("apps/")),
        pathsPreview: allFiles.filter(f => f.startsWith("apps/")),
        fileIssues: {}
      },
      {
        id: "services",
        label: "services",
        sub: "14 files · 22800 loc",
        tone: "emerald",
        warn: false,
        warnMsg: null,
        infoMsg: null,
        isOrphan: false,
        isEntry: false,
        x: 450,
        y: 150,
        files: 14,
        loc: 22800,
        lastModified: nowSec - 7200,
        fanIn: 3,
        fanOut: 4,
        allPaths: allFiles.filter(f => f.startsWith("services/")),
        pathsPreview: allFiles.filter(f => f.startsWith("services/")),
        fileIssues: {}
      },
      {
        id: "packages",
        label: "packages",
        sub: "10 files · 9600 loc",
        tone: "cyan",
        warn: false,
        warnMsg: null,
        infoMsg: null,
        isOrphan: false,
        isEntry: false,
        x: 300,
        y: 400,
        files: 10,
        loc: 9600,
        lastModified: nowSec - 1800,
        fanIn: 4,
        fanOut: 2,
        allPaths: allFiles.filter(f => f.startsWith("packages/")),
        pathsPreview: allFiles.filter(f => f.startsWith("packages/")),
        fileIssues: {}
      },
      {
        id: "infrastructure",
        label: "infrastructure",
        sub: "3 files · 3200 loc",
        tone: "rose",
        warn: false,
        warnMsg: null,
        infoMsg: null,
        isOrphan: false,
        isEntry: false,
        x: 600,
        y: 400,
        files: 3,
        loc: 3200,
        lastModified: nowSec - 86400,
        fanIn: 1,
        fanOut: 3,
        allPaths: allFiles.filter(f => f.startsWith("infrastructure/")),
        pathsPreview: allFiles.filter(f => f.startsWith("infrastructure/")),
        fileIssues: {}
      },
      {
        id: "legacy",
        label: "legacy",
        sub: "6 files · 4500 loc",
        tone: "amber",
        warn: true,
        warnMsg: "Legacy Code: Outdated components with high dead code exports.",
        infoMsg: "Legacy Code: Deprecated codebase with multiple dead exports.",
        isOrphan: true,
        isEntry: false,
        x: 750,
        y: 200,
        files: 6,
        loc: 4500,
        lastModified: nowSec - 30 * 24 * 3600,
        fanIn: 1,
        fanOut: 0,
        allPaths: allFiles.filter(f => f.startsWith("legacy/")),
        pathsPreview: allFiles.filter(f => f.startsWith("legacy/")),
        fileIssues: {}
      }
    ],
    edges: [
      { id: "e1", source: "apps", target: "services", weight: 4 },
      { id: "e2", source: "apps", target: "packages", weight: 5 },
      { id: "e3", source: "services", target: "packages", weight: 8 },
      { id: "e4", source: "services", target: "legacy", weight: 1 },
      { id: "e5", source: "infrastructure", target: "apps", weight: 2 },
      { id: "e6", source: "infrastructure", target: "services", weight: 3 },
      { id: "e7", source: "packages", target: "services", weight: 2 }, // Cycle!
    ],
    cycles: [["packages", "services"]],
    topExternal: [
      { name: "react", count: 8 },
      { name: "lodash", count: 12 },
      { name: "fastapi", count: 3 }
    ]
  };

  // Construct Depth 2
  const g2 = {
    root: "enterprise-commerce-suite",
    generatedAt: new Date().toISOString(),
    stats: { files: allFiles.length, loc: 55500 },
    nodes: [
      {
        id: "apps/storefront",
        label: "apps/storefront",
        sub: "4 files · 8400 loc",
        tone: "violet",
        warn: false,
        warnMsg: null,
        infoMsg: null,
        isOrphan: false,
        isEntry: true,
        x: 120,
        y: 100,
        files: 4,
        loc: 8400,
        lastModified: nowSec - 3600,
        fanIn: 0,
        fanOut: 2,
        allPaths: allFiles.filter(f => f.startsWith("apps/storefront/")),
        pathsPreview: allFiles.filter(f => f.startsWith("apps/storefront/")),
        fileIssues: {}
      },
      {
        id: "apps/admin-dashboard",
        label: "apps/admin-dashboard",
        sub: "3 files · 7000 loc",
        tone: "violet",
        warn: false,
        warnMsg: null,
        infoMsg: null,
        isOrphan: false,
        isEntry: false,
        x: 220,
        y: 220,
        files: 3,
        loc: 7000,
        lastModified: nowSec - 7200,
        fanIn: 0,
        fanOut: 2,
        allPaths: allFiles.filter(f => f.startsWith("apps/admin-dashboard/")),
        pathsPreview: allFiles.filter(f => f.startsWith("apps/admin-dashboard/")),
        fileIssues: {}
      },
      {
        id: "services/api-gateway",
        label: "services/api-gateway",
        sub: "4 files · 11200 loc",
        tone: "emerald",
        warn: false,
        warnMsg: null,
        infoMsg: null,
        isOrphan: false,
        isEntry: false,
        x: 380,
        y: 100,
        files: 4,
        loc: 11200,
        lastModified: nowSec - 1800,
        fanIn: 2,
        fanOut: 3,
        allPaths: allFiles.filter(f => f.startsWith("services/api-gateway/")),
        pathsPreview: allFiles.filter(f => f.startsWith("services/api-gateway/")),
        fileIssues: {}
      },
      {
        id: "services/auth-service",
        label: "services/auth-service",
        sub: "4 files · 4200 loc",
        tone: "emerald",
        warn: false,
        warnMsg: null,
        infoMsg: null,
        isOrphan: false,
        isEntry: false,
        x: 480,
        y: 70,
        files: 4,
        loc: 4200,
        lastModified: nowSec - 86400,
        fanIn: 1,
        fanOut: 1,
        allPaths: allFiles.filter(f => f.startsWith("services/auth-service/")),
        pathsPreview: allFiles.filter(f => f.startsWith("services/auth-service/")),
        fileIssues: {}
      },
      {
        id: "services/payment-service",
        label: "services/payment-service",
        sub: "4 files · 4800 loc",
        tone: "emerald",
        warn: false,
        warnMsg: null,
        infoMsg: null,
        isOrphan: false,
        isEntry: false,
        x: 580,
        y: 100,
        files: 4,
        loc: 4800,
        lastModified: nowSec - 7200,
        fanIn: 1,
        fanOut: 1,
        allPaths: allFiles.filter(f => f.startsWith("services/payment-service/")),
        pathsPreview: allFiles.filter(f => f.startsWith("services/payment-service/")),
        fileIssues: {}
      },
      {
        id: "services/order-service",
        label: "services/order-service",
        sub: "2 files · 2600 loc",
        tone: "emerald",
        warn: false,
        warnMsg: null,
        infoMsg: null,
        isOrphan: false,
        isEntry: false,
        x: 620,
        y: 200,
        files: 2,
        loc: 2600,
        lastModified: nowSec - 1800,
        fanIn: 1,
        fanOut: 2,
        allPaths: allFiles.filter(f => f.startsWith("services/order-service/")),
        pathsPreview: allFiles.filter(f => f.startsWith("services/order-service/")),
        fileIssues: {}
      },
      {
        id: "packages/shared-ui",
        label: "packages/shared-ui",
        sub: "4 files · 4600 loc",
        tone: "cyan",
        warn: false,
        warnMsg: null,
        infoMsg: "Highly Coupled: Giant module imported by almost all frontends.",
        isOrphan: false,
        isEntry: false,
        x: 280,
        y: 450,
        files: 4,
        loc: 4600,
        lastModified: nowSec - 1800,
        fanIn: 3,
        fanOut: 1,
        allPaths: allFiles.filter(f => f.startsWith("packages/shared-ui/")),
        pathsPreview: allFiles.filter(f => f.startsWith("packages/shared-ui/")),
        fileIssues: {}
      },
      {
        id: "packages/db-client",
        label: "packages/db-client",
        sub: "3 files · 3200 loc",
        tone: "cyan",
        warn: false,
        warnMsg: null,
        infoMsg: null,
        isOrphan: false,
        isEntry: false,
        x: 420,
        y: 480,
        files: 3,
        loc: 3200,
        lastModified: nowSec - 1800,
        fanIn: 3,
        fanOut: 0,
        allPaths: allFiles.filter(f => f.startsWith("packages/db-client/")),
        pathsPreview: allFiles.filter(f => f.startsWith("packages/db-client/")),
        fileIssues: {}
      },
      {
        id: "packages/utils-lib",
        label: "packages/utils-lib",
        sub: "3 files · 1800 loc",
        tone: "cyan",
        warn: false,
        warnMsg: null,
        infoMsg: null,
        isOrphan: false,
        isEntry: false,
        x: 520,
        y: 420,
        files: 3,
        loc: 1800,
        lastModified: nowSec - 86400,
        fanIn: 2,
        fanOut: 0,
        allPaths: allFiles.filter(f => f.startsWith("packages/utils-lib/")),
        pathsPreview: allFiles.filter(f => f.startsWith("packages/utils-lib/")),
        fileIssues: {}
      },
      {
        id: "infrastructure/terraform",
        label: "infrastructure/terraform",
        sub: "2 files · 2400 loc",
        tone: "rose",
        warn: false,
        warnMsg: null,
        infoMsg: null,
        isOrphan: false,
        isEntry: false,
        x: 720,
        y: 420,
        files: 2,
        loc: 2400,
        lastModified: nowSec - 86400,
        fanIn: 0,
        fanOut: 2,
        allPaths: allFiles.filter(f => f.startsWith("infrastructure/terraform/")),
        pathsPreview: allFiles.filter(f => f.startsWith("infrastructure/terraform/")),
        fileIssues: {}
      },
      {
        id: "infrastructure/docker",
        label: "infrastructure/docker",
        sub: "1 files · 800 loc",
        tone: "rose",
        warn: false,
        warnMsg: null,
        infoMsg: null,
        isOrphan: false,
        isEntry: false,
        x: 800,
        y: 360,
        files: 1,
        loc: 800,
        lastModified: nowSec - 86400,
        fanIn: 0,
        fanOut: 1,
        allPaths: allFiles.filter(f => f.startsWith("infrastructure/docker/")),
        pathsPreview: allFiles.filter(f => f.startsWith("infrastructure/docker/")),
        fileIssues: {}
      },
      {
        id: "legacy/auth-v1",
        label: "legacy/auth-v1",
        sub: "3 files · 2500 loc",
        tone: "amber",
        warn: true,
        warnMsg: "Unreachable / Deprecated module.",
        infoMsg: "Legacy Code: Contains multiple dead exports and old algorithms.",
        isOrphan: true,
        isEntry: false,
        x: 780,
        y: 160,
        files: 3,
        loc: 2500,
        lastModified: nowSec - 45 * 24 * 3600,
        fanIn: 1,
        fanOut: 0,
        allPaths: allFiles.filter(f => f.startsWith("legacy/auth-v1/")),
        pathsPreview: allFiles.filter(f => f.startsWith("legacy/auth-v1/")),
        fileIssues: {}
      },
      {
        id: "legacy/billing-v1",
        label: "legacy/billing-v1",
        sub: "3 files · 2000 loc",
        tone: "amber",
        warn: true,
        warnMsg: "Unreachable / Deprecated module.",
        infoMsg: "Legacy Code: Deprecated billing modules.",
        isOrphan: true,
        isEntry: false,
        x: 850,
        y: 220,
        files: 3,
        loc: 2000,
        lastModified: nowSec - 60 * 24 * 3600,
        fanIn: 0,
        fanOut: 0,
        allPaths: allFiles.filter(f => f.startsWith("legacy/billing-v1/")),
        pathsPreview: allFiles.filter(f => f.startsWith("legacy/billing-v1/")),
        fileIssues: {}
      }
    ],
    edges: [
      { id: "e0", source: "apps/storefront", target: "services/api-gateway", weight: 3 },
      { id: "e1", source: "apps/storefront", target: "packages/shared-ui", weight: 4 },
      { id: "e2", source: "apps/admin-dashboard", target: "services/api-gateway", weight: 2 },
      { id: "e3", source: "apps/admin-dashboard", target: "packages/shared-ui", weight: 3 },
      { id: "e4", source: "services/api-gateway", target: "services/auth-service", weight: 3 },
      { id: "e5", source: "services/api-gateway", target: "services/order-service", weight: 4 },
      { id: "e6", source: "services/api-gateway", target: "packages/db-client", weight: 5 },
      { id: "e7", source: "services/order-service", target: "services/payment-service", weight: 2 },
      { id: "e8", source: "services/order-service", target: "packages/db-client", weight: 3 },
      { id: "e9", source: "services/payment-service", target: "packages/utils-lib", weight: 2 },
      { id: "e10", source: "services/auth-service", target: "packages/utils-lib", weight: 2 },
      { id: "e11", source: "packages/shared-ui", target: "services/api-gateway", weight: 2 }, // Cycle!
      { id: "e12", source: "infrastructure/terraform", target: "packages/db-client", weight: 1 },
      { id: "e13", source: "infrastructure/terraform", target: "services/api-gateway", weight: 1 },
      { id: "e14", source: "infrastructure/docker", target: "services/api-gateway", weight: 1 },
      { id: "e15", source: "legacy/auth-v1", target: "packages/utils-lib", weight: 1 }
    ],
    cycles: [["services/api-gateway", "packages/shared-ui"]],
    topExternal: [
      { name: "react", count: 8 },
      { name: "lodash", count: 12 },
      { name: "fastapi", count: 3 }
    ]
  };

  // Construct Depth 3
  const g3 = {
    root: "enterprise-commerce-suite",
    generatedAt: new Date().toISOString(),
    stats: { files: allFiles.length, loc: 55500 },
    nodes: allFiles.map((f, idx) => {
      const parts = f.split("/");
      const rootDir = parts[0];
      const tone = rootDir === "apps" ? "violet"
        : rootDir === "services" ? "emerald"
        : rootDir === "packages" ? "cyan"
        : rootDir === "infrastructure" ? "rose"
        : "amber";
      
      const isLegacy = rootDir === "legacy";
      const isEntry = f === "apps/storefront/src/pages/index.tsx";
      
      // Calculate dynamic positions seeded in grid-like positions
      const x = 100 + (idx % 10) * 80;
      const y = 80 + Math.floor(idx / 10) * 120;

      return {
        id: f,
        label: f,
        sub: `1 file · ${f.endsWith(".json") || f.endsWith(".toml") || f.endsWith(".txt") || f.endsWith(".mod") ? 20 : 150} loc`,
        tone: tone,
        warn: isLegacy,
        warnMsg: isLegacy ? "Legacy Code component" : null,
        infoMsg: f.includes("gateway.controller.ts") ? "Giant File (> 500 LOC)" : null,
        isOrphan: isLegacy,
        isEntry: isEntry,
        x: x,
        y: y,
        files: 1,
        loc: f.includes("gateway.controller.ts") ? 950 : f.includes("Button.tsx") ? 620 : 150,
        lastModified: isLegacy ? nowSec - 45 * 24 * 3600 : nowSec - 3600,
        fanIn: f.includes("Button.tsx") ? 8 : 1,
        fanOut: 1,
        allPaths: [f],
        pathsPreview: [f],
        fileIssues: {}
      };
    }),
    edges: [
      { id: "e0", source: "apps/storefront/src/pages/index.tsx", target: "packages/shared-ui/src/Button.tsx", weight: 1 },
      { id: "e1", source: "apps/storefront/src/pages/index.tsx", target: "packages/shared-ui/src/Modal.tsx", weight: 1 },
      { id: "e2", source: "apps/storefront/src/pages/index.tsx", target: "apps/storefront/src/hooks/useCart.ts", weight: 1 },
      { id: "e3", source: "apps/storefront/src/components/ProductGrid.tsx", target: "packages/shared-ui/src/Button.tsx", weight: 1 },
      { id: "e4", source: "apps/admin-dashboard/src/pages/Dashboard.tsx", target: "packages/shared-ui/src/Button.tsx", weight: 1 },
      { id: "e5", source: "services/api-gateway/src/main.ts", target: "services/api-gateway/src/middleware/auth.ts", weight: 1 },
      { id: "e6", source: "services/api-gateway/src/middleware/auth.ts", target: "packages/shared-ui/src/Button.tsx", weight: 1 }, // Cycle trigger
      { id: "e7", source: "services/api-gateway/src/controllers/gateway.controller.ts", target: "packages/db-client/src/index.ts", weight: 1 },
      { id: "e8", source: "services/auth-service/main.go", target: "services/auth-service/token/jwt.go", weight: 1 },
      { id: "e9", source: "services/auth-service/main.go", target: "services/auth-service/db/session.go", weight: 1 },
      { id: "e10", source: "services/payment-service/app.py", target: "services/payment-service/models/invoice.py", weight: 1 },
      { id: "e11", source: "services/order-service/main.go", target: "packages/db-client/src/index.ts", weight: 1 }
    ],
    cycles: [["services/api-gateway/src/middleware/auth.ts", "packages/shared-ui/src/Button.tsx"]],
    topExternal: [
      { name: "react", count: 8 },
      { name: "lodash", count: 12 },
      { name: "fastapi", count: 3 }
    ]
  };

  // Compile final graph object
  const graph = {
    root: "enterprise-commerce-suite",
    generatedAt: new Date().toISOString(),
    stats: { files: allFiles.length, loc: 55500 },
    maxDepth: 3,
    scannedFilePaths: allFiles,
    graphsByDepth: {
      "1": g1,
      "2": g2,
      "3": g3
    },
    insights: {
      summary: {
        files: allFiles.length,
        internalEdges: 42,
        externalRefs: 120,
        uniquePackages: 15,
        loc: 55500,
        isolatedInternalFiles: 4,
        isolatedInternalList: [
          { path: "legacy/auth-v1/crypto.js", loc: 450 },
          { path: "legacy/billing-v1/paypal.js", loc: 320 },
          { path: "packages/utils-lib/src/hash.rs", loc: 220 },
          { path: "apps/admin-dashboard/src/components/AnalyticsChart.tsx", loc: 150 }
        ]
      },
      topFilesByLoc: [
        { path: "services/api-gateway/src/controllers/gateway.controller.ts", loc: 950 },
        { path: "packages/db-client/src/index.ts", loc: 680 },
        { path: "packages/shared-ui/src/Button.tsx", loc: 620 },
        { path: "legacy/auth-v1/crypto.js", loc: 450 },
        { path: "legacy/billing-v1/paypal.js", loc: 320 }
      ],
      topImported: [
        { path: "packages/shared-ui/src/Button.tsx", count: 8 },
        { path: "packages/db-client/src/index.ts", count: 5 },
        { path: "packages/shared-ui/src/Modal.tsx", count: 4 }
      ],
      hubs: [
        { path: "packages/shared-ui/src/Button.tsx", in: 8, out: 2 },
        { path: "packages/db-client/src/index.ts", in: 5, out: 1 }
      ],
      zeroInternalImporters: [
        { path: "legacy/auth-v1/crypto.js", loc: 450 },
        { path: "legacy/billing-v1/paypal.js", loc: 320 },
        { path: "packages/utils-lib/src/hash.rs", loc: 220 },
        { path: "apps/admin-dashboard/src/components/AnalyticsChart.tsx", loc: 150 }
      ],
      filesIndex: allFiles.map(f => ({
        path: f,
        loc: f.includes("gateway.controller.ts") ? 950 : f.includes("Button.tsx") ? 620 : 150,
        ext: "." + f.split(".").pop(),
        importers: f.includes("Button.tsx") ? 8 : 1,
        importees: 1
      })),
      filesIndexCap: 100,
      filesIndexTruncated: false,
      externalPackages: [
        { name: "react", count: 8 },
        { name: "lodash", count: 12 },
        { name: "fastapi", count: 3 }
      ],
      dirStats: [
        { dir: "apps", count: 7, loc: 15400 },
        { dir: "services", count: 14, loc: 22800 },
        { dir: "packages", count: 10, loc: 9600 },
        { dir: "infrastructure", count: 3, loc: 3200 },
        { dir: "legacy", count: 6, loc: 4500 }
      ]
    },
    fileDetails: {
      imports: {
        "apps/storefront/src/pages/index.tsx": {
          specs: ["packages/shared-ui/src/Button.tsx", "packages/shared-ui/src/Modal.tsx", "apps/storefront/src/hooks/useCart.ts"],
          details: [
            { spec: "packages/shared-ui/src/Button.tsx", line: 2, statement: "import { Button } from '@enterprise/shared-ui'" },
            { spec: "packages/shared-ui/src/Modal.tsx", line: 2, statement: "import { Modal } from '@enterprise/shared-ui'" }
          ]
        },
        "services/api-gateway/src/middleware/auth.ts": {
          specs: ["packages/shared-ui/src/Button.tsx"],
          details: [
            { spec: "packages/shared-ui/src/Button.tsx", line: 2, statement: "import { Button } from '@enterprise/shared-ui'" }
          ]
        }
      },
      symbols: {
        "apps/storefront/src/pages/index.tsx": [
          { type: "function", name: "StorefrontIndex", line: 6 }
        ],
        "services/auth-service/main.go": [
          { type: "function", name: "main", line: 10 }
        ],
        "services/payment-service/app.py": [
          { type: "function", name: "process_charge", line: 16 }
        ],
        "packages/shared-ui/src/Button.tsx": [
          { type: "const", name: "Button", line: 7 }
        ]
      },
      loc: allFiles.reduce((acc, f) => {
        acc[f] = f.includes("gateway.controller.ts") ? 950 : f.includes("Button.tsx") ? 620 : 150;
        return acc;
      }, {}),
      lastModified: allFiles.reduce((acc, f) => {
        acc[f] = f.startsWith("legacy/") ? nowSec - 45 * 24 * 3600 : nowSec - 3600;
        return acc;
      }, {}),
      resolvedEdges: []
    }
  };

  // Construct Health
  const health = {
    score: 64,
    grade: "D",
    reasons: [
      {
        kind: "cycles",
        count: 2,
        penalty: 12,
        msg: "2 circular dependency cycles detected at depth 2",
        samples: [
          { path: "services/api-gateway <-> packages/shared-ui" },
          { path: "apps/storefront <-> packages/shared-ui" }
        ]
      },
      {
        kind: "isolated",
        count: 4,
        ratio: 0.1,
        penalty: 10,
        msg: "4 isolated file(s) (10%)",
        samples: [
          { path: "legacy/auth-v1/crypto.js", loc: 450 },
          { path: "legacy/billing-v1/paypal.js", loc: 320 },
          { path: "packages/utils-lib/src/hash.rs", loc: 220 }
        ]
      },
      {
        kind: "oversized",
        count: 3,
        penalty: 9,
        msg: "3 file(s) > 500 LOC",
        samples: [
          { path: "services/api-gateway/src/controllers/gateway.controller.ts", loc: 950 },
          { path: "packages/db-client/src/index.ts", loc: 680 },
          { path: "packages/shared-ui/src/Button.tsx", loc: 620 }
        ]
      },
      {
        kind: "god",
        count: 1,
        penalty: 5,
        msg: "1 god file(s) — large AND heavily imported",
        samples: [
          { path: "packages/shared-ui/src/Button.tsx", loc: 620, in: 8 }
        ]
      }
    ]
  };

  // Construct Dead Code candidates
  const deadcode = {
    totalFiles: allFiles.length,
    candidateCount: 4,
    potentialLocSavings: 1140,
    candidates: [
      {
        path: "legacy/auth-v1/crypto.js",
        loc: 450,
        outgoing: 0,
        confidence: 95,
        reason: "no internal importers · marked deprecated · legacy code"
      },
      {
        path: "legacy/billing-v1/paypal.js",
        loc: 320,
        outgoing: 1,
        confidence: 90,
        reason: "no active imports · dead endpoints"
      },
      {
        path: "packages/utils-lib/src/hash.rs",
        loc: 220,
        outgoing: 0,
        confidence: 85,
        reason: "unused module in Rust crate export"
      },
      {
        path: "apps/admin-dashboard/src/components/AnalyticsChart.tsx",
        loc: 150,
        outgoing: 2,
        confidence: 80,
        reason: "no active references in React pages"
      }
    ]
  };

  // Construct Unreachable
  const unreachable = {
    "apps": {
      srcDir: "apps",
      seeds: ["apps/storefront/src/pages/index.tsx"],
      totalFiles: 7,
      reachableCount: 5,
      unreachableCount: 2,
      totalUnreachableBytes: 12400,
      unreachable: [
        { path: "apps/admin-dashboard/src/components/AnalyticsChart.tsx", bytes: 6400, loc: 150 }
      ]
    },
    "services": {
      srcDir: "services",
      seeds: ["services/api-gateway/src/main.ts"],
      totalFiles: 14,
      reachableCount: 14,
      unreachableCount: 0,
      totalUnreachableBytes: 0,
      unreachable: []
    },
    "legacy": {
      srcDir: "legacy",
      seeds: [],
      totalFiles: 6,
      reachableCount: 0,
      unreachableCount: 6,
      totalUnreachableBytes: 25400,
      unreachable: [
        { path: "legacy/auth-v1/index.js", bytes: 8400, loc: 280 },
        { path: "legacy/auth-v1/crypto.js", bytes: 12000, loc: 450 },
        { path: "legacy/billing-v1/index.js", bytes: 3400, loc: 90 },
        { path: "legacy/billing-v1/paypal.js", bytes: 1600, loc: 320 }
      ]
    }
  };

  // Construct Deps
  const deps = {
    available: true,
    packages: [
      {
        name: "lodash",
        type: "dep",
        declaredRange: "^4.17.21",
        installedVersion: "4.17.21",
        description: "A modern JavaScript utility library delivering modularity, performance & extras.",
        isDeprecated: false,
        deprecationMessage: null,
        importCount: 12,
        importingFiles: ["apps/storefront/src/pages/index.tsx", "services/api-gateway/src/main.ts"],
        isUnused: false,
        isConfigOnly: false,
        vulnerabilities: [
          {
            id: "GHSA-35jh-83p4-7cxh",
            severity: "high",
            title: "Prototype Pollution in lodash",
            package: "lodash",
            advisoryUrl: "https://github.com/advisories/GHSA-35jh-83p4-7cxh"
          }
        ],
        outdatedInfo: { current: "4.17.21", wanted: "4.17.21", latest: "4.17.21" },
        outdatedSeverity: "none",
        riskScore: 6.5
      },
      {
        name: "axios",
        type: "dep",
        declaredRange: "^1.6.0",
        installedVersion: "1.6.0",
        description: "Promise based HTTP client for the browser and node.js",
        isDeprecated: false,
        deprecationMessage: null,
        importCount: 4,
        importingFiles: ["apps/storefront/src/hooks/useCart.ts"],
        isUnused: false,
        isConfigOnly: false,
        vulnerabilities: [
          {
            id: "GHSA-42qf-g272-p8gw",
            severity: "moderate",
            title: "Axios Server-Side Request Forgery",
            package: "axios",
            advisoryUrl: "https://github.com/advisories/GHSA-42qf-g272-p8gw"
          }
        ],
        outdatedInfo: { current: "1.6.0", wanted: "1.6.8", latest: "1.7.2" },
        outdatedSeverity: "minor",
        riskScore: 4.8
      }
    ],
    subPackages: [
      {
        name: "enterprise-commerce-suite",
        relPath: "packages/shared-ui",
        packages: [
          {
            name: "react",
            type: "dep",
            declaredRange: "^18.2.0",
            installedVersion: "18.2.0",
            description: "React is a JavaScript library for building user interfaces.",
            isDeprecated: false,
            deprecationMessage: null,
            importCount: 8,
            importingFiles: ["packages/shared-ui/src/Button.tsx", "packages/shared-ui/src/Modal.tsx"],
            isUnused: false,
            isConfigOnly: false,
            vulnerabilities: [],
            outdatedInfo: { current: "18.2.0", wanted: "18.2.0", latest: "18.3.1" },
            outdatedSeverity: "minor",
            riskScore: 2.1
          },
          {
            name: "classnames",
            type: "dep",
            declaredRange: "^2.3.2",
            installedVersion: "2.3.2",
            description: "A simple JavaScript utility for conditionally joining classNames together.",
            isDeprecated: false,
            deprecationMessage: null,
            importCount: 2,
            importingFiles: ["packages/shared-ui/src/Button.tsx"],
            isUnused: false,
            isConfigOnly: false,
            vulnerabilities: [],
            outdatedInfo: { current: "2.3.2", wanted: "2.3.2", latest: "2.3.2" },
            outdatedSeverity: "none",
            riskScore: 1.0
          }
        ],
        summary: {
          total: 2,
          safe: 2,
          mediumRisk: 0,
          highRisk: 0,
          critical: 0,
          high: 0,
          moderate: 0,
          low: 0,
          unused: 0,
          deprecated: 0,
          outdated: 1
        },
        ecosystemWarnings: [],
        auditAvailable: true,
        auditError: null,
        outdatedAvailable: true
      }
    ],
    summary: {
      total: 15,
      safe: 13,
      mediumRisk: 1,
      highRisk: 1,
      critical: 0,
      high: 1,
      moderate: 1,
      low: 0,
      unused: 1,
      deprecated: 0,
      outdated: 4
    },
    ecosystemWarnings: [],
    auditAvailable: true,
    auditError: null,
    outdatedAvailable: true
  };

  const meta = {
    root: "reality-map (live demo)",
    version: "1.4.5",
    watch: false,
    maxDepth: 3,
    generatedAt: new Date().toISOString(),
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log("✍️  Writing mockData.js...");
  const json = JSON.stringify({ meta, graph, health, deadcode, unreachable, deps, previews });
  fs.writeFileSync(path.join(OUT_DIR, "mockData.js"), `window.MOCK_DATA = ${json};`);
  console.log(`   → ${(json.length / 1024).toFixed(0)} KB`);

  console.log("📋 Copying dashboard assets...");
  for (const asset of ["app.js", "styles.css", "logo.PNG"]) {
    fs.copyFileSync(path.join(PKG_PUBLIC, asset), path.join(OUT_DIR, asset));
    console.log(`   → ${asset}`);
  }

  console.log("📄 Generating index.html...");
  let html = fs.readFileSync(path.join(PKG_PUBLIC, "index.html"), "utf8");
  // Fix absolute asset paths to relative
  html = html.replace(/href="\/styles\.css"/g, 'href="styles.css"');
  html = html.replace(/href="\/logo\.PNG"/g, 'href="logo.PNG"');
  html = html.replace(/src="\/logo\.PNG"/g, 'src="logo.PNG"');
  // Inject mockData + interceptor before app.js
  html = html.replace(
    '<script src="/app.js"></script>',
    `<script src="mockData.js"></script>\n${INTERCEPTOR_SCRIPT}\n<script src="app.js"></script>`
  );
  fs.writeFileSync(path.join(OUT_DIR, "index.html"), html);
  console.log(`   → index.html`);

  console.log("✅ public/demo/ is ready.");
}

main().catch((err) => {
  console.error("generate-demo-data failed:", err);
  process.exit(1);
});
