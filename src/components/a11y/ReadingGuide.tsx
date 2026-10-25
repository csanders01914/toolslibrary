"use client";

import { useEffect, useRef, useState } from "react";
import { useAccessibility } from "@/context/AccessibilityContext";

export function ReadingGuide() {
  const { prefs, ready } = useAccessibility();
  const [y, setY] = useState(0);
  const [visible, setVisible] = useState(false);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!ready || !prefs.readingGuide) {
      setVisible(false);
      return;
    }

    const onMove = (e: MouseEvent) => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        setY(e.clientY);
        setVisible(true);
      });
    };

    const onLeave = () => setVisible(false);

    window.addEventListener("mousemove", onMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", onLeave);

    return () => {
      window.removeEventListener("mousemove", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [prefs.readingGuide, ready]);

  if (!ready || !prefs.readingGuide) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed left-0 right-0 z-[9999]"
      style={{ top: y - 1, opacity: visible ? 1 : 0, transition: "opacity 120ms ease" }}
    >
      <div
        className="h-[2px] w-full"
        style={{
          background: "#FFE600",
        }}
      />
    </div>
  );
}
