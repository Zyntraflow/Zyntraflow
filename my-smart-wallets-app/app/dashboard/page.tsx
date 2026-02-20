"use client";

import Header from "@/app/components/header";
import ProfileSwitcher from "@/app/components/profile-switcher";
import ResponsiveGrid from "@/app/components/ResponsiveGrid";
import Section from "@/app/components/Section";
import { type SignedFreeSummary, verifySignedSummary } from "@/lib/feedSignature";
import type { UiScanProfile } from "@/lib/profiles";
import { buildXPostText } from "@/lib/shareText";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

export const dynamic = "force-dynamic";

type OperatorHealth = {
  ok: boolean;
  timestamp: string;
  lastTickAt: string | null;
  lastTickOk: boolean;
  lastReportHash: string | null;
  lastError: string | null;
  lastAlertsSent: number;
  lastDiscordSentAt: string | null;
  lastDiscordStatus: "sent" | "skipped" | "error" | null;
  lastTelegramSentAt: string | null;
  lastTelegramStatus: "sent" | "skipped" | "error" | null;
};

type FeedHistoryResponse = {
  date: string;
  count: number;
  items: unknown[];
};

type DailyMetrics = {
  date: string;
  feedLatestHits: number;
  feedHistoryHits: number;
  healthHits: number;
  premiumPullHits: number;
  launchPageHits: number;
};

const todayDate = (): string => new Date().toISOString().slice(0, 10);

const asSignedSummary = (value: unknown): SignedFreeSummary | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const maybe = value as Partial<SignedFreeSummary>;
  if (!maybe.summary || typeof maybe.summary !== "object") {
    return null;
  }
  if (typeof maybe.signature !== "string" || typeof maybe.signerAddress !== "string") {
    return null;
  }
  return maybe as SignedFreeSummary;
};

