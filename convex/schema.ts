import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  sessions: defineTable({
    instrument: v.union(
      v.literal("articulation"),
      v.literal("phoneme"),
      v.literal("guitar")
    ),
    mode: v.optional(
      v.union(v.literal("pitch"), v.literal("concept"), v.literal("present"))
    ),
    mood: v.union(
      v.literal("idle"),
      v.literal("listening"),
      v.literal("frown"),
      v.literal("think"),
      v.literal("smile"),
      v.literal("drill")
    ),
    transcript: v.optional(v.string()),
    score: v.optional(v.number()),
  }),

  ablations: defineTable({
    sessionId: v.id("sessions"),
    sandboxId: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("done"),
      v.literal("error")
    ),
    inputPhrase: v.string(),
    outputText: v.optional(v.string()),
    score: v.optional(v.number()),
    referenceLabel: v.optional(v.string()),
  }).index("by_session", ["sessionId"]),

  gapProfile: defineTable({
    userId: v.string(),
    instrument: v.union(
      v.literal("articulation"),
      v.literal("phoneme"),
      v.literal("guitar")
    ),
    signals: v.array(
      v.object({
        kind: v.union(
          v.literal("hedge"),
          v.literal("filler"),
          v.literal("jargon"),
          v.literal("phoneme"),
          v.literal("rhythm-beat")
        ),
        identifier: v.string(),
        missCount: v.number(),
        hitCount: v.number(),
        lastSeenAt: v.number(),
      })
    ),
  }).index("by_user_instrument", ["userId", "instrument"]),
});
