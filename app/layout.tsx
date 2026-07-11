import "./globals.css";

export const metadata = {
  title: "Bridget Pope Designs",
  description: "Luxury event design, client portal, and admin CRM.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
