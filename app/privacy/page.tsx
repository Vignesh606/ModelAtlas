import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PageIntro } from "@/components/page-intro";
import { CookieSettingsButton } from "@/components/site/cookie-settings-button";
import { DeleteDataButton } from "@/components/site/delete-data-button";
import { ScrollProgress } from "@/components/site/scroll-progress";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What ModelAtlas stores, which cookies it uses, and how to change your choice or delete your data.",
};

export default function PrivacyPage() {
  return (
    <article className="max-w-2xl">
      <ScrollProgress />
      <PageIntro title="Privacy">Short version: no accounts, no ads, and analytics only if you say yes.</PageIntro>

      <div className="space-y-8 text-sm leading-relaxed">
        <Section title="Strictly necessary cookie">
          <p>
            <code className="font-mono">ma_session</code> is a random, anonymous id in an httpOnly cookie (JavaScript
            can&apos;t read it). It ties your playground history to this browser and scopes rate limits. It contains no
            personal information and lasts one year. Because the playground needs it, it is not optional.
          </p>
          <p>
            <code className="font-mono">ma_consent</code> remembers your cookie choice, so we don&apos;t ask on every
            visit.
          </p>
        </Section>

        <Section title="Analytics (only with your consent)">
          <p>
            If you choose &ldquo;Accept analytics&rdquo;, we record page views (the page path only, never query strings
            or what you type) and keep your first campaign source in the <code className="font-mono">ma_utm</code>{" "}
            cookie for 30 days: <code className="font-mono">utm_source</code>, <code className="font-mono">medium</code>,{" "}
            <code className="font-mono">campaign</code>, <code className="font-mono">term</code>,{" "}
            <code className="font-mono">content</code>, and the site that referred you (without its query string).
          </p>
          <p>
            Before you choose, nothing is stored. If you switch to &ldquo;Essential only&rdquo;, the campaign cookie is
            removed, tracking stops, and page views recorded for your session are deleted.
          </p>
          <CookieSettingsButton className="text-sm font-medium underline underline-offset-2" />
        </Section>

        <Section title="Playground history">
          <p>
            Prompts and replies you send in the playground are stored with token counts, latency and status, linked
            only to your anonymous session id, so only this browser can see them. Your own API key, if you add one, is
            sent with each request but never stored or logged.
          </p>
        </Section>

        <Section title="In your browser only">
          <p>
            Your theme and the compare tray are saved in your browser&apos;s local storage and never sent to us.
          </p>
        </Section>

        <Section title="Third parties">
          <p>
            Playground prompts are forwarded to OpenRouter (and the model provider it routes to), or to the provider whose key you added, to generate replies.
            Data is stored in a Postgres database hosted by Neon. The site is hosted on Vercel.
          </p>
        </Section>

        <Section title="Delete your data">
          <p>Remove your playground history and page views from our database at any time:</p>
          <DeleteDataButton />
        </Section>
      </div>
    </article>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-2xl">{title}</h2>
      <div className="space-y-3 text-muted">{children}</div>
    </section>
  );
}
