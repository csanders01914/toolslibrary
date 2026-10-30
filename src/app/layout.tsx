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

import './globals.css';
import type { ReactNode } from 'react';
import { SessionProvider } from 'next-auth/react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/footer/Footer';
import { AccessibilityProvider } from '@/context/AccessibilityContext';
import { AccessibilityMenu } from '@/components/a11y/AccessibilityMenu';
import { ReadingGuide } from '@/components/a11y/ReadingGuide';
import { MessengerWidget } from '@/components/messenger/MessengerWidget';

export const metadata = {
  title: 'ToolsLibrary — Community Tool Sharing',
  description: 'Zero-PII peer-to-peer tool lending and skills exchange.',
  icons: { icon: '/icon.png' },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="bg-workshop-canvas bg-[#050505] text-zinc-100 antialiased relative overflow-x-hidden">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function(){
                try {
                  var m = document.cookie.match(/(?:^|; )a11y_prefs=([^;]+)/);
                  if (m) {
                    var p = JSON.parse(decodeURIComponent(m[1]));
                    var d = document.documentElement;
                    if (p.contrast) d.setAttribute('data-contrast', p.contrast);
                    if (p.fontSize) d.setAttribute('data-font-size', p.fontSize);
                    if (p.dyslexic) d.setAttribute('data-dyslexic', 'true');
                    if (p.textSpacing) d.setAttribute('data-text-spacing', 'true');
                    if (p.focusIndicators) d.setAttribute('data-focus-indicators', 'true');
                    if (p.reducedMotion) d.setAttribute('data-reduced-motion', 'true');
                    if (p.bigCursor) d.setAttribute('data-big-cursor', 'true');
                    if (p.underlineLinks) d.setAttribute('data-underline-links', 'true');
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-screen flex flex-col">
        <SessionProvider>
          <AccessibilityProvider>
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] bg-black text-cyan-400 border border-cyan-500/60 font-mono text-xs uppercase tracking-widest px-4 py-2"
            >
              Skip to main content
            </a>
            <Navbar />
            <main id="main-content" tabIndex={-1} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
              {children}
            </main>
            <Footer />
            <MessengerWidget />
            <AccessibilityMenu />
            <ReadingGuide />
          </AccessibilityProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
