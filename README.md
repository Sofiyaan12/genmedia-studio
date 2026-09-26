# GenMedia Studio — Multimodal AI Advertisement Production Platform

**Google DeepMind Hyderabad Hackathon — Track: Problem Statement 3 (Multimodal Creative Pipelines with GenMedia)**

GenMedia Studio transforms a creative brief into a broadcast-ready MP4 advertisement using chained image, video, and audio generation with cross-modal visual continuity, conversational scene editing, and automated FFmpeg post-production.

---

## 1. Verified Required Google AI Models (Milestone 1 Report)

All three required models from the official hackathon brief were verified against the live API using the provided hackathon credentials (`scripts/verify_models.ts` and `scripts/run_e2e_pipeline_test.ts`):

| Modality | Official Model Name | Model ID | Verified API Method | Verified Input / Output Format | Verified Limitations & Engineering Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Storyboard Image Generation** | **Nano Banana 2 Lite** | `gemini-3.1-flash-lite-image` | `ai.models.generateContent({ model: 'gemini-3.1-flash-lite-image', config: { responseModalities: ['IMAGE'] } })` | **Input**: Multimodal `[inlineData (reference image), text prompt]` or text prompt.<br>**Output**: `image/jpeg` (`inlineData.data` base64). | Generates 1 high-contrast keyframe per request. Cross-scene continuity is enforced by passing Scene 1's generated keyframe (or uploaded brand reference image) + visual identity anchors into subsequent scene requests. |
| **2. Video Generation & Conversational Editing** | **Gemini Omni Flash** | `gemini-omni-1.1-flash` | `ai.interactions.create({ model: 'gemini-omni-1.1-flash', response_modalities: ['video'] })` | **Input**: `[ { type: 'image', data, mime_type }, { type: 'text', text } ]` + optional `previous_interaction_id` for stateful edits.<br>**Output**: Native `video/mp4` (`interaction.output_video.data`, H.264 encoded). | `generateContent` returns `400 This model only supports Interactions API`; therefore all calls use `ai.interactions.create`. Stateful conversational edits preserve `scene.versionHistory` so previous takes can be restored without regenerating unaffected scenes. |
| **3. Adaptive Soundtrack Generation** | **Lyria 3.5** | `lyria-3.5` | `ai.models.generateContent({ model: 'lyria-3.5', config: { responseModalities: ['AUDIO'] } })` | **Input**: Mood, genre, tempo, and creative direction prompt.<br>**Output**: `audio/mpeg` (MP3 `inlineData.data`) + musical structure notes (`part.text`). | In `@google/genai` v2.4.0, `lyria-3.5` is invoked via `ai.models.generateContent` (returns `[text, audio/mpeg]`). Does not perform automatic frame-locked beat slicing; FFmpeg handles duration alignment, volume leveling, and `afade` envelopes. |

Real verified sample outputs generated during Milestone 1 are stored in `/public/verified_samples/`:
* `verified_image_gemini-3.1-flash-lite-image.jpg`
* `verified_video_gemini-omni-1.1-flash.mp4`
* `verified_video_edited_gemini-omni-1.1-flash.mp4`
* `verified_audio_lyria-3.5.mp3`
* `verification_report.json`

---

## 2. Product Workflow (End-to-End Pipeline)

1. **Creative Brief**: Enter Brand Name, Product Description, Target Audience, Campaign Objective, Creative Style, Duration (`6s–30s`), Aspect Ratio (`16:9`, `9:16`, `1:1`), Language, and optional Reference Image.
2. **AI Campaign Planner**: Generates a structured creative concept, campaign message, visual identity (hex color palette, lighting signature, lens/framing, continuity anchors), and a scene-by-scene storyboard with image prompts, video prompts, camera movements, audio directions, and transition types.
3. **Rapid Storyboard Generation (`gemini-3.1-flash-lite-image`)**: Generates storyboard keyframes across all scenes while chaining reference images for visual consistency. Users can approve, edit prompts, reorder scenes, and regenerate individual scenes.
4. **Video Generation & Conversational Editing (`gemini-omni-1.1-flash`)**: Converts approved storyboard frames into native MP4 video clips via the Interactions API. Includes a conversational Director Console where users can request natural-language edits (*"Change camera movement to orbital pan right"*, *"Make the lighting warmer golden hour"*, *"Add rising steam"*) while preserving previous scene versions (`v1`, `v2`, etc.) for instant comparison and rollback.
5. **Adaptive Soundtrack Generation (`lyria-3.5`)**: Generates custom MP3 commercial soundtracks tailored to the campaign's mood and pacing, with multi-take history and mix volume control.
6. **Final Video Assembly & Validation (`FFmpeg` + `ffprobe`)**: Normalizes all approved clips to target aspect ratio and `24 fps` (`yuv420p`, `libx264`), burns in optional lower-third scene copy (`drawtext`), applies smooth scene fade transitions, mixes the `lyria-3.5` soundtrack with `afade` envelopes, and validates the final MP4 stream (`codec`, `width`, `height`, `duration`, `frameCount`, `hasAudioStream`) before marking the campaign complete.

---

## 3. Quick Start & Setup Instructions

### Prerequisites
* Node.js 20+
* FFmpeg (`ffmpeg` and `ffprobe` in system `PATH`)
* Google Gemini API Key with access to `gemini-3.1-flash-lite-image`, `gemini-omni-1.1-flash`, and `lyria-3.5`

### Installation & Running Locally
```bash
# 1. Copy environment template and configure GEMINI_API_KEY
cp .env.example .env

# 2. Install dependencies
npm install

# 3. Verify all three required models against live API
npm run verify:models

# 4. Run full end-to-end pipeline test (Plan -> Storyboard -> Video -> Edit -> Lyria -> FFmpeg)
npm run test:e2e

# 5. Start the full-stack studio application on http://localhost:3000
npm run dev
```

### Optional Python FastAPI Service
A reference FastAPI orchestration service is also provided in `/backend/main.py`:
```bash
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --port 8000
```
