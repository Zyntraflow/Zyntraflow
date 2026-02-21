"use client";

import Header from "../components/header";
import ProfileSwitcher from "../components/profile-switcher";
import ResponsiveGrid from "../components/ResponsiveGrid";
import Section from "../components/Section";
import { filterAlerts, getChainFilterOptions } from "@/lib/alertsFilters";
import { uiText } from "@/lib/i18n";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Subscription, SubscriptionUnsigned } from "@/lib/subscriptionAuth";
import type { UiScanProfile } from "@/lib/profiles";

export const dynamic = "force-dynamic";

type AlertEvent = {
  ts: string;
  userAddress: string;
  reportHash: string;
  chainId: number;
  pair: string;
  netProfitEth: number;
  gasCostEth: number;
  slippagePercent: number;
  riskFlags: string[];
  score: number;
  mode: "free" | "premium";
  notes: string[];
  signedFreeSummaryUrl: string;
  premiumPackageUrl?: string;
};

type AlertSnapshot = {
  updatedAt: string;
  global: AlertEvent[];
  byUser: Record<string, AlertEvent[]>;
};

const defaultSnapshot: AlertSnapshot = {
  updatedAt: new Date(0).toISOString(),
  global: [],
  byUser: {},
};

const createNonce = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "_");
  }
  return `nonce_${Date.now().toString(36)}`;
};

