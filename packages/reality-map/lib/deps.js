/* eslint-disable */
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync, spawn } = require("child_process");

// Dev-tool packages that are never imported in source but are valid — don't flag as unused
const SAFE_DEV = new Set([
  "typescript", "eslint", "prettier", "vitest", "jest", "mocha", "jasmine",
  "vite", "webpack", "rollup", "esbuild", "parcel", "turbo", "tsup", "unbuild",
  "postcss", "autoprefixer", "tailwindcss", "sass", "less",
  "ts-node", "tsx", "nodemon", "concurrently", "cross-env", "dotenv-cli",
  "@vitejs/plugin-react", "@vitejs/plugin-vue", "@vitejs/plugin-svelte",
  "eslint-config-prettier", "eslint-plugin-prettier", "eslint-plugin-react-hooks",
  "eslint-plugin-react-refresh", "typescript-eslint", "globals",
  "@eslint/js", "@playwright/test", "@testing-library/react",
]);

const ECOSYSTEM_GROUPS = [
  { kind: "date-library",     label: "Multiple date libraries",        packages: ["moment", "date-fns", "dayjs", "luxon", "sugar-date"] },
  { kind: "http-client",      label: "Multiple HTTP client libraries",  packages: ["axios", "ky", "got", "superagent", "node-fetch", "undici", "ofetch"] },
  { kind: "state-management", label: "Multiple state management libs",  packages: ["redux", "zustand", "mobx", "jotai", "recoil", "valtio", "xstate", "@reduxjs/toolkit"] },
  { kind: "form-library",     label: "Multiple form libraries",         packages: ["react-hook-form", "formik", "react-final-form", "@tanstack/react-form"] },
  { kind: "css-in-js",        label: "Multiple CSS-in-JS libraries",    packages: ["styled-components", "@emotion/react", "@emotion/styled", "stitches", "@stitches/react"] },
  { kind: "animation",        label: "Multiple animation libraries",    packages: ["framer-motion", "react-spring", "motion", "animejs", "gsap", "@motionone/dom"] },
  { kind: "validation",       label: "Multiple validation libraries",   packages: ["zod", "yup", "joi", "valibot", "superstruct", "arktype"] },
  { kind: "orm",              label: "Multiple ORM / query libraries",  packages: ["prisma", "drizzle-orm", "typeorm", "sequelize", "knex", "mikro-orm", "mongoose"] },
  { kind: "router",           label: "Multiple routing libraries",      packages: ["react-router", "react-router-dom", "@tanstack/react-router", "wouter", "reach-router"] },
  { kind: "query-client",     label: "Multiple data-fetching libraries",packages: ["@tanstack/react-query", "swr", "react-async", "apollo-client", "@apollo/client"] },
];

// Config file patterns — imports from these files are "config-only" usage, not runtime usage
const CONFIG_FILE_RE = /(?:^|\/)(?:[\w.-]+\.config\.[cm]?[jt]sx?|\.[\w]+(rc|config)(?:\.[cm]?[jt]sx?)?|tsconfig[\w.-]*\.json|jsconfig\.json)$/i;

// ── Helpers ────────────────────────────────────────────────────────────────

function pkgNameFromSpec(spec) {
  if (spec.startsWith("@")) {
    const parts = spec.split("/");
    return parts.length >= 2 ? parts[0] + "/" + parts[1] : spec;
  }
  return spec.split("/")[0];
}

function readPackageJson(root) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  } catch { return null; }
}

function readInstalledMeta(root, pkgName) {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(root, "node_modules", pkgName, "package.json"), "utf8"));
    return {
      version: j.version || null,
      deprecated: typeof j.deprecated === "string" ? j.deprecated : (j.deprecated ? "Deprecated" : null),
      description: j.description || null,
    };
  } catch { return { version: null, deprecated: null, description: null }; }
}

function spawnJsonAsync(cmd, args, cwd, timeoutMs = 30000) {
  return new Promise((resolve) => {
    let stdout = "";
    let timedOut = false;
    const child = spawn(cmd, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
      resolve({ ok: false, data: null, error: "timeout" });
    }, timeoutMs);
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.on("close", () => {
      clearTimeout(timer);
      if (timedOut) return;
      if (!stdout.trim()) { resolve({ ok: false, data: null, error: "empty output" }); return; }
      try { resolve({ ok: true, data: JSON.parse(stdout) }); }
      catch (e) { resolve({ ok: false, data: null, error: String(e && e.message ? e.message : e) }); }
    });
    child.on("error", (e) => {
      clearTimeout(timer);
      resolve({ ok: false, data: null, error: String(e && e.message ? e.message : e) });
    });
  });
}

