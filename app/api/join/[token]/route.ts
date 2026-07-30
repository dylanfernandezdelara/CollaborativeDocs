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

  const script = `#!/bin/sh
set -eu

ORIGIN="${origin}"
TOKEN="${token}"
MCP_URL="${mcpUrl}"

mkdir -p .cursor

if [ -f .cursor/mcp.json ]; then
  node -e 'const fs=require("fs");const p=".cursor/mcp.json";const cfg=JSON.parse(fs.readFileSync(p,"utf8"));cfg.mcpServers=cfg.mcpServers||{};cfg.mcpServers.collabdocs={url:process.env.MCP_URL};fs.writeFileSync(p,JSON.stringify(cfg,null,2)+"\\n");' MCP_URL="$MCP_URL"
else
  printf '%s\\n' "{\\"mcpServers\\":{\\"collabdocs\\":{\\"url\\":\\"$MCP_URL\\"}}}" > .cursor/mcp.json
fi

echo 'Added CollabDocs MCP server to .cursor/mcp.json'
echo 'Start your agent (e.g. \`cursor-agent\`) in this directory to connect.'
`;

  return new Response(script, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
