"use client";

import { type SignedFreeSummary, verifySignedSummary } from "@/lib/feedSignature";
import { useCallback, useEffect, useState } from "react";

export default function PublicFeedCard() {
  const [feed, setFeed] = useState<SignedFreeSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verificationState, setVerificationState] = useState<"idle" | "valid" | "invalid">("idle");

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const response = await fetch("/api/feed/latest", { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`Feed unavailable (${response.status})`);
        }
        const payload = (await response.json()) as SignedFreeSummary;
        if (!isMounted) {
          return;
        }
        setFeed(payload);
        setError(null);
      } catch (err) {
        if (!isMounted) {
          return;
        }
        setFeed(null);
        setError(err instanceof Error ? err.message : "Unable to load feed");
      }
    };

    void load();
    return () => {
      isMounted = false;
    };
  }, []);

  const onVerify = useCallback(() => {
    if (!feed) {
      return;
    }
    try {
      setVerificationState(verifySignedSummary(feed) ? "valid" : "invalid");
    } catch {
      setVerificationState("invalid");
    }
  }, [feed]);

  return (
    <section className="rounded-xl border bg-background/80 p-4 shadow-sm">
      <h2 className="text-lg font-semibold">Global Feed</h2>
      {error && <p className="mt-2 text-sm text-muted-foreground">No feed yet: {error}</p>}
      {feed && (
        <div className="mt-3 space-y-1 text-sm">
          <p>ts: {feed.summary.ts}</p>
          <p>chainId: {feed.summary.chainId}</p>
          <p>pairsScanned: {feed.summary.pairsScanned}</p>
          <p>reportHash: {feed.summary.reportHash}</p>
          <p>premiumAvailable: {String(feed.summary.premiumAvailable)}</p>
          <button
            type="button"
            className="mt-2 rounded-md border px-3 py-1 text-sm hover:bg-muted"
            onClick={onVerify}
          >
            Verify signature
          </button>
          {verificationState === "valid" && <p className="text-emerald-600">Signature valid</p>}
          {verificationState === "invalid" && <p className="text-red-600">Signature invalid</p>}
        </div>
      )}
    </section>
  );
}
