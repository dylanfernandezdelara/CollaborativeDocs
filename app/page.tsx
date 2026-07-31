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
  // Production Convex may lag the Next deploy. Prefer scoped listing when the
  // cookie identity is ready; fall back to the unscoped `{}` shape that older
  // deployments still accept (unknown args are rejected as Server Error).
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
    <main className="mx-auto flex min-h-screen max-w-[640px] flex-col px-4 py-24">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-medium text-[#292929]">CollabDocs</h1>
          <p className="mt-2 text-[14px] text-[#5D5D5D]">
            A quiet space for humans and agents to write together.
          </p>
        </div>
        <GitHubAuthButton />
      </div>

      <Button
        onClick={() => void handleCreate()}
        disabled={creating || !loaded}
        className="mt-8 w-fit rounded-full px-5 text-[13px]"
      >
        {creating ? "Creating…" : "New document"}
      </Button>

      <section className="mt-12">
        <h2 className="text-[13px] font-medium text-[#5D5D5D]">Documents</h2>
        {!loaded || docs === undefined ? (
          <p className="mt-3 text-[13px] text-[#9E9E9E]">Loading…</p>
        ) : docs.length === 0 ? (
          <p className="mt-3 text-[13px] text-[#9E9E9E]">No documents yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-[rgba(0,0,0,0.08)]">
            {docs.map((doc) => (
              <li key={doc._id}>
                <Link
                  href={`/d/${doc._id}`}
                  className="flex items-baseline justify-between py-3 hover:opacity-80"
                >
                  <span className="text-[14px] text-[#292929]">{doc.title}</span>
                  <span className="text-[13px] text-[#9E9E9E]">
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
