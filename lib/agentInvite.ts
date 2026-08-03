export function agentInviteSlug(name: string, token: string): string {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32) || "agent";
  return `${base}-${token.slice(0, 8)}`;
}

export function agentMcpServerId(slug: string): string {
  return `collabdocs-${slug}`;
}

export function buildJoinUrl(origin: string, token: string, name: string): string {
  const params = new URLSearchParams({ name });
  return `${origin}/api/join/${token}?${params.toString()}`;
}

export function buildJoinCurlCommand(origin: string, token: string, name: string): string {
  return `curl -fsSL ${buildJoinUrl(origin, token, name)} | sh`;
}

function shellSingleQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function buildAgentWorkspaceScript(options: {
  token: string;
  name: string;
  mcpUrl: string;
}): string {
  const slug = agentInviteSlug(options.name, options.token);
  const mcpId = agentMcpServerId(slug);
  const agentName = shellSingleQuote(options.name);
  const slugQuoted = shellSingleQuote(slug);
  const mcpIdQuoted = shellSingleQuote(mcpId);
  const mcpUrlQuoted = shellSingleQuote(options.mcpUrl);

  return `#!/bin/sh
set -eu

AGENT_NAME=${agentName}
SLUG=${slugQuoted}
MCP_ID=${mcpIdQuoted}
MCP_URL=${mcpUrlQuoted}
WORKSPACE="\${HOME}/.collabdocs/agents/\${SLUG}"

mkdir -p "\${WORKSPACE}/.cursor"

WORKSPACE="\${WORKSPACE}" MCP_ID="\${MCP_ID}" MCP_URL="\${MCP_URL}" node -e 'const fs=require("fs");const path=require("path");const workspace=process.env.WORKSPACE;const mcpId=process.env.MCP_ID;const mcpUrl=process.env.MCP_URL;const cfg={mcpServers:{[mcpId]:{url:mcpUrl}}};fs.writeFileSync(path.join(workspace,".cursor","mcp.json"),JSON.stringify(cfg,null,2)+"\\n");'

echo "Memos: configured \${AGENT_NAME}"
echo "Workspace: \${WORKSPACE}"
echo "MCP server: \${MCP_ID}"

if command -v cursor-agent >/dev/null 2>&1; then
  exec cursor-agent --workspace "\${WORKSPACE}" --trust --approve-mcps "\$@"
else
  echo "cursor-agent not found in PATH."
  echo "After installing the Cursor CLI, run:"
  echo "  cursor-agent --workspace \\"\${WORKSPACE}\\" --trust --approve-mcps"
fi
`;
}
