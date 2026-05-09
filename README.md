# ClearerToday

ClearerToday is a personal practice assistant for people who want to improve something about themselves every day.

The current product focus is articulation by phoneme. You say a short phrase, the app records your speech and visible mouth shape, compares what happened against useful references, scores the gap, and gives you the next drill to try.

That sounds simple, but the point is not just "speech analysis." The point is repeated practice that actually compounds.

Most self-improvement tools fail for the same reason. They either give generic advice once, or they generate feedback that is not grounded in the user's actual attempt. ClearerToday is built around a tighter loop:

1. capture one real rep
2. inspect what actually happened
3. retrieve references that help with that gap
4. prescribe one concrete next drill
5. remember what the user tends to miss
6. use that memory to make the next rep more relevant

That memory step is the part that matters.

## why this exists

People usually do not improve because they lack information. They fail because the feedback loop is too weak.

A pronunciation video can be correct and still not help much. A speech coach can be useful and still not be available when you need ten small reps in a row. A flashcard can tell you the target sound, but it cannot tell you what your own mouth actually did when you tried.

ClearerToday is built from a different assumption: improvement is a sequence of short reps with feedback that gets more personal over time.

In this version, the concrete problem is phoneme articulation. If someone wants to sound clearer, there is no point giving them a long lecture about communication. The useful thing is to show them:

- which word broke down
- what visible mouth-shape gap was detected
- what the target should sound like
- what to try next
- which weakness keeps repeating across reps

That is the product.

## first principles

The system is built on a few straightforward ideas.

### 1. one rep is better than one explanation

Users improve by doing, not by reading a paragraph once. The app is built around short practice attempts and fast feedback.

### 2. feedback should be grounded in evidence

The app does not only generate advice. It combines:

- the recorded attempt
- visible mouth landmarks
- transcript timing
- retrieved pronunciation references
- model-based scoring and drill generation

That makes the feedback more defensible and easier to act on.

### 3. retrieval should adapt to the user, not just the query

Two users can say the same sentence and need different help. One may consistently miss /s/. Another may struggle with /r/ or /th/. If the reference layer ignores that history, the system stays generic.

ClearerToday stores misses and hits over time, then reranks future references around the user's actual weak spots.

### 4. the model does not need retraining for the interface to adapt

This repo does not fine-tune a model after every rep. Instead, it updates a lightweight gap profile and uses that profile to change what references and drills show up next.

That is the practical adaptation loop in this project:

`rep -> score -> store miss/hit -> rerank next references`

## how the phoneme flow works

The phoneme route is the clearest example of the full product loop.

1. The user chooses guided or free practice.
2. The browser captures microphone audio and front camera video.
3. MediaPipe Face Mesh extracts mouth landmarks frame by frame.
4. ElevenLabs transcribes the spoken phrase and provides word timing.
5. The app trims the visible frame timeline to the spoken window.
6. Exa retrieves live pronunciation and articulation references.
7. A local comparison step measures the gap between the user's visible mouth shape and the canonical target.
8. OpenAI scores the gap and generates the next drill.
9. Convex stores the session state and updates the user's gap profile.
10. On the next rep, the reference set is reranked using that stored profile.

The result screen then shows:

- the overall mouth-shape comparison
- per-word or per-phrase optimization targets
- source references
- replay of the user's attempt
- target-word playback
- the next drill to try

## the adaptation loop

This is the technical center of the project.

Convex stores a small gap profile per user and instrument. Each signal keeps track of:

- the identifier, such as a phoneme or rhythm beat
- how often it was missed
- how often it was hit
- when it was last seen

That profile is then used to rerank reference results before they are shown to the user.

This matters because a static retrieval layer treats every rep like a first attempt. ClearerToday does not. It assumes that recurring mistakes are useful data. If a user repeatedly struggles with a certain sound, the system should bias future help toward that weakness.

This is also where the Adaption Labs framing fits in. There is no direct Adaption Labs API call in the current codebase, but the product already follows the same idea of adaptive data without retraining. The model stays the same. The routing changes.

## tech stack

ClearerToday uses a stack chosen for the actual feedback loop, not for checkbox value.

- Next.js for the app shell, routes, and API endpoints
- React for the client-side practice interfaces
- MediaPipe Face Mesh for visible mouth landmark extraction
- ElevenLabs Scribe for speech transcription
- ElevenLabs TTS for optional drill and target-word playback
- Exa for live pronunciation and articulation reference retrieval
- OpenAI for judging, scoring, and drill generation
- Convex for session state, ablation tracking, and persistent gap memory

Each tool has a narrow job in the pipeline:

- capture the rep
- understand the rep
- retrieve useful context
- judge the gap
- store what happened
- adapt the next retrieval step

## practice surfaces

The repo currently includes several routes built around the same general pattern.

### phoneme

This is the strongest and most complete mode. It focuses on visible mouth-shape and pronunciation practice.

### pitch, concept, present

These routes focus on speaking clarity and reformulation. The app transcribes the user, identifies weak phrases such as hedges or filler, runs rewrite-style ablations, and stores those results.

### guitar

This route applies the same learning loop to rhythm timing. Instead of phonemes, it detects onset timing, compares against a target pattern, scores the weak beat, and stores the repeated miss.

The common idea across all of them is the same: one short rep, one diagnosed gap, one next drill, one memory update.

## what makes this practical

The project is useful because it does not ask the user to change their whole life or build a complicated study system.

It asks for one rep.

That is the right unit of work for daily improvement. A person can practice a sentence, a sound, a short explanation, or a rhythm pattern in under a minute. If the system can make that minute useful, it has a real chance of being used repeatedly.

The design goal is not abstract "AI coaching." The design goal is a tighter practice loop:

- shorter than booking a lesson
- more personal than a static tutorial
- more grounded than generic text advice
- more repeatable than one-off feedback

## local development

Install dependencies:

```bash
npm install
```

Run the app:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

You will need the relevant environment variables for services such as Convex, Exa, OpenAI, and ElevenLabs.

## repo notes

If you want the full runtime flow, read [ARCHITECTURE.md](/Users/WilsonSoon/Downloads/AIEHack/articula/ARCHITECTURE.md).

That file is the implementation-facing codemap. This README is the product-facing explanation.
