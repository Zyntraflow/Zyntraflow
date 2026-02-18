"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <main className="container mx-auto max-w-5xl px-4 py-10 space-y-8">
        <section className="rounded-2xl border bg-background/90 p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight">Zyntraflow Launch</h1>
              <p className="text-sm text-muted-foreground">
                Zyntraflow is a crypto-native, read-only arbitrage scanner. Free feed is public and signed. Premium
                details are encrypted for Access Pass holders.
              </p>
            </div>
            <Image src="/logo.svg" alt="Zyntraflow" width={88} height={88} className="h-16 w-16 rounded-lg" />
          </div>
          <div className="mt-4 text-sm">
            <Link className="underline underline-offset-4" href="/">
              Back to home
            </Link>
          </div>
        </section>

        <section className="rounded-2xl border bg-background/90 p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Free Feed</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Public feed summaries are signed by Zyntraflow. Anyone can fetch and verify them without accounts.
          </p>
          <div className="mt-4">
            <PublicFeedCard />
          </div>
        </section>

        <section className="rounded-2xl border bg-background/90 p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Premium Access Pass</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Premium stays read-only. Access is unlocked by on-chain ERC-1155 ownership checks.
          </p>
          <div className="mt-4 grid gap-2 text-sm">
            <p>contract: {config.ACCESS_PASS_CONTRACT_ADDRESS ?? "Not configured"}</p>
            <p>chainId: {config.ACCESS_PASS_CHAIN_ID ?? "Not configured"}</p>
            <p>tokenId: {config.ACCESS_PASS_TOKEN_ID}</p>
            <p>minBalance: {config.ACCESS_PASS_MIN_BALANCE}</p>
            <p>mintPriceWei: {config.ACCESS_PASS_MINT_PRICE_WEI ?? "Not configured"}</p>
            {mintLink && (
              <p>
                mint link: <a className="underline underline-offset-4" href={mintLink}>{mintLink}</a>
              </p>
            )}
            {configError && <p className="text-amber-600">public config note: {configError}</p>}
          </div>
          <div className="mt-4 rounded bg-muted p-3 text-xs leading-6">
            <p>1) <code>npm run dev -- --mint-calldata</code></p>
            <p>2) <code>npm run dev -- --address 0x... --print-login-message</code></p>
            <p>3) Sign the login message in wallet</p>
            <p>4) <code>npm run dev -- --address 0x... --signature 0x... --premium true</code></p>
          </div>
        </section>

        <section className="rounded-2xl border bg-background/90 p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Premium Pull</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Premium packages are encrypted and user-bound. Pull by report hash + wallet address:
          </p>
          <code className="mt-3 block rounded bg-muted p-3 text-xs">
            {config.PREMIUM_PULL_TEMPLATE}
          </code>
        </section>
      </main>
    </div>
  );
}
