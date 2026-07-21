import "./globals.css";

export const metadata = {
  title: "Bridget Pope Designs",
  description: "Luxury event design and planning by Bridget Pope Designs.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
