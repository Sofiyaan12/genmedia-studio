# GenMedia Studio — Complete Documentation & User Guide

**Track**: Google DeepMind Hyderabad Hackathon — Problem Statement 3 (Multimodal Creative Pipelines with GenMedia)  
**Team Members**:
* **Mohammed Sofiyaan** — Full-Stack Architecture, Frontend Workstation, Backend API Orchestration & State Persistence
* **Syed Saad Ahmed** — Multimodal Image & Video Pipeline (`gemini-3.1-flash-lite-image` & `gemini-omni-1.1-flash`), Cross-Scene Continuity & Conversational Editing
* **Mohd Rayyan Bin Mohd Jaweed** — Adaptive Audio Synthesis (`lyria-3.5`), FFmpeg Master Rendering, Audio Mixing & `ffprobe` Validation
* **Mohamed Mustafa Ali Khan** — AI Campaign Planner (`gemini-3-flash-preview`), Prompt Engineering, Visual Identity Schema, QA Verification & End-to-End Testing

---

## Table of Contents

1. [Executive Overview](#1-executive-overview)
2. [Technology Stack](#2-technology-stack)
3. [System Architecture & Data Flow](#3-system-architecture--data-flow)
4. [Models Used, How They Work & Where APIs Are Called](#4-models-used-how-they-work--where-apis-are-called)
5. [Implementation-Level Breakdown](#5-implementation-level-breakdown)
6. [Complete Website User Guide (Step-by-Step)](#6-complete-website-user-guide-step-by-step)
7. [Quick Start Guide](#7-quick-start-guide)
8. [Team Contributions](#8-team-contributions)
9. [Frequently Asked Questions (FAQ)](#9-frequently-asked-questions-faq)

---

## 1. Executive Overview

**GenMedia Studio** is an end-to-end multimodal AI advertisement production platform that transforms a structured creative brief into a finished, broadcast-ready MP4 commercial. It chains four core engines in a non-destructive workflow:

1. **AI Campaign Planner (`gemini-3-flash-preview`)** — Converts a brand brief into a structured creative concept, visual identity (hex color palette, lighting signature, lens framing, continuity anchors), musical direction, and a scene-by-scene storyboard.
2. **Rapid Storyboard Generator (`gemini-3.1-flash-lite-image` — Nano Banana 2 Lite)** — Generates photorealistic storyboard keyframes while chaining Scene 1's image (or an uploaded reference image) into subsequent scenes for strict cross-scene visual continuity.
3. **Video Animator & Conversational Director (`gemini-omni-1.1-flash` — Gemini Omni Flash)** — Synthesizes native H.264 MP4 video clips from approved storyboard frames via the Interactions API and supports natural-language conversational editing while preserving prior versions (`v1`, `v2`, `v3`) for non-destructive rollback.
4. **Adaptive Soundtrack & Master Assembler (`lyria-3.5` + `FFmpeg` + `ffprobe`)** — Generates custom commercial soundtracks in MP3 format, normalizes all scene clips to target aspect ratio and `24 fps`, burns in lower-third typography overlays (`drawtext`), applies scene transitions, mixes stereo AAC audio with fade envelopes (`afade`), and validates the final MP4 streams before export.

---

## 2. Technology Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend UI** | React 19, TypeScript, Vite | Non-Linear Editor (NLE) cinema workstation interface with 4-stage pipeline navigation, real-time video/audio monitors, and version history switchers. |
| **Styling & Design** | Tailwind CSS v4, Lucide Icons, Google Fonts (`Syne`, `Plus Jakarta Sans`, `JetBrains Mono`) | Atmospheric dark-mode post-production studio UI (`#090A0D` carbon canvas, `#111318` obsidian panels, `1px` Swiss grid borders, tabular timecodes). |
| **Primary Runtime Server** | Node.js, Express (`server.ts`), `@google/genai` v2.4.0 | Serves `/api/*` orchestration endpoints, manages background job tracking, executes Google GenAI SDK calls, and invokes FFmpeg child processes. |
| **Reference Python Backend** | Python, FastAPI, Pydantic (`backend/main.py`) | Reference FastAPI service implementing the identical shared REST API and asset contract. |
| **Database & Persistence** | Firebase Firestore + Google Auth (`src/firebase.ts`) & Local JSON Mirror (`data/campaigns.json`, `data/jobs.json`) | Dual-layer persistence storing campaigns, storyboard scenes, version histories, and pipeline job states across sessions. |
| **Media Processing** | FFmpeg 4.4.2 (`libx264`, `aac`, `libfreetype`, `libfontconfig`) + `ffprobe` | Resolution/framerate normalization, Ken Burns motion synthesis, lower-third `drawtext` burn-in, scene fade transitions, stereo audio mixing, and post-render stream validation. |

---

## 3. System Architecture & Data Flow

```
+---------------------------------------------------------------------------------------+
|                          GENMEDIA STUDIO WEB WORKSTATION (React)                      |
|  [Header: Campaign Drawer | Verified Models Inspector | Cloud Sync (Google Auth)]     |
|  [Step 01-02: Brief & Plan] -> [Step 03: Storyboard] -> [Step 04: Video] -> [Step 05: Master] |
+-------------------------------------------+-------------------------------------------+
                                            |
                                            | REST JSON (/api/*) + Firestore Sync
                                            v
+---------------------------------------------------------------------------------------+
|                        BACKEND ORCHESTRATION LAYER (server.ts)                        |
|  - Job Queue & Telemetry Tracker (data/jobs.json + Firestore /jobs/{jobId})           |
|  - Campaign State Store (data/campaigns.json + Firestore /campaigns/{campaignId})     |
|  - Retry & Exponential Backoff Handler (withRetry in server/genmediaService.ts)       |
+------------+-------------------------+-------------------------+----------------------+
             |                         |                         |
             v                         v                         v
+------------------------+ +-----------------------+ +----------------------------------+
| 1. PLANNER & IMAGES    | | 2. VIDEO & EDITING    | | 3. AUDIO & FFMPEG MASTERING      |
|                        | |                       | |                                  |
| - gemini-3-flash-      | | - gemini-omni-1.1-    | | - lyria-3.5 (AUDIO Modality)     |
|   preview (JSON Plan)  | |   flash               | |   -> /public/assets/audio/*.mp3  |
| - gemini-3.1-flash-    | |   (Interactions API)  | |                                  |
|   lite-image           | |   Image+Text -> MP4   | | - FFmpeg + ffprobe               |
|   (Ref-Chained Frames) | |   Stateful Edits via  | |   24fps yuv420p + drawtext +     |
| -> /assets/images/*.jpg| |   previous_inter_id   | |   afade mix + stream validation  |
|                        | | -> /assets/videos/*.mp4| | -> /public/assets/renders/*.mp4  |
+------------------------+ +-----------------------+ +----------------------------------+
```

---

## 4. Models Used, How They Work & Where APIs Are Called

### 4.1 AI Campaign Planner — `gemini-3-flash-preview`
* **Where Used**: `generateCampaignPlanAndStoryboard()` in `/server/genmediaService.ts` (Lines 42–188), triggered by `POST /api/campaigns/plan` in `/server.ts`.
* **How It Works**:
  * Accepts the user's `CreativeBrief` (plus optional base64 reference image).
  * Calls `ai.models.generateContent` with `responseMimeType: 'application/json'` and a strict `responseSchema`.
  * Produces a `CampaignPlan` containing `creativeConcept`, `campaignMessage`, `visualIdentity` (`colorPalette`, `lightingStyle`, `lensAndFraming`, `continuityAnchors`), `musicalMood`, `soundtrackPrompt`, and 3–5 structured `SceneItem` objects.

### 4.2 Rapid Storyboard Image Generator — `gemini-3.1-flash-lite-image` (Nano Banana 2 Lite)
* **Where Used**: `generateSceneStoryboardImage()` in `/server/genmediaService.ts` (Lines 190–259), triggered by:
  * `POST /api/campaigns/:id/storyboard/generate-all` (batch reference-chained generation)
  * `POST /api/campaigns/:id/scenes/:sceneId/image` (single-scene generation/regeneration)
* **How It Works**:
  * Calls `ai.models.generateContent({ model: 'gemini-3.1-flash-lite-image', contents, config: { responseModalities: ['IMAGE'] } })`.
  * **Cross-Scene Visual Continuity**: When generating Scene 1, if the user uploaded a product photo, it is passed as `inlineData`. Once Scene 1 is generated, Scene 1's output image (`/public/assets/images/...`) is automatically passed as the `inlineData` reference image to Scenes 2, 3, 4, and 5 alongside the campaign's `visualIdentity.continuityAnchors`.
  * Decodes `inlineData.data` (base64 JPEG/PNG) and writes it to `/public/assets/images/`.

### 4.3 Video Generation & Conversational Editing — `gemini-omni-1.1-flash` (Gemini Omni Flash)
* **Where Used**: `generateOrEditSceneVideo()` in `/server/genmediaService.ts` (Lines 261–393), triggered by `POST /api/campaigns/:id/scenes/:sceneId/video` in `/server.ts`.
* **How It Works**:
  * Calls the **Interactions API**: `ai.interactions.create({ model: 'gemini-omni-1.1-flash', input, response_modalities: ['video'] })`.
  * **Initial Scene Animation**: Passes `[ { type: 'image', data: base64Keyframe, mime_type: 'image/jpeg' }, { type: 'text', text: videoPrompt } ]` so `gemini-omni-1.1-flash` animates the approved storyboard frame using the specified camera movement.
  * **Conversational Editing**: When a user submits a natural-language edit (e.g., *"Make the lighting warmer golden hour and change camera movement to orbital pan right"*), the server:
    1. Saves the current video URL, prompt, camera movement, and `interactionId` into `scene.versionHistory` (`v1`, `v2`, etc.).
    2. Calls `ai.interactions.create` with `previous_interaction_id: scene.interactionId` and the edit instruction.
    3. Extracts the newly generated MP4 binary from `interaction.output_video.data`, saves it to `/public/assets/videos/`, validates it with `validateVideoAsset()`, and updates only that scene.

### 4.4 Adaptive Soundtrack Generator — `lyria-3.5` (Lyria 3.5)
* **Where Used**: `generateAdaptiveSoundtrack()` in `/server/genmediaService.ts` (Lines 395–454), triggered by `POST /api/campaigns/:id/soundtrack` in `/server.ts`.
* **How It Works**:
  * Calls `ai.models.generateContent({ model: 'lyria-3.5', contents: fullMusicPrompt, config: { responseModalities: ['AUDIO'] } })`.
  * Extracts both the `audio/mpeg` binary stream (`part.inlineData.data`) and the musical composition notes (`part.text`).
  * Saves the MP3 file to `/public/assets/audio/soundtrack_<campaignId>_<timestamp>.mp3` and archives previous soundtracks in `campaign.soundtrack.history`.

### 4.5 Final Video Assembly & Stream Validation — `FFmpeg` + `ffprobe`
* **Where Used**: `assembleFinalAdvertisement()` and `validateVideoAsset()` in `/server/ffmpegRenderer.ts`, triggered by `POST /api/campaigns/:id/render` in `/server.ts`.
* **How It Works**:
  1. **Per-Scene Normalization**: Loops through all approved scenes in storyboard order. Normalizes every clip to the target aspect ratio (`1280x720` for `16:9`, `720x1280` for `9:16`, `720x720` for `1:1`) at `24 fps` (`yuv420p`, `libx264`).
  2. **Lower-Third Typography & Transitions**: Applies `drawtext` filters for scenes with `overlayText` and applies smooth `fade=t=in` / `fade=t=out` transitions at scene boundaries.
  3. **Concatenation**: Joins all normalized scene segments using the FFmpeg `concat` demuxer.
  4. **Audio Mixing**: Mixes the generated `lyria-3.5` MP3 soundtrack using `-filter:a volume=...,afade=t=in...,afade=t=out...` and encodes stereo AAC (`192k`).
  5. **Post-Render Validation (`ffprobe`)**: Inspects the exported MP4 file to verify file size, `h264` video stream, `aac` audio stream, resolution, duration, and total frame count before marking the campaign `completed`.

---

## 5. Implementation-Level Breakdown

| File Path | Responsibility |
| :--- | :--- |
| `/src/types/campaign.ts` | Shared TypeScript interfaces (`CreativeBrief`, `CampaignPlan`, `SceneItem`, `SceneVersion`, `SoundtrackData`, `FinalRenderData`, `ValidationReport`, `PipelineJob`, `ModelVerificationReport`). |
| `/server/genmediaService.ts` | Core Google GenAI integration module with `withRetry()` exponential backoff, structured campaign planner, Nano Banana 2 Lite image generator, Gemini Omni Flash video & conversational editor, and Lyria 3.5 music generator. |
| `/server/ffmpegRenderer.ts` | Child-process FFmpeg & `ffprobe` rendering pipeline: aspect ratio scaling, Ken Burns fallback motion synthesis (`zoompan`), `drawtext` burn-in, scene concatenation, soundtrack mixing (`afade`), and JSON stream inspection. |
| `/server.ts` | Full-stack Express + Vite server exposing `/api/models/verify`, `/api/campaigns`, `/api/campaigns/plan`, `/api/campaigns/:id/storyboard/generate-all`, `/api/campaigns/:id/scenes/:sceneId/image`, `/api/campaigns/:id/scenes/:sceneId/video`, `/api/campaigns/:id/soundtrack`, and `/api/campaigns/:id/render`. |
| `/backend/main.py` | Python FastAPI + Pydantic reference backend matching the shared REST API contract. |
| `/src/firebase.ts` | Firebase client initialization (Google Auth + Firestore database `ai-studio-e3368b07-87ac-426c-9e4d-c7a28041e209`). |
| `/src/App.tsx` | Main studio shell managing campaign state, Firestore real-time mirror sync, 4-stage pipeline navigation, campaign history drawer, and background job status bar. |
| `/src/components/ModelVerificationModal.tsx` | Milestone 1 live model verification modal displaying verified SDK calls, capabilities, limitations, and playable sample outputs. |
| `/src/components/BriefAndPlannerStage.tsx` | Stage 1 & 2 UI: Creative brief form, 3 one-click studio presets, reference photo uploader, and AI Campaign Blueprint viewer. |
| `/src/components/StoryboardStage.tsx` | Stage 3 UI: Storyboard grid, reference-chained batch generation, scene reordering (`Move Left/Right`), approval toggle (`Approved/Hold`), transition picker, overlay copy input, and single-scene regeneration. |
| `/src/components/VideoDirectorStage.tsx` | Stage 4 UI: Split-screen NLE video monitor, conversational edit prompt console, quick director chips, and non-destructive version history bar (`v1`, `v2`, `Current`) with one-click rollback. |
| `/src/components/SoundtrackAndRenderStage.tsx` | Stage 5, 6 & 7 UI: Lyria 3.5 mood selector, audio player, mix gain slider, FFmpeg master commercial theatre, `ffprobe` stream validation report, expandable FFmpeg command log, and MP4 download. |
| `/scripts/verify_models.ts` | Automated CLI probe that verifies `gemini-3.1-flash-lite-image`, `gemini-omni-1.1-flash`, and `lyria-3.5` against live credentials. |
| `/scripts/run_e2e_pipeline_test.ts` | End-to-end automated pipeline test that generates a complete campaign from brief to validated MP4. |

---

## 6. Complete Website User Guide (Step-by-Step)

### Top Studio Bar
* **Campaign Switcher (`Campaign: KONA AERO`)**: Click to open the **Persisted Campaign History Drawer**. Switch between saved campaigns, delete old campaigns, or click **+ New Campaign Brief** to start fresh.
* **Verified Models Report**: Click the green **Verified Models Report** button at any time to open the Milestone 1 verification modal. Inside, you can inspect the exact SDK syntax, capabilities, and limitations, and play the verified sample image, native MP4 video, and Lyria 3.5 audio clip.
* **Cloud Sync**: Click **Cloud Sync** to sign in with Google and sync all campaign changes directly to your Firebase Firestore account in addition to local server storage.

### Step 01 & 02 — Brief & AI Campaign Planner
1. **Load a Preset or Write a Custom Brief**: On the left panel, click one of the 3 studio presets (*KONA AERO — Espresso System*, *AETHERIA — Botanical Elixir*, or *VELOCE CARBON — Urban E-Bike*) or fill in your own Brand Name, Product Description, Target Audience, Campaign Objective, Creative Style, Duration (`12s`, `15s`, `20s`, `30s`), Aspect Ratio (`16:9`, `9:16`, `1:1`), and Language.
2. **Optional Reference Image**: Click **Upload Product Photo (PNG/JPG)** to attach a visual reference anchor.
3. **Generate Plan**: Click **Generate Structured Campaign Plan & Storyboard**.
4. **Review Director's Blueprint**: On the right panel, inspect the generated **Creative Concept**, **Core Campaign Message**, **Visual Identity & Continuity Anchors** (with hex color swatches, lighting signature, and lens framing), and the **Scene-by-Scene Storyboard Plan**.
5. Click **Open Storyboard Studio** to proceed to Step 03.

### Step 03 — Rapid Storyboard Grid (`gemini-3.1-flash-lite-image`)
1. **Batch Generation with Continuity**: Click **Generate All Storyboard Frames (Nano Banana 2 Lite)** in the top bar. Scene 1 is generated first and automatically passed as a visual continuity reference to Scenes 2..N.
2. **Edit & Customize Individual Scenes**: Each scene card in the grid lets you:
   * Adjust **Duration (s)** (`2–10s`) and **Transition** (`fade`, `dissolve`, `wipeleft`, `smoothleft`, `cut`).
   * Edit the **Scene Lower-Third Overlay Copy** (burned into the video during FFmpeg assembly).
   * Modify the **Nano Banana 2 Lite Image Prompt** and click **Regenerate Frame** to update only that scene.
3. **Reorder & Approve**: Use the **`<-` / `->` arrows** in the top-right of any card to reorder scenes, or toggle **Approved / Hold** to include or exclude a scene from the final commercial.
4. Click **Proceed to Video Director (Gemini Omni Flash)** (or click **Animate / Edit** on any scene card).

### Step 04 — Video Director & Conversational Editor (`gemini-omni-1.1-flash`)
1. **Select a Scene**: Click any scene thumbnail in the horizontal **Scene Timeline Selector Strip** at the top.
2. **Generate Base Video**: In the center monitor (or right panel), click **Generate Initial Video Clip (`gemini-omni-1.1-flash`)**. Gemini Omni Flash animates the storyboard frame into a native MP4 video clip.
3. **Conversational Editing**:
   * On the right panel under **Conversational Scene Editor**, click any **Quick Conversational Edit Preset** (e.g., *"Make the lighting warmer golden hour with richer rim highlights"*) or type your own natural-language instruction.
   * Click **Apply Conversational Edit to Scene 0X Only**.
4. **Non-Destructive Version History & Rollback**:
   * Below the video monitor, the **Non-Destructive Take History Bar** displays every version (`v1`, `v2`, `Current Active Take`).
   * Click any historical version badge (`v1`) to preview that earlier take in the video player, or click the **Restore (`RotateCcw`) icon** on that badge to make it the active clip again.
5. Click **Proceed to Lyria 3.5 Soundtrack & FFmpeg Master**.

### Step 05–07 — Lyria 3.5 Soundtrack & FFmpeg Master Export
1. **Generate Adaptive Soundtrack (`lyria-3.5`)**:
   * On the left panel (**Lyria 3.5 Commercial Scoring Deck**), choose a **Musical Mood** chip and refine the instrumentation prompt.
   * Click **Generate Custom Soundtrack (`lyria-3.5`)**.
   * Preview the generated MP3 track in the built-in audio player, adjust the **Master Mix Gain Envelope** slider (`10%–100%`), or toggle **Mix into Final Video**.
2. **Assemble Final Advertisement (`FFmpeg`)**:
   * On the right panel (**FFmpeg Master Commercial Theatre**), click **Assemble Final Advertisement MP4**.
   * FFmpeg normalizes all approved clips to your chosen aspect ratio at `24 fps`, burns in lower-third overlay copy, applies scene fade transitions, and mixes the `lyria-3.5` soundtrack with smooth audio fade-in/out.
3. **Inspect Stream Validation & Export**:
   * Review the green **FFPROBE POST-RENDER STREAM VALIDATION PASSED** panel showing verified `VIDEO CODEC (H264)`, `AUDIO CODEC (AAC)`, `RESOLUTION`, `DURATION`, `FRAMES (@24fps)`, and `FILE SIZE`.
   * Click **Inspect Executed FFmpeg Pipeline Commands** to view the exact shell commands executed.
   * Click **Export MP4** to download the finished commercial to your computer.

---

## 7. Quick Start Guide

```bash
# 1. Clone the repository & configure environment
cp .env.example .env
# Add your GEMINI_API_KEY="AIza..." inside .env

# 2. Install Node.js dependencies
npm install

# 3. Verify all 3 required Google AI models against live credentials
npm run verify:models

# 4. Run the automated end-to-end pipeline test
npm run test:e2e

# 5. Start the full-stack GenMedia Studio server on http://localhost:3000
npm run dev
```

---

## 8. Team Contributions

### 1. Mohammed Sofiyaan — Full-Stack Architecture, Frontend Workstation & Backend Orchestration
* Architected the end-to-end **GenMedia Studio** web workstation (`src/App.tsx`, `src/components/*`) with a dark-mode cinema NLE layout, 4-stage pipeline navigation, and persistent campaign drawer.
* Implemented the Express orchestration server (`server.ts`) and reference Python FastAPI service (`backend/main.py`) following a unified REST API contract (`/api/campaigns/*`, `/api/models/verify`).
* Integrated dual-layer persistence combining **Firebase Firestore + Google Authentication** (`src/firebase.ts`, `firestore.rules`, `firebase-blueprint.json`) with local JSON state mirroring (`data/campaigns.json`, `data/jobs.json`) and live background job telemetry.

### 2. Syed Saad Ahmed — Multimodal Image & Video Pipeline (`gemini-3.1-flash-lite-image` & `gemini-omni-1.1-flash`)
* Integrated **Nano Banana 2 Lite (`gemini-3.1-flash-lite-image`)** in `server/genmediaService.ts` for rapid storyboard image generation, implementing reference-image chaining (passing Scene 1's keyframe or uploaded product photo as `inlineData` to subsequent scenes) to maintain cross-scene visual consistency.
* Integrated **Gemini Omni Flash (`gemini-omni-1.1-flash`)** via the **Interactions API** (`ai.interactions.create` with `response_modalities: ['video']`) to synthesize native H.264 MP4 video clips (`interaction.output_video.data`) from approved storyboard frames.
* Built the stateful **Conversational Video Editing** workflow (`VideoDirectorStage.tsx`) using `previous_interaction_id` and non-destructive `versionHistory` snapshots so users can edit individual scenes and roll back between `v1`, `v2`, and `v3` takes.

### 3. Mohd Rayyan Bin Mohd Jaweed — Adaptive Audio Synthesis (`lyria-3.5`) & FFmpeg Master Rendering Engine
* Integrated **Lyria 3.5 (`lyria-3.5`)** via `ai.models.generateContent` (`responseModalities: ['AUDIO']`) to synthesize custom MP3 commercial soundtracks (`audio/mpeg`) with mood selection, composition notes extraction, and take history (`SoundtrackAndRenderStage.tsx`).
* Built the **FFmpeg Master Rendering Pipeline** (`server/ffmpegRenderer.ts`) supporting multi-aspect normalization (`1280x720`, `720x1280`, `720x720` @ `24 fps` `yuv420p`), Ken Burns motion synthesis (`zoompan`), lower-third typography burn-in (`drawtext`), scene fade transitions, and stereo AAC soundtrack mixing with `afade` envelopes.
* Implemented automated post-render stream validation using `ffprobe` (`validateVideoAsset`) to verify video/audio codecs, frame counts, duration, and file integrity prior to export.

### 4. Mohamed Mustafa Ali Khan — AI Campaign Planner, Prompt Engineering, Model Verification & QA
* Designed the **AI Campaign Planner** (`generateCampaignPlanAndStoryboard` using `gemini-3-flash-preview` with structured JSON `responseSchema`) to transform user briefs into cohesive creative concepts, hex color palettes, lens/lighting specifications, and scene-by-scene storyboards (`BriefAndPlannerStage.tsx`).
* Authored the live credential verification suite (`scripts/verify_models.ts`, `ModelVerificationModal.tsx`) that empirically tested model availability, API interfaces, and output modalities across all required hackathon models.
* Built the automated end-to-end test harness (`scripts/run_e2e_pipeline_test.ts`), curated the studio campaign presets (*KONA AERO*, *AETHERIA*, *VELOCE CARBON*), and led quality assurance and technical documentation.

---

## 9. Frequently Asked Questions (FAQ)

### Q1: Does GenMedia Studio use any mock media or fake model outputs?
**No.** Every image, video clip, audio soundtrack, and rendered commercial is genuinely generated by the live Google AI models (`gemini-3.1-flash-lite-image`, `gemini-omni-1.1-flash`, `lyria-3.5`) and assembled by `/usr/bin/ffmpeg`. Even the pre-loaded **KONA AERO** showcase campaign was generated end-to-end via `npm run test:e2e` using live API credentials.

### Q2: Why is `gemini-omni-1.1-flash` called via `ai.interactions.create` instead of `ai.models.generateContent`?
During Milestone 1 live verification (`scripts/verify_models.ts`), calling `ai.models.generateContent` on `gemini-omni-1.1-flash` returned HTTP `400: This model only supports Interactions API`. When invoked via `ai.interactions.create({ model: 'gemini-omni-1.1-flash', response_modalities: ['video'] })`, it natively returns an H.264 `video/mp4` payload inside `interaction.output_video.data` and provides an `interaction.id` for stateful multi-turn editing.

### Q3: How does `lyria-3.5` generate audio in `@google/genai` v2.4.0?
In `@google/genai` v2.4.0, `lyria-3.5` supports `generateContent` (`models/lyria-3.5`). Calling `ai.models.generateContent({ model: 'lyria-3.5', contents: prompt, config: { responseModalities: ['AUDIO'] } })` returns two content parts: composition notes (`text`) and a stereo MP3 audio stream (`audio/mpeg` in `inlineData.data`).

### Q4: How is visual consistency maintained across multiple storyboard scenes?
We combine two techniques:
1. **Structured Continuity Anchors**: The AI Campaign Planner generates explicit `visualIdentity` rules (hex color palette, lighting style, lens specification, and recurring product geometry anchors) that are appended to every scene prompt.
2. **Multimodal Reference Image Chaining**: When generating scenes $2..N$, the backend automatically passes Scene 1's generated image (or the user's uploaded reference photo) as an `inlineData` image input to `gemini-3.1-flash-lite-image`.

### Q5: What happens when I request a conversational edit on a video scene? Does it overwrite my previous video?
No. Before invoking `gemini-omni-1.1-flash` with your edit instruction, the backend pushes the current video URL, prompt, camera movement, and `interactionId` into `scene.versionHistory`. Only the selected scene is regenerated, and you can preview or restore any previous version (`v1`, `v2`, etc.) with one click in the **Video Director** tab.

### Q6: Can I render the final commercial even if I haven't generated video clips for all scenes yet?
Yes! If an approved scene has a native `gemini-omni-1.1-flash` MP4 clip, FFmpeg uses that clip. If an approved scene only has a `gemini-3.1-flash-lite-image` storyboard image, FFmpeg automatically synthesizes a smooth 24fps camera movement clip (`zoompan` push-in, pull-back, or pan matching `scene.cameraMovement`) so you can assemble a complete commercial at any stage.
