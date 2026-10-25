import './globals.css';
import type { ReactNode } from 'react';
import { SessionProvider } from 'next-auth/react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/footer/Footer';
import { AccessibilityProvider } from '@/context/AccessibilityContext';
import { AccessibilityMenu } from '@/components/a11y/AccessibilityMenu';
import { ReadingGuide } from '@/components/a11y/ReadingGuide';

export const metadata = {
  title: 'Tool Library — Community Tool Sharing',
  description: 'Zero-PII peer-to-peer tool lending and skills exchange.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="bg-[#05070e] text-slate-100 antialiased bg-cypher-grid relative overflow-x-hidden">
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
            <a href="#main-content" className="sr-only focus:not-sr-only bg-cyan-400 text-slate-950 px-4 py-2 rounded">
              Skip to main content
            </a>
            <Navbar />
            <div className="fixed -top-40 -left-40 w-96 h-96 bg-cyan-500/15 rounded-full blur-[128px] pointer-events-none" />
            <div className="fixed top-20 -right-40 w-96 h-96 bg-purple-600/15 rounded-full blur-[128px] pointer-events-none" />
            <div className="fixed -bottom-40 left-1/3 w-96 h-96 bg-emerald-500/10 rounded-full blur-[128px] pointer-events-none" />
            <main id="main-content" tabIndex={-1} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10 flex-1">
              {children}
            </main>
            <Footer />
            <AccessibilityMenu />
            <ReadingGuide />
          </AccessibilityProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
