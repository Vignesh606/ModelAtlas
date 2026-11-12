"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

/**
 * Deletes this browser's history and page views (DELETE /api/history).
 * Two-step confirm instead of window.confirm(), so it stays accessible and on-brand.
 */
export function DeleteDataButton() {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "confirm" | "deleting" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  const remove = async () => {
    setState("deleting");
    try {
      const response = await fetch("/api/history", { method: "DELETE" });
      if (!response.ok) throw new Error(String(response.status));
      const data = (await response.json()) as { deleted: { requests: number; visits: number } };
      setMessage(`Deleted ${data.deleted.requests} requests and ${data.deleted.visits} page views.`);
      setState("done");
      router.refresh();
    } catch {
      setMessage("Couldn't delete your data. Try again.");
      setState("error");
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      {state === "confirm" ? (
        <>
          <Button variant="primary" size="sm" onClick={remove}>
            Yes, delete everything
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setState("idle")}>
            Cancel
          </Button>
        </>
      ) : (
        <Button variant="secondary" size="sm" onClick={() => setState("confirm")} disabled={state === "deleting"}>
          {state === "deleting" ? <Spinner /> : <Trash2 className="size-4" aria-hidden />}
          Delete my data
        </Button>
      )}
      <p role="status" className="text-xs text-muted">
        {state === "confirm" ? "This removes your playground history and page views. It can't be undone." : message}
      </p>
    </div>
  );
}
