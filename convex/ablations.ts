import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    sessionId: v.id("sessions"),
    inputPhrase: v.string(),
    referenceLabel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("ablations", {
      sessionId: args.sessionId,
      inputPhrase: args.inputPhrase,
      referenceLabel: args.referenceLabel,
      status: "pending",
    });
  },
});

export const setRunning = mutation({
  args: {
    ablationId: v.id("ablations"),
    sandboxId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.ablationId, {
      sandboxId: args.sandboxId,
      status: "running",
    });
  },
});

export const setDone = mutation({
  args: {
    ablationId: v.id("ablations"),
    outputText: v.string(),
    score: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.ablationId, {
      outputText: args.outputText,
      score: args.score,
      status: "done",
    });
  },
});

export const setError = mutation({
  args: { ablationId: v.id("ablations") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.ablationId, { status: "error" });
  },
});

export const bySession = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("ablations")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
  },
});
