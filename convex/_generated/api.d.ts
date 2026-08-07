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
import type * as auth from "../auth.js";
import type * as authStatus from "../authStatus.js";
import type * as collaborators from "../collaborators.js";
import type * as comments from "../comments.js";
import type * as documents from "../documents.js";
import type * as edits from "../edits.js";
import type * as http from "../http.js";
import type * as intents from "../intents.js";
import type * as lib_access from "../lib/access.js";
import type * as lib_agentAuth from "../lib/agentAuth.js";
import type * as lib_collaboratorSeats from "../lib/collaboratorSeats.js";
import type * as lib_githubAuthConfig from "../lib/githubAuthConfig.js";
import type * as lib_lastEdit from "../lib/lastEdit.js";
import type * as lib_markdown from "../lib/markdown.js";
import type * as lib_owner from "../lib/owner.js";
import type * as lib_purgeDocument from "../lib/purgeDocument.js";
import type * as notifications from "../notifications.js";
import type * as presence from "../presence.js";
import type * as prosemirror from "../prosemirror.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  agentDoc: typeof agentDoc;
  agents: typeof agents;
  auth: typeof auth;
  authStatus: typeof authStatus;
  collaborators: typeof collaborators;
  comments: typeof comments;
  documents: typeof documents;
  edits: typeof edits;
  http: typeof http;
  intents: typeof intents;
  "lib/access": typeof lib_access;
  "lib/agentAuth": typeof lib_agentAuth;
  "lib/collaboratorSeats": typeof lib_collaboratorSeats;
  "lib/githubAuthConfig": typeof lib_githubAuthConfig;
  "lib/lastEdit": typeof lib_lastEdit;
  "lib/markdown": typeof lib_markdown;
  "lib/owner": typeof lib_owner;
  "lib/purgeDocument": typeof lib_purgeDocument;
  notifications: typeof notifications;
  presence: typeof presence;
  prosemirror: typeof prosemirror;
  users: typeof users;
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
