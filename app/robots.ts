import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/client/", "/auth/", "/api/"],
    },
    sitemap: "https://bridget-pope-designs.us/sitemap.xml",
  };
}
