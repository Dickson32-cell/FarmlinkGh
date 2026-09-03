import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FarmLink Ghana — Farm Produce Market Link",
  description: "Connect farmers directly with buyers. No middlemen. Real prices. Real produce.",
  // Social sharing (WhatsApp / Telegram / Facebook / X): brand-green card
  // with the FarmLink logo + name — replaces the default Vercel share block.
  openGraph: {
    title: "FarmLink Ghana",
    description: "Farmers sell direct. Buyers pay safe. Ghana Card-verified farmers, escrow payments, GPS delivery.",
    url: "https://www.farmlinkgh.app",
    siteName: "FarmLink Ghana",
    type: "website",
    images: [{ url: "https://www.farmlinkgh.app/og-image.jpg", width: 1200, height: 630, alt: "FarmLink Ghana — www.farmlinkgh.app" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "FarmLink Ghana",
    description: "Farmers sell direct. Buyers pay safe. Escrow payments. GPS delivery.",
    images: ["https://www.farmlinkgh.app/og-image.jpg"],
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

// Proper mobile rendering: width=device-width, no forced zoom-out
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
