import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="py-20 text-center">
      <p className="font-mono text-sm text-muted">404</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-2 text-muted">That model or page doesn&apos;t exist, or it was removed from the catalog.</p>
      <Link href="/" className={buttonClasses("secondary", "md", "mt-6")}>
        Browse all models
      </Link>
    </div>
  );
}