export default function DashboardPage() {
  const [activeProfile, setActiveProfile] = useState<UiScanProfile | null>(null);
  const [latest, setLatest] = useState<SignedFreeSummary | null>(null);
  const [latestError, setLatestError] = useState<string | null>(null);
  const [verificationState, setVerificationState] = useState<"idle" | "valid" | "invalid">("idle");
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  const [health, setHealth] = useState<OperatorHealth | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);

  const [metrics, setMetrics] = useState<DailyMetrics | null>(null);
  const [metricsMessage, setMetricsMessage] = useState<string>("Loading metrics...");

  const [history, setHistory] = useState<SignedFreeSummary[]>([]);
  const [historyMessage, setHistoryMessage] = useState<string>("Loading history...");

  const loadDashboardData = useCallback(async () => {
    const [latestResp, healthResp, metricsResp, historyResp] = await Promise.allSettled([
      fetch("/api/feed/latest", { cache: "no-store" }),
      fetch("/api/health", { cache: "no-store" }),
      fetch("/api/metrics", { cache: "no-store" }),
      fetch(`/api/feed/history?date=${todayDate()}&limit=10`, { cache: "no-store" }),
    ]);

    if (latestResp.status === "fulfilled" && latestResp.value.ok) {
      try {
        const payload = (await latestResp.value.json()) as SignedFreeSummary;
        setLatest(payload);
        setLatestError(null);
      } catch {
        setLatest(null);
        setLatestError("Latest feed payload is invalid.");
      }
    } else {
      setLatest(null);
      if (latestResp.status === "fulfilled") {
        setLatestError(`Latest feed unavailable (${latestResp.value.status}).`);
      } else {
        setLatestError("Latest feed request failed.");
      }
    }

    if (healthResp.status === "fulfilled" && healthResp.value.ok) {
      try {
        const payload = (await healthResp.value.json()) as OperatorHealth;
        setHealth(payload);
        setHealthError(null);
      } catch {
        setHealth(null);
        setHealthError("Health payload is invalid.");
      }
    } else {
      setHealth(null);
      setHealthError(
        healthResp.status === "fulfilled"
          ? `Health endpoint unavailable (${healthResp.value.status}).`
          : "Health request failed.",
      );
    }

    if (metricsResp.status === "fulfilled") {
      if (metricsResp.value.status === 404) {
        setMetrics(null);
        setMetricsMessage("Metrics disabled by operator.");
      } else if (metricsResp.value.ok) {
        try {
          const payload = (await metricsResp.value.json()) as DailyMetrics;
          setMetrics(payload);
          setMetricsMessage("Metrics loaded.");
        } catch {
          setMetrics(null);
          setMetricsMessage("Metrics payload is invalid.");
        }
      } else {
        setMetrics(null);
        setMetricsMessage(`Metrics endpoint unavailable (${metricsResp.value.status}).`);
      }
    } else {
      setMetrics(null);
      setMetricsMessage("Metrics request failed.");
    }

    if (historyResp.status === "fulfilled" && historyResp.value.ok) {
      try {
        const payload = (await historyResp.value.json()) as FeedHistoryResponse;
        const parsed = payload.items.map(asSignedSummary).filter((item): item is SignedFreeSummary => item !== null);
        setHistory(parsed.slice(-10).reverse());
        setHistoryMessage(parsed.length > 0 ? `Loaded ${parsed.length} item(s).` : "No history items for today yet.");
      } catch {
        setHistory([]);
        setHistoryMessage("History payload is invalid.");
      }
    } else if (historyResp.status === "fulfilled" && historyResp.value.status === 404) {
      setHistory([]);
      setHistoryMessage("No history entries published yet.");
    } else if (historyResp.status === "fulfilled") {
      setHistory([]);
      setHistoryMessage(`History endpoint unavailable (${historyResp.value.status}).`);
    } else {
      setHistory([]);
      setHistoryMessage("History request failed.");
    }
  }, []);

  useEffect(() => {
    void loadDashboardData();
  }, [loadDashboardData]);

  const verifyLatest = useCallback(() => {
    if (!latest) {
      return;
    }
    try {
      setVerificationState(verifySignedSummary(latest) ? "valid" : "invalid");
    } catch {
      setVerificationState("invalid");
    }
  }, [latest]);

  const copyText = useCallback(async (label: string, value: string | null | undefined) => {
    if (!value) {
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setCopyMessage(`${label} copied`);
      setTimeout(() => setCopyMessage(null), 1500);
    } catch {
      setCopyMessage(`Unable to copy ${label.toLowerCase()}`);
      setTimeout(() => setCopyMessage(null), 1500);
    }
  }, []);

  const historyPreview = useMemo(() => history.slice(0, 10), [history]);
  const topOpportunities = latest?.summary.topOpportunities ?? [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <Header />
      <main className="container mx-auto max-w-6xl px-4 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <div className="flex flex-wrap gap-3 text-sm">
            <Link className="underline underline-offset-4" href="/premium/decrypt">
              Premium Decrypt Tool
            </Link>
            <button type="button" className="min-h-10 rounded border px-3 py-2 hover:bg-muted" onClick={() => void loadDashboardData()}>
              Refresh data
            </button>
          </div>
        </div>
        {copyMessage && <p className="text-xs text-muted-foreground">{copyMessage}</p>}
        <ProfileSwitcher onProfileChange={setActiveProfile} />
        {activeProfile && (
          <p className="text-xs text-muted-foreground">
            Local preference: <span className="font-medium">{activeProfile.name}</span>. Runtime scans still follow operator/CLI profile configuration.
          </p>
        )}

        <ResponsiveGrid className="items-start">
          <Section
            className="md:col-span-2 xl:col-span-3"
            title="Top Opportunities"
            description="Ranked by score using read-only simulation outputs."
          >
            {topOpportunities.length === 0 && (
              <p className="text-sm text-muted-foreground">No ranked opportunities in the latest report.</p>
            )}

            {topOpportunities.length > 0 && (
              <>
                <div className="space-y-2 md:hidden">
                  {topOpportunities.map((opportunity, index) => (
                    <div key={`${opportunity.pair}-${index}`} className="rounded border p-3 text-sm">
                      <p className="font-medium">{opportunity.pair}</p>
                      <p>chainId: {opportunity.chainId}</p>
                      <p>netProfitEth: {opportunity.netProfitEth.toFixed(6)}</p>
                      <p>gasCostEth: {opportunity.gasCostEth.toFixed(6)}</p>
                      <p>slippage: {(opportunity.slippagePercent * 100).toFixed(2)}%</p>
                      <p>score: {opportunity.score.toFixed(6)}</p>
                      <p>riskFlags: {opportunity.riskFlags.join(", ") || "none"}</p>
                      <p className="break-all">reportHash: {latest?.summary.reportHash ?? "N/A"}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="min-h-10 rounded border px-3 py-2 text-xs hover:bg-muted"
                          onClick={() => void copyText("Pair", opportunity.pair)}
                        >
                          Copy pair
                        </button>
                        <button
                          type="button"
                          className="min-h-10 rounded border px-3 py-2 text-xs hover:bg-muted"
                          onClick={() => void copyText("Report hash", latest?.summary.reportHash)}
                        >
                          Copy report hash
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="hidden overflow-auto md:block">
                  <table className="min-w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="px-3 py-2 font-medium">Pair</th>
                        <th className="px-3 py-2 font-medium">Chain</th>
                        <th className="px-3 py-2 font-medium">Net Profit (ETH)</th>
                        <th className="px-3 py-2 font-medium">Gas Cost (ETH)</th>
                        <th className="px-3 py-2 font-medium">Slippage</th>
                        <th className="px-3 py-2 font-medium">Risk Flags</th>
                        <th className="px-3 py-2 font-medium">Report Hash</th>
                        <th className="px-3 py-2 font-medium">Score</th>
                        <th className="px-3 py-2 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topOpportunities.map((opportunity, index) => (
                        <tr key={`${opportunity.pair}-${index}`} className="border-b last:border-b-0">
                          <td className="px-3 py-2">{opportunity.pair}</td>
                          <td className="px-3 py-2">
                            <span className="rounded-full border px-2 py-0.5 text-xs">{opportunity.chainId}</span>
                          </td>
                          <td className="px-3 py-2">{opportunity.netProfitEth.toFixed(6)}</td>
                          <td className="px-3 py-2">{opportunity.gasCostEth.toFixed(6)}</td>
                          <td className="px-3 py-2">{(opportunity.slippagePercent * 100).toFixed(2)}%</td>
                          <td className="px-3 py-2">{opportunity.riskFlags.join(", ") || "none"}</td>
                          <td className="px-3 py-2 max-w-48 truncate">{latest?.summary.reportHash ?? "N/A"}</td>
                          <td className="px-3 py-2">{opportunity.score.toFixed(6)}</td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                className="min-h-9 rounded border px-2 py-1 text-xs hover:bg-muted"
                                onClick={() => void copyText("Pair", opportunity.pair)}
                              >
                                Copy pair
                              </button>
                              <button
                                type="button"
                                className="min-h-9 rounded border px-2 py-1 text-xs hover:bg-muted"
                                onClick={() => void copyText("Report hash", latest?.summary.reportHash)}
                              >
                                Copy hash
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </Section>

          <Section className="md:col-span-2" title="Latest Feed" description="Live signed free feed snapshot and signature validation.">
            {latestError && <p className="text-sm text-muted-foreground">{latestError}</p>}
            {!latest && !latestError && <p className="text-sm text-muted-foreground">Loading latest feed...</p>}
            {latest && (
              <div className="space-y-2 text-sm">
                <p>timestamp: {latest.summary.ts}</p>
                <p>chainId: {latest.summary.chainId}</p>
                <p>pairsScanned: {latest.summary.pairsScanned}</p>
                <p className="break-all">reportHash: {latest.summary.reportHash}</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="min-h-10 rounded border px-3 py-2 hover:bg-muted" onClick={verifyLatest}>
                    Verify signature
                  </button>
                  <button
                    type="button"
                    className="min-h-10 rounded border px-3 py-2 hover:bg-muted"
                    onClick={() => void copyText("Report hash", latest.summary.reportHash)}
                  >
                    Copy report hash
                  </button>
                  <button
                    type="button"
                    className="min-h-10 rounded border px-3 py-2 hover:bg-muted"
                    onClick={() => void copyText("X post", buildXPostText(latest))}
                  >
                    Copy X post
                  </button>
                  <a
                    className="inline-flex min-h-10 items-center rounded border px-3 py-2 hover:bg-muted"
                    href="https://x.com/zyntraflow"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open X
                  </a>
                </div>
                {verificationState === "valid" && <p className="text-emerald-600">Signature valid.</p>}
                {verificationState === "invalid" && <p className="text-red-600">Signature invalid.</p>}
              </div>
            )}
          </Section>

          <Section title="Health" description="Operator liveness and latest report status.">
            {healthError && <p className="text-sm text-muted-foreground">{healthError}</p>}
            {!health && !healthError && <p className="text-sm text-muted-foreground">Loading health...</p>}
            {health && (
              <div className="space-y-1 text-sm">
                <p>ok: {String(health.ok)}</p>
                <p>lastTickAt: {health.lastTickAt ?? "Not available"}</p>
                <p>lastTickOk: {String(health.lastTickOk)}</p>
                <p className="break-all">lastReportHash: {health.lastReportHash ?? "Not available"}</p>
                <p>lastAlertsSent: {health.lastAlertsSent}</p>
                <p>lastDiscordStatus: {health.lastDiscordStatus ?? "Not available"}</p>
                <p>lastDiscordSentAt: {health.lastDiscordSentAt ?? "Not available"}</p>
                <p>lastTelegramStatus: {health.lastTelegramStatus ?? "Not available"}</p>
                <p>lastTelegramSentAt: {health.lastTelegramSentAt ?? "Not available"}</p>
                <p>lastError: {health.lastError ?? "None"}</p>
              </div>
            )}
          </Section>

          <Section title="Metrics" description="Privacy-preserving usage counters from today.">
            {!metrics && <p className="text-sm text-muted-foreground">{metricsMessage}</p>}
            {metrics && (
              <div className="grid gap-1 text-sm">
                <p>date: {metrics.date}</p>
                <p>feedLatestHits: {metrics.feedLatestHits}</p>
                <p>feedHistoryHits: {metrics.feedHistoryHits}</p>
                <p>healthHits: {metrics.healthHits}</p>
                <p>premiumPullHits: {metrics.premiumPullHits}</p>
                <p>launchPageHits: {metrics.launchPageHits}</p>
              </div>
            )}
          </Section>

          <Section className="md:col-span-2 xl:col-span-3" title="History" description="Latest 10 signed feed entries for today.">
            <p className="text-sm text-muted-foreground">{historyMessage}</p>
            {historyPreview.length > 0 && (
              <ul className="mt-3 grid gap-2 text-sm md:grid-cols-2 xl:grid-cols-3">
                {historyPreview.map((item) => (
                  <li key={`${item.summary.ts}-${item.summary.reportHash}`} className="rounded border p-3">
                    <p>ts: {item.summary.ts}</p>
                    <p className="break-all">reportHash: {item.summary.reportHash}</p>
                    <p>pairsScanned: {item.summary.pairsScanned}</p>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </ResponsiveGrid>
      </main>
    </div>
  );
}
