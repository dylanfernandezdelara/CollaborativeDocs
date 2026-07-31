"use client";

import { GitHubAuthButton } from "@/components/GitHubAuthButton";
import { Button } from "@/components/ui/button";
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
  // Until production Convex is redeployed (CONVEX_DEPLOY_KEY on Vercel), the
  // live backend only accepts list({}). Set NEXT_PUBLIC_DOCS_OWNER_SCOPING=1
  // after that deploy to restore cookie-scoped lists.
  const ownerScoping =
    process.env.NEXT_PUBLIC_DOCS_OWNER_SCOPING === "1" && !!localId;
  const docs = useQuery(
    api.documents.list,
    !loaded ? "skip" : ownerScoping ? { localOwnerId: localId } : {},
  );
  const createDoc = useMutation(api.documents.create);
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    setCreating(true);
    try {
      const docId = await createDoc(
        ownerScoping && localId
          ? { title: "Product Roadmap", localOwnerId: localId }
          : { title: "Product Roadmap" },
      );
      router.push(`/d/${docId}`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-[640px] flex-col px-4 py-12 sm:py-24">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-[24px] font-medium text-ink">CollabDocs</h1>
        </div>
        <div className="shrink-0">
          <GitHubAuthButton />
        </div>
      </div>

      <Button
        onClick={() => void handleCreate()}
        disabled={creating || !loaded}
        className="mt-8 w-fit rounded-full px-5 text-[13px]"
      >
        {creating ? "Creating…" : "New document"}
      </Button>

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
