"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

// Registers the service worker once per page load (production only, so dev builds aren't cached).
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
  }, []);
  return null;
}

// Android/Chrome offers installation through beforeinstallprompt; the button appears only then.
export function InstallButton() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPromptEvent);
    };
    const onInstalled = () => setPrompt(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!prompt) return null;
  return (
    <button
      className="nav-item install"
      onClick={async () => {
        await prompt.prompt();
        await prompt.userChoice;
        setPrompt(null);
      }}
    >
      <Download size={20} />
      <span>התקנת האפליקציה</span>
    </button>
  );
}
