"use client";

import Header from "@/app/components/header";
import ResponsiveGrid from "@/app/components/ResponsiveGrid";
import Section from "@/app/components/Section";
import { uiText } from "@/lib/i18n";
import { buildPremiumPackagePath, validatePremiumLookup } from "@/lib/premiumPackageApi";
import { decryptPremiumJson, type PremiumEncryptedPayload } from "@/lib/premiumDecrypt";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

export const dynamic = "force-dynamic";

type PremiumPackage = PremiumEncryptedPayload & {
  header: Record<string, unknown>;
  signerAddress: string;
  signature: string;
};

const isPremiumPackage = (value: unknown): value is PremiumPackage => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const maybe = value as Partial<PremiumPackage>;
  return (
    typeof maybe.ciphertextBase64 === "string" &&
    typeof maybe.ivBase64 === "string" &&
    typeof maybe.saltBase64 === "string" &&
    !!maybe.header &&
    typeof maybe.header === "object" &&
    typeof maybe.signerAddress === "string" &&
    typeof maybe.signature === "string"
  );
};

export default function PremiumDecryptPage() {
  const text = uiText.premiumDecrypt;
  const [packageJson, setPackageJson] = useState("");
  const [signature, setSignature] = useState("");
  const [reportHashInput, setReportHashInput] = useState("");
  const [addressInput, setAddressInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [decrypted, setDecrypted] = useState<unknown>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [fetchMessage, setFetchMessage] = useState<string | null>(null);

  const onDecrypt = useCallback(async () => {
    setError(null);
    setDecrypted(null);

    if (packageJson.trim() === "") {
      setError("Premium package JSON is required.");
      return;
    }

    if (signature.trim() === "") {
      setError("Login signature is required.");
      return;
    }

    try {
      const parsed = JSON.parse(packageJson) as unknown;
      if (!isPremiumPackage(parsed)) {
        setError("Premium package JSON is missing required fields.");
        return;
      }
      const result = await decryptPremiumJson(parsed, signature);
      setDecrypted(result);
    } catch (decryptError) {
      setError(decryptError instanceof Error ? decryptError.message : "Unable to decrypt premium package.");
    }
  }, [packageJson, signature]);

  const onFetchPackage = useCallback(async () => {
    setError(null);
    setFetchMessage(null);

    const lookup = {
      reportHash: reportHashInput,
      address: addressInput,
    };
    const validationError = validatePremiumLookup(lookup);
    if (validationError) {
      setError(validationError);
      return;
    }

    const path = buildPremiumPackagePath(lookup);
    try {
      const response = await fetch(path, { cache: "no-store" });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(payload.message ?? `Premium package lookup failed (${response.status}).`);
      }

      const payload = (await response.json()) as unknown;
      if (!isPremiumPackage(payload)) {
        throw new Error("Fetched premium package is missing required fields.");
      }
      setPackageJson(JSON.stringify(payload, null, 2));
      setFetchMessage(`Loaded package from ${path}`);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Unable to load premium package.");
    }
  }, [addressInput, reportHashInput]);

  const onCopy = useCallback(async () => {
    if (decrypted === null) {
      return;
    }

    try {
      await navigator.clipboard.writeText(JSON.stringify(decrypted, null, 2));
      setCopyMessage("Decrypted output copied");
      setTimeout(() => setCopyMessage(null), 1500);
    } catch {
      setCopyMessage("Unable to copy decrypted output");
      setTimeout(() => setCopyMessage(null), 1500);
    }
  }, [decrypted]);

  const prettyOutput = useMemo(() => (decrypted === null ? "" : JSON.stringify(decrypted, null, 2)), [decrypted]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <Header />
      <main className="container mx-auto max-w-6xl px-4 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{text.pageTitle}</h1>
          <Link href="/dashboard" className="text-sm underline underline-offset-4">
            Open Dashboard
          </Link>
        </div>

        <ResponsiveGrid className="items-start">
          <Section
            title={text.warningsTitle}
            description={text.warningsDescription}
            className="md:col-span-2 xl:col-span-3"
          >
            <ul className="list-disc space-y-1 pl-5 text-sm text-amber-700">
              <li>{text.warningDoNotShareSignature}</li>
              <li>{text.warningNoPrivateKeys}</li>
              <li>{text.warningNoStorage}</li>
            </ul>
          </Section>

          <Section title={text.fetchSectionTitle} description={text.fetchSectionDescription} className="md:col-span-2">
            <div className="grid gap-3 text-sm">
              <label className="grid gap-1">
                <span>Report Hash</span>
                <input
                  className="min-h-12 rounded border px-3 py-2 font-mono text-xs"
                  placeholder="0x...64 hex"
                  value={reportHashInput}
                  onChange={(event) => setReportHashInput(event.target.value)}
                />
              </label>
              <label className="grid gap-1">
                <span>Wallet Address</span>
                <input
                  className="min-h-12 rounded border px-3 py-2 font-mono text-xs"
                  placeholder="0x...40 hex"
                  value={addressInput}
                  onChange={(event) => setAddressInput(event.target.value)}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="min-h-11 rounded border px-4 py-2 text-sm hover:bg-muted" onClick={() => void onFetchPackage()}>
                  Fetch package from API
                </button>
                <button
                  type="button"
                  className="min-h-11 rounded border px-4 py-2 text-sm hover:bg-muted"
                  onClick={() => void navigator.clipboard.writeText(buildPremiumPackagePath({ reportHash: reportHashInput, address: addressInput }))}
                >
                  Copy fetch URL
                </button>
              </div>
              {fetchMessage && <p className="text-xs text-muted-foreground break-all">{fetchMessage}</p>}
            </div>
          </Section>

          <Section title={text.packageTitle} description={text.packageDescription}>
            <textarea
              id="premium-package-json"
              className="min-h-56 w-full rounded border p-3 font-mono text-xs md:min-h-64"
              placeholder='{"header":{},"ciphertextBase64":"...","ivBase64":"...","saltBase64":"...","signerAddress":"0x...","signature":"0x..."}'
              value={packageJson}
              onChange={(event) => setPackageJson(event.target.value)}
            />
          </Section>

          <Section title={text.signatureTitle} description={text.signatureDescription}>
            <textarea
              id="user-signature"
              className="min-h-56 w-full rounded border p-3 font-mono text-xs md:min-h-64"
              placeholder="0x..."
              value={signature}
              onChange={(event) => setSignature(event.target.value)}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="min-h-11 rounded border px-4 py-2 text-sm hover:bg-muted" onClick={() => void onDecrypt()}>
                Decrypt package
              </button>
              <button type="button" className="min-h-11 rounded border px-4 py-2 text-sm hover:bg-muted" onClick={() => void onCopy()}>
                Copy decrypted output
              </button>
            </div>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            {copyMessage && <p className="mt-2 text-xs text-muted-foreground">{copyMessage}</p>}
          </Section>

          <Section title={text.outputTitle} description={text.outputDescription} className="md:col-span-2 xl:col-span-3">
            {prettyOutput ? (
              <pre className="max-h-[32rem] overflow-auto rounded bg-muted p-3 text-xs">{prettyOutput}</pre>
            ) : (
              <p className="text-sm text-muted-foreground">No decrypted output yet.</p>
            )}
          </Section>
        </ResponsiveGrid>
      </main>
    </div>
  );
}
