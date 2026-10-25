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
        className="fixed bottom-6 right-6 z-[9998] flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-slate-950 shadow-[0_0_25px_rgba(6,182,212,0.5)] hover:shadow-[0_0_35px_rgba(6,182,212,0.7)] hover:scale-105 transition-all duration-200 cursor-pointer"
      >
        <Accessibility className="w-7 h-7" aria-hidden="true" />
      </button>

      {/* Dialog panel */}
      {menuOpen && (
        <div
          ref={panelRef}
          id="a11y-menu-panel"
          role="dialog"
          aria-modal="false"
          aria-label="Accessibility settings"
          className="fixed bottom-24 right-6 z-[9998] w-[calc(100vw-3rem)] max-w-sm max-h-[75vh] overflow-y-auto bg-slate-900/90 backdrop-blur-xl border border-cyan-500/30 rounded-2xl p-5 shadow-[0_0_50px_-10px_rgba(6,182,212,0.4)]"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-cyan-300">Accessibility</h2>
            <button
              type="button"
              data-autofocus
              onClick={() => {
                setMenuOpen(false);
                triggerRef.current?.focus();
              }}
              aria-label="Close accessibility settings"
              className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 hover:text-slate-100 hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>

          {/* Contrast mode */}
          <fieldset className="mb-4">
            <legend className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
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
                    className={`min-h-[44px] min-w-[44px] px-3 py-2 rounded-xl text-xs font-semibold border transition-all duration-200 cursor-pointer ${
                      selected
                        ? "bg-cyan-500/20 text-cyan-200 border-cyan-400/60 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                        : "bg-slate-950/80 text-slate-400 border-white/15 hover:border-cyan-500/40 hover:text-cyan-300"
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
            <legend className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
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
                    className={`flex-1 min-h-[44px] min-w-[44px] px-3 py-2 rounded-xl text-xs font-semibold border transition-all duration-200 cursor-pointer ${
                      selected
                        ? "bg-cyan-500/20 text-cyan-200 border-cyan-400/60 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                        : "bg-slate-950/80 text-slate-400 border-white/15 hover:border-cyan-500/40 hover:text-cyan-300"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* Boolean toggles */}
          <div className="space-y-2 mb-4">
            {TOGGLES.map((toggle) => {
              const checked = Boolean(prefs[toggle.key]);
              return (
                <button
                  key={toggle.key}
                  type="button"
                  role="switch"
                  aria-checked={checked}
                  onClick={() => updatePref(toggle.key, !checked as never)}
                  className="w-full min-h-[44px] flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-slate-950/80 border border-white/15 hover:border-cyan-500/40 transition-all duration-200 cursor-pointer text-left"
                >
                  <span>
                    <span className="block text-sm font-medium text-slate-200">{toggle.label}</span>
                    <span className="block text-xs text-slate-500">{toggle.hint}</span>
                  </span>
                  <span
                    aria-hidden="true"
                    className={`relative shrink-0 w-10 h-6 rounded-full border transition-colors duration-200 ${
                      checked
                        ? "bg-cyan-500/30 border-cyan-400/60"
                        : "bg-slate-800 border-white/20"
                    }`}
                  >
                    <span
                      className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full transition-all duration-200 ${
                        checked
                          ? "left-[calc(100%-1.25rem)] bg-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.6)]"
                          : "left-1 bg-slate-500"
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
            className="w-full min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-rose-500/10 text-rose-300 border border-rose-500/30 hover:bg-rose-500/20 hover:shadow-[0_0_15px_rgba(244,63,94,0.3)] transition-all duration-200 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
            Reset All
          </button>

          <p className="mt-3 text-[11px] text-slate-500 leading-relaxed flex items-start gap-1.5">
            <Check className="w-3.5 h-3.5 mt-0.5 shrink-0 text-emerald-400" aria-hidden="true" />
            Settings are stored anonymously in a local cookie and synced to your account without
            any personal data. Shortcuts: Alt+A menu, Alt+M main content, Escape close.
          </p>
        </div>
      )}
    </>
  );
}
