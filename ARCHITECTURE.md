# ClearerToday Architecture

This document describes how the app works today.

It is not a roadmap. It is a codemap and runtime reference for the current implementation.

## Current answer

The current implementation uses Convex directly.

It does not use Adaption Labs directly.

What is live today:

- [`app/providers.tsx`](/Users/WilsonSoon/Downloads/AIEHack/articula/app/providers.tsx) mounts `ConvexProvider`
- [`components/ArticSession.tsx`](/Users/WilsonSoon/Downloads/AIEHack/articula/components/ArticSession.tsx) creates sessions and updates mood through Convex mutations
- [`convex/sessions.ts`](/Users/WilsonSoon/Downloads/AIEHack/articula/convex/sessions.ts) stores session lifecycle state
- [`convex/gapProfile.ts`](/Users/WilsonSoon/Downloads/AIEHack/articula/convex/gapProfile.ts) stores persistent gap signals
- [`convex/ablations.ts`](/Users/WilsonSoon/Downloads/AIEHack/articula/convex/ablations.ts) stores articulation ablation runs

What is not live today:

- no `adaption.ai` or `adaptionlabs.ai` API call
- no Adaption SDK import
- no server route or worker that uploads data to Adaption

Adaption Labs is currently reflected in the architecture pattern only: persistent adaptive data plus gradient-free reranking of references and drills.

## Product shape

ClearerToday is a browser-based coaching app with several practice surfaces:

- `phoneme`: guided or free mouth-shape and pronunciation practice
- `pitch`, `concept`, `present`: articulation and reformulation coaching
- `guitar`: rhythm timing practice

The most complex flow today is the phoneme page. That is the part updated most recently and the part this document focuses on first.

## System flow

At the app level, the runtime flow is:

1. [`app/layout.tsx`](/Users/WilsonSoon/Downloads/AIEHack/articula/app/layout.tsx) mounts the app shell.
2. [`app/providers.tsx`](/Users/WilsonSoon/Downloads/AIEHack/articula/app/providers.tsx) creates the `ConvexReactClient` and wraps the app in `ConvexProvider`.
3. Each practice route renders through [`components/ArticSession.tsx`](/Users/WilsonSoon/Downloads/AIEHack/articula/components/ArticSession.tsx).
4. `ArticSession` opens browser media capture, creates a Convex session row, and manages the shared phase state: `idle -> recording -> processing -> reveal`.
5. The route-specific pipeline runs:
   - `phoneme`: camera + mic capture, transcription, mouth-shape comparison, reference retrieval, scoring
   - `pitch` / `concept` / `present`: transcription, phrase identification, reference retrieval, ablation sandbox runs, scoring
   - `guitar`: audio onset detection, rhythm comparison, reference retrieval, scoring
6. Each route writes session results and weakness signals back to Convex.
7. Future runs read the existing gap profile and rerank references through [`lib/adaptation/router.ts`](/Users/WilsonSoon/Downloads/AIEHack/articula/lib/adaptation/router.ts).
8. The reveal UI shows the analysis, references, prescriptions, and playback tools for the current mode.

This is where the adaptation loop lives today:

`rep -> score -> Convex gap signal -> rerankRefs() on the next rep`

## Runtime stack

- **Next.js App Router**: page routing, API routes, browser app shell
- **React**: client-side session UI and practice flows
- **Convex**: session state and long-lived gap profile memory
- **MediaPipe Face Mesh**: browser-side face landmark extraction
- **Web Audio API**: microphone energy analysis for speech onset and silence detection
- **Exa**: live reference retrieval for phoneme and articulation guidance
- **OpenAI**: scoring and prescription generation through `/api/judge`
- **ElevenLabs Scribe**: speech transcription through `/api/transcribe`
- **ElevenLabs TTS**: manual target-word and drill playback, with fallback audio / browser speech synthesis
- **Adaption Labs**: no direct API call today; the app uses the same adaptive-data idea locally through Convex gap profiles and gradient-free routing

## High-level flow

For the phoneme flow, the app does this:

1. The user picks guided or free mode on [`app/phoneme/page.tsx`](/Users/WilsonSoon/Downloads/AIEHack/articula/app/phoneme/page.tsx).
2. In guided mode, the user reads a practice sentence. The default prompt is now:
   `She sells seashells by the seashore. The shells she sells are seashells`