// ── npm audit parsing ──────────────────────────────────────────────────────

function parseAuditVulns(data) {
  const map = new Map(); // pkgName → [{severity, title, url}]
  if (!data) return map;

  // npm ≥7 format
  if (data.vulnerabilities) {
    for (const [name, info] of Object.entries(data.vulnerabilities)) {
      const vulns = (info.via || []).filter(v => typeof v === "object" && v.severity);
      if (vulns.length) {
        map.set(name, vulns.map(v => ({ severity: v.severity, title: v.title || "Vulnerability", url: v.url || null })));
      } else if (info.severity && (info.isDirect || info.effects)) {
        // indirect/aggregate entry — still report severity
        if (!map.has(name)) {
          map.set(name, [{ severity: info.severity, title: "Vulnerable dependency", url: null }]);
        }
      }
    }
  }

  // npm 6 format
  if (data.advisories && !data.vulnerabilities) {
    for (const adv of Object.values(data.advisories)) {
      const name = adv.module_name;
      if (!name) continue;
      if (!map.has(name)) map.set(name, []);
      map.get(name).push({ severity: adv.severity, title: adv.title || adv.overview || "Vulnerability", url: adv.url || null });
    }
  }

  return map;
}

// ── Import-file mapping ────────────────────────────────────────────────────

function buildImportingFilesMap(fileDetails) {
  const map = new Map(); // pkgName → Set<filePath>
  for (const [filePath, importData] of Object.entries(fileDetails?.imports || {})) {
    for (const spec of (importData.specs || [])) {
      if (spec.startsWith(".") || spec.startsWith("/")) continue;
      const pkg = pkgNameFromSpec(spec);
      if (!map.has(pkg)) map.set(pkg, new Set());
      map.get(pkg).add(filePath);
    }
  }
  const result = new Map();
  for (const [pkg, files] of map) result.set(pkg, [...files].sort());
  return result;
}

// ── Outdated severity ─────────────────────────────────────────────────────

function getOutdatedSeverity(outdatedInfo) {
  if (!outdatedInfo || !outdatedInfo.current || !outdatedInfo.latest) return null;
  if (outdatedInfo.current === outdatedInfo.latest) return null;
  const [curMaj, curMin] = outdatedInfo.current.split(".").map(Number);
  const [latMaj, latMin] = outdatedInfo.latest.split(".").map(Number);
  if (!isNaN(curMaj) && !isNaN(latMaj) && latMaj > curMaj) return "major";
  if (!isNaN(curMin) && !isNaN(latMin) && latMin > curMin) return "minor";
  return "patch";
}

// ── Config-only detection ─────────────────────────────────────────────────

function checkIsConfigOnly(importingFiles) {
  return importingFiles.length > 0 && importingFiles.every(f => CONFIG_FILE_RE.test(f));
}

// ── Risk score ────────────────────────────────────────────────────────────

function computeRiskScore({ vulns, isDeprecated, isUnused, outdatedSeverity }) {
  let score = 0;
  for (const v of vulns) {
    if (v.severity === "critical") score += 4;
    else if (v.severity === "high") score += 3;
    else if (v.severity === "moderate" || v.severity === "medium") score += 2;
    else if (v.severity === "low") score += 0.5;
  }
  if (isDeprecated) score += 2;
  if (isUnused) score += 1;
  if (outdatedSeverity === "major") score += 1.5;
  else if (outdatedSeverity === "minor") score += 0.5;
  // patch updates are safe — no penalty
  return Math.min(10, Math.round(score * 10) / 10);
}

// ── Ecosystem duplicate detection ─────────────────────────────────────────

function detectEcosystemDuplicates(allDeclaredNames) {
  const installed = new Set(allDeclaredNames);
  return ECOSYSTEM_GROUPS
    .map(g => ({ ...g, found: g.packages.filter(p => installed.has(p)) }))
    .filter(g => g.found.length >= 2)
    .map(g => ({ kind: g.kind, packages: g.found, message: `${g.label} detected: ${g.found.join(", ")}` }));
}

