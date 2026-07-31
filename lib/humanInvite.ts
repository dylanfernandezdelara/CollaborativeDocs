/** Build a document URL that accepts a human collaborator invite. */
export function buildHumanInviteUrl(
  origin: string,
  docId: string,
  token: string,
): string {
  const url = new URL(`/d/${docId}`, origin);
  url.searchParams.set("h", token);
  return url.toString();
}