3. The user starts recording. The page enters `recording` phase and shows:
   - live camera preview
   - manual `Stop` control
   - recording state
4. Browser capture runs in [`lib/phonemes/capture.ts`](/Users/WilsonSoon/Downloads/AIEHack/articula/lib/phonemes/capture.ts):
   - front camera stream
   - microphone stream
   - MediaRecorder for audio
   - Web Audio analyser for voice activity
   - MediaPipe Face Mesh for mouth landmarks
5. Capture ends when one of these happens:
   - user presses `Stop`
   - `3.5s` of post-speech quiet
   - maximum recording length is reached
   - no input threshold is reached
6. The app transcribes the captured audio using [`lib/elevenlabs/scribe.ts`](/Users/WilsonSoon/Downloads/AIEHack/articula/lib/elevenlabs/scribe.ts) via [`app/api/transcribe/route.ts`](/Users/WilsonSoon/Downloads/AIEHack/articula/app/api/transcribe/route.ts).
7. The app trims the landmark timeline to the spoken window and derives phoneme targets from the expected text or transcript.
8. The app fetches live guidance snippets from Exa in [`lib/exa/references.ts`](/Users/WilsonSoon/Downloads/AIEHack/articula/lib/exa/references.ts).
9. The app compares the captured mouth-shape frames against canonical targets with the local phoneme comparison code.
10. The app sends the gap description and retrieved snippets to the OpenAI-backed judge in [`lib/openai/judge.ts`](/Users/WilsonSoon/Downloads/AIEHack/articula/lib/openai/judge.ts) via [`app/api/judge/route.ts`](/Users/WilsonSoon/Downloads/AIEHack/articula/app/api/judge/route.ts).
11. The app writes miss/hit signals to Convex gap memory in [`convex/gapProfile.ts`](/Users/WilsonSoon/Downloads/AIEHack/articula/convex/gapProfile.ts).
12. The app renders reveal mode with:
   - transcript summary
   - sentence feedback
   - unit-level feedback
   - phoneme references
   - audio-synced attempt replay
   - per-word attempt and target playback
   - multiple source references for each optimized word or phrase
13. The app does not auto-play the spoken prescription. The user can manually play the drill or a target word through [`lib/elevenlabs/tts.ts`](/Users/WilsonSoon/Downloads/AIEHack/articula/lib/elevenlabs/tts.ts), falling back to local clips or `speechSynthesis`.

## Articulation flow

The `pitch`, `concept`, and `present` routes all run through [`components/ArticulationModePage.tsx`](/Users/WilsonSoon/Downloads/AIEHack/articula/components/ArticulationModePage.tsx).

That flow is:

1. The route starts in [`components/ArticSession.tsx`](/Users/WilsonSoon/Downloads/AIEHack/articula/components/ArticSession.tsx), which creates a Convex session row for the `articulation` instrument.
2. The page prewarms Daytona sandboxes before recording starts.
3. Browser audio is captured through the shared recording shell.
4. [`lib/elevenlabs/scribe.ts`](/Users/WilsonSoon/Downloads/AIEHack/articula/lib/elevenlabs/scribe.ts) transcribes the recording.
5. [`lib/openai/ablator.ts`](/Users/WilsonSoon/Downloads/AIEHack/articula/lib/openai/ablator.ts) identifies hedge, filler, and jargon phrases.
6. Exa references are fetched and reranked using the user's existing articulation gap profile.
7. Candidate phrases are sent through Daytona ablation runs in [`lib/daytona/sandbox.ts`](/Users/WilsonSoon/Downloads/AIEHack/articula/lib/daytona/sandbox.ts) to test stronger rewrites.
8. Each ablation run is tracked in Convex through [`convex/ablations.ts`](/Users/WilsonSoon/Downloads/AIEHack/articula/convex/ablations.ts).
9. Successful ablations update the articulation gap profile through [`convex/gapProfile.ts`](/Users/WilsonSoon/Downloads/AIEHack/articula/convex/gapProfile.ts).
10. The page writes transcript and score summaries back to [`convex/sessions.ts`](/Users/WilsonSoon/Downloads/AIEHack/articula/convex/sessions.ts).
11. The reveal shows a heatmap, rewrite attempts, and reranked sources.

This means Convex is not only a memory store. It is also the persistence layer for session state and ablation bookkeeping.

## Guitar flow

