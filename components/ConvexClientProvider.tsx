"use client";

import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";
import { ConvexReactClient } from "convex/react";
import { ReactNode, useState } from "react";

function createClient(): ConvexReactClient | null {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    return null;
  }
  return new ConvexReactClient(url);
}

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const [client] = useState(createClient);

  if (!client) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-[14px] text-ink-secondary">
        Configure <code className="mx-1">NEXT_PUBLIC_CONVEX_URL</code> to run
        the app (locally: <code className="mx-1">npm run convex:once</code>).
      </div>
    );
  }

  return (
    <ConvexAuthNextjsProvider client={client}>{children}</ConvexAuthNextjsProvider>
  );
}
