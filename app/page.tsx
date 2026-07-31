"use client";

import { Button } from "@/components/ui/button";
import { AuthNav } from "@/components/AuthControls";
import { api } from "@/convex/_generated/api";
import { localOwnerId, useOwnerKey } from "@/lib/ownerKey";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function HomePage() {
  const router = useRouter();
  const { ownerKey, loaded } = useOwnerKey();
  const localId = ownerKey ? localOwnerId(ownerKey) : undefined;
  const docs = useQuery(
    api.documents.list,
    !loaded || !localId ? "skip" : { localOwnerId: localId },
  );
  const createDoc = useMutation(api.documents.create);
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    if (!localId) return;
    setCreating(true);
    try {
      const docId = await createDoc({
        title: "Product Roadmap",
        localOwnerId: localId,
      });
      router.push(`/d/${docId}`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-[640px] flex-col px-4 py-8 sm:py-12">
      <nav
        aria-label="Primary navigation"
        className="flex min-h-8 items-center justify-between gap-4"
      >
        <span className="text-[14px] font-medium text-ink">CollabDocs</span>
        <AuthNav localOwnerId={localId} />
      </nav>

      <section className="mt-16 sm:mt-24">
        <h1 className="text-[24px] font-medium text-ink">Your documents</h1>
        <p className="mt-3 max-w-[480px] text-[14px] leading-6 text-ink-secondary">
          Documents save automatically and stay linked to this device. Sign in
          to sync them across browsers and devices.
        </p>

        <Button
          onClick={() => void handleCreate()}
          disabled={creating || !loaded || !localId}
          className="mt-8 w-fit rounded-full px-5 text-[13px]"
        >
          {creating ? "Creating…" : "New document"}
        </Button>
      </section>

      <section className="mt-10 sm:mt-12">
        <h2 className="text-[13px] font-medium text-ink-secondary">Documents</h2>
        {!loaded || docs === undefined ? (
          <p className="mt-3 text-[13px] text-ink-tertiary">Loading…</p>
        ) : docs.length === 0 ? (
          <p className="mt-3 text-[13px] text-ink-tertiary">No documents yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-ink/8">
            {docs.map((doc) => (
              <li key={doc._id}>
                <Link
                  href={`/d/${doc._id}`}
                  className="flex items-baseline justify-between gap-3 py-3 hover:opacity-80"
                >
                  <span className="min-w-0 truncate text-[14px] text-ink">
                    {doc.title}
                  </span>
                  <span className="shrink-0 text-[13px] text-ink-tertiary">
                    {formatDate(doc.createdAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
