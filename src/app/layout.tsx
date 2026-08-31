import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FarmLink Ghana — Farm Produce Market Link",
  description: "Connect farmers directly with buyers. No middlemen. Real prices. Real produce.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
