import { CircleAlert, CircleCheck, CircleStop } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { RequestStatus } from "@/lib/db/schema";

// Icon + text, never color alone (and the palette has no status colors by design).
const STATUS = {
  success: { label: "Success", Icon: CircleCheck },
  error: { label: "Error", Icon: CircleAlert },
  aborted: { label: "Stopped", Icon: CircleStop },
} as const;

export function StatusBadge({ status }: { status: RequestStatus }) {
  const { label, Icon } = STATUS[status];
  return (
    <Badge tone={status === "success" ? "outline" : "neutral"}>
      <Icon className="size-3" aria-hidden />
      {label}
    </Badge>
  );
}
