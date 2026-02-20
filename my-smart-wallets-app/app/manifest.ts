import type { MetadataRoute } from "next";
import { BRAND_LOGO_PNG, BRAND_LOGO_SVG } from "@/lib/branding";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Zyntraflow",
    short_name: "Zyntraflow",
    description: "Read-only scanner with signed free feed and encrypted premium packages.",
    start_url: "/",
    display: "standalone",
    background_color: "#0b1220",
    theme_color: "#0b1220",
    icons: [
      {
        src: BRAND_LOGO_SVG,
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: BRAND_LOGO_PNG,
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
