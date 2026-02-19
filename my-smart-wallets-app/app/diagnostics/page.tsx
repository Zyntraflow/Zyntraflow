"use client";

import Header from "@/app/components/header";
import ResponsiveGrid from "@/app/components/ResponsiveGrid";
import Section from "@/app/components/Section";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type CheckResult = {
  name: string;
  path: string;
  ok: boolean;
  status: number | null;
  message: string;
};

const interpretResult = (name: string, path: string, status: number | null, ok: boolean, failed = false): CheckResult => {
  if (failed) {
    return {
      name,
      path,
      ok: false,
      status: null,
      message: "Network error. Origin unreachable; check ports 80/443 and docker compose status.",
    };
  }

  if (ok) {
    return {
      name,
      path,
      ok: true,
      status,
      message: "OK",
    };
  }

  if (status === 522) {
    return {
      name,
      path,
      ok: false,
      status,
      message: "Origin unreachable (522). Check VPS firewall, Caddy container, and Cloudflare SSL mode.",
    };
  }

  if (path === "/api/feed/latest" && status === 404) {
    return {
      name,
      path,
      ok: false,
      status,
      message: "Operator has not produced a feed artifact yet.",
    };
  }

  if (status === 404) {
    return {
      name,
      path,
      ok: false,
      status,
      message: "Endpoint not found. Verify deployment and build output.",
    };
  }

  return {
    name,
    path,
    ok: false,
    status,
    message: `Unexpected response status (${status}).`,
  };
};

export default function DiagnosticsPage() {
  const [results, setResults] = useState<CheckResult[]>([]);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  const runChecks = useCallback(async () => {
    const targets = [
      { name: "Health", path: "/api/health" },
      { name: "Latest Feed", path: "/api/feed/latest" },
      { name: "Public Config", path: "/api/public-config" },
    ];

    const checks = await Promise.all(
      targets.map(async (target) => {
        try {
          const response = await fetch(target.path, { cache: "no-store" });
          return interpretResult(target.name, target.path, response.status, response.ok);
        } catch {
          return interpretResult(target.name, target.path, null, false, true);
        }
      }),
    );

    setResults(checks);
    setLastCheckedAt(new Date().toISOString());
  }, []);

  useEffect(() => {
    void runChecks();
  }, [runChecks]);

  const supportBundle = useMemo(
    () =>
      JSON.stringify(
        {
          checkedAt: lastCheckedAt,
          checks: results.map((item) => ({
            name: item.name,
            path: item.path,
            status: item.status,
            ok: item.ok,
            message: item.message,
          })),
        },
        null,
        2,
      ),
    [lastCheckedAt, results],
  );

  const onCopySupportBundle = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(supportBundle);
      setCopyMessage("Support bundle copied");
      setTimeout(() => setCopyMessage(null), 1500);
    } catch {
      setCopyMessage("Unable to copy support bundle");
      setTimeout(() => setCopyMessage(null), 1500);
    }
  }, [supportBundle]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <Header />
      <main className="container mx-auto max-w-5xl px-4 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Diagnostics</h1>
          <button type="button" className="min-h-10 rounded border px-3 py-2 text-sm hover:bg-muted" onClick={() => void runChecks()}>
            Re-run checks
          </button>
        </div>

        <ResponsiveGrid className="items-start">
          <Section
            className="md:col-span-2"
            title="Checks"
            description={`Endpoint status checks. Last checked: ${lastCheckedAt ?? "Not run yet"}`}
          >
            {results.length === 0 && <p className="text-sm text-muted-foreground">Running checks...</p>}
            <div className="space-y-3">
              {results.map((item) => (
                <div key={item.path} className="rounded border p-3 text-sm">
                  <p className="font-medium">{item.name}</p>
                  <p>path: {item.path}</p>
                  <p>status: {item.status ?? "network error"}</p>
                  <p className={item.ok ? "text-emerald-600" : "text-amber-700"}>{item.message}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Fix Guide" description="Follow this sequence when checks fail.">
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Confirm VPS ports 80/443 are open in host firewall and provider security group.</li>
              <li>Confirm Cloudflare SSL/TLS mode is Full (strict), never Flexible.</li>
              <li>Confirm `docker compose ps` shows web, caddy, and operator containers healthy.</li>
              <li>If `/api/feed/latest` is 404, run operator and verify `public-feed/latest.signed.json` exists.</li>
              <li>If network errors continue, inspect Caddy logs and reverse proxy target `web:3000`.</li>
            </ul>
            <p className="mt-3 text-sm">
              <Link href="/dashboard" className="underline underline-offset-4">
                Open Dashboard
              </Link>
            </p>
          </Section>

          <Section
            title="Copy Support Bundle"
            description="Copy sanitized endpoint statuses for operator or deployment support."
            className="md:col-span-2 xl:col-span-3"
          >
            <button
              type="button"
              className="min-h-10 rounded border px-3 py-2 text-sm hover:bg-muted"
              onClick={() => void onCopySupportBundle()}
            >
              Copy support bundle
            </button>
            {copyMessage && <p className="mt-2 text-xs text-muted-foreground">{copyMessage}</p>}
            <pre className="mt-3 max-h-80 overflow-auto rounded bg-muted p-3 text-xs">{supportBundle}</pre>
          </Section>
        </ResponsiveGrid>
      </main>
    </div>
  );
}
