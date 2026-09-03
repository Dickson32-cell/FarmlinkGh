import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FarmLink Ghana — Farm Produce Market Link",
  description: "Connect farmers directly with buyers. No middlemen. Real prices. Real produce.",
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