The guitar route in [`app/guitar/page.tsx`](/Users/WilsonSoon/Downloads/AIEHack/articula/app/guitar/page.tsx) runs a different analysis path:

1. Shared session recording starts through [`components/ArticSession.tsx`](/Users/WilsonSoon/Downloads/AIEHack/articula/components/ArticSession.tsx).
2. The captured audio blob is decoded in [`lib/audio/onsets.ts`](/Users/WilsonSoon/Downloads/AIEHack/articula/lib/audio/onsets.ts).
3. The app trims silence and detects onset times.
4. [`lib/rhythm/canonical.ts`](/Users/WilsonSoon/Downloads/AIEHack/articula/lib/rhythm/canonical.ts) builds the target onset pattern and compares user timing to it.
5. Exa rhythm references are fetched and reranked using the current rhythm gap profile.
6. [`lib/openai/judge.ts`](/Users/WilsonSoon/Downloads/AIEHack/articula/lib/openai/judge.ts) scores the weak beat and returns the next drill.
7. The weak beat is stored in Convex as a `rhythm-beat` signal.
8. The route writes the final score to the current session row.
9. The reveal visualizes target beats, user beats, deviation, and references.

## Phoneme page ownership

The phoneme flow is centered in [`app/phoneme/page.tsx`](/Users/WilsonSoon/Downloads/AIEHack/articula/app/phoneme/page.tsx).

That page owns:

- practice mode (`guided` vs `free`)
- default and quick prompt selection
- preview-side inferred phoneme targets
- recording lifecycle
- camera preview state
- manual stop control
- object URLs for the captured attempt audio
- final reveal state

It does not own the low-level media capture mechanics. Those live in [`lib/phonemes/capture.ts`](/Users/WilsonSoon/Downloads/AIEHack/articula/lib/phonemes/capture.ts).

## Capture subsystem

[`lib/phonemes/capture.ts`](/Users/WilsonSoon/Downloads/AIEHack/articula/lib/phonemes/capture.ts) is the browser capture engine.

It is responsible for:

- requesting `audio` and `video` streams with `getUserMedia`
- passing the live stream back to the UI for preview
- recording audio with `MediaRecorder`
- sampling microphone waveform with `AnalyserNode`
- calibrating a noise floor
- deciding when audio counts as distinct voice
- running MediaPipe Face Mesh on captured video frames
- returning:
  - audio blob
  - landmark timeline
  - speech window
  - stop reason
  - total capture duration

Current stop logic:

- `initialSilenceMs`: 12s
- `minSpeechMs`: 500ms
- `silenceHoldMs`: 3.5s
- `maxDurationMs`: 120s for phoneme capture

Current stop reasons:

- `manual`
- `silence`
- `timeout`
- `no_input`

## Session shell

[`components/ArticSession.tsx`](/Users/WilsonSoon/Downloads/AIEHack/articula/components/ArticSession.tsx) is the shared session shell.

It provides:

- common nav
- phase progress indicator
- companion mood display
- session creation and mood updates via Convex

The phoneme page renders inside this shell and controls it through the `ArticSessionContext`.

## Reveal playback

[`components/MouthShapeReveal.tsx`](/Users/WilsonSoon/Downloads/AIEHack/articula/components/MouthShapeReveal.tsx) is the result surface for phoneme practice.

It receives:

- trimmed mouth-shape frames
- capture timestamp for each retained frame
- the captured attempt audio object URL
- the transcript speech window
- unit-level start and end timestamps
- unit-level OpenAI scores and prescriptions
- Exa references for the whole utterance and each unit

Frame playback is tied to attempted audio time. When the user plays the full attempt, the component seeks the recorded audio to the scoring window and maps `audio.currentTime` to the nearest retained capture timestamp. When the user plays a single optimized word, it seeks to that word's transcript timing and advances the mouth-shape frame against the same clock.

This fixes the old pause bug. The old implementation queued `setTimeout` inside `requestAnimationFrame`, so pausing could cancel the animation frame while a timeout was still waiting. The current implementation keeps both handles and clears both on pause, scrub, unmount, or segment end.

The target-word button is separate from the attempted-audio button. "Play your attempt" replays the user's captured audio. "Play target word" uses ElevenLabs TTS or the local fallback chain to make the expected word playable. The source of truth for each target is the reference set shown under the word, usually the top three Exa sources after adaptive reranking.

## AI tool boundaries

### Exa

