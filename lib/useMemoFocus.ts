"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type FocusPhase = "title" | "body" | null;

/**
 * Create-flow focus: title first when `?new=1`, then body after Enter.
 * Existing memos start on the body once the editor mounts.
 */
export function useMemoFocus(docId: string, isNewMemo: boolean) {
  const router = useRouter();
  const titleAutoFocus = useRef(isNewMemo).current;
  const [phase, setPhase] = useState<FocusPhase>(isNewMemo ? "title" : "body");

  useEffect(() => {
    if (!isNewMemo) return;
    const params = new URLSearchParams(
      typeof window !== "undefined" ? window.location.search : "",
    );
    params.delete("new");
    const qs = params.toString();
    router.replace(qs ? `/d/${docId}?${qs}` : `/d/${docId}`, { scroll: false });
  }, [docId, isNewMemo, router]);

  return {
    titleAutoFocus,
    focusBody: phase === "body",
    onTitleEnter: () => setPhase("body"),
  };
}
