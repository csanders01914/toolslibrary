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
  title: 'Tool Library — Community Tool Sharing',
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
