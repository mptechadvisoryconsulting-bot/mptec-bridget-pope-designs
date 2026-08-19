import type { MetadataRoute } from "next";

const siteUrl = "https://bridget-pope-designs.us";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["", "/about", "/contact", "/faq", "/gallery", "/inquire", "/reviews", "/services"];

  return routes.map((route) => ({
    url: `${siteUrl}${route}`,
    changeFrequency: route === "" || route === "/gallery" ? "weekly" : "monthly",
    priority: route === "" ? 1 : route === "/inquire" ? 0.9 : 0.7,
  }));
}
