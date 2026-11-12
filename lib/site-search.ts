/*
 * Static content searched by the command palette: pages and FAQ entries.
 * The FAQ list also renders the accordion on the home page, so both stay in sync.
 */

export interface PageEntry {
  title: string;
  href: string;
  description: string;
}

export const PAGES: PageEntry[] = [
  { title: "Models", href: "/", description: "Browse, filter and sort every model" },
  { title: "Compare", href: "/compare", description: "Side-by-side specs and monthly cost estimator" },
  { title: "Playground", href: "/playground", description: "Chat with models, side by side" },
  { title: "History", href: "/history", description: "Your past requests and usage analytics" },
  { title: "FAQ", href: "/#faq", description: "Data sources, pricing accuracy, privacy" },
  { title: "Privacy", href: "/privacy", description: "Cookies, analytics and your data" },
];

export interface FaqEntry {
  id: string;
  question: string;
  answer: string;
}

export const FAQ: FaqEntry[] = [
  {
    id: "data-source",
    question: "Where does the model data come from?",
    answer:
      "From OpenRouter's public models API, fetched on the server and refreshed about once an hour. Three models from the assessment brief are sample data and are labelled \"Sample\". If OpenRouter is unreachable, the site falls back to that sample data and says so.",
  },
  {
    id: "pricing-accuracy",
    question: "How accurate are the prices?",
    answer:
      "Prices are each model's default OpenRouter price per 1M tokens. Individual providers can be cheaper or more expensive (see a model's Providers table), and long-context surcharges, prompt caching and batch discounts aren't included. Treat estimates as a guide, not an invoice.",
  },
  {
    id: "estimator",
    question: "How does the cost estimator work?",
    answer:
      "Monthly cost = (input tokens / 1M) × input price + (output tokens / 1M) × output price. Set your monthly volumes with the sliders or exact numbers, or start from a preset (chatbot, RAG, code agent). The cheapest model is marked \"Best value\" with its monthly saving over the next best.",
  },
  {
    id: "benchmarks",
    question: "Where do the benchmark scores come from?",
    answer:
      "Intelligence, coding and agentic scores are Artificial Analysis indexes, provided through OpenRouter. Values marked † are sample numbers from the assessment brief. When no score exists we show \"-\"; numbers are never estimated or invented.",
  },
  {
    id: "playground-cost",
    question: "Is the playground free to use?",
    answer:
      "It defaults to free models through a shared key, which have tight rate limits. To use paid models, paste your own OpenRouter key in the playground settings: it stays in your browser tab's memory, is sent only with your requests, and is never stored or logged.",
  },
  {
    id: "privacy",
    question: "What do you store about me?",
    answer:
      "A strictly necessary, anonymous session cookie that ties your playground history (prompts, replies, tokens) to this browser. Page views and campaign (UTM) data are recorded only if you accept analytics. You can change your choice or delete your data at any time on the Privacy page.",
  },
  {
    id: "sharing",
    question: "Can I share a comparison?",
    answer:
      "Yes. The compare page URL lists the selected models (for example /compare?models=a/b,c/d), so copying the link reproduces the comparison anywhere, even in a private window. Unknown or invalid model ids in a link are skipped.",
  },
  {
    id: "errors",
    question: "Why did a model fail in the playground?",
    answer:
      "Free models are often rate-limited, some are restricted to specific apps, and providers occasionally go down. The playground explains each error; trying again shortly or picking another model usually helps.",
  },
];

/** Case-insensitive match of every search word against the given fields. */
export function matches(query: string, ...fields: string[]): boolean {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const haystack = fields.join(" ").toLowerCase();
  return terms.every((t) => haystack.includes(t));
}
