"use client";

import { useEffect, useState } from "react";

// PWA install prompt — shows a small bottom card inviting the user to install
// FarmLink to their home screen (Android/Chrome via beforeinstallprompt;
// iOS Safari shows its own "Add to Home Screen" flow, hinted at here).
// Dismissal is remembered in localStorage — never nags twice.

export default function PWAInstallPrompt() {
  const [deferred, setDeferred] = useState<any>(null);
  const [visible, setVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // already installed? never show
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    const dismissed = localStorage.getItem("farmlink-install-dismissed");
    if (dismissed) return;

    const isiOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIsIOS(isiOS);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e);
      setTimeout(() => setVisible(true), 4000);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    // iOS never fires beforeinstallprompt — show the hint card instead
    if (isiOS) setTimeout(() => setVisible(true), 4000);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const close = () => {
    setVisible(false);
    localStorage.setItem("farmlink-install-dismissed", "1");
  };

  const install = async () => {
    if (deferred) {
      deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice?.outcome === "accepted") setVisible(false);
      setDeferred(null);
    } else {
      close();
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-3 left-3 right-3 z-[60] md:left-auto md:right-6 md:w-96">
      <div className="bg-white rounded-xl shadow-2xl border border-gray-200 p-4 flex items-center gap-3">
        <img src="/icon-192.png" alt="FarmLink" className="w-11 h-11 rounded-lg shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="font-bold text-[#1b5e20] text-sm">Install the FarmLink app</div>
          <div className="text-xs text-gray-500 leading-snug">
            {isIOS
              ? "In Safari: Share button → 'Add to Home Screen'."
              : "Quick access from your home screen — works even with poor network."}
          </div>
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          {!isIOS && (
            <button onClick={install} className="bg-[#1b5e20] text-white text-xs font-bold px-3 py-2 rounded-lg hover:bg-[#0d3818]">
              Install
            </button>
          )}
          <button onClick={close} className="text-gray-400 text-xs px-3 py-1 hover:text-gray-600">
            {isIOS ? "Close" : "Later"}
          </button>
        </div>
      </div>
    </div>
  );
}