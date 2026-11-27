import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "V11 Estimate",
    short_name: "V11 Estimate",
    description: "One controlled workspace for sourcing costs, exchange rates, markup and approvals.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "portrait",
    background_color: "#f7f8fc",
    theme_color: "#2f4bff",
    lang: "en",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Dashboard", short_name: "Dashboard", url: "/dashboard", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "New RFQ", short_name: "New RFQ", url: "/rfqs/new", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Approvals", short_name: "Approvals", url: "/approval", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
