"use client";

import ArticulationModePage from "@/components/ArticulationModePage";

const USER_ID =
  typeof window !== "undefined"
    ? (sessionStorage.getItem("clearertoday_uid") ??
      (() => {
        const id = crypto.randomUUID();
        sessionStorage.setItem("clearertoday_uid", id);
        return id;
      })())
    : "demo";

export default function PitchPage() {
  return (
    <ArticulationModePage
      mode="pitch"
      userId={USER_ID}
      title="Pitch Coach"
      description="Deliver your pitch. We surface hedges, filler, and jargon, then run counterfactual rewrites so you can hear what stronger delivery sounds like."
      ctaLabel="Start Pitch"
    />
  );
}