export default function AlertsPage() {
  const text = uiText.alerts;
  const [activeProfile, setActiveProfile] = useState<UiScanProfile | null>(null);
  const [alerts, setAlerts] = useState<AlertSnapshot>(defaultSnapshot);
  const [alertsMessage, setAlertsMessage] = useState<string>("Loading alerts...");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [chainFilter, setChainFilter] = useState<"all" | number>("all");
  const [modeFilter, setModeFilter] = useState<"all" | "free" | "premium">("all");

  const [address, setAddress] = useState("");
  const [minNetProfitEth, setMinNetProfitEth] = useState("0.01");
  const [maxSlippagePercent, setMaxSlippagePercent] = useState("0.02");
  const [chainsInput, setChainsInput] = useState("8453");
  const [pairsInput, setPairsInput] = useState("WETH/USDC");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [nonce, setNonce] = useState(createNonce());
  const [signature, setSignature] = useState("");
  const [messageToSign, setMessageToSign] = useState("");
  const [subscriptionPreview, setSubscriptionPreview] = useState<SubscriptionUnsigned | null>(null);
  const [storedSubscription, setStoredSubscription] = useState<Subscription | null>(null);

  const loadAlerts = useCallback(async () => {
    try {
      const response = await fetch("/api/alerts/latest", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Alerts endpoint returned ${response.status}`);
      }
      const payload = (await response.json()) as AlertSnapshot;
      setAlerts(payload);
      setAlertsMessage(payload.global.length > 0 ? `Loaded ${payload.global.length} recent alert(s).` : "No alerts yet.");
    } catch {
      setAlerts(defaultSnapshot);
      setAlertsMessage("Alert feed unavailable.");
    }
  }, []);

  useEffect(() => {
    void loadAlerts();
  }, [loadAlerts]);

  const handleProfileChange = useCallback((profile: UiScanProfile) => {
    setActiveProfile(profile);
    setChainsInput(profile.chains.join(","));
    setPairsInput(profile.pairs.join(","));
    setMinNetProfitEth(profile.minProfitGap.toString());
  }, []);

  const parsedChains = useMemo(
    () =>
      chainsInput
        .split(",")
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isInteger(value) && value > 0),
    [chainsInput],
  );

  const parsedPairs = useMemo(
    () =>
      pairsInput
        .split(",")
        .map((value) => value.trim().toUpperCase())
        .filter((value) => value.length > 0),
    [pairsInput],
  );

  const availableChains = useMemo(() => getChainFilterOptions(alerts.global), [alerts.global]);

  const filteredAlerts = useMemo(
    () =>
      filterAlerts({
        events: alerts.global,
        chainIdFilter: chainFilter,
        modeFilter,
        profileFilter: activeProfile,
      }),
    [activeProfile, alerts.global, chainFilter, modeFilter],
  );

  const copyText = useCallback(async (label: string, value: string | null | undefined) => {
    if (!value) {
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      setCopied(`${label} copied`);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      setCopied(`Unable to copy ${label.toLowerCase()}`);
      setTimeout(() => setCopied(null), 1500);
    }
  }, []);

  const generateMessage = useCallback(() => {
    setStatusMessage(null);
    void (async () => {
      try {
        const minProfit = Number(minNetProfitEth);
        const maxSlippage = Number(maxSlippagePercent);
        if (!Number.isFinite(minProfit) || minProfit < 0) {
          throw new Error("Min net profit must be a non-negative number.");
        }
        if (!Number.isFinite(maxSlippage) || maxSlippage < 0 || maxSlippage > 1) {
          throw new Error("Max slippage must be between 0 and 1.");
        }
        if (parsedChains.length === 0) {
          throw new Error("At least one chain ID is required.");
        }

        const unsigned: SubscriptionUnsigned = {
          version: 1,
          userAddress: address.trim(),
          createdAt: Math.floor(Date.now() / 1000),
          minNetProfitEth: minProfit,
          maxSlippagePercent: maxSlippage,
          chains: parsedChains,
          pairs: parsedPairs.length > 0 ? parsedPairs : undefined,
          delivery: {
            webhookUrl: webhookUrl.trim() || undefined,
          },
          nonce: nonce.trim(),
        };

        const response = await fetch("/api/subscriptions/message", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify(unsigned),
        });
        const body = (await response.json()) as { message?: string; payload?: SubscriptionUnsigned };
        if (!response.ok || !body.message || !body.payload) {
          throw new Error(body.message ?? `Unable to generate message (${response.status}).`);
        }

        setSubscriptionPreview(body.payload);
        setMessageToSign(body.message);
        setStatusMessage("Message generated. Sign it in your wallet, then paste the signature.");
      } catch (error) {
        setMessageToSign("");
        setSubscriptionPreview(null);
        setStatusMessage(error instanceof Error ? error.message : "Unable to generate message.");
      }
    })();
  }, [address, maxSlippagePercent, minNetProfitEth, nonce, parsedChains, parsedPairs, webhookUrl]);

  const loadStoredSubscription = useCallback(async (lookupAddress: string) => {
    try {
      const response = await fetch(`/api/subscriptions/${lookupAddress}`, { cache: "no-store" });
      if (!response.ok) {
        setStoredSubscription(null);
        return;
      }
      const payload = (await response.json()) as Subscription;
      setStoredSubscription(payload);
    } catch {
      setStoredSubscription(null);
    }
  }, []);

  const submitSubscription = useCallback(async () => {
    if (!subscriptionPreview || !messageToSign) {
      setStatusMessage("Generate a message before submitting.");
      return;
    }
    if (!signature.trim()) {
      setStatusMessage("Signature is required.");
      return;
    }

    const payload: Subscription = {
      ...subscriptionPreview,
      signature: signature.trim(),
    };

    try {
      const response = await fetch("/api/subscriptions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as { message?: string };
      if (!response.ok) {
        setStatusMessage(body.message ?? `Subscription failed (${response.status}).`);
        return;
      }

      setStatusMessage("Subscription saved.");
      setNonce(createNonce());
      await loadStoredSubscription(payload.userAddress);
    } catch {
      setStatusMessage("Subscription request failed.");
    }
  }, [loadStoredSubscription, messageToSign, signature, subscriptionPreview]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <Header />
      <main className="container mx-auto max-w-6xl px-4 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{text.pageTitle}</h1>
          <button
            type="button"
            className="min-h-10 rounded border px-3 py-2 text-sm hover:bg-muted"
            onClick={() => void loadAlerts()}
          >
            Refresh alerts
          </button>
        </div>
        {copied && <p className="text-xs text-muted-foreground">{copied}</p>}
        <ProfileSwitcher onProfileChange={handleProfileChange} />
        {activeProfile && (
          <p className="text-xs text-muted-foreground">
            Subscription defaults applied from <span className="font-medium">{activeProfile.name}</span>.
          </p>
        )}

        <ResponsiveGrid className="items-start">
          <Section
            className="md:col-span-2 xl:col-span-3"
            title={text.latestTitle}
            description={text.latestDescription}
          >
            <p className="text-sm text-muted-foreground">{alertsMessage}</p>
            <p className="mt-1 text-xs text-muted-foreground">updatedAt: {alerts.updatedAt}</p>
            <div className="mt-3 grid gap-3 rounded border p-3 text-sm md:grid-cols-3">
              <label className="grid gap-1">
                <span>Chain filter</span>
                <select
                  className="min-h-10 rounded border bg-background px-3 py-2"
                  value={chainFilter === "all" ? "all" : String(chainFilter)}
                  onChange={(event) => {
                    const next = event.target.value;
                    setChainFilter(next === "all" ? "all" : Number(next));
                  }}
                >
                  <option value="all">All chains</option>
                  {availableChains.map((chain) => (
                    <option key={chain} value={chain}>
                      {chain}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1">
                <span>Mode filter</span>
                <select
                  className="min-h-10 rounded border bg-background px-3 py-2"
                  value={modeFilter}
                  onChange={(event) => setModeFilter(event.target.value as "all" | "free" | "premium")}
                >
                  <option value="all">All modes</option>
                  <option value="free">Free</option>
                  <option value="premium">Premium</option>
                </select>
              </label>
              <div className="grid gap-1">
                <span>Profile coverage</span>
                <div className="min-h-10 rounded border px-3 py-2 text-xs text-muted-foreground">
                  {activeProfile ? `${activeProfile.name} (${activeProfile.pairs.length} pairs)` : "All profiles"}
                </div>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Showing {filteredAlerts.length} of {alerts.global.length} alerts.
            </p>
            {filteredAlerts.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">{text.noAlerts}</p>
            ) : (
              <>
                <div className="mt-3 space-y-2 md:hidden">
                  {filteredAlerts.slice(0, 10).map((event, index) => (
                    <div key={`${event.reportHash}-${event.userAddress}-${index}`} className="rounded border p-3 text-sm">
                      <p className="font-medium">{event.pair}</p>
                      <p>chainId: {event.chainId}</p>
                      <p>mode: {event.mode}</p>
                      <p>netProfitEth: {event.netProfitEth.toFixed(6)}</p>
                      <p>slippage: {(event.slippagePercent * 100).toFixed(2)}%</p>
                      <p className="break-all">reportHash: {event.reportHash}</p>
                      <button
                        type="button"
                        className="mt-2 min-h-10 rounded border px-3 py-2 text-xs hover:bg-muted"
                        onClick={() => void copyText("Report hash", event.reportHash)}
                      >
                        Copy hash
                      </button>
                    </div>
                  ))}
                </div>
                <div className="mt-3 hidden overflow-auto md:block">
                  <table className="min-w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="px-3 py-2 font-medium">Pair</th>
                        <th className="px-3 py-2 font-medium">Chain</th>
                        <th className="px-3 py-2 font-medium">Mode</th>
                        <th className="px-3 py-2 font-medium">Net Profit (ETH)</th>
                        <th className="px-3 py-2 font-medium">Slippage</th>
                        <th className="px-3 py-2 font-medium">Score</th>
                        <th className="px-3 py-2 font-medium">Report Hash</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAlerts.slice(0, 10).map((event, index) => (
                        <tr key={`${event.reportHash}-${event.userAddress}-${index}`} className="border-b last:border-b-0">
                          <td className="px-3 py-2">{event.pair}</td>
                          <td className="px-3 py-2">
                            <span className="rounded-full border px-2 py-0.5 text-xs">{event.chainId}</span>
                          </td>
                          <td className="px-3 py-2">{event.mode}</td>
                          <td className="px-3 py-2">{event.netProfitEth.toFixed(6)}</td>
                          <td className="px-3 py-2">{(event.slippagePercent * 100).toFixed(2)}%</td>
                          <td className="px-3 py-2">{event.score.toFixed(4)}</td>
                          <td className="px-3 py-2 max-w-56 truncate">{event.reportHash}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </Section>

          <Section className="md:col-span-2" title="Create Subscription" description="Wallet-signed SIWE-lite payload, no account/password.">
            <div className="grid gap-3 text-sm">
              <label className="grid gap-1">
                <span>Wallet Address</span>
                <input
                  className="min-h-10 rounded border px-3 py-2"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  placeholder="0x..."
                />
              </label>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-1">
                  <span>Min Net Profit (ETH)</span>
                  <input
                    className="min-h-10 rounded border px-3 py-2"
                    value={minNetProfitEth}
                    onChange={(event) => setMinNetProfitEth(event.target.value)}
                  />
                </label>
                <label className="grid gap-1">
                  <span>Max Slippage (0-1)</span>
                  <input
                    className="min-h-10 rounded border px-3 py-2"
                    value={maxSlippagePercent}
                    onChange={(event) => setMaxSlippagePercent(event.target.value)}
                  />
                </label>
              </div>
              <label className="grid gap-1">
                <span>Chains (comma-separated IDs)</span>
                <input
                  className="min-h-10 rounded border px-3 py-2"
                  value={chainsInput}
                  onChange={(event) => setChainsInput(event.target.value)}
                  placeholder="8453,42161"
                />
              </label>
              <label className="grid gap-1">
                <span>Pairs (optional, comma-separated)</span>
                <input
                  className="min-h-10 rounded border px-3 py-2"
                  value={pairsInput}
                  onChange={(event) => setPairsInput(event.target.value)}
                  placeholder="WETH/USDC,WETH/DAI"
                />
              </label>
              <label className="grid gap-1">
                <span>Webhook URL (optional, HTTPS)</span>
                <input
                  className="min-h-10 rounded border px-3 py-2"
                  value={webhookUrl}
                  onChange={(event) => setWebhookUrl(event.target.value)}
                  placeholder="https://example.com/alert-webhook"
                />
              </label>
              <label className="grid gap-1">
                <span>Nonce</span>
                <input
                  className="min-h-10 rounded border px-3 py-2"
                  value={nonce}
                  onChange={(event) => setNonce(event.target.value)}
                />
              </label>
              <button type="button" className="min-h-10 rounded border px-3 py-2 hover:bg-muted" onClick={generateMessage}>
                Generate message
              </button>
            </div>
          </Section>

          <Section title="Sign + Submit" description="Sign the generated message in wallet, paste signature, then submit.">
            <p className="mb-2 text-xs text-amber-600">Do not share your wallet signature publicly.</p>
            <label className="grid gap-1 text-sm">
              <span>Message to Sign</span>
              <textarea className="min-h-36 rounded border px-3 py-2 text-xs" readOnly value={messageToSign} />
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                className="min-h-10 rounded border px-3 py-2 text-xs hover:bg-muted"
                onClick={() => void copyText("Message", messageToSign)}
              >
                Copy message
              </button>
            </div>

            <label className="mt-3 grid gap-1 text-sm">
              <span>Signature</span>
              <textarea
                className="min-h-24 rounded border px-3 py-2 text-xs"
                value={signature}
                onChange={(event) => setSignature(event.target.value)}
                placeholder="0x..."
              />
            </label>
            <button
              type="button"
              className="mt-3 min-h-10 rounded border px-3 py-2 text-sm hover:bg-muted"
              onClick={() => void submitSubscription()}
            >
              Submit subscription
            </button>
            {statusMessage && <p className="mt-2 text-sm text-muted-foreground">{statusMessage}</p>}
          </Section>

          <Section className="md:col-span-2 xl:col-span-3" title="Current Subscription" description="Stored subscription for the entered address.">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="min-h-10 rounded border px-3 py-2 text-sm hover:bg-muted"
                onClick={() => void loadStoredSubscription(address.trim())}
              >
                Load current subscription
              </button>
            </div>
            {!storedSubscription ? (
              <p className="mt-3 text-sm text-muted-foreground">No stored subscription loaded.</p>
            ) : (
              <pre className="mt-3 overflow-auto rounded bg-muted p-3 text-xs">
                {JSON.stringify(storedSubscription, null, 2)}
              </pre>
            )}
          </Section>
        </ResponsiveGrid>
      </main>
    </div>
  );
}
