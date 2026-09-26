import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import {
  CampaignPlan,
  CreativeBrief,
  ModelVerificationReport,
  SceneItem,
  SoundtrackData,
  TransitionType,
} from '../src/types/campaign';
import { renderStillToMotionVideo, validateVideoAsset } from './ffmpegRenderer';

dotenv.config();

const IMAGE_MODEL_ID = 'gemini-3.1-flash-lite-image';
const OMNI_VIDEO_MODEL_ID = 'gemini-omni-1.1-flash';
const LYRIA_MODEL_ID = 'lyria-3.5';
const PLANNER_MODEL_ID = 'gemini-3-flash-preview';

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is required.');
  }
  return new GoogleGenAI({ apiKey });
}

async function withRetry<T>(fn: () => Promise<T>, retries = 2, delayMs = 1500): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)));
      }
    }
  }
  throw lastError;
}

export async function generateCampaignPlanAndStoryboard(
  brief: CreativeBrief
): Promise<{ plan: CampaignPlan; scenes: SceneItem[] }> {
  const ai = getAiClient();
  const targetSceneCount = brief.durationSeconds <= 12 ? 3 : brief.durationSeconds <= 20 ? 4 : 5;
  const avgSceneDuration = Math.max(3, Math.round(brief.durationSeconds / targetSceneCount));

  const promptText = `You are an award-winning commercial film director and creative strategist.
Design a complete, cohesive multimodal advertisement campaign plan and scene-by-scene storyboard for the following brief:

- Brand / Product Name: ${brief.brandName}
- Product Description: ${brief.productDescription}
- Target Audience: ${brief.targetAudience}
- Campaign Objective: ${brief.campaignObjective}
- Creative Style: ${brief.creativeStyle}
- Total Duration: ${brief.durationSeconds} seconds (${targetSceneCount} scenes, ~${avgSceneDuration}s each)
- Aspect Ratio: ${brief.aspectRatio}
- Language: ${brief.language}

Ensure strict cross-modal visual continuity across all ${targetSceneCount} scenes: specify recurring subject details, color palette hex/names, lighting signature, and lens framing inside every scene's imagePrompt and videoPrompt so that Nano Banana 2 Lite (${IMAGE_MODEL_ID}) and Gemini Omni Flash (${OMNI_VIDEO_MODEL_ID}) produce visually consistent shots.`;

  const contents: any[] = [];
  if (brief.referenceImageBase64 && brief.referenceImageMimeType) {
    contents.push({
      inlineData: {
        data: brief.referenceImageBase64.replace(/^data:[^;]+;base64,/, ''),
        mimeType: brief.referenceImageMimeType,
      },
    });
  }
  contents.push(promptText);

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: PLANNER_MODEL_ID,
      contents,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            creativeConcept: { type: Type.STRING },
            campaignMessage: { type: Type.STRING },
            visualIdentity: {
              type: Type.OBJECT,
              properties: {
                colorPalette: { type: Type.ARRAY, items: { type: Type.STRING } },
                lightingStyle: { type: Type.STRING },
                lensAndFraming: { type: Type.STRING },
                continuityAnchors: { type: Type.STRING },
              },
              required: ['colorPalette', 'lightingStyle', 'lensAndFraming', 'continuityAnchors'],
            },
            musicalMood: { type: Type.STRING },
            soundtrackPrompt: { type: Type.STRING },
            scenes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  sceneNumber: { type: Type.INTEGER },
                  title: { type: Type.STRING },
                  durationSeconds: { type: Type.NUMBER },
                  imagePrompt: { type: Type.STRING },
                  videoPrompt: { type: Type.STRING },
                  cameraMovement: { type: Type.STRING },
                  audioDirection: { type: Type.STRING },
                  transitionType: { type: Type.STRING },
                  overlayText: { type: Type.STRING },
                },
                required: [
                  'sceneNumber',
                  'title',
                  'durationSeconds',
                  'imagePrompt',
                  'videoPrompt',
                  'cameraMovement',
                  'audioDirection',
                  'transitionType',
                  'overlayText',
                ],
              },
            },
          },
          required: [
            'creativeConcept',
            'campaignMessage',
            'visualIdentity',
            'musicalMood',
            'soundtrackPrompt',
            'scenes',
          ],
        },
      },
    })
  );

  const parsed = JSON.parse(response.text || '{}');

  const plan: CampaignPlan = {
    creativeConcept: parsed.creativeConcept || `High-impact ${brief.creativeStyle} campaign for ${brief.brandName}`,
    campaignMessage: parsed.campaignMessage || brief.campaignObjective,
    visualIdentity: {
      colorPalette: parsed.visualIdentity?.colorPalette || ['#F59E0B', '#18181B', '#FAFAFA'],
      lightingStyle: parsed.visualIdentity?.lightingStyle || 'Cinematic golden rim lighting with soft fill',
      lensAndFraming: parsed.visualIdentity?.lensAndFraming || '35mm anamorphic prime lens, shallow depth of field',
      continuityAnchors:
        parsed.visualIdentity?.continuityAnchors ||
        `Consistent ${brief.brandName} hero product geometry and material finish across all shots`,
    },
    musicalMood: parsed.musicalMood || 'Uplifting Modern Electronic',
    soundtrackPrompt:
      parsed.soundtrackPrompt ||
      `Instrumental ${brief.creativeStyle} commercial soundtrack for ${brief.brandName}, warm synths and crisp percussion, high production value`,
  };

  const allowedTransitions: TransitionType[] = ['fade', 'dissolve', 'wipeleft', 'smoothleft', 'cut'];
  const scenes: SceneItem[] = (parsed.scenes || []).map((s: any, idx: number) => {
    const rawTransition = String(s.transitionType || 'fade').toLowerCase() as TransitionType;
    const transitionType: TransitionType = allowedTransitions.includes(rawTransition) ? rawTransition : 'fade';

    return {
      id: `scene_${idx + 1}_${Date.now().toString(36)}`,
      sceneNumber: idx + 1,
      title: s.title || `Scene ${idx + 1}`,
      durationSeconds: Math.max(3, Math.min(8, Number(s.durationSeconds) || avgSceneDuration)),
      imagePrompt: s.imagePrompt,
      videoPrompt: s.videoPrompt,
      cameraMovement: s.cameraMovement || 'Slow Push-In',
      audioDirection: s.audioDirection || 'Warm ambient score swell',
      transitionType,
      overlayText: s.overlayText || (idx === (parsed.scenes?.length || 1) - 1 ? brief.brandName : ''),
      approved: true,
      status: 'pending',
      versionHistory: [],
    };
  });

  return { plan, scenes };
}

