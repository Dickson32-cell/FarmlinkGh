import type { Metadata, Viewport } from "next";
import "./globals.css";
import ServiceWorkerRegister from "@/components/serviceWorkerRegister";
import PWAInstallPrompt from "@/components/pwaInstallPrompt";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.farmlinkgh.app"),
  title: "FarmLink Ghana — Buy & Sell Farm Produce Direct, No Middlemen",
  description:
    "Ghana's farm marketplace. Buy fresh produce directly from Ghana Card-verified farmers — maize, cassava, vegetables and more. Escrow-protected payments, GPS delivery, SMS alerts on any phone. Sell your harvest at real prices.",
  keywords: [
    "FarmLink Ghana",
    "buy farm produce Ghana",
    "sell farm produce Ghana",
    "Ghana farm market online",
    "farmers market Ghana",
    "buy maize Ghana",
    "agricultural marketplace Ghana",
    "farm produce Koforidua",
  ],
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
  // PWA: installable app on Android home screens; iOS via Add to Home Screen
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "FarmLink",
    statusBarStyle: "black-translucent",
  },
};

// Proper mobile rendering: width=device-width, no forced zoom-out.
// themeColor drives the Android address-bar color when installed.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#1b5e20",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>

        {/* Structured data for Google: organization + site search + marketplace */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "Organization",
                  "@id": "https://www.farmlinkgh.app/#org",
                  name: "FarmLink Ghana",
                  url: "https://www.farmlinkgh.app",
                  logo: "https://www.farmlinkgh.app/logo.jpg",
                  description:
                    "Ghana farm marketplace connecting Ghana Card-verified farmers directly with buyers. Escrow payments, GPS delivery, SMS alerts.",
                  contactPoint: {
                    "@type": "ContactPoint",
                    telephone: "+233595726252",
                    contactType: "customer support",
                    email: "support@farmlinkgh.app",
                    areaServed: "GH",
                    availableLanguage: ["en"],
                  },
                },
                {
                  "@type": "WebSite",
                  "@id": "https://www.farmlinkgh.app/#site",
                  url: "https://www.farmlinkgh.app",
                  name: "FarmLink Ghana",
                  publisher: { "@id": "https://www.farmlinkgh.app/#org" },
                  inLanguage: "en",
                },
                {
                  "@type": "WebPage",
                  "@id": "https://www.farmlinkgh.app/#home",
                  url: "https://www.farmlinkgh.app",
                  name: "FarmLink Ghana — Buy & Sell Farm Produce Direct",
                  isPartOf: { "@id": "https://www.farmlinkgh.app/#site" },
                  about: { "@id": "https://www.farmlinkgh.app/#org" },
                },
              ],
            }),
          }}
        />

        {children}
        <ServiceWorkerRegister />
        <PWAInstallPrompt />
      </body>
    </html>
  );
}
