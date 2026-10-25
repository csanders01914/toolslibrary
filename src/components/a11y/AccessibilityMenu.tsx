"use client";

import { useEffect, useRef } from "react";
import { Accessibility, X, RotateCcw, Check } from "lucide-react";
import { useAccessibility, type A11yPrefs } from "@/context/AccessibilityContext";

const FONT_SIZES: Array<{ value: A11yPrefs["fontSize"]; label: string }> = [
  { value: "100", label: "100%" },
  { value: "125", label: "125%" },
  { value: "150", label: "150%" },
];

const CONTRAST_OPTIONS: Array<{ value: A11yPrefs["contrast"]; label: string }> = [
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "inverted", label: "Inverted" },
  { value: "monochrome", label: "Mono" },
];

const TOGGLES: Array<{ key: keyof A11yPrefs; label: string; hint: string }> = [
  { key: "dyslexic", label: "Dyslexia-Friendly Font", hint: "Local OpenDyslexic font stack" },
  { key: "textSpacing", label: "Increased Text Spacing", hint: "Wider line, letter, and word spacing" },
  { key: "focusIndicators", label: "Enhanced Focus Indicators", hint: "Bold yellow outlines on keyboard focus" },
  { key: "reducedMotion", label: "Reduce Motion", hint: "Disable animations and transitions" },
  { key: "bigCursor", label: "Large High-Contrast Cursor", hint: "Enlarged yellow pointer" },
  { key: "readingGuide", label: "Reading Guide", hint: "Horizontal bar follows the cursor" },
];

export function AccessibilityMenu() {
  const { prefs, menuOpen, setMenuOpen, updatePref, resetAll } = useAccessibility();
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Global keyboard shortcuts: Alt+A toggle menu, Alt+M focus main content, Escape close.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === "a" || e.key === "A")) {
        e.preventDefault();
        setMenuOpen(!menuOpen);
      } else if (e.altKey && (e.key === "m" || e.key === "M")) {
        e.preventDefault();
        const main = document.getElementById("main-content");
        if (main) {
          main.focus();
          main.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      } else if (e.key === "Escape" && menuOpen) {
        e.preventDefault();
        setMenuOpen(false);
        triggerRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen, setMenuOpen]);

  // Move focus into the dialog when it opens.
  useEffect(() => {
    if (menuOpen) {
      requestAnimationFrame(() => {
        panelRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
      });
    }
  }, [menuOpen]);

  return (
    <>
      {/* Floating trigger */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setMenuOpen(!menuOpen)}
        aria-expanded={menuOpen}
        aria-haspopup="dialog"
        aria-controls="a11y-menu-panel"
        aria-label="Accessibility settings (Alt+A)"
        className="fixed bottom-6 right-6 z-[9998] flex h-14 w-14 items-center justify-center rounded-none border border-zinc-700 bg-black text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white cursor-pointer"
      >
        <Accessibility className="h-6 w-6" aria-hidden="true" />
      </button>

      {/* Dialog panel */}
      {menuOpen && (
        <div
          ref={panelRef}
          id="a11y-menu-panel"
          role="dialog"
          aria-modal="false"
          aria-label="Accessibility settings"
          className="fixed bottom-24 right-6 z-[9998] w-[calc(100vw-3rem)] max-w-sm max-h-[75vh] overflow-y-auto rounded-none border border-zinc-800 bg-black p-5"
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-400">
              ACCESSIBILITY // SETTINGS
            </h2>
            <button
              type="button"
              data-autofocus
              onClick={() => {
                setMenuOpen(false);
                triggerRef.current?.focus();
              }}
              aria-label="Close accessibility settings"
              className="flex h-11 w-11 items-center justify-center rounded-none border border-zinc-800 text-zinc-400 transition-colors hover:border-zinc-600 hover:text-white cursor-pointer"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          {/* Contrast mode */}
          <fieldset className="mb-4">
            <legend className="mb-2 font-mono text-[11px] uppercase tracking-widest text-zinc-500">
              Contrast Mode
            </legend>
            <div role="radiogroup" aria-label="Contrast mode" className="flex flex-wrap gap-2">
              {CONTRAST_OPTIONS.map((option) => {
                const selected = prefs.contrast === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => updatePref("contrast", option.value)}
                    className={`min-h-[44px] min-w-[44px] rounded-none border px-3 py-2 font-mono text-xs uppercase tracking-wider transition-colors cursor-pointer ${
                      selected
                        ? "border-cyan-500/60 bg-cyan-500/10 text-cyan-400"
                        : "border-zinc-800 bg-black text-zinc-400 hover:border-zinc-600 hover:text-white"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* Font size */}
          <fieldset className="mb-4">
            <legend className="mb-2 font-mono text-[11px] uppercase tracking-widest text-zinc-500">
              Font Size
            </legend>
            <div role="radiogroup" aria-label="Font size" className="flex gap-2">
              {FONT_SIZES.map((option) => {
                const selected = prefs.fontSize === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => updatePref("fontSize", option.value)}
                    className={`min-h-[44px] min-w-[44px] flex-1 rounded-none border px-3 py-2 font-mono text-xs uppercase tracking-wider transition-colors cursor-pointer ${
                      selected
                        ? "border-cyan-500/60 bg-cyan-500/10 text-cyan-400"
                        : "border-zinc-800 bg-black text-zinc-400 hover:border-zinc-600 hover:text-white"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* Boolean toggles */}
          <div className="mb-4 space-y-2">
            {TOGGLES.map((toggle) => {
              const checked = Boolean(prefs[toggle.key]);
              return (
                <button
                  key={toggle.key}
                  type="button"
                  role="switch"
                  aria-checked={checked}
                  onClick={() => updatePref(toggle.key, !checked as never)}
                  className="flex w-full min-h-[44px] items-center justify-between gap-3 rounded-none border border-zinc-800 bg-black px-4 py-2.5 text-left transition-colors hover:border-zinc-600 cursor-pointer"
                >
                  <span>
                    <span className="block font-mono text-xs text-zinc-200">{toggle.label}</span>
                    <span className="block font-mono text-[11px] text-zinc-500">{toggle.hint}</span>
                  </span>
                  <span
                    aria-hidden="true"
                    className={`relative h-6 w-10 shrink-0 border transition-colors ${
                      checked
                        ? "border-emerald-500/60 bg-emerald-500/10"
                        : "border-zinc-800 bg-black"
                    }`}
                  >
                    <span
                      className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 transition-colors ${
                        checked
                          ? "left-[calc(100%-1.25rem)] bg-emerald-400"
                          : "left-1 bg-zinc-600"
                      }`}
                    />
                  </span>
                </button>
              );
            })}
          </div>

          {/* Reset all */}
          <button
            type="button"
            onClick={resetAll}
            className="flex w-full min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-none border border-red-500/60 px-4 py-2.5 font-mono text-xs uppercase tracking-widest text-red-400 transition-colors hover:bg-red-500/10"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Reset All
          </button>

          <p className="mt-3 flex items-start gap-1.5 font-mono text-[11px] leading-relaxed text-zinc-500">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden="true" />
            Settings are stored anonymously in a local cookie and synced to your account without
            any personal data. Shortcuts: Alt+A menu, Alt+M main content, Escape close.
          </p>
        </div>
      )}
    </>
  );
}
