import type { Metadata } from "next";
import { PageIntro } from "@/components/page-intro";

export const metadata: Metadata = { title: "Compare" };

// Placeholder: implemented in Phase 3.
export default function ComparePage() {
  return <PageIntro title="Compare">Pick 2 to 4 models to compare specs, pricing and estimated monthly cost.</PageIntro>;
}