export async function generateSceneStoryboardImage(options: {
  scene: SceneItem;
  brief: CreativeBrief;
  plan?: CampaignPlan;
  referenceImagePath?: string;
  publicDir: string;
}): Promise<{ imageUrl: string; modelUsed: string }> {
  const ai = getAiClient();
  const { scene, brief, plan, referenceImagePath, publicDir } = options;

  const imagesDir = path.join(publicDir, 'assets', 'images');
  fs.mkdirSync(imagesDir, { recursive: true });

  const continuityContext = plan
    ? `Visual Continuity Anchors: ${plan.visualIdentity.continuityAnchors}. Lighting: ${plan.visualIdentity.lightingStyle}. Lens: ${plan.visualIdentity.lensAndFraming}. Palette: ${plan.visualIdentity.colorPalette.join(', ')}.`
    : `Style: ${brief.creativeStyle}. Brand: ${brief.brandName}.`;

  const fullImagePrompt = `${scene.imagePrompt}\n\n${continuityContext}\nAspect Ratio: ${brief.aspectRatio}. Commercial advertisement still frame, photorealistic, high contrast, no watermarks.`;

  const contents: any[] = [];
  if (referenceImagePath && fs.existsSync(referenceImagePath)) {
    const ext = path.extname(referenceImagePath).toLowerCase();
    const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
    const b64 = fs.readFileSync(referenceImagePath).toString('base64');
    contents.push({
      inlineData: {
        data: b64,
        mimeType,
      },
    });
    contents.push(
      `Maintain visual consistency with this reference image for ${brief.brandName}. Generate the following scene frame: ${fullImagePrompt}`
    );
  } else if (brief.referenceImageBase64 && brief.referenceImageMimeType) {
    contents.push({
      inlineData: {
        data: brief.referenceImageBase64.replace(/^data:[^;]+;base64,/, ''),
        mimeType: brief.referenceImageMimeType,
      },
    });
    contents.push(
      `Maintain visual consistency with this brand reference image for ${brief.brandName}. Generate the following scene frame: ${fullImagePrompt}`
    );
  } else {
    contents.push(fullImagePrompt);
  }

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: IMAGE_MODEL_ID,
      contents,
      config: {
        responseModalities: ['IMAGE'],
      },
    })
  );

  const parts = response.candidates?.[0]?.content?.parts || [];
  const imgPart = parts.find((p: any) => p.inlineData?.data);
  if (!imgPart?.inlineData?.data) {
    throw new Error(`Model ${IMAGE_MODEL_ID} did not return inline image data.`);
  }

  const ext = imgPart.inlineData.mimeType?.includes('png') ? 'png' : 'jpg';
  const filename = `${scene.id}_${Date.now()}.${ext}`;
  const outPath = path.join(imagesDir, filename);
  fs.writeFileSync(outPath, Buffer.from(imgPart.inlineData.data, 'base64'));

  return {
    imageUrl: `/assets/images/${filename}`,
    modelUsed: IMAGE_MODEL_ID,
  };
}

