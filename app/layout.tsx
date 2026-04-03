import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Bridgeway Connects",
  description: "Privacy-first screening tool connecting individuals to support resources.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* DEMO BANNER */}
        <div
          style={{
            width: "100%",
            background: "#FEF3C7",
            color: "#92400E",
            padding: "10px 16px",
            textAlign: "center",
            fontSize: 14,
            fontWeight: 600,
            borderBottom: "1px solid #FCD34D",
            position: "sticky",
            top: 0,
            zIndex: 1000,
          }}
        >
          Bridgeway Connects Demo , Privacy-first screening tool , No personal data is stored
        </div>

        {children}
      </body>
    </html>
  );
}