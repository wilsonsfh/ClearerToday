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

export default function ConceptPage() {
  return (
    <ArticulationModePage
      mode="concept"
      userId={USER_ID}
      title="Concept Explainer"
      description="Explain a complex idea. We diagnose clarity blockers, run phrase-level ablations, and highlight stronger alternatives."
      ctaLabel="Explain"
    />
  );
}
