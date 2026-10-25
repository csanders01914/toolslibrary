"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useSession } from "next-auth/react";

export interface A11yPrefs {
  contrast: "normal" | "high" | "inverted" | "monochrome";
  fontSize: "100" | "125" | "150";
  dyslexic: boolean;
  textSpacing: boolean;
  focusIndicators: boolean;
  reducedMotion: boolean;
  bigCursor: boolean;
  readingGuide: boolean;
}

export const DEFAULT_PREFS: A11yPrefs = {
  contrast: "normal",
  fontSize: "100",
  dyslexic: false,
  textSpacing: false,
  focusIndicators: false,
  reducedMotion: false,
  bigCursor: false,
  readingGuide: false,
};

const COOKIE_NAME = "a11y_prefs";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function readCookiePrefs(): Partial<A11yPrefs> {
  if (typeof document === "undefined") return {};
  try {
    const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]+)`));
    if (!match) return {};
    return JSON.parse(decodeURIComponent(match[1])) as Partial<A11yPrefs>;
  } catch {
    return {};
  }
}

function writeCookiePrefs(prefs: A11yPrefs) {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(
    JSON.stringify(prefs)
  )}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
}

function applyPrefsToDocument(prefs: A11yPrefs) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (prefs.contrast && prefs.contrast !== "normal") {
    root.setAttribute("data-contrast", prefs.contrast);
  } else {
    root.removeAttribute("data-contrast");
  }
  if (prefs.fontSize && prefs.fontSize !== "100") {
    root.setAttribute("data-font-size", prefs.fontSize);
  } else {
    root.removeAttribute("data-font-size");
  }
  if (prefs.dyslexic) root.setAttribute("data-dyslexic", "true");
  else root.removeAttribute("data-dyslexic");
  if (prefs.textSpacing) root.setAttribute("data-text-spacing", "true");
  else root.removeAttribute("data-text-spacing");
  if (prefs.focusIndicators) root.setAttribute("data-focus-indicators", "true");
  else root.removeAttribute("data-focus-indicators");
  if (prefs.reducedMotion) root.setAttribute("data-reduced-motion", "true");
  else root.removeAttribute("data-reduced-motion");
  if (prefs.bigCursor) root.setAttribute("data-big-cursor", "true");
  else root.removeAttribute("data-big-cursor");
}

interface AccessibilityContextValue {
  prefs: A11yPrefs;
  ready: boolean;
  announcement: string;
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
  updatePref: <K extends keyof A11yPrefs>(key: K, value: A11yPrefs[K]) => void;
  resetAll: () => void;
}

const AccessibilityContext = createContext<AccessibilityContextValue | null>(null);

export function useAccessibility(): AccessibilityContextValue {
  const ctx = useContext(AccessibilityContext);
  if (!ctx) {
    throw new Error("useAccessibility must be used within AccessibilityProvider");
  }
  return ctx;
}

const LABELS: Record<keyof A11yPrefs, string> = {
  contrast: "Contrast mode",
  fontSize: "Font size",
  dyslexic: "Dyslexia-friendly font",
  textSpacing: "Increased text spacing",
  focusIndicators: "Enhanced focus indicators",
  reducedMotion: "Reduced motion",
  bigCursor: "Large high-contrast cursor",
  readingGuide: "Reading guide",
};

export function AccessibilityProvider({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const [prefs, setPrefs] = useState<A11yPrefs>(DEFAULT_PREFS);
  const [ready, setReady] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hydrate from cookie after mount (the inline <head> script already applied
  // the attributes pre-paint to prevent FOUC; this syncs React state).
  useEffect(() => {
    const cookiePrefs = readCookiePrefs();
    setPrefs({ ...DEFAULT_PREFS, ...cookiePrefs });
    applyPrefsToDocument({ ...DEFAULT_PREFS, ...cookiePrefs });
    setReady(true);
  }, []);

  // Apply attribute changes and persist whenever prefs change (after hydration).
  useEffect(() => {
    if (!ready) return;
    applyPrefsToDocument(prefs);
    writeCookiePrefs(prefs);
  }, [prefs, ready]);

  // Debounced anonymous sync to the account when logged in.
  useEffect(() => {
    if (!ready || status !== "authenticated") return;
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      fetch("/api/user/accessibility", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      }).catch(() => {});
    }, 800);
    return () => {
      if (syncTimer.current) clearTimeout(syncTimer.current);
    };
  }, [prefs, ready, status]);

  const announce = useCallback((message: string) => {
    setAnnouncement("");
    // Double requestAnimationFrame ensures the live region clears before repopulating.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setAnnouncement(message));
    });
  }, []);

  const updatePref = useCallback(
    <K extends keyof A11yPrefs>(key: K, value: A11yPrefs[K]) => {
      setPrefs((prev) => {
        const next = { ...prev, [key]: value };
        const label = LABELS[key];
        const stateText =
          typeof value === "boolean" ? (value ? "on" : "off") : String(value);
        announce(`${label} ${stateText}`);
        return next;
      });
    },
    [announce]
  );

  const resetAll = useCallback(() => {
    setPrefs(DEFAULT_PREFS);
    announce("All accessibility settings reset to defaults");
  }, [announce]);

  const value = useMemo(
    () => ({ prefs, ready, announcement, menuOpen, setMenuOpen, updatePref, resetAll }),
    [prefs, ready, announcement, menuOpen, updatePref, resetAll]
  );

  return (
    <AccessibilityContext.Provider value={value}>
      {children}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>
    </AccessibilityContext.Provider>
  );
}
