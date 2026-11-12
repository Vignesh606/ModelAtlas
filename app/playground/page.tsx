import type { Metadata } from "next";
import { PageIntro } from "@/components/page-intro";

export const metadata: Metadata = { title: "Playground" };

// Placeholder: implemented in Phase 4.
export default function PlaygroundPage() {
  return <PageIntro title="Playground">Chat with any model and see token usage and projected cost for each reply.</PageIntro>;
}
