import { fetchPhonemeRefs } from "@/lib/exa/references";

export type PhonemeCacheWarmResult = {
  warmed: string[];
  failed: string[];
  source: "live" | "cached";
};

export async function warmPhonemeReferenceCache(
  phonemes: string[] = ["θ", "r"]
): Promise<PhonemeCacheWarmResult> {
  const warmed: string[] = [];
  const failed: string[] = [];

  await Promise.all(
    phonemes.map(async (phoneme) => {
      try {
        const refs = await fetchPhonemeRefs(phoneme);
        if (refs.length > 0) {
          warmed.push(phoneme);
        } else {
          failed.push(phoneme);
        }
      } catch {
        failed.push(phoneme);
      }
    })
  );

  return {
    warmed,
    failed,
    source: failed.length > 0 ? "cached" : "live",
  };
}
