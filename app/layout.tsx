import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Casper Operations Dashboard",
  description: "Real-time CMO agent pipeline for Traqd",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ fontFamily: "'Inter', sans-serif", backgroundColor: "#000000" }}>
        {children}
      </body>
    </html>
  );
}
