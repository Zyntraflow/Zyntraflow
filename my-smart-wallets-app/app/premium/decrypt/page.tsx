"use client";

import Header from "@/app/components/header";
import ResponsiveGrid from "@/app/components/ResponsiveGrid";
import Section from "@/app/components/Section";
import { decryptPremiumJson, type PremiumEncryptedPayload } from "@/lib/premiumDecrypt";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

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
  const [packageJson, setPackageJson] = useState("");
  const [signature, setSignature] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [decrypted, setDecrypted] = useState<unknown>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

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
          <h1 className="text-2xl font-semibold tracking-tight">Premium Decrypt Tool</h1>
          <Link href="/dashboard" className="text-sm underline underline-offset-4">
            Open Dashboard
          </Link>
        </div>

        <ResponsiveGrid className="items-start">
          <Section
            title="Warnings"
            description="Decryption runs in-browser only. This page does not send package JSON or signature to any API."
            className="md:col-span-2 xl:col-span-3"
          >
            <ul className="list-disc space-y-1 pl-5 text-sm text-amber-700">
              <li>Do not share your signature publicly.</li>
              <li>Do not paste private keys into this tool.</li>
              <li>No data is stored in localStorage by this page.</li>
            </ul>
          </Section>

          <Section title="Paste Package" description="Paste PremiumPackage JSON payload.">
            <textarea
              id="premium-package-json"
              className="min-h-56 w-full rounded border p-3 font-mono text-xs"
              placeholder='{"header":{},"ciphertextBase64":"...","ivBase64":"...","saltBase64":"...","signerAddress":"0x...","signature":"0x..."}'
              value={packageJson}
              onChange={(event) => setPackageJson(event.target.value)}
            />
          </Section>

          <Section title="Paste Signature" description="Paste the same login signature used to unlock premium mode.">
            <textarea
              id="user-signature"
              className="min-h-56 w-full rounded border p-3 font-mono text-xs"
              placeholder="0x..."
              value={signature}
              onChange={(event) => setSignature(event.target.value)}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="min-h-10 rounded border px-4 py-2 text-sm hover:bg-muted" onClick={() => void onDecrypt()}>
                Decrypt package
              </button>
              <button type="button" className="min-h-10 rounded border px-4 py-2 text-sm hover:bg-muted" onClick={() => void onCopy()}>
                Copy decrypted output
              </button>
            </div>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            {copyMessage && <p className="mt-2 text-xs text-muted-foreground">{copyMessage}</p>}
          </Section>

          <Section title="Decrypted Output" description="Decoded ScanReport data (client-side decrypted)." className="md:col-span-2 xl:col-span-3">
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