Used in [`lib/exa/references.ts`](/Users/WilsonSoon/Downloads/AIEHack/articula/lib/exa/references.ts).

Purpose:

- fetch pronunciation and articulation references
- retrieve supporting snippets for a full utterance or a single unit
- provide live external guidance before judging

Failure behavior:

- falls back to built-in phoneme reference snippets for supported hints
- otherwise returns an empty reference set

### OpenAI

Used through [`lib/openai/judge.ts`](/Users/WilsonSoon/Downloads/AIEHack/articula/lib/openai/judge.ts) and the judge API route.

Purpose:

- convert gap descriptions plus reference context into:
  - score
  - reasoning
  - prescription
- score both:
  - whole-utterance phoneme performance
  - unit-level word / phrase attempts

Failure behavior:

- returns cached fallback scoring behavior with a conservative score and direct prescription

### ElevenLabs Scribe

Used through [`lib/elevenlabs/scribe.ts`](/Users/WilsonSoon/Downloads/AIEHack/articula/lib/elevenlabs/scribe.ts) and [`app/api/transcribe/route.ts`](/Users/WilsonSoon/Downloads/AIEHack/articula/app/api/transcribe/route.ts).

Purpose:

- transcribe recorded speech
- align transcript words to a time window
- use `referenceText` to bias transcription toward the guided sentence when present

### ElevenLabs TTS

Used through [`lib/elevenlabs/tts.ts`](/Users/WilsonSoon/Downloads/AIEHack/articula/lib/elevenlabs/tts.ts).

Purpose:

- manually read the final prescription aloud
- manually play a target word or phrase for comparison against the user's attempt

Failure behavior:

- falls back to local audio clips
- then to browser `speechSynthesis`
- target-word playback prefers browser `speechSynthesis` over generic clips if ElevenLabs is unavailable, so the fallback still speaks the requested word

### Adaption Labs

There is no direct Adaption Labs API or SDK integration in the current codebase. There are no calls to `adaption.ai` or `adaptionlabs.ai` in runtime code.

The app uses Adaption Labs architecturally. The model does not retrain. The interface adapts. Every rep updates a gap profile that changes which references and drills the user sees next. There is no gradient update and no fine-tuning step in the user loop.

Current adaptive-data implementation:

| File | Role |
| --- | --- |
| [`convex/gapProfile.ts`](/Users/WilsonSoon/Downloads/AIEHack/articula/convex/gapProfile.ts) | Stores per-user signal tallies: `missCount` and `hitCount` per phoneme or rhythm beat. This is the app's adaptive data store. |
| [`lib/adaptation/router.ts`](/Users/WilsonSoon/Downloads/AIEHack/articula/lib/adaptation/router.ts) | `rerankRefs()` reorders Exa top-K results by gap-profile match. This is gradient-free routing. |
| [`app/phoneme/page.tsx`](/Users/WilsonSoon/Downloads/AIEHack/articula/app/phoneme/page.tsx) | Calls `upsertSignal` after each full phoneme rep and after each word / phrase unit. |
| [`app/guitar/page.tsx`](/Users/WilsonSoon/Downloads/AIEHack/articula/app/guitar/page.tsx) | Calls `upsertSignal` after each rhythm rep. |

The pitch is precise:

> The model never retrains. The interface adapts. Every rep updates a gap profile that reranks which references and drills you see next, no gradient, no fine-tuning, just routing.

Direct sponsor integration would be server-side and asynchronous. Public Adaption Labs docs describe an Adaptive Data API and Python SDK with a dataset lifecycle: ingest data, run an adaptation job, evaluate, and export. Their public API supports dataset upload/import, `datasets.run`, `brand_controls`, `recipe_specification`, `job_specification.max_rows`, estimates, polling, and download.

A low-risk integration path:

1. Add a server-only `ADAPTION_API_KEY`.
2. Add [`lib/adaption/client.ts`](/Users/WilsonSoon/Downloads/AIEHack/articula/lib/adaption/client.ts) as a thin REST client, or run the official Python SDK in a backend worker if the deployment supports it.
3. Export rows shaped like `{ userGapProfile, candidateReference, targetPhoneme, lastScore, label }`.
4. Send those rows to Adaption as an adaptive dataset job.
5. Download the adapted output into a small local reference cache.
6. Keep [`lib/adaptation/router.ts`](/Users/WilsonSoon/Downloads/AIEHack/articula/lib/adaptation/router.ts) as the online fallback.

