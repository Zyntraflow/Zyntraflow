import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type ResponsiveGridProps = {
  children: ReactNode;
  className?: string;
};

export default function ResponsiveGrid({ children, className }: ResponsiveGridProps) {
  return <div className={cn("grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3", className)}>{children}</div>;
}
