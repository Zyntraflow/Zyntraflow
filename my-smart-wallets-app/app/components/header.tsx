"use client";

import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useLogout, useSignerStatus } from "@account-kit/react";
import { BRAND_LOGO_SVG } from "@/lib/branding";
import Image from "next/image";
import Link from "next/link";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/launch", label: "Launch" },
  { href: "/alerts", label: "Alerts" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/diagnostics", label: "Diagnostics" },
  { href: "/premium/decrypt", label: "Premium Decrypt" },
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
            alt="Zyntraflow"
            width={48}
            height={48}
            className="h-10 w-10 rounded-md"
          />
          <span className="font-semibold">Zyntraflow</span>
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
            <span>Logout</span>
          </Button>
        )}
      </div>
    </header>
  );
}
