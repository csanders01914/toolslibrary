"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Wrench, MessageSquare, LogOut, User, Shield, Plus, Hammer } from "lucide-react";

export function Navbar() {
  const { data: session, status } = useSession();

  const navLinks = [
    { href: "/tools", label: "Browse Tools", icon: Hammer, glow: "cyan" },
    { href: "/skills", label: "Skills Exchange", icon: Wrench, glow: "purple" },
  ];

  const authLinks = [
    { href: "/tools/new", label: "+ Lend Tool", icon: Plus, glow: "cyan" },
    { href: "/skills/new", label: "+ Offer Skill", icon: Plus, glow: "purple" },
  ];

  return (
    <nav className="sticky top-0 z-50 bg-slate-950/75 backdrop-blur-xl border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-3" aria-label="Tool Library Home">
          <div className="relative p-2 bg-gradient-to-br from-cyan-500/20 to-purple-500/20 rounded-xl border border-cyan-500/30">
            <Hammer className="w-6 h-6 text-cyan-400" aria-hidden="true" />
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-purple-500 rounded-full opacity-70 blur-sm" />
          </div>
          <span className="font-extrabold text-xl bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-500 bg-clip-text text-transparent">
            Tool Library
          </span>
        </Link>

        {/* Navigation Pills */}
        <div className="hidden md:flex items-center gap-2">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const glowClasses =
              link.glow === "cyan"
                ? "hover:bg-cyan-500/10 hover:border-cyan-500/30 hover:shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                : "hover:bg-purple-500/10 hover:border-purple-500/30 hover:shadow-[0_0_15px_rgba(168,85,247,0.2)]";
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-slate-300 border border-transparent transition-all duration-200 ${glowClasses}`}
              >
                <Icon className="w-4 h-4" aria-hidden="true" />
                {link.label}
              </Link>
            );
          })}
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-3">
          {status === "loading" ? (
            <div className="w-24 h-8 bg-slate-800/50 rounded-xl animate-pulse border border-white/10" />
          ) : session ? (
            <>
              {/* Authenticated Navigation */}
              <div className="hidden sm:flex items-center gap-2">
                {authLinks.map((link) => {
                  const Icon = link.icon;
                  const glowClasses =
                    link.glow === "cyan"
                      ? "hover:bg-cyan-500/10 hover:border-cyan-500/30 hover:shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                      : "hover:bg-purple-500/10 hover:border-purple-500/30 hover:shadow-[0_0_15px_rgba(168,85,247,0.2)]";
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-slate-300 border border-transparent transition-all duration-200 ${glowClasses}`}
                    >
                      <Icon className="w-4 h-4" aria-hidden="true" />
                      {link.label}
                    </Link>
                  );
                })}
              </div>

              {/* User Menu */}
              <div className="flex items-center gap-3">
                <Link
                  href="/messages"
                  className="relative p-2 rounded-xl text-slate-400 hover:text-cyan-300 hover:bg-cyan-500/10 transition-all duration-200"
                  aria-label="Messages"
                >
                  <MessageSquare className="w-5 h-5" aria-hidden="true" />
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-cyan-500 text-slate-950 text-[10px] font-bold rounded-full flex items-center justify-center">
                    3
                  </span>
                </Link>

                <Link
                  href="/dashboard"
                  className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-slate-300 bg-slate-900/50 border border-white/10 hover:border-cyan-500/30 hover:bg-cyan-500/10 transition-all duration-200"
                >
                  <User className="w-4 h-4" aria-hidden="true" />
                  Dashboard
                </Link>

                {session.user.role === "ADMIN" && (
                  <Link
                    href="/admin"
                    className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-rose-300 bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 hover:shadow-[0_0_15px_rgba(251,113,133,0.3)] transition-all duration-200"
                  >
                    <Shield className="w-4 h-4" aria-hidden="true" />
                    Admin
                  </Link>
                )}

                {/* User Alias Badge */}
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-sm font-medium">
                  <User className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{session.user.alias}</span>
                </div>

                {/* Logout Button */}
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-slate-300 bg-slate-900/50 border border-white/10 hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-300 transition-all duration-200 flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" aria-hidden="true" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Guest Navigation */}
              <Link
                href="/login"
                className="hidden sm:px-4 py-2 rounded-xl text-sm font-medium text-slate-300 bg-slate-900/50 border border-white/10 hover:border-cyan-500/30 hover:bg-cyan-500/10 hover:text-cyan-300 transition-all duration-200"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="px-5 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:shadow-[0_0_30px_rgba(6,182,212,0.6)] transition-all duration-200 cursor-pointer flex items-center gap-2"
              >
                <User className="w-4 h-4" aria-hidden="true" />
                Join Collective
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}