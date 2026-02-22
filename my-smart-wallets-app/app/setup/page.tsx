"use client";

import Header from "@/app/components/header";
import ResponsiveGrid from "@/app/components/ResponsiveGrid";
import Section from "@/app/components/Section";
import { useCallback, useEffect, useState } from "react";

export const dynamic = "force-dynamic";

type HealthPayload = {
  lastTickAt: string | null;
  lastTickOk: boolean;
  lastReportHash: string | null;
  executionEnabled?: boolean;
  lastExecutionStatus?: "disabled" | "blocked" | "sim_failed" | "sent" | "error" | null;
  lastExecutionReason?: string | null;
  lastTradeAt?: string | null;
};

type ReadinessPayload = {
  ts: string;
  lastTickOk: boolean;
  lastReportHash: string | null;
  chainsScanned: number;
  profileId: string;
};

type PublicConfigPayload = {
  ACCESS_PASS_CHAIN_ID: number | null;
  ACCESS_PASS_CONTRACT_ADDRESS: string | null;
  ACCESS_PASS_TOKEN_ID: number;
};

type EndpointCheck = {
  name: string;
  path: string;
  ok: boolean;
  status: number | null;
  message: string;
};

const interpret = (name: string, path: string, status: number | null, ok: boolean): EndpointCheck => {
  if (status === null) {
    return {
      name,
      path,
      ok: false,
      status: null,
      message: "Network error. Check origin reachability and reverse proxy.",
    };
  }

  if (ok) {
    return { name, path, ok: true, status, message: "OK" };
  }

  if (path === "/api/feed/latest" && status === 404) {
    return {
      name,
      path,
      ok: false,
      status,
      message: "Feed not generated yet. Start operator and wait one tick.",
    };
  }

  return {
    name,
    path,
    ok: false,
    status,
    message: `Unexpected status ${status}.`,
  };
};