// ── Main export ───────────────────────────────────────────────────────────

async function analyzeDeps(root, scan) {
  const pkgJson = readPackageJson(root);
  if (!pkgJson) return { available: false, error: "No package.json found at project root." };

  const deps    = pkgJson.dependencies    || {};
  const devDeps = pkgJson.devDependencies || {};
  const allDeclared = { ...deps, ...devDeps };

  const importingFilesMap  = buildImportingFilesMap(scan.fileDetails);
  const externalPkgCounts  = new Map((scan.insights?.externalPackages || []).map(p => [p.name, p.count]));

  const [auditResult, outdatedResult] = await Promise.all([
    spawnJsonAsync("npm", ["audit", "--json"], root),
    spawnJsonAsync("npm", ["outdated", "--json"], root),
  ]);
  const vulnsByPkg    = parseAuditVulns(auditResult.ok ? auditResult.data : null);
  const outdatedData   = (outdatedResult.ok && outdatedResult.data && typeof outdatedResult.data === "object") ? outdatedResult.data : {};

  const packages = [];
  for (const [name, declaredRange] of Object.entries(allDeclared)) {
    const installed      = readInstalledMeta(root, name);
    const importCount    = externalPkgCounts.get(name) || 0;
    const importingFiles = (importingFilesMap.get(name) || []).slice(0, 60);
    const isConfigOnly   = checkIsConfigOnly(importingFiles);
    const isUnused       = importCount === 0 && !isConfigOnly && !SAFE_DEV.has(name) && !name.startsWith("@types/");
    const vulns          = vulnsByPkg.get(name) || [];
    const raw            = outdatedData[name];
    const outdatedInfo   = raw ? { current: raw.current, wanted: raw.wanted, latest: raw.latest } : null;
    const outSeverity    = getOutdatedSeverity(outdatedInfo);

    packages.push({
      name,
      type:               name in devDeps ? "devDep" : "dep",
      declaredRange,
      installedVersion:   installed.version,
      description:        installed.description,
      isDeprecated:       !!installed.deprecated,
      deprecationMessage: installed.deprecated,
      importCount,
      importingFiles,
      isUnused,
      isConfigOnly,
      vulnerabilities:    vulns,
      outdatedInfo,
      outdatedSeverity:   outSeverity,
      riskScore: computeRiskScore({ vulns, isDeprecated: !!installed.deprecated, isUnused, outdatedSeverity: outSeverity }),
    });
  }

  packages.sort((a, b) => b.riskScore - a.riskScore || a.name.localeCompare(b.name));

  let criticalCount = 0, highCount = 0, moderateCount = 0, lowCount = 0;
  for (const pkg of packages) {
    for (const v of pkg.vulnerabilities) {
      if (v.severity === "critical")                             criticalCount++;
      else if (v.severity === "high")                           highCount++;
      else if (v.severity === "moderate" || v.severity === "medium") moderateCount++;
      else if (v.severity === "low")                            lowCount++;
    }
  }

  const unusedCount    = packages.filter(p => p.isUnused).length;
  const deprecatedCount = packages.filter(p => p.isDeprecated).length;
  const outdatedCount  = packages.filter(p => p.outdatedInfo && p.outdatedInfo.current !== p.outdatedInfo.latest).length;
  const highRiskCount  = packages.filter(p => p.riskScore >= 6).length;
  const medRiskCount   = packages.filter(p => p.riskScore >= 3 && p.riskScore < 6).length;
  const safeCount      = packages.filter(p => p.riskScore < 3 && !p.isUnused && !p.isDeprecated).length;

  return {
    available: true,
    packages,
    summary: {
      total:      packages.length,
      safe:       safeCount,
      mediumRisk: medRiskCount,
      highRisk:   highRiskCount,
      critical:   criticalCount,
      high:       highCount,
      moderate:   moderateCount,
      low:        lowCount,
      unused:     unusedCount,
      deprecated: deprecatedCount,
      outdated:   outdatedCount,
    },
    ecosystemWarnings:  detectEcosystemDuplicates(Object.keys(allDeclared)),
    auditAvailable:     auditResult.ok,
    auditError:         auditResult.ok ? null : (auditResult.error || "npm audit failed"),
    outdatedAvailable:  outdatedResult.ok,
  };
}

module.exports = { analyzeDeps };
