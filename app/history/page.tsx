import type { Metadata } from "next";
import { PageIntro } from "@/components/page-intro";

export const metadata: Metadata = { title: "History" };

// Placeholder: implemented in Phase 5.
export default function HistoryPage() {
  return <PageIntro title="History">Your past playground requests, with tokens, latency and status.</PageIntro>;
}
