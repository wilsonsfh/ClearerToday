# ClearerToday

ClearerToday is a personal practice assistant for people who want to get a little better every day. The current implementation focuses on articulation, especially phoneme practice, but the system is built around a broader loop: capture a rep, compare it against useful references, score the gap, and prescribe the next drill.

On the phoneme route, the app records camera and microphone input, transcribes speech with ElevenLabs, retrieves pronunciation references with Exa, scores the visible mouth-shape gap with OpenAI, and stores persistent weakness signals in Convex. Those signals are then used to rerank future references and drills. That is also where the Adaption Labs story fits today: no direct API call yet, but the product already follows the same adaptive-data thesis through a gradient-free routing loop.

Other routes extend the same idea to articulation rewrites and rhythm timing. The result is a practical self-improvement tool: short reps, clear feedback, and a memory of what you keep getting wrong.

## 2-minute demo

1. Open `/phoneme`.
2. Show the sentence prompt and explain that this is daily deliberate practice for clearer speech.
3. Record one rep and stop.
4. Show transcript, mouth-shape comparison, per-word feedback, and source references.
5. Click `Play your attempt`, `Play target word`, and `Play drill`.
6. Point to the gap profile and explain that future references are reranked from stored misses and hits.
7. Close with the Adaption Labs angle: no retraining, the interface adapts after every rep.

## sponsor prize fit

- OpenAI - Best use of GPT-5.5/Codex: yes for the build workflow and OpenAI-backed judging/rewrite logic
- Adaption Labs - Most creative use: yes for the adaptive-data routing loop, and stronger if direct API upload is added
- Convex - Best use of Convex: yes, Convex is the live session, ablation, and gap-memory layer
- Exa AI - Most creative use of Exa: yes, Exa is used as the live reference retrieval layer before scoring

Not a fit from the current codebase:

- OpenAI - Best use of GPT Image 2
- OpenAI - Best use of GPT Realtime 2
- Google DeepMind - Best Gen Media Track
- Google DeepMind - Best Voice Agent Track
- Cursor - Best use of the Cursor SDK
- Fal - Best use of Fal
