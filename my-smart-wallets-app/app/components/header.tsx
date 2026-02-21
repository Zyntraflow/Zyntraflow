"use client";

import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useLogout, useSignerStatus } from "@account-kit/react";
import { BRAND_LOGO_SVG } from "@/lib/branding";
import { uiText } from "@/lib/i18n";
import Image from "next/image";
import Link from "next/link";

const text = uiText.header;

const navLinks = [
  { href: "/", label: text.home },
  { href: "/launch", label: text.launch },
  { href: "/alerts", label: text.alerts },
  { href: "/dashboard", label: text.dashboard },
  { href: "/setup", label: text.setup },
  { href: "/diagnostics", label: text.diagnostics },
  { href: "/premium/decrypt", label: text.premiumDecrypt },
];

export default function Header() {
  const { logout } = useLogout();
  const { isConnected } = useSignerStatus();

  return (
    <header className="border-b">
      <div className="container mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Image
            src={BRAND_LOGO_SVG}
            alt={uiText.common.appName}
            width={48}
            height={48}
            className="h-10 w-10 rounded-md"
          />
          <span className="font-semibold">{uiText.common.appName}</span>
        </div>

        <nav className="flex flex-wrap items-center gap-3 text-sm">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} className="text-muted-foreground hover:text-foreground">
              {link.label}
            </Link>
          ))}
        </nav>

        {isConnected && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
            onClick={() => logout()}
          >
            <LogOut className="h-4 w-4" />
            <span>{text.logout}</span>
          </Button>
        )}
      </div>
    </header>
  );
}
