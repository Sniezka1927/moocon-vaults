import type { Metadata } from "next";
import { Space_Grotesk, Manrope } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["700"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600", "800"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://moocon.xyz"),
  title: "Moocon",
  description:
    "Earn platform with outsized rewards built on top of Jupiter Lend.",
  icons: {
    icon: "/icon.png",
  },
  openGraph: {
    type: "website",
    title: "Moocon",
    description:
      "Earn platform with outsized rewards built on top of Jupiter Lend.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Moocon",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Moocon",
    description:
      "Earn platform with outsized rewards built on top of Jupiter Lend.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${manrope.variable} antialiased`}
    >
      <body className="min-h-screen bg-background text-foreground font-body">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
