import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const get = query({
  args: {
    userId: v.string(),
    instrument: v.union(
      v.literal("articulation"),
      v.literal("phoneme"),
      v.literal("guitar")
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("gapProfile")
      .withIndex("by_user_instrument", (q) =>
        q.eq("userId", args.userId).eq("instrument", args.instrument)
      )
      .first();
  },
});

export const upsertSignal = mutation({
  args: {
    userId: v.string(),
    instrument: v.union(
      v.literal("articulation"),
      v.literal("phoneme"),
      v.literal("guitar")
    ),
    kind: v.union(
      v.literal("hedge"),
      v.literal("filler"),
      v.literal("jargon"),
      v.literal("phoneme"),
      v.literal("rhythm-beat")
    ),
    identifier: v.string(),
    judgeScore: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("gapProfile")
      .withIndex("by_user_instrument", (q) =>
        q.eq("userId", args.userId).eq("instrument", args.instrument)
      )
      .first();

    const now = Date.now();
    const isMiss = args.judgeScore < 0.5;

    if (!existing) {
      await ctx.db.insert("gapProfile", {
        userId: args.userId,
        instrument: args.instrument,
        signals: [
          {
            kind: args.kind,
            identifier: args.identifier,
            missCount: isMiss ? 1 : 0,
            hitCount: isMiss ? 0 : 1,
            lastSeenAt: now,
          },
        ],
      });
      return;
    }

    const signals = [...existing.signals];
    const idx = signals.findIndex(
      (s) => s.kind === args.kind && s.identifier === args.identifier
    );

    if (idx === -1) {
      signals.push({
        kind: args.kind,
        identifier: args.identifier,
        missCount: isMiss ? 1 : 0,
        hitCount: isMiss ? 0 : 1,
        lastSeenAt: now,
      });
    } else {
      signals[idx] = {
        ...signals[idx],
        missCount: signals[idx].missCount + (isMiss ? 1 : 0),
        hitCount: signals[idx].hitCount + (isMiss ? 0 : 1),
        lastSeenAt: now,
      };
    }

    await ctx.db.patch(existing._id, { signals });
  },
});
