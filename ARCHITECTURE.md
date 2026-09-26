# GenMedia Studio — System Architecture & Shared Asset Contract

## 1. High-Level Architecture

```
+-----------------------------------------------------------------------------------+
|                        GENMEDIA STUDIO FRONTEND (React + TS)                      |
|  [1. Brief & Plan] -> [2. Storyboard Grid] -> [3. Omni Video NLE] -> [4. Master]  |
+-----------------------------------------+-----------------------------------------+
                                          | REST API (/api/campaigns/*) + Firestore Sync
                                          v
+-----------------------------------------------------------------------------------+
|                     ORCHESTRATION & JOB ENGINE (server.ts / FastAPI)              |
|  - Campaign State Persistence (Firebase Firestore + Local JSON Mirror)            |
|  - Background Job State Tracker (/api/campaigns, jobs.json, Firestore /jobs)      |
|  - Retry & Exponential Backoff Wrapper + Selective Scene Version History          |
+-----------------+-------------------------------+---------------------------------+
                  |                               |
     +------------+------------+                  +----------------+----------------+
     | SAAD: IMAGE & VIDEO     |                                   | RAYYAN: AUDIO & FFMPEG RENDER  |
     v                         v                                   v                                v
+--------------------+  +-------------------------+       +------------------+             +--------------------+
| Nano Banana 2 Lite |  |   Gemini Omni Flash     |       |    Lyria 3.5     |             |  FFmpeg + ffprobe  |
| gemini-3.1-flash-  |  |  gemini-omni-1.1-flash  |       |    lyria-3.5     |             |  /usr/bin/ffmpeg   |
|    lite-image      |  | (Interactions API v1)   |       | (AUDIO Modality) |             |  - 24fps yuv420p   |
|                    |  |                         |       |                  |             |  - drawtext burn-in|
| Reference Chaining |  | Image+Text -> MP4 Video |       | Mood + Pacing -> |             |  - afade audio mix |
| -> /assets/images/ |  | Stateful Conversational |       | /assets/audio/   |             |  - Stream check    |
|                    |  | Edits -> /assets/videos/|       |   *.mp3          |             | -> /assets/renders/|
+--------------------+  +-------------------------+       +------------------+             +--------------------+
```

## 2. Team Module Boundaries & Shared API Contract

### Sofiyaan — Frontend, Backend & Orchestration
* **Campaign Planning (`POST /api/campaigns/plan`)**: Uses structured JSON output (`responseSchema`) to convert a `CreativeBrief` into a `CampaignPlan` and an array of `SceneItem` records containing explicit `visualIdentity.continuityAnchors`.
* **Persistence & Job States**: Every campaign and pipeline job (`plan`, `scene_image`, `scene_video`, `scene_edit`, `soundtrack`, `final_render`) is persisted in both Firebase Firestore (`/campaigns/{id}`, `/jobs/{id}`) and local storage (`data/campaigns.json`, `data/jobs.json`).

### Saad — Image & Video Generation (`server/genmediaService.ts`)
* **Storyboard Generation (`POST /api/campaigns/:id/scenes/:sceneId/image` & `/storyboard/generate-all`)**:
  * Model: `gemini-3.1-flash-lite-image` via `ai.models.generateContent`.
  * Cross-modal continuity: Scene 1's approved keyframe (or user's uploaded brand reference image) is passed as `inlineData` to scenes `2..N` alongside the campaign's `visualIdentity` palette and lighting signature.
* **Video Generation & Conversational Editing (`POST /api/campaigns/:id/scenes/:sceneId/video`)**:
  * Model: `gemini-omni-1.1-flash` via `ai.interactions.create({ model: 'gemini-omni-1.1-flash', response_modalities: ['video'] })`.
  * Extracts native MP4 bytes from `interaction.output_video.data`.
  * Conversational edits push the current clip onto `scene.versionHistory` before creating a chained interaction (`previous_interaction_id`), allowing non-destructive version switching (`v1`, `v2`, etc.).

### Rayyan — Audio & FFmpeg Rendering (`server/ffmpegRenderer.ts`)
* **Adaptive Soundtrack (`POST /api/campaigns/:id/soundtrack`)**:
  * Model: `lyria-3.5` via `ai.models.generateContent({ model: 'lyria-3.5', config: { responseModalities: ['AUDIO'] } })`.
  * Saves `audio/mpeg` stream to `/public/assets/audio/` and preserves previous takes in `soundtrack.history`.
* **Final Video Assembly (`POST /api/campaigns/:id/render`)**:
  * Normalizes each approved scene to target aspect ratio (`1280x720` for `16:9`, `720x1280` for `9:16`, `720x720` for `1:1`) at `24 fps` (`libx264`, `yuv420p`).
  * Applies lower-third `drawtext` overlays and scene boundary fade transitions.
  * Concatenates normalized clips and mixes the `lyria-3.5` soundtrack with `volume` and `afade` filters.
  * Executes `ffprobe` (`validateVideoAsset`) to verify video codec, audio stream presence, resolution, frame count, and duration before marking the campaign `completed`.