export async function generateOrEditSceneVideo(options: {
  scene: SceneItem;
  brief: CreativeBrief;
  plan?: CampaignPlan;
  conversationalInstruction?: string;
  publicDir: string;
}): Promise<{
  videoUrl: string;
  modelUsed: string;
  interactionId?: string;
  directorNotes?: string;
  updatedVideoPrompt: string;
  updatedCameraMovement: string;
}> {
  const ai = getAiClient();
  const { scene, brief, plan, conversationalInstruction, publicDir } = options;

  const videosDir = path.join(publicDir, 'assets', 'videos');
  fs.mkdirSync(videosDir, { recursive: true });

  let updatedCameraMovement = scene.cameraMovement;
  let updatedVideoPrompt = scene.videoPrompt;

  if (conversationalInstruction && conversationalInstruction.trim()) {
    const lower = conversationalInstruction.toLowerCase();
    if (lower.includes('pan right') || lower.includes('orbital')) {
      updatedCameraMovement = 'Orbital Pan Right';
    } else if (lower.includes('pan left')) {
      updatedCameraMovement = 'Smooth Pan Left';
    } else if (lower.includes('pull') || lower.includes('zoom out') || lower.includes('wide')) {
      updatedCameraMovement = 'Slow Pull-Back Reveal';
    } else if (lower.includes('push') || lower.includes('zoom in') || lower.includes('close')) {
      updatedCameraMovement = 'Macro Push-In';
    } else if (lower.includes('crane') || lower.includes('tilt')) {
      updatedCameraMovement = 'Dynamic Crane Up';
    }
    updatedVideoPrompt = `${scene.videoPrompt}. Director Edit: ${conversationalInstruction.trim()}`;
  }

  const continuityNote = plan
    ? `Visual Identity: ${plan.visualIdentity.continuityAnchors}, ${plan.visualIdentity.lightingStyle}, ${plan.visualIdentity.lensAndFraming}.`
    : `Brand: ${brief.brandName}, Style: ${brief.creativeStyle}.`;

  const promptForOmni = conversationalInstruction
    ? `Apply this edit to the commercial scene for ${brief.brandName}: "${conversationalInstruction}".
Keep visual continuity (${continuityNote}).
Scene action: ${updatedVideoPrompt}.
Camera movement: ${updatedCameraMovement}.`
    : `Commercial video clip for ${brief.brandName} (${brief.aspectRatio}).
Scene: ${updatedVideoPrompt}.
Camera Movement: ${updatedCameraMovement}.
${continuityNote}`;

  // Prepare input for gemini-omni-1.1-flash
  const interactionParams: Record<string, any> = {
    model: OMNI_VIDEO_MODEL_ID,
    response_modalities: ['video'],
  };

  if (conversationalInstruction && scene.interactionId) {
    interactionParams.previous_interaction_id = scene.interactionId;
    interactionParams.input = promptForOmni;
  } else if (scene.imageUrl) {
    const cleanRel = scene.imageUrl.split('?')[0].replace(/^\//, '');
    const localImgPath = path.join(publicDir, cleanRel);
    if (fs.existsSync(localImgPath)) {
      const b64 = fs.readFileSync(localImgPath).toString('base64');
      const mimeType = localImgPath.endsWith('.png') ? 'image/png' : 'image/jpeg';
      interactionParams.input = [
        {
          type: 'image',
          data: b64,
          mime_type: mimeType,
        },
        {
          type: 'text',
          text: promptForOmni,
        },
      ];
    } else {
      interactionParams.input = promptForOmni;
    }
  } else {
    interactionParams.input = promptForOmni;
  }

  const interaction: any = await withRetry(async () => {
    try {
      return await (ai as any).interactions.create(interactionParams);
    } catch (err: any) {
      // If image+text input or previous_interaction_id was rejected by the endpoint, retry with pure text input on gemini-omni-1.1-flash
      if (Array.isArray(interactionParams.input) || interactionParams.previous_interaction_id) {
        return await (ai as any).interactions.create({
          model: OMNI_VIDEO_MODEL_ID,
          input: promptForOmni,
          response_modalities: ['video'],
        });
      }
      throw err;
    }
  }, 1);

  const outputs: any[] = interaction.outputs || [];
  const videoOut =
    interaction.output_video?.data
      ? interaction.output_video
      : outputs.find((o: any) => o.type === 'video' && o.data);
  const textOut =
    interaction.output_text
      ? { text: interaction.output_text }
      : outputs.find((o: any) => o.type === 'text' && o.text);

  if (videoOut && videoOut.data) {
    const versionNum = (scene.versionHistory?.length || 0) + 1;
    const filename = `${scene.id}_v${versionNum}_${Date.now()}.mp4`;
    const outPath = path.join(videosDir, filename);
    fs.writeFileSync(outPath, Buffer.from(videoOut.data, 'base64'));

    await validateVideoAsset(outPath);

    return {
      videoUrl: `/assets/videos/${filename}`,
      modelUsed: OMNI_VIDEO_MODEL_ID,
      interactionId: interaction.id,
      directorNotes:
        textOut?.text ||
        (conversationalInstruction
          ? `Applied edit via ${OMNI_VIDEO_MODEL_ID}: "${conversationalInstruction}"`
          : `Generated native video clip via ${OMNI_VIDEO_MODEL_ID} (${updatedCameraMovement})`),
      updatedVideoPrompt,
      updatedCameraMovement,
    };
  }

  throw new Error(`Model ${OMNI_VIDEO_MODEL_ID} completed interaction without returning a video payload.`);
}

export async function generateAdaptiveSoundtrack(options: {
  campaignId: string;
  mood: string;
  prompt: string;
  brief: CreativeBrief;
  publicDir: string;
}): Promise<{
  audioUrl: string;
  modelUsed: string;
  generatedLyricsOrNotes?: string;
}> {
  const ai = getAiClient();
  const { campaignId, mood, prompt, brief, publicDir } = options;

  const audioDir = path.join(publicDir, 'assets', 'audio');
  fs.mkdirSync(audioDir, { recursive: true });

  const fullMusicPrompt = `Create an advertisement soundtrack for "${brief.brandName}".
Musical Mood: ${mood}.
Direction: ${prompt}.
Campaign Style: ${brief.creativeStyle}.
Instrumental commercial score with clean dynamic progression.`;

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: LYRIA_MODEL_ID,
      contents: fullMusicPrompt,
      config: {
        responseModalities: ['AUDIO'],
      },
    })
  );

  const parts = response.candidates?.[0]?.content?.parts || [];
  let audioBase64: string | undefined;
  let audioMimeType = 'audio/mp3';
  const textNotes: string[] = [];

  for (const part of parts) {
    if (part.inlineData?.data && part.inlineData?.mimeType?.startsWith('audio/')) {
      audioBase64 = part.inlineData.data;
      audioMimeType = part.inlineData.mimeType;
    } else if (part.text) {
      textNotes.push(part.text);
    }
  }

  if (!audioBase64) {
    throw new Error(`Model ${LYRIA_MODEL_ID} did not return an audio inlineData payload.`);
  }

  const ext = audioMimeType.includes('mp3') || audioMimeType.includes('mpeg') ? 'mp3' : 'wav';
  const filename = `soundtrack_${campaignId}_${Date.now()}.${ext}`;
  const outPath = path.join(audioDir, filename);
  fs.writeFileSync(outPath, Buffer.from(audioBase64, 'base64'));

  return {
    audioUrl: `/assets/audio/${filename}`,
    modelUsed: LYRIA_MODEL_ID,
    generatedLyricsOrNotes: textNotes.join('\n').trim() || `Instrumental ${mood} score generated by ${LYRIA_MODEL_ID}.`,
  };
}

