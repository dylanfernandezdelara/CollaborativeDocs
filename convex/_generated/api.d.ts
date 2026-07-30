/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agentDoc from "../agentDoc.js";
import type * as agents from "../agents.js";
import type * as comments from "../comments.js";
import type * as documents from "../documents.js";
import type * as edits from "../edits.js";
import type * as intents from "../intents.js";
import type * as lib_agentAuth from "../lib/agentAuth.js";
import type * as lib_markdown from "../lib/markdown.js";
import type * as notifications from "../notifications.js";
import type * as presence from "../presence.js";
import type * as prosemirror from "../prosemirror.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  agentDoc: typeof agentDoc;
  agents: typeof agents;
  comments: typeof comments;
  documents: typeof documents;
  edits: typeof edits;
  intents: typeof intents;
  "lib/agentAuth": typeof lib_agentAuth;
  "lib/markdown": typeof lib_markdown;
  notifications: typeof notifications;
  presence: typeof presence;
  prosemirror: typeof prosemirror;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  prosemirrorSync: import("@convex-dev/prosemirror-sync/_generated/component.js").ComponentApi<"prosemirrorSync">;
  presence: import("@convex-dev/presence/_generated/component.js").ComponentApi<"presence">;
};
