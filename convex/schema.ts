import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables,
  documents: defineTable({
    title: v.string(),
    createdAt: v.number(),
    /** `local:<cookie>` for anonymous owners, `user:<id>` after GitHub sign-in. */
    ownerId: v.optional(v.string()),
    /** Denormalized last-edit signal for the docs index (humans + agents). */
    lastEditedAt: v.optional(v.number()),
    lastEditorName: v.optional(v.string()),
    lastEditorIsAgent: v.optional(v.boolean()),
  }).index("by_owner", ["ownerId"]),
  /** Pins each anonymous device identity to the first account that claims it. */
  identityClaims: defineTable({
    localOwnerId: v.string(),
    userOwnerId: v.string(),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  }).index("by_local_owner", ["localOwnerId"]),
  agents: defineTable({
    docId: v.id("documents"),
    name: v.string(),
    color: v.string(),
    token: v.string(),
    revoked: v.boolean(),
    lastSeenAt: v.number(),
    lastSeenVersion: v.number(),
    lastDigestAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_doc", ["docId"]),
  /** Named human invites — link sharing stays open; this tracks collaborators. */
  collaborators: defineTable({
    docId: v.id("documents"),
    name: v.string(),
    token: v.string(),
    revoked: v.boolean(),
    createdAt: v.number(),
    /** Bound when the invitee opens the invite link (`local:…` or `user:…`). */
    subjectId: v.optional(v.string()),
    joinedAt: v.optional(v.number()),
  })
    .index("by_token", ["token"])
    .index("by_doc", ["docId"])
    .index("by_subject", ["subjectId"])
    .index("by_doc_and_subject", ["docId", "subjectId"]),
  intents: defineTable({
    docId: v.id("documents"),
    agentId: v.id("agents"),
    task: v.string(),
    anchorText: v.string(),
    active: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_doc", ["docId", "active"])
    .index("by_agent", ["agentId", "active"]),
  comments: defineTable({
    docId: v.id("documents"),
    parentId: v.optional(v.id("comments")),
    authorName: v.string(),
    agentId: v.optional(v.id("agents")),
    anchorText: v.optional(v.string()),
    text: v.string(),
    resolved: v.boolean(),
    createdAt: v.number(),
  }).index("by_doc", ["docId"]),
  notifications: defineTable({
    agentId: v.id("agents"),
    docId: v.id("documents"),
    kind: v.string(),
    payload: v.string(),
    createdAt: v.number(),
    consumedAt: v.optional(v.number()),
  }).index("by_agent", ["agentId"]),
  edits: defineTable({
    docId: v.id("documents"),
    agentId: v.optional(v.id("agents")),
    agentName: v.string(),
    task: v.string(),
    summary: v.string(),
    createdAt: v.number(),
  }).index("by_doc", ["docId"]),
});