export default function SetupPage() {
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [checks, setChecks] = useState<EndpointCheck[]>([]);
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [readiness, setReadiness] = useState<ReadinessPayload | null>(null);
  const [publicConfig, setPublicConfig] = useState<PublicConfigPayload | null>(null);
  const [metricsEnabled, setMetricsEnabled] = useState<boolean | null>(null);

  const runChecks = useCallback(async () => {
    const targets = [
      { name: "Health", path: "/api/health" },
      { name: "Latest Feed", path: "/api/feed/latest" },
      { name: "Public Config", path: "/api/public-config" },
      { name: "Readiness", path: "/api/readiness" },
    ];

    const results: EndpointCheck[] = [];
    for (const target of targets) {
      try {
        const response = await fetch(target.path, { cache: "no-store" });
        results.push(interpret(target.name, target.path, response.status, response.ok));

        if (target.path === "/api/health" && response.ok) {
          setHealth((await response.json()) as HealthPayload);
        }
        if (target.path === "/api/readiness" && response.ok) {
          setReadiness((await response.json()) as ReadinessPayload);
        }
        if (target.path === "/api/public-config" && response.ok) {
          setPublicConfig((await response.json()) as PublicConfigPayload);
        }
      } catch {
        results.push(interpret(target.name, target.path, null, false));
      }
    }

    try {
      const metricsResponse = await fetch("/api/metrics", { cache: "no-store" });
      setMetricsEnabled(metricsResponse.ok);
    } catch {
      setMetricsEnabled(false);
    }

    setChecks(results);
    setCheckedAt(new Date().toISOString());
  }, []);

  useEffect(() => {
    void runChecks();
  }, [runChecks]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <Header />
      <main className="container mx-auto max-w-6xl px-4 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">First-Run Setup Wizard</h1>
          <button type="button" className="min-h-10 rounded border px-3 py-2 text-sm hover:bg-muted" onClick={() => void runChecks()}>
            Re-check setup
          </button>
        </div>

        <ResponsiveGrid className="items-start">
          <Section className="md:col-span-2" title="API Checks" description={`Checked: ${checkedAt ?? "running..."}`}>
            <div className="space-y-3 text-sm">
              {checks.map((item) => (
                <div key={item.path} className="rounded border p-3">
                  <p className="font-medium">{item.name}</p>
                  <p>endpoint: {item.path}</p>
                  <p>status: {item.status ?? "network error"}</p>
                  <p className={item.ok ? "text-emerald-600" : "text-amber-700"}>{item.message}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Operator Tick Status" description="Shows whether your operator is producing feed artifacts.">
            <div className="space-y-1 text-sm">
              <p>lastTickOk: {health ? String(health.lastTickOk) : "unknown"}</p>
              <p>lastTickAt: {health?.lastTickAt ?? "unknown"}</p>
              <p className="break-all">lastReportHash: {health?.lastReportHash ?? "unknown"}</p>
              <p>metricsEnabled: {metricsEnabled === null ? "unknown" : metricsEnabled ? "true" : "false"}</p>
            </div>
          </Section>

          <Section title="Readiness Artifact" description="Generated by operator each tick under reports/readiness.json.">
            {!readiness ? (
              <p className="text-sm text-muted-foreground">Readiness not available yet.</p>
            ) : (
              <div className="space-y-1 text-sm">
                <p>ts: {readiness.ts}</p>
                <p>lastTickOk: {String(readiness.lastTickOk)}</p>
                <p className="break-all">lastReportHash: {readiness.lastReportHash ?? "none"}</p>
                <p>chainsScanned: {readiness.chainsScanned}</p>
                <p>profileId: {readiness.profileId}</p>
              </div>
            )}
          </Section>

          <Section title="Public Config Check" description="Safe onboarding values served by /api/public-config.">
            {!publicConfig ? (
              <p className="text-sm text-muted-foreground">Public config unavailable.</p>
            ) : (
              <div className="space-y-1 text-sm">
                <p>accessPassChainId: {publicConfig.ACCESS_PASS_CHAIN_ID ?? "not configured"}</p>
                <p className="break-all">accessPassContract: {publicConfig.ACCESS_PASS_CONTRACT_ADDRESS ?? "not configured"}</p>
                <p>accessPassTokenId: {publicConfig.ACCESS_PASS_TOKEN_ID}</p>
              </div>
            )}
          </Section>

          <Section className="md:col-span-2 xl:col-span-3" title="Fix Steps" description="Apply in this order if checks fail.">
            <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Run `docker compose up -d --build` in the repo on your VPS.</li>
              <li>Open inbound ports `80/tcp` and `443/tcp` in host firewall and provider security group.</li>
              <li>Set Cloudflare SSL/TLS mode to `Full (strict)`.</li>
              <li>Check `docker compose ps` and container logs (`caddy`, `web`, `operator`).</li>
              <li>If `/api/feed/latest` is 404, wait for one operator tick or run a bounded operator tick.</li>
            </ol>
          </Section>

          <Section
            className="md:col-span-2 xl:col-span-3"
            title="Execution Safety"
            description="Execution is high risk and should stay disabled until dry-runs are consistently stable."
          >
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Fund the execution wallet with limited funds only.</li>
              <li>Keep `EXECUTION_ENABLED=false` until policy checks and simulations are stable for multiple days.</li>
              <li>Set a kill switch file (`reports/KILL_SWITCH`) to disable all sends instantly.</li>
              <li>Current status: {health?.lastExecutionStatus ?? "unknown"}.</li>
              <li>Execution enabled: {health?.executionEnabled === undefined ? "unknown" : String(health.executionEnabled)}.</li>
              <li>Last execution reason: {health?.lastExecutionReason ?? "none"}.</li>
              <li>Last trade time: {health?.lastTradeAt ?? "none"}.</li>
            </ul>
          </Section>
        </ResponsiveGrid>
      </main>
    </div>
  );
}
