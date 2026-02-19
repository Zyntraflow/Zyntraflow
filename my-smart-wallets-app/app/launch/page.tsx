"use client";

import Header from "../components/header";
import ResponsiveGrid from "../components/ResponsiveGrid";
import Section from "../components/Section";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import PublicFeedCard from "../components/public-feed-card";

type PublicConfig = {
  ACCESS_PASS_CHAIN_ID: number | null;
  ACCESS_PASS_CONTRACT_ADDRESS: string | null;
  ACCESS_PASS_TOKEN_ID: number;
  ACCESS_PASS_MIN_BALANCE: number;
  ACCESS_PASS_MINT_PRICE_WEI: string | null;
  ACCESS_PASS_MINT_EIP681: string | null;
  FEED_LATEST_PATH: string;
  FEED_HISTORY_PATH: string;
  HEALTH_PATH: string;
  PREMIUM_PULL_TEMPLATE: string;
};

const defaultConfig: PublicConfig = {
  ACCESS_PASS_CHAIN_ID: null,
  ACCESS_PASS_CONTRACT_ADDRESS: null,
  ACCESS_PASS_TOKEN_ID: 1,
  ACCESS_PASS_MIN_BALANCE: 1,
  ACCESS_PASS_MINT_PRICE_WEI: null,
  ACCESS_PASS_MINT_EIP681: null,
  FEED_LATEST_PATH: "/api/feed/latest",
  FEED_HISTORY_PATH: "/api/feed/history",
  HEALTH_PATH: "/api/health",
  PREMIUM_PULL_TEMPLATE: "/api/premium/<reportHash>/<address>",
};

export default function LaunchPage() {
  const [config, setConfig] = useState<PublicConfig>(defaultConfig);
  const [configError, setConfigError] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadPublicConfig = async () => {
      try {
        const response = await fetch("/api/public-config", { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`Public config unavailable (${response.status})`);
        }

        const payload = (await response.json()) as PublicConfig;
        if (!mounted) {
          return;
        }

        setConfig(payload);
        setConfigError(null);
      } catch (error) {
        if (!mounted) {
          return;
        }

        setConfig(defaultConfig);
        setConfigError(error instanceof Error ? error.message : "Unable to load public config");
      }
    };

    void loadPublicConfig();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    void fetch("/api/metrics/hit?name=launchPageHits", { cache: "no-store" });
  }, []);

  const mintLink = useMemo(() => config.ACCESS_PASS_MINT_EIP681, [config.ACCESS_PASS_MINT_EIP681]);

  const copyValue = useCallback(async (label: string, value: string | null) => {
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <Header />
      <main className="container mx-auto max-w-5xl px-4 py-10 space-y-8">
        <Section
          title="Zyntraflow Launch"
          description="Zyntraflow is a crypto-native, read-only arbitrage scanner. Free feed is public and signed. Premium details are encrypted for Access Pass holders."
          actions={
            <Image src="/logo.svg" alt="Zyntraflow" width={88} height={88} className="h-16 w-16 rounded-lg" />
          }
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Use this page for public feed verification, premium onboarding, and secure package retrieval.
            </p>
            <Link className="text-sm underline underline-offset-4" href="/dashboard">
              Open Dashboard
            </Link>
          </div>
          {copyMessage && <p className="mt-3 text-xs text-muted-foreground">{copyMessage}</p>}
        </Section>

        <ResponsiveGrid className="items-start">
          <Section
            className="md:col-span-2"
            title="Free Feed"
            description="Public feed summaries are signed by Zyntraflow. Verify signatures before using shared data."
          >
            <PublicFeedCard />
          </Section>

          <Section
            title="Premium Access"
            description="Premium remains read-only. Access is gated by on-chain ERC-1155 ownership checks."
          >
            <div className="grid gap-2 text-sm break-all">
              <p>contract: {config.ACCESS_PASS_CONTRACT_ADDRESS ?? "Not configured"}</p>
              <p>chainId: {config.ACCESS_PASS_CHAIN_ID ?? "Not configured"}</p>
              <p>tokenId: {config.ACCESS_PASS_TOKEN_ID}</p>
              <p>minBalance: {config.ACCESS_PASS_MIN_BALANCE}</p>
              <p>mintPriceWei: {config.ACCESS_PASS_MINT_PRICE_WEI ?? "Not configured"}</p>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  className="min-h-10 rounded border px-3 py-2 text-xs hover:bg-muted"
                  onClick={() => void copyValue("Contract address", config.ACCESS_PASS_CONTRACT_ADDRESS)}
                >
                  Copy contract
                </button>
                {mintLink && (
                  <button
                    type="button"
                    className="min-h-10 rounded border px-3 py-2 text-xs hover:bg-muted"
                    onClick={() => void copyValue("Mint link", mintLink)}
                  >
                    Copy mint link
                  </button>
                )}
              </div>
              {mintLink && (
                <p>
                  mint link:{" "}
                  <a className="underline underline-offset-4" href={mintLink}>
                    {mintLink}
                  </a>
                </p>
              )}
              {configError && <p className="text-amber-600">public config note: {configError}</p>}
            </div>
          </Section>

          <Section title="How to Unlock" description="Premium package generation uses wallet signature-based encryption.">
            <div className="rounded bg-muted p-3 text-xs leading-6">
              <p>1) <code>npm run dev -- --mint-calldata</code></p>
              <p>2) <code>npm run dev -- --address 0x... --print-login-message</code></p>
              <p>3) Sign the login message in wallet</p>
              <p>4) <code>npm run dev -- --address 0x... --signature 0x... --premium true</code></p>
            </div>
          </Section>

          <Section title="Premium Pull" description="Packages are encrypted and user-bound. Pull by report hash + wallet address.">
            <code className="block rounded bg-muted p-3 text-xs break-all">{config.PREMIUM_PULL_TEMPLATE}</code>
            <div className="mt-3">
              <button
                type="button"
                className="min-h-10 rounded border px-3 py-2 text-xs hover:bg-muted"
                onClick={() => void copyValue("Premium pull template", config.PREMIUM_PULL_TEMPLATE)}
              >
                Copy pull URL template
              </button>
            </div>
          </Section>
        </ResponsiveGrid>
      </main>
    </div>
  );
}
