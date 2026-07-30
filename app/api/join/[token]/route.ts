import {
  agentInviteSlug,
  agentMcpServerId,
  buildAgentWorkspaceScript,
} from "@/lib/agentInvite";

function getOrigin(request: Request): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");

  if (forwardedHost) {
    const host = forwardedHost.split(",")[0]?.trim();
    const proto = forwardedProto?.split(",")[0]?.trim() || "https";
    return `${proto}://${host}`;
  }

  return new URL(request.url).origin;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const origin = getOrigin(request);
  const mcpUrl = `${origin}/api/mcp/${token}`;
  const name = new URL(request.url).searchParams.get("name")?.trim() || "agent";
  const slug = agentInviteSlug(name, token);
  const mcpId = agentMcpServerId(slug);

  const script = buildAgentWorkspaceScript({
    token,
    name,
    mcpUrl,
  });

  return new Response(script, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-CollabDocs-Agent-Name": name,
      "X-CollabDocs-Agent-Slug": slug,
      "X-CollabDocs-Mcp-Id": mcpId,
    },
  });
}
