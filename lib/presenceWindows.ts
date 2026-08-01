/** Agent counts as live on the index / doc chrome within this window. */
export const LIVE_AGENT_MS = 90_000;

/** Last-edit counts as “is typing” on the docs index within this window. */
export const TYPIST_WINDOW_MS = 30_000;

/** Client throttle for human `documents.touch` while actively editing. */
export const TOUCH_THROTTLE_MS = 5_000;
