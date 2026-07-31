/**
 * Named human collaborator invites require production Convex to include
 * `collaborators:*`. Set NEXT_PUBLIC_HUMAN_COLLABORATORS=1 in Vercel after
 * deploying Convex with CONVEX_DEPLOY_KEY (see scripts/build.mjs).
 */
export function humanCollaboratorsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_HUMAN_COLLABORATORS === "1";
}
