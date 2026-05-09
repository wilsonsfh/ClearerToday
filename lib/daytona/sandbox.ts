import type { ArticulationMode } from "@/lib/openai/ablator";

export type AblationSandboxParams = {
  transcript: string;
  phraseToRemove: string;
  mode: ArticulationMode;
  openaiKey?: string;
};

export type AblationSandboxResult = {
  output: string;
  score: number;
  reasoning: string;
  source: "live" | "cached";
};

export async function runAblationSandbox(
  params: AblationSandboxParams
): Promise<AblationSandboxResult> {
  try {
    const res = await fetch("/api/daytona", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task: "ablate", ...params }),
    });

    if (!res.ok) throw new Error(`Sandbox failed ${res.status}`);
    const data = await res.json();

    return {
      output: typeof data.output === "string" ? data.output : params.transcript,
      score: typeof data.score === "number" ? data.score : 0.55,
      reasoning: typeof data.reasoning === "string" ? data.reasoning : "No reasoning returned",
      source: data.source === "live" ? "live" : "cached",
    };
  } catch {
    const output = params.transcript
      .replace(new RegExp(params.phraseToRemove.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), " ")
      .replace(/\s+/g, " ")
      .trim();

    return {
      output: output || params.transcript,
      score: 0.5,
      reasoning: "Fallback sandbox result",
      source: "cached",
    };
  }
}

export async function prewarmSandboxes(n = 2): Promise<void> {
  try {
    await fetch("/api/daytona", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task: "prewarm", n }),
    });
  } catch {
    // best effort
  }
}
