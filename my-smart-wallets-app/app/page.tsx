"use client";

import { useSignerStatus } from "@account-kit/react";
import UserInfoCard from "./components/user-info-card";
import NftMintCard from "./components/nft-mint-card";
import LoginCard from "./components/login-card";
import Header from "./components/header";
import LearnMore from "./components/learn-more";
import PublicFeedCard from "./components/public-feed-card";
import Link from "next/link";

export default function Home() {
  const signerStatus = useSignerStatus();

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <Header />
      <div className="bg-bg-main bg-cover bg-center bg-no-repeat h-[calc(100vh-4rem)]">
        <main className="container mx-auto px-4 py-8 h-full">
          <div className="mb-4 flex flex-wrap gap-3 text-sm">
            <Link className="underline underline-offset-4" href="/launch">
              Launch
            </Link>
            <Link className="underline underline-offset-4" href="/dashboard">
              Dashboard
            </Link>
            <Link className="underline underline-offset-4" href="/alerts">
              Alerts
            </Link>
            <Link className="underline underline-offset-4" href="/diagnostics">
              Diagnostics
            </Link>
            <Link className="underline underline-offset-4" href="/setup">
              Setup
            </Link>
            <Link className="underline underline-offset-4" href="/premium/decrypt">
              Premium Decrypt
            </Link>
          </div>
          {signerStatus.isConnected ? (
            <div className="grid gap-8 md:grid-cols-[1fr_2fr]">
              <div className="flex flex-col gap-8">
                <UserInfoCard />
                <LearnMore />
                <PublicFeedCard />
              </div>
              <NftMintCard />
            </div>
          ) : (
            <div className="flex flex-col justify-center items-center h-full pb-[4rem] gap-6">
              <LoginCard />
              <div className="w-full max-w-xl">
                <PublicFeedCard />
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