The tradeoff is latency. Adaption's public product is a dataset adaptation pipeline, not a per-click ranking endpoint. Putting it directly inside the recording reveal path would make the demo slower and less reliable. The better architecture is to keep local `rerankRefs()` in the hot path and run Adaption as an offline or background improvement loop for the drill/reference corpus.

If Adaption Labs provides a sponsor-only online ranking primitive, the replacement seam is already clear:

```ts
type AdaptiveRanker = (
  gapProfile: GapSignal[],
  candidates: PhonemeRef[],
  task: "phoneme" | "rhythm"
) => Promise<PhonemeRef[]>;
```

`rerankRefs()` would become the fallback implementation. The direct Adaption-backed ranker would use the same inputs and return the same sorted candidate references.

## Convex data responsibilities

### Sessions

[`convex/sessions.ts`](/Users/WilsonSoon/Downloads/AIEHack/articula/convex/sessions.ts)

Responsibilities:

- create new practice sessions
- update current mood
- store transcript / score summaries when used

### Ablations

[`convex/ablations.ts`](/Users/WilsonSoon/Downloads/AIEHack/articula/convex/ablations.ts)

Responsibilities:

- create ablation rows for articulation experiments
- track sandbox execution state
- store rewrite output and score
- support reveal-time inspection of rewrite attempts

### Gap profile

[`convex/gapProfile.ts`](/Users/WilsonSoon/Downloads/AIEHack/articula/convex/gapProfile.ts)

Responsibilities:

- persist repeated misses and hits by instrument and signal
- adapt later retrieval and ranking using historical weakness data

This is the app's lightweight memory layer today.

## Frontend layout notes

The phoneme page now uses a two-column practice cockpit:

- left: text, prompt selection, inferred targets, focus controls
- right: live camera preview and recording controls

That choice keeps the reading task and self-monitoring task in one viewport during capture.

## Failure model

The app currently degrades like this:

- Exa unavailable:
  - fallback phoneme references or empty refs
- OpenAI judge unavailable:
  - fallback score / reasoning / prescription
- ElevenLabs TTS unavailable:
  - fallback mp3 clips, then browser speech synthesis when the user manually asks for playback
- Adaption Labs unavailable:
  - keep using local Convex gap profiles and `rerankRefs()`
- no clear speech:
  - reveal still renders, but scoring remains limited
- no useful face landmarks:
  - reveal reports capture quality issue and asks for retry

## Files that matter most

- [`app/phoneme/page.tsx`](/Users/WilsonSoon/Downloads/AIEHack/articula/app/phoneme/page.tsx): main phoneme workflow and UI
- [`lib/phonemes/capture.ts`](/Users/WilsonSoon/Downloads/AIEHack/articula/lib/phonemes/capture.ts): audio/video capture and stop logic
- [`components/ArticSession.tsx`](/Users/WilsonSoon/Downloads/AIEHack/articula/components/ArticSession.tsx): shared session shell and Convex-backed mood/session handling
- [`lib/exa/references.ts`](/Users/WilsonSoon/Downloads/AIEHack/articula/lib/exa/references.ts): live reference retrieval
- [`lib/openai/judge.ts`](/Users/WilsonSoon/Downloads/AIEHack/articula/lib/openai/judge.ts): AI scoring client
- [`lib/elevenlabs/scribe.ts`](/Users/WilsonSoon/Downloads/AIEHack/articula/lib/elevenlabs/scribe.ts): transcription client
- [`lib/elevenlabs/tts.ts`](/Users/WilsonSoon/Downloads/AIEHack/articula/lib/elevenlabs/tts.ts): manual drill and target-word playback
- [`convex/gapProfile.ts`](/Users/WilsonSoon/Downloads/AIEHack/articula/convex/gapProfile.ts): persistent weakness tracking
- [`convex/sessions.ts`](/Users/WilsonSoon/Downloads/AIEHack/articula/convex/sessions.ts): session records and mood updates

## Current gaps

- silence detection is still heuristic, not a full voice activity detector
- crowd-noise rejection is improved, but not model-driven
- camera preview is visible only during active capture
- the capture loop is still client-side and single-threaded
- target-word "correct audio" is TTS-based, not an expert-recorded pronunciation dataset
- direct Adaption Labs integration is designed but not wired to the public API yet
