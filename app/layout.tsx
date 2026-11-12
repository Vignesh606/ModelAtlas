import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import { CompareTray } from "@/components/compare-tray";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { Analytics } from "@/components/site/analytics";
import { CommandPalette } from "@/components/site/command-palette";
import { CookieSettingsButton } from "@/components/site/cookie-settings-button";
import { FloatingLayer } from "@/components/site/floating-layer";
import { SITE } from "@/lib/site";
import { themeInitScript } from "@/lib/theme";
import "./globals.css";

// UI text
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
// Prices and numbers
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
// Serif display face for headlines and section titles (matches the reference design)
const newsreader = Newsreader({ variable: "--font-newsreader", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "ModelAtlas", template: "%s · ModelAtlas" },
  description: "Discover, compare and try AI models: pricing, context windows, capabilities and cost estimates.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: the inline script sets data-theme on <html>
    // before React hydrates, so the server and client attributes differ on purpose.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="flex min-h-dvh flex-col bg-bg font-sans text-fg">
        <a
          href="#main"
          className="sr-only rounded-md bg-primary px-3 py-2 text-sm text-primary-fg focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50"
        >
          Skip to content
        </a>
        <SiteHeader />
        <main id="main" tabIndex={-1} className="w-full flex-1 px-4 py-10 outline-none sm:px-6 lg:px-8">
          {children}
        </main>
        <footer className="border-t border-border">
          <div className="flex w-full flex-col gap-3 px-4 py-6 pb-24 text-xs text-muted sm:flex-row sm:justify-between sm:px-6 lg:px-8">
            <p>
              Model, pricing and benchmark data from OpenRouter (benchmarks by Artificial Analysis). Values marked †
              are sample data from the assessment brief.
            </p>
            <nav aria-label="Footer" className="flex shrink-0 gap-4">
              <Link href="/privacy" className="rounded hover:text-fg">
                Privacy
              </Link>
              <CookieSettingsButton className="rounded hover:text-fg" />
              <a href={SITE.githubUrl} target="_blank" rel="noopener noreferrer" className="rounded hover:text-fg">
                GitHub
              </a>
            </nav>
          </div>
        </footer>
        {/* These read usePathname, which suspends on request-time routes (see NavLinks). */}
        <Suspense fallback={null}>
          <CompareTray />
          <Analytics />
        </Suspense>
        <FloatingLayer />
        <CommandPalette />
      </body>
    </html>
  );
}
