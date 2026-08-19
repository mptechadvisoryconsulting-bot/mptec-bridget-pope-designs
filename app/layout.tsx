import type { Metadata } from "next";
import "./globals.css";

const siteUrl = "https://bridget-pope-designs.us";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Bridget Pope Designs | Event Design & Planning",
    template: "%s | Bridget Pope Designs",
  },
  description: "Luxury event design and planning by Bridget Pope Designs in Murfreesboro, Tennessee.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "Bridget Pope Designs",
    title: "Bridget Pope Designs | Event Design & Planning",
    description: "Luxury event design and planning by Bridget Pope Designs in Murfreesboro, Tennessee.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
