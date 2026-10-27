/*
 * ToolsLibrary - A self-hostable, zero-PII tool library and skill-sharing platform built for local communities.
 * Copyright (C) 2026  Chris Sanders
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Menu, X } from "lucide-react";

function formatCountdown(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds);
  const h = String(Math.floor(clamped / 3600)).padStart(2, "0");
  const m = String(Math.floor((clamped % 3600) / 60)).padStart(2, "0");
  const s = String(clamped % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

export function Navbar() {
  const { data: session, status } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  const expiresAt = session?.expires ? new Date(session.expires).getTime() : null;

  useEffect(() => {
    if (!expiresAt) {
      setSecondsLeft(null);
      return;
    }
    const tick = () => {
      setSecondsLeft(Math.floor((expiresAt - Date.now()) / 1000));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const navLinks = [
    { href: "/tools", label: "TOOLS" },
    { href: "/skills", label: "SKILLS" },
  ];

  const closeMenu = () => setMenuOpen(false);

  return (
    <nav className="sticky top-0 z-50 bg-black border-b border-zinc-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="text-xl font-bold tracking-tight" aria-label="Tool Library Home">
          <span className="text-red-500">Tools</span>
          <span className="text-white">Library</span>
        </Link>

        {/* Desktop: nav links + session cluster */}
        <div className="hidden md:flex items-center gap-6">
          <div className="flex items-center gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="font-mono text-xs uppercase tracking-widest text-zinc-400 hover:text-white transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Right side (desktop) */}
          <div className="flex items-center gap-3">
          {status === "loading" ? (
            <span className="font-mono text-xs text-zinc-600">...</span>
          ) : session ? (
            <>
              <span className="font-mono text-xs text-zinc-300">{session.user.alias}</span>
              {secondsLeft !== null && (
                <span
                  className={`font-mono text-xs ${secondsLeft < 60 ? "text-red-400" : "text-emerald-400"}`}
                  aria-label="Session time remaining"
                >
                  {formatCountdown(secondsLeft)}
                </span>
              )}
              {session.user.role === "ADMIN" && (
                <Link
                  href="/admin"
                  className="font-mono text-xs px-2 py-1 border border-purple-500/60 text-purple-400 hover:bg-purple-500/10 transition-colors"
                >
                  ADMIN
                </Link>
              )}
              <Link
                href="/dashboard"
                className="font-mono text-xs px-2 py-1 border border-cyan-500/60 text-cyan-400 hover:bg-cyan-500/10 transition-colors"
              >
                DASHBOARD
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="font-mono text-xs px-2 py-1 border border-red-500/60 text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
              >
                BURN SESSION
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="font-mono text-xs px-2 py-1 border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors"
              >
                LOGIN
              </Link>
              <Link
                href="/register"
                className="font-mono text-xs px-2 py-1 border border-cyan-500/60 text-cyan-400 hover:bg-cyan-500/10 transition-colors"
              >
                JOIN
              </Link>
            </>
          )}
          </div>
        </div>

        {/* Mobile menu toggle */}
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-controls="mobile-nav"
          aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
          className="md:hidden p-3 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600 active:text-cyan-400 active:border-cyan-500/60 transition-colors cursor-pointer"
        >
          {menuOpen ? (
            <X className="w-5 h-5" aria-hidden="true" />
          ) : (
            <Menu className="w-5 h-5" aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Mobile disclosure panel */}
      {menuOpen && (
        <div id="mobile-nav" className="md:hidden border-t border-zinc-800 bg-black px-4 py-3 space-y-2">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={closeMenu}
              className="block font-mono text-xs uppercase tracking-widest text-zinc-400 hover:text-white active:text-cyan-400 transition-colors py-3"
            >
              {link.label}
            </Link>
          ))}
          {status === "loading" ? (
            <span className="block font-mono text-xs text-zinc-600 py-1">...</span>
          ) : session ? (
            <>
              <p className="font-mono text-xs text-zinc-300 py-1">{session.user.alias}</p>
              {secondsLeft !== null && (
                <p
                  className={`font-mono text-xs py-1 ${secondsLeft < 60 ? "text-red-400" : "text-emerald-400"}`}
                >
                  SESSION: {formatCountdown(secondsLeft)}
                </p>
              )}
              {session.user.role === "ADMIN" && (
                <Link
                  href="/admin"
                  onClick={closeMenu}
                  className="block font-mono text-xs px-2 py-3 border border-purple-500/60 text-purple-400 hover:bg-purple-500/10 active:bg-purple-500/20 transition-colors"
                >
                  ADMIN
                </Link>
              )}
              <Link
                href="/dashboard"
                onClick={closeMenu}
                className="block font-mono text-xs px-2 py-3 border border-cyan-500/60 text-cyan-400 hover:bg-cyan-500/10 active:bg-cyan-500/20 transition-colors"
              >
                DASHBOARD
              </Link>
              <button
                onClick={() => {
                  closeMenu();
                  signOut({ callbackUrl: "/" });
                }}
                className="block w-full text-left font-mono text-xs px-2 py-3 border border-red-500/60 text-red-400 hover:bg-red-500/10 active:bg-red-500/20 transition-colors cursor-pointer"
              >
                BURN SESSION
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                onClick={closeMenu}
                className="block font-mono text-xs px-2 py-3 border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 active:text-white transition-colors"
              >
                LOGIN
              </Link>
              <Link
                href="/register"
                onClick={closeMenu}
                className="block font-mono text-xs px-2 py-3 border border-cyan-500/60 text-cyan-400 hover:bg-cyan-500/10 active:bg-cyan-500/20 transition-colors"
              >
                JOIN
              </Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
}
