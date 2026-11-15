"use client";

import { useEffect, useState } from "react";

// Small completion delights: a confetti burst where a checkbox was ticked, and a toast at the
// bottom of the screen. They're drawn by <Celebrations /> (in the app layout), which outlives
// the card: a completed task usually leaves its list right away.
const CONFETTI_EVENT = "gtd-confetti";
const TOAST_EVENT = "gtd-toast";
const CHEERS = ["יפה! צעד אחד קדימה", "ממשיכים ככה"];
const COLORS = ["#8fd49c", "#e38fbf", "#e8b44c", "#7fb2e6", "#a6e3b0"];
let turn = 0;

export function confettiAt(element: Element) {
  const r = element.getBoundingClientRect();
  window.dispatchEvent(new CustomEvent(CONFETTI_EVENT, { detail: { x: r.left, y: r.top, w: r.width, h: r.height } }));
}

export function celebrate(projectCleared = false) {
  const text = projectCleared ? "כל הפעולות הבאות הושלמו" : CHEERS[turn++ % CHEERS.length];
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: text }));
}

type Burst = { key: number; x: number; y: number; w: number; h: number };

export function Celebrations() {
  const [toast, setToast] = useState<{ text: string; key: number } | null>(null);
  const [bursts, setBursts] = useState<Burst[]>([]);
  useEffect(() => {
    let toastTimer: ReturnType<typeof setTimeout>;
    const onToast = (e: Event) => {
      clearTimeout(toastTimer);
      setToast({ text: (e as CustomEvent<string>).detail, key: Date.now() });
      toastTimer = setTimeout(() => setToast(null), 2500);
    };
    const onConfetti = (e: Event) => {
      const burst = { ...(e as CustomEvent<Omit<Burst, "key">>).detail, key: Date.now() + Math.random() };
      setBursts((all) => [...all, burst]);
      setTimeout(() => setBursts((all) => all.filter((b) => b.key !== burst.key)), 1000);
    };
    window.addEventListener(TOAST_EVENT, onToast);
    window.addEventListener(CONFETTI_EVENT, onConfetti);
    return () => {
      window.removeEventListener(TOAST_EVENT, onToast);
      window.removeEventListener(CONFETTI_EVENT, onConfetti);
      clearTimeout(toastTimer);
    };
  }, []);
  return (
    <>
      {bursts.map((b) => (
        <span key={b.key} className="confetti-burst" style={{ left: b.x, top: b.y, width: b.w, height: b.h }} aria-hidden>
          {COLORS.map((color, i) => (
            <span key={i} className={`confetti c${i}`} style={{ background: color }} />
          ))}
        </span>
      ))}
      <div className="toast-zone" role="status" aria-live="polite">
        {toast && (
          <span key={toast.key} className="toast">
            <span className="toast-dot" aria-hidden /> {toast.text}
          </span>
        )}
      </div>
    </>
  );
}
