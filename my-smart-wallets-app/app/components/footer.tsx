import Link from "next/link";
import { Github, MessageCircle, Twitter } from "lucide-react";

const socialLinks = [
  {
    href: "https://discord.gg/p7Ty4ERH",
    label: "Discord",
    icon: MessageCircle,
  },
  {
    href: "https://x.com/zyntraflow",
    label: "X",
    icon: Twitter,
  },
  {
    href: "https://github.com/Zyntraflow",
    label: "GitHub",
    icon: Github,
  },
];

export default function Footer() {
  return (
    <footer className="border-t bg-background/95">
      <div className="container mx-auto flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">Zyntraflow Community</p>
        <div className="flex flex-wrap gap-2">
          {socialLinks.map((social) => {
            const Icon = social.icon;
            return (
              <Link
                key={social.href}
                href={social.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-10 items-center gap-2 rounded border px-3 py-2 text-sm hover:bg-muted"
              >
                <Icon className="h-4 w-4" />
                <span>{social.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </footer>
  );
}
