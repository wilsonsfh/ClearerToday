import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    instrument: v.union(
      v.literal("articulation"),
      v.literal("phoneme"),
      v.literal("guitar")
    ),
    mode: v.optional(
      v.union(v.literal("pitch"), v.literal("concept"), v.literal("present"))
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("sessions", {
      instrument: args.instrument,
      mode: args.mode,
      mood: "idle",
    });
  },
});

export const setMood = mutation({
  args: {
    sessionId: v.id("sessions"),
    mood: v.union(
      v.literal("idle"),
      v.literal("listening"),
      v.literal("frown"),
      v.literal("think"),
      v.literal("smile"),
      v.literal("drill")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, { mood: args.mood });
  },
});

export const setResult = mutation({
  args: {
    sessionId: v.id("sessions"),
    transcript: v.optional(v.string()),
    score: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, {
      transcript: args.transcript,
      score: args.score,
    });
  },
});

export const get = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.sessionId);
  },
});
