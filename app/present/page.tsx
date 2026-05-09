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

export default function PresentPage() {
  return (
    <ArticulationModePage
      mode="present"
      userId={USER_ID}
      title="Presentation Coach"
      description="Present a section. We quantify pacing language quality with phrase ablations and guide confidence-focused revisions."
      ctaLabel="Present"
    />
  );
}