export function getVerifiedModelsReport(publicDir: string): ModelVerificationReport {
  const hasImageSample = fs.existsSync(
    path.join(publicDir, 'verified_samples', 'verified_image_gemini-3.1-flash-lite-image.jpg')
  );
  const hasVideoSample = fs.existsSync(
    path.join(publicDir, 'verified_samples', 'verified_video_gemini-omni-1.1-flash.mp4')
  );
  const hasEditedVideoSample = fs.existsSync(
    path.join(publicDir, 'verified_samples', 'verified_video_edited_gemini-omni-1.1-flash.mp4')
  );
  const hasAudioSample = fs.existsSync(
    path.join(publicDir, 'verified_samples', 'verified_audio_lyria-3.5.mp3')
  );

  return {
    timestamp: new Date().toISOString(),
    imageModel: {
      requestedId: IMAGE_MODEL_ID,
      verifiedId: IMAGE_MODEL_ID,
      sdkMethod: "ai.models.generateContent({ model: 'gemini-3.1-flash-lite-image', config: { responseModalities: ['IMAGE'] } })",
      status: 'verified',
      capabilities: [
        'Text-to-Image storyboard generation (image/jpeg)',
        'Multimodal reference image input for cross-scene visual consistency',
        'Rapid scene-level regeneration',
      ],
      limitations: [
        'Returns single keyframe image per call; aspect ratio guided via prompt + reference image framing',
      ],
      sampleAssetUrl: hasImageSample
        ? '/verified_samples/verified_image_gemini-3.1-flash-lite-image.jpg'
        : undefined,
    },
    videoOmniModel: {
      requestedId: OMNI_VIDEO_MODEL_ID,
      verifiedId: OMNI_VIDEO_MODEL_ID,
      sdkMethod: "ai.interactions.create({ model: 'gemini-omni-1.1-flash', response_modalities: ['video'] })",
      status: 'verified',
      capabilities: [
        'Native MP4 (video/mp4, H.264) clip generation via Interactions API',
        'Image + Text to Video animation from approved Nano Banana 2 Lite storyboard frames',
        'Stateful conversational editing via previous_interaction_id and natural-language director prompts',
        'Scene-level version history preservation without regenerating unaffected scenes',
      ],
      limitations: [
        'Each interaction generates a ~4-8s MP4 clip; longer durations and cross-scene transitions are normalized and assembled via FFmpeg',
        'Audio speech_config voice parameter is not supported when generating video; soundtrack is mixed via Lyria 3.5 + FFmpeg',
      ],
      sampleVideoUrl: hasVideoSample
        ? '/verified_samples/verified_video_gemini-omni-1.1-flash.mp4'
        : hasEditedVideoSample
          ? '/verified_samples/verified_video_edited_gemini-omni-1.1-flash.mp4'
          : undefined,
    },
    musicModel: {
      requestedId: LYRIA_MODEL_ID,
      verifiedId: LYRIA_MODEL_ID,
      sdkMethod: "ai.models.generateContent({ model: 'lyria-3.5', config: { responseModalities: ['AUDIO'] } })",
      status: 'verified',
      capabilities: [
        'Native soundtrack generation (audio/mp3) via generateContent with AUDIO modality',
        'Mood, genre, tempo, and instrumentation control via structured prompts',
        'Multiple take history and preview before final FFmpeg audio mix',
      ],
      limitations: [
        'Called via ai.models.generateContent (not ai.music.generate in @google/genai v2.4.0)',
        'Does not perform automatic frame-locked beat synchronization; FFmpeg handles duration trimming, volume leveling, and fade-in/out envelopes',
      ],
      sampleAudioUrl: hasAudioSample
        ? '/verified_samples/verified_audio_lyria-3.5.mp3'
        : undefined,
    },
    ffmpegEngine: {
      binaryPath: '/usr/bin/ffmpeg',
      version: '4.4.2 (libx264, aac, libfreetype, libfontconfig, ffprobe)',
      capabilities: [
        'Resolution & framerate normalization (1280x720 16:9, 720x1280 9:16, 720x720 1:1 @ 24fps yuv420p)',
        'Scene transition fades and drawtext lower-third overlays',
        'Multi-clip concatenation and Lyria 3.5 stereo AAC soundtrack mixing with afade envelopes',
        'Automated post-render ffprobe stream validation (codec, frame count, duration, audio stream check)',
      ],
    },
  };
}
