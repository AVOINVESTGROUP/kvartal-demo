"use client";

import { useEffect, useRef, useState } from "react";

type StatusResponse = {
  ok?: boolean;
  typing?: Array<{
    organizationName: string;
    officeName: string;
    expiresAt: string;
  }>;
};

export function InteractionMessageComposer({
  interactionId,
  officeSlug,
}: {
  interactionId: string;
  officeSlug: string;
}) {
  const [typing, setTyping] = useState<StatusResponse["typing"]>([]);
  const lastPulseAt = useRef(0);

  useEffect(() => {
    let cancelled = false;

    async function loadStatus() {
      try {
        const response = await fetch(
          `/api/v1/admin/interactions/${encodeURIComponent(interactionId)}/status?officeSlug=${encodeURIComponent(officeSlug)}`,
          { cache: "no-store" },
        );
        const payload = (await response.json()) as StatusResponse;

        if (!cancelled && response.ok && payload.ok !== false) {
          setTyping(payload.typing ?? []);
        }
      } catch {
        if (!cancelled) {
          setTyping([]);
        }
      }
    }

    void loadStatus();
    const timer = window.setInterval(loadStatus, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [interactionId, officeSlug]);

  async function sendTypingPulse() {
    const now = Date.now();

    if (now - lastPulseAt.current < 1200) {
      return;
    }

    lastPulseAt.current = now;

    try {
      await fetch(`/api/v1/admin/interactions/${encodeURIComponent(interactionId)}/typing`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ officeSlug }),
      });
    } catch {
      // Typing state is non-critical and should not interrupt message composition.
    }
  }

  return (
    <>
      <textarea
        name="message"
        required
        onChange={sendTypingPulse}
        className="mt-2 min-h-[88px] w-full rounded-md border border-kv-line px-3 py-2 text-kv-ink"
      />
      {typing?.length ? (
        <div className="mt-2 text-[12px] font-bold text-kv-muted">
          {typing.map((item) => item.organizationName).join(", ")} печатает...
        </div>
      ) : null}
    </>
  );
}
