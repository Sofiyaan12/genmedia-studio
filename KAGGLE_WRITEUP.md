# GenMedia Studio: End-to-End Multimodal AI Advertisement Production Pipeline

**Track**: Problem Statement 3 — Multimodal Creative Pipelines with GenMedia  
**Team**: Mohammed Sofiyaan, Syed Saad Ahmed, Mohd Rayyan Bin Mohd Jaweed, Mohamed Mustafa Ali Khan

---

## 1. Executive Summary

Advertising production traditionally requires disconnected tools for scripting, storyboarding, motion synthesis, musical scoring, and non-linear video editing. When generative AI is applied piecemeal to these stages, two critical problems emerge: **visual discontinuity across scenes** and **destructive regeneration** whenever a creative director wants to tweak a single shot.

**GenMedia Studio** solves both problems by unifying Google DeepMind's latest multimodal models into a cohesive, non-destructive production workstation:
1. **Nano Banana 2 Lite (`gemini-3.1-flash-lite-image`)** for reference-anchored rapid storyboarding.
2. **Gemini Omni Flash (`gemini-omni-1.1-flash`)** via the **Interactions API** for native MP4 scene video generation and stateful conversational editing.
3. **Lyria 3.5 (`lyria-3.5`)** for mood-matched commercial soundtrack generation.
4. **FFmpeg + ffprobe** for automated resolution/framerate normalization, typography burn-in, stereo AAC soundtrack mixing, and post-render stream validation.

---

## 2. Empirical Model Verification & Capabilities Analysis

Before building the pipeline, we wrote automated verification probes (`scripts/verify_models.ts`) to test the exact models specified in the hackathon brief against live credentials:

### 2.1 Nano Banana 2 Lite (`gemini-3.1-flash-lite-image`)
* **Verified Interface**: `ai.models.generateContent` with `config: { responseModalities: ['IMAGE'] }`.
* **Capabilities**: Accepts both text prompts and multimodal `[inlineData, text]` reference inputs, returning high-contrast `image/jpeg` keyframes in ~3–5 seconds.
* **Cross-Scene Continuity Pattern**: To prevent product geometry or color drift across a multi-scene ad, GenMedia Studio passes the campaign's structured `VisualIdentity` (hex palette, lens spec, lighting style, continuity anchors) alongside **Scene 1's approved keyframe image** as a multimodal reference input to Scenes 2 through $N$.

### 2.2 Gemini Omni Flash (`gemini-omni-1.1-flash`)
* **Verified Interface**: `ai.interactions.create({ model: 'gemini-omni-1.1-flash', input, response_modalities: ['video'] })`.
* **Capabilities**: Calling standard `generateContent` on `gemini-omni-1.1-flash` returns `400 This model only supports Interactions API`. Via `ai.interactions.create`, it natively generates `video/mp4` (H.264 with SynthID C2PA provenance metadata) in `interaction.output_video.data`. It accepts multimodal `[image, text]` inputs to animate approved Nano Banana 2 Lite storyboard frames and supports `previous_interaction_id` for multi-turn conversational editing.
* **Non-Destructive Conversational Editing**: When a user requests an edit on Scene $k$ (e.g., *"Make the lighting warmer golden hour and change camera movement to an orbital pan right"*), GenMedia Studio snapshots the current video URL and prompt into `scene.versionHistory` before invoking `gemini-omni-1.1-flash`. Only Scene $k$ is regenerated, and users can toggle between `v1`, `v2`, and `v3` at any time.

### 2.3 Lyria 3.5 (`lyria-3.5`)
* **Verified Interface**: `ai.models.generateContent({ model: 'lyria-3.5', contents, config: { responseModalities: ['AUDIO'] } })`.
* **Capabilities**: Returns a two-part response containing musical composition notes (`part.text`) and a stereo `audio/mpeg` MP3 stream (`part.inlineData.data`).
* **Honest Engineering Boundaries**: While `lyria-3.5` responds accurately to mood, instrumentation, and tempo prompts, it does not natively lock beats to arbitrary video cut timestamps. Rather than claiming unverified beat-sync, we handle temporal alignment deterministically in FFmpeg using duration trimming, gain staging, and smooth `afade` audio envelopes.

---

## 3. End-to-End Production Architecture

1. **Structured AI Campaign Planner**: Converts a creative brief into a JSON-validated `CampaignPlan` and multi-scene storyboard with explicit camera movements, transition types, overlay copy, and continuity anchors.
2. **Reference-Chained Storyboard Grid**: Generates all scene keyframes with `gemini-3.1-flash-lite-image`, allowing drag/button reordering, prompt editing, scene approval toggles, and single-scene regeneration.
3. **Conversational Video Director Console**: Animates approved frames into MP4 clips via `gemini-omni-1.1-flash` and provides one-click and freeform conversational editing with version history rollback.
4. **Adaptive Scoring Deck**: Generates and previews `lyria-3.5` soundtracks with take history and mix level controls.
5. **FFmpeg Master Assembler & Validator**: Normalizes every scene to target resolution (`1280x720`, `720x1280`, or `720x720`) at `24 fps` (`yuv420p`), burns in lower-third copy via `drawtext`, applies scene fade transitions, mixes the `lyria-3.5` soundtrack in stereo AAC (`192k`), and runs `ffprobe` validation before unlocking final MP4 export.

---

## 4. Verification & Reproducibility

Every stage was verified end-to-end (`npm run test:e2e`) using real API calls. The pre-loaded **KONA AERO** flagship campaign includes real assets generated by `gemini-3.1-flash-lite-image`, `gemini-omni-1.1-flash` (including `v1` and conversationally edited `v2` takes), `lyria-3.5`, and a validated FFmpeg master MP4.
