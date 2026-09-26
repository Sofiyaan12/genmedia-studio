import dotenv from 'dotenv';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { assembleFinalAdvertisement } from './server/ffmpegRenderer';
import {
  generateAdaptiveSoundtrack,
  generateCampaignPlanAndStoryboard,
  generateOrEditSceneVideo,
  generateSceneStoryboardImage,
  getVerifiedModelsReport,
} from './server/genmediaService';
import { Campaign, CreativeBrief, PipelineJob, SceneVersion } from './src/types/campaign';

dotenv.config();

const PORT = 3000;
const PUBLIC_DIR = path.resolve(process.cwd(), 'public');
const DATA_DIR = path.resolve(process.cwd(), 'data');
const CAMPAIGNS_FILE = path.join(DATA_DIR, 'campaigns.json');
const JOBS_FILE = path.join(DATA_DIR, 'jobs.json');

fs.mkdirSync(PUBLIC_DIR, { recursive: true });
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(path.join(PUBLIC_DIR, 'assets', 'images'), { recursive: true });
fs.mkdirSync(path.join(PUBLIC_DIR, 'assets', 'videos'), { recursive: true });
fs.mkdirSync(path.join(PUBLIC_DIR, 'assets', 'audio'), { recursive: true });
fs.mkdirSync(path.join(PUBLIC_DIR, 'assets', 'renders'), { recursive: true });

function loadCampaigns(): Campaign[] {
  try {
    if (fs.existsSync(CAMPAIGNS_FILE)) {
      return JSON.parse(fs.readFileSync(CAMPAIGNS_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('Failed to read campaigns.json:', e);
  }
  return [];
}

function saveCampaigns(campaigns: Campaign[]): void {
  fs.writeFileSync(CAMPAIGNS_FILE, JSON.stringify(campaigns, null, 2));
}

function upsertCampaign(campaign: Campaign): Campaign {
  const list = loadCampaigns();
  const idx = list.findIndex((c) => c.id === campaign.id);
  campaign.updatedAt = new Date().toISOString();
  if (idx >= 0) {
    list[idx] = campaign;
  } else {
    list.unshift(campaign);
  }
  saveCampaigns(list);
  return campaign;
}

function loadJobs(): PipelineJob[] {
  try {
    if (fs.existsSync(JOBS_FILE)) {
      return JSON.parse(fs.readFileSync(JOBS_FILE, 'utf-8'));
    }
  } catch {
    // ignore
  }
  return [];
}

function upsertJob(job: PipelineJob): PipelineJob {
  const jobs = loadJobs();
  const idx = jobs.findIndex((j) => j.id === job.id);
  job.updatedAt = new Date().toISOString();
  if (idx >= 0) {
    jobs[idx] = job;
  } else {
    jobs.unshift(job);
  }
  const trimmed = jobs.slice(0, 60);
  fs.writeFileSync(JOBS_FILE, JSON.stringify(trimmed, null, 2));
  return job;
}

function createJob(
  campaignId: string,
  ownerId: string,
  type: PipelineJob['type'],
  modelId: string,
  message: string
): PipelineJob {
  const now = new Date().toISOString();
  const job: PipelineJob = {
    id: `job_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    campaignId,
    ownerId,
    type,
    status: 'running',
    progress: 15,
    modelId,
    message,
    createdAt: now,
    updatedAt: now,
  };
  return upsertJob(job);
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));
  app.use(express.static(PUBLIC_DIR));

  // 1. Model Verification Report Endpoint
  app.get('/api/models/verify', (_req, res) => {
    try {
      const report = getVerifiedModelsReport(PUBLIC_DIR);
      res.json(report);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to get model verification report' });
    }
  });

  // 2. List Campaigns & Jobs
  app.get('/api/campaigns', (_req, res) => {
    res.json({ campaigns: loadCampaigns(), jobs: loadJobs().slice(0, 25) });
  });

  app.get('/api/campaigns/:id', (req, res) => {
    const campaign = loadCampaigns().find((c) => c.id === req.params.id);
    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }
    res.json(campaign);
  });

  // 3. Create & Plan Campaign (Step 1 & 2)
  app.post('/api/campaigns/plan', async (req, res) => {
    const brief: CreativeBrief = req.body.brief;
    const ownerId: string = req.body.ownerId || 'public-demo';
    if (!brief?.brandName || !brief?.productDescription) {
      res.status(400).json({ error: 'brandName and productDescription are required' });
      return;
    }

    const campaignId = `camp_${Date.now().toString(36)}`;
    const job = createJob(
      campaignId,
      ownerId,
      'plan',
      'gemini-3-flash-preview',
      `Planning multimodal campaign & storyboard for ${brief.brandName}...`
    );

    try {
      const { plan, scenes } = await generateCampaignPlanAndStoryboard(brief);
      const now = new Date().toISOString();

      let referenceImageUrl = brief.referenceImageUrl;
      if (brief.referenceImageBase64 && brief.referenceImageMimeType) {
        const ext = brief.referenceImageMimeType.includes('png') ? 'png' : 'jpg';
        const refFilename = `ref_${campaignId}.${ext}`;
        const refPath = path.join(PUBLIC_DIR, 'assets', 'images', refFilename);
        fs.writeFileSync(
          refPath,
          Buffer.from(brief.referenceImageBase64.replace(/^data:[^;]+;base64,/, ''), 'base64')
        );
        referenceImageUrl = `/assets/images/${refFilename}`;
      }

      const campaign: Campaign = {
        id: campaignId,
        ownerId,
        brandName: brief.brandName,
        productDescription: brief.productDescription,
        targetAudience: brief.targetAudience || 'Design-conscious modern consumers',
        campaignObjective: brief.campaignObjective || 'Brand awareness & product launch',
        creativeStyle: brief.creativeStyle || 'Cinematic Commercial Realism',
        durationSeconds: Number(brief.durationSeconds) || 15,
        aspectRatio: brief.aspectRatio || '16:9',
        language: brief.language || 'English',
        referenceImageUrl,
        status: 'planned',
        plan,
        scenes,
        soundtrack: {
          mood: plan.musicalMood,
          prompt: plan.soundtrackPrompt,
          status: 'idle',
          includeInFinalMix: true,
          volumeLevel: 0.85,
          history: [],
        },
        finalRender: {
          status: 'idle',
        },
        createdAt: now,
        updatedAt: now,
      };

      upsertCampaign(campaign);
      upsertJob({
        ...job,
        status: 'completed',
        progress: 100,
        message: `Generated ${scenes.length}-scene storyboard plan for ${brief.brandName}`,
      });

      res.json({ campaign, job });
    } catch (err: any) {
      upsertJob({
        ...job,
        status: 'failed',
        error: err?.message || 'Campaign planning failed',
        message: 'Failed to generate campaign plan',
      });
      res.status(500).json({ error: err?.message || 'Failed to generate campaign plan' });
    }
  });

  // 4. Update Campaign (Scene reorder, approval toggle, prompt edits, version rollback)
  app.put('/api/campaigns/:id', (req, res) => {
    const existing = loadCampaigns().find((c) => c.id === req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }
    const updated: Campaign = {
      ...existing,
      ...req.body,
      id: existing.id,
      updatedAt: new Date().toISOString(),
    };
    upsertCampaign(updated);
    res.json(updated);
  });

  app.delete('/api/campaigns/:id', (req, res) => {
    const list = loadCampaigns().filter((c) => c.id !== req.params.id);
    saveCampaigns(list);
    res.json({ ok: true });
  });

  // 5. Generate Single Scene Storyboard Image via Nano Banana 2 Lite (gemini-3.1-flash-lite-image)
  app.post('/api/campaigns/:id/scenes/:sceneId/image', async (req, res) => {
    const campaigns = loadCampaigns();
    const campaign = campaigns.find((c) => c.id === req.params.id);
    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }
    const sceneIdx = campaign.scenes.findIndex((s) => s.id === req.params.sceneId);
    if (sceneIdx < 0) {
      res.status(404).json({ error: 'Scene not found' });
      return;
    }

    const scene = campaign.scenes[sceneIdx];
    if (req.body.imagePrompt) {
      scene.imagePrompt = req.body.imagePrompt;
    }

    const job = createJob(
      campaign.id,
      campaign.ownerId,
      'scene_image',
      'gemini-3.1-flash-lite-image',
      `Generating Scene ${scene.sceneNumber} keyframe via gemini-3.1-flash-lite-image...`
    );

    try {
      scene.status = 'generating_image';
      scene.error = undefined;
      upsertCampaign(campaign);

      // Use reference image or Scene 1's image for cross-scene visual consistency
      let refPath: string | undefined;
      if (campaign.referenceImageUrl) {
        const candidate = path.join(PUBLIC_DIR, campaign.referenceImageUrl.replace(/^\//, ''));
        if (fs.existsSync(candidate)) refPath = candidate;
      } else if (sceneIdx > 0 && campaign.scenes[0]?.imageUrl) {
        const candidate = path.join(PUBLIC_DIR, campaign.scenes[0].imageUrl.replace(/^\//, ''));
        if (fs.existsSync(candidate)) refPath = candidate;
      }

      const result = await generateSceneStoryboardImage({
        scene,
        brief: {
          brandName: campaign.brandName,
          productDescription: campaign.productDescription,
          targetAudience: campaign.targetAudience,
          campaignObjective: campaign.campaignObjective,
          creativeStyle: campaign.creativeStyle,
          durationSeconds: campaign.durationSeconds,
          aspectRatio: campaign.aspectRatio,
          language: campaign.language,
        },
        plan: campaign.plan,
        referenceImagePath: refPath,
        publicDir: PUBLIC_DIR,
      });

      // Reload latest campaign state to avoid race condition when generating multiple scenes
      const freshCampaign = loadCampaigns().find((c) => c.id === campaign.id) || campaign;
      const freshScene = freshCampaign.scenes.find((s) => s.id === scene.id);
      if (freshScene) {
        freshScene.imageUrl = result.imageUrl;
        freshScene.imageModelUsed = result.modelUsed;
        freshScene.status = freshScene.videoUrl ? 'video_ready' : 'image_ready';
        freshScene.error = undefined;
      }
      freshCampaign.status = 'storyboarding';
      upsertCampaign(freshCampaign);

      upsertJob({
        ...job,
        status: 'completed',
        progress: 100,
        message: `Scene ${scene.sceneNumber} image generated with ${result.modelUsed}`,
      });

      res.json({ campaign: freshCampaign, scene: freshScene, job });
    } catch (err: any) {
      const freshCampaign = loadCampaigns().find((c) => c.id === campaign.id) || campaign;
      const freshScene = freshCampaign.scenes.find((s) => s.id === scene.id);
      if (freshScene) {
        freshScene.status = 'error';
        freshScene.error = err?.message || 'Image generation failed';
      }
      upsertCampaign(freshCampaign);
      upsertJob({
        ...job,
        status: 'failed',
        error: err?.message || 'Image generation failed',
        message: `Scene ${scene.sceneNumber} image generation failed`,
      });
      res.status(500).json({ error: err?.message || 'Image generation failed', campaign: freshCampaign });
    }
  });

  // 6. Generate All Storyboard Images Sequentially (Maintaining Reference Image Continuity)
  app.post('/api/campaigns/:id/storyboard/generate-all', async (req, res) => {
    const campaign = loadCampaigns().find((c) => c.id === req.params.id);
    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    const job = createJob(
      campaign.id,
      campaign.ownerId,
      'scene_image',
      'gemini-3.1-flash-lite-image',
      `Generating all ${campaign.scenes.length} storyboard scenes with visual continuity...`
    );

    try {
      campaign.status = 'storyboarding';
      upsertCampaign(campaign);

      let anchorImagePath: string | undefined;
      if (campaign.referenceImageUrl) {
        const candidate = path.join(PUBLIC_DIR, campaign.referenceImageUrl.replace(/^\//, ''));
        if (fs.existsSync(candidate)) anchorImagePath = candidate;
      }

      for (let i = 0; i < campaign.scenes.length; i++) {
        const scene = campaign.scenes[i];
        scene.status = 'generating_image';
        upsertCampaign(campaign);

        upsertJob({
          ...job,
          progress: Math.round(((i + 0.3) / campaign.scenes.length) * 100),
          message: `Generating Scene ${scene.sceneNumber}/${campaign.scenes.length} via gemini-3.1-flash-lite-image...`,
        });

        try {
          const result = await generateSceneStoryboardImage({
            scene,
            brief: {
              brandName: campaign.brandName,
              productDescription: campaign.productDescription,
              targetAudience: campaign.targetAudience,
              campaignObjective: campaign.campaignObjective,
              creativeStyle: campaign.creativeStyle,
              durationSeconds: campaign.durationSeconds,
              aspectRatio: campaign.aspectRatio,
              language: campaign.language,
            },
            plan: campaign.plan,
            referenceImagePath: anchorImagePath,
            publicDir: PUBLIC_DIR,
          });

          scene.imageUrl = result.imageUrl;
          scene.imageModelUsed = result.modelUsed;
          scene.status = scene.videoUrl ? 'video_ready' : 'image_ready';
          scene.error = undefined;

          if (!anchorImagePath && result.imageUrl) {
            const firstPath = path.join(PUBLIC_DIR, result.imageUrl.replace(/^\//, ''));
            if (fs.existsSync(firstPath)) anchorImagePath = firstPath;
          }
        } catch (sceneErr: any) {
          scene.status = 'error';
          scene.error = sceneErr?.message || 'Scene image generation failed';
        }
        upsertCampaign(campaign);
      }

      upsertJob({
        ...job,
        status: 'completed',
        progress: 100,
        message: `Completed storyboard generation for ${campaign.scenes.length} scenes`,
      });

      res.json({ campaign, job });
    } catch (err: any) {
      upsertJob({
        ...job,
        status: 'failed',
        error: err?.message || 'Storyboard batch generation failed',
        message: 'Storyboard generation failed',
      });
      res.status(500).json({ error: err?.message || 'Storyboard generation failed' });
    }
  });

  // 7. Generate or Conversationally Edit Scene Video via Gemini Omni Flash (gemini-omni-1.1-flash)
  app.post('/api/campaigns/:id/scenes/:sceneId/video', async (req, res) => {
    const campaign = loadCampaigns().find((c) => c.id === req.params.id);
    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }
    const scene = campaign.scenes.find((s) => s.id === req.params.sceneId);
    if (!scene) {
      res.status(404).json({ error: 'Scene not found' });
      return;
    }

    const conversationalInstruction: string | undefined = req.body.instruction;
    if (req.body.videoPrompt) scene.videoPrompt = req.body.videoPrompt;
    if (req.body.cameraMovement) scene.cameraMovement = req.body.cameraMovement;

    const job = createJob(
      campaign.id,
      campaign.ownerId,
      conversationalInstruction ? 'scene_edit' : 'scene_video',
      'gemini-omni-1.1-flash',
      conversationalInstruction
        ? `Conversational edit on Scene ${scene.sceneNumber} via gemini-omni-1.1-flash: "${conversationalInstruction}"`
        : `Generating Scene ${scene.sceneNumber} video clip via gemini-omni-1.1-flash...`
    );

    try {
      // Preserve previous version in versionHistory before modifying
      if (scene.videoUrl) {
        const prevVersion: SceneVersion = {
          version: (scene.versionHistory?.length || 0) + 1,
          timestamp: new Date().toISOString(),
          instruction: conversationalInstruction || 'Initial video generation',
          imageUrl: scene.imageUrl,
          videoUrl: scene.videoUrl,
          cameraMovement: scene.cameraMovement,
          videoPrompt: scene.videoPrompt,
          directorNotes: scene.directorNotes,
          interactionId: scene.interactionId,
        };
        scene.versionHistory = [...(scene.versionHistory || []), prevVersion];
      }

      scene.status = 'generating_video';
      scene.error = undefined;
      campaign.status = 'video_production';
      upsertCampaign(campaign);

      const result = await generateOrEditSceneVideo({
        scene,
        brief: {
          brandName: campaign.brandName,
          productDescription: campaign.productDescription,
          targetAudience: campaign.targetAudience,
          campaignObjective: campaign.campaignObjective,
          creativeStyle: campaign.creativeStyle,
          durationSeconds: campaign.durationSeconds,
          aspectRatio: campaign.aspectRatio,
          language: campaign.language,
        },
        plan: campaign.plan,
        conversationalInstruction,
        publicDir: PUBLIC_DIR,
      });

      const freshCampaign = loadCampaigns().find((c) => c.id === campaign.id) || campaign;
      const freshScene = freshCampaign.scenes.find((s) => s.id === scene.id);
      if (freshScene) {
        freshScene.videoUrl = result.videoUrl;
        freshScene.videoModelUsed = result.modelUsed;
        freshScene.interactionId = result.interactionId;
        freshScene.directorNotes = result.directorNotes;
        freshScene.videoPrompt = result.updatedVideoPrompt;
        freshScene.cameraMovement = result.updatedCameraMovement;
        freshScene.status = 'video_ready';
        freshScene.error = undefined;
      }
      upsertCampaign(freshCampaign);

      upsertJob({
        ...job,
        status: 'completed',
        progress: 100,
        message: `Scene ${scene.sceneNumber} video clip ready (${result.modelUsed})`,
      });

      res.json({ campaign: freshCampaign, scene: freshScene, job });
    } catch (err: any) {
      const freshCampaign = loadCampaigns().find((c) => c.id === campaign.id) || campaign;
      const freshScene = freshCampaign.scenes.find((s) => s.id === scene.id);
      if (freshScene) {
        freshScene.status = freshScene.imageUrl ? 'image_ready' : 'error';
        freshScene.error = err?.message || 'Video generation failed';
      }
      upsertCampaign(freshCampaign);
      upsertJob({
        ...job,
        status: 'failed',
        error: err?.message || 'Video generation failed',
        message: `Scene ${scene.sceneNumber} video generation failed`,
      });
      res.status(500).json({ error: err?.message || 'Video generation failed', campaign: freshCampaign });
    }
  });

  // 8. Generate Adaptive Soundtrack via Lyria 3.5 (lyria-3.5)
  app.post('/api/campaigns/:id/soundtrack', async (req, res) => {
    const campaign = loadCampaigns().find((c) => c.id === req.params.id);
    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    const mood = req.body.mood || campaign.soundtrack.mood || 'Uplifting Commercial Electronic';
    const prompt =
      req.body.prompt ||
      campaign.soundtrack.prompt ||
      `Instrumental ${mood} commercial soundtrack for ${campaign.brandName}`;

    const job = createJob(
      campaign.id,
      campaign.ownerId,
      'soundtrack',
      'lyria-3.5',
      `Generating "${mood}" soundtrack via lyria-3.5...`
    );

    try {
      // Preserve previous audio in history if present
      if (campaign.soundtrack.audioUrl) {
        campaign.soundtrack.history = [
          ...(campaign.soundtrack.history || []),
          {
            version: (campaign.soundtrack.history?.length || 0) + 1,
            timestamp: new Date().toISOString(),
            mood: campaign.soundtrack.mood,
            prompt: campaign.soundtrack.prompt,
            audioUrl: campaign.soundtrack.audioUrl,
            modelUsed: campaign.soundtrack.modelUsed || 'lyria-3.5',
          },
        ];
      }

      campaign.soundtrack.mood = mood;
      campaign.soundtrack.prompt = prompt;
      campaign.soundtrack.status = 'generating';
      campaign.soundtrack.error = undefined;
      campaign.status = 'scoring';
      upsertCampaign(campaign);

      const result = await generateAdaptiveSoundtrack({
        campaignId: campaign.id,
        mood,
        prompt,
        brief: {
          brandName: campaign.brandName,
          productDescription: campaign.productDescription,
          targetAudience: campaign.targetAudience,
          campaignObjective: campaign.campaignObjective,
          creativeStyle: campaign.creativeStyle,
          durationSeconds: campaign.durationSeconds,
          aspectRatio: campaign.aspectRatio,
          language: campaign.language,
        },
        publicDir: PUBLIC_DIR,
      });

      const freshCampaign = loadCampaigns().find((c) => c.id === campaign.id) || campaign;
      freshCampaign.soundtrack.audioUrl = result.audioUrl;
      freshCampaign.soundtrack.modelUsed = result.modelUsed;
      freshCampaign.soundtrack.generatedLyricsOrNotes = result.generatedLyricsOrNotes;
      freshCampaign.soundtrack.status = 'ready';
      freshCampaign.soundtrack.error = undefined;
      upsertCampaign(freshCampaign);

      upsertJob({
        ...job,
        status: 'completed',
        progress: 100,
        message: `Generated soundtrack via ${result.modelUsed}`,
      });

      res.json({ campaign: freshCampaign, job });
    } catch (err: any) {
      const freshCampaign = loadCampaigns().find((c) => c.id === campaign.id) || campaign;
      freshCampaign.soundtrack.status = 'error';
      freshCampaign.soundtrack.error = err?.message || 'Soundtrack generation failed';
      upsertCampaign(freshCampaign);

      upsertJob({
        ...job,
        status: 'failed',
        error: err?.message || 'Soundtrack generation failed',
        message: 'Lyria 3.5 soundtrack generation failed',
      });
      res.status(500).json({ error: err?.message || 'Soundtrack generation failed', campaign: freshCampaign });
    }
  });

  // 9. Assemble Final Video via FFmpeg + Validate Output (Step 6 & 7)
  app.post('/api/campaigns/:id/render', async (req, res) => {
    const campaign = loadCampaigns().find((c) => c.id === req.params.id);
    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    if (typeof req.body?.includeInFinalMix === 'boolean') {
      campaign.soundtrack.includeInFinalMix = req.body.includeInFinalMix;
    }
    if (typeof req.body?.volumeLevel === 'number') {
      campaign.soundtrack.volumeLevel = req.body.volumeLevel;
    }

    const approvedScenes = campaign.scenes.filter((s) => s.approved !== false && (s.videoUrl || s.imageUrl));
    if (approvedScenes.length === 0) {
      res.status(400).json({
        error: 'At least one approved scene must have a generated video clip or storyboard image before rendering.',
      });
      return;
    }

    const job = createJob(
      campaign.id,
      campaign.ownerId,
      'final_render',
      'ffmpeg-4.4.2',
      `Assembling ${approvedScenes.length} scenes + Lyria 3.5 soundtrack via FFmpeg...`
    );

    try {
      campaign.finalRender = {
        status: 'rendering',
      };
      campaign.status = 'rendering';
      upsertCampaign(campaign);

      const renderResult = await assembleFinalAdvertisement({
        campaignId: campaign.id,
        scenes: approvedScenes,
        soundtrack: campaign.soundtrack,
        aspectRatio: campaign.aspectRatio,
        brandName: campaign.brandName,
        publicDir: PUBLIC_DIR,
      });

      const freshCampaign = loadCampaigns().find((c) => c.id === campaign.id) || campaign;
      freshCampaign.finalRender = {
        status: renderResult.validationReport.valid ? 'completed' : 'error',
        videoUrl: renderResult.videoUrl,
        renderedAt: new Date().toISOString(),
        resolution: `${renderResult.validationReport.width}x${renderResult.validationReport.height}`,
        fps: 24,
        durationSeconds: renderResult.validationReport.durationSeconds,
        fileSizeBytes: renderResult.validationReport.fileSizeBytes,
        ffmpegCommandLog: renderResult.commandLog,
        validationReport: renderResult.validationReport,
      };
      freshCampaign.status = renderResult.validationReport.valid ? 'completed' : 'failed';
      upsertCampaign(freshCampaign);

      upsertJob({
        ...job,
        status: 'completed',
        progress: 100,
        message: `Exported & validated MP4 (${renderResult.validationReport.width}x${renderResult.validationReport.height}, ${renderResult.validationReport.durationSeconds}s)`,
      });

      res.json({ campaign: freshCampaign, job });
    } catch (err: any) {
      const freshCampaign = loadCampaigns().find((c) => c.id === campaign.id) || campaign;
      freshCampaign.finalRender = {
        status: 'error',
        error: err?.message || 'FFmpeg rendering failed',
      };
      freshCampaign.status = 'failed';
      upsertCampaign(freshCampaign);

      upsertJob({
        ...job,
        status: 'failed',
        error: err?.message || 'FFmpeg rendering failed',
        message: 'Final FFmpeg assembly failed',
      });
      res.status(500).json({ error: err?.message || 'FFmpeg rendering failed', campaign: freshCampaign });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`GenMedia Studio server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start GenMedia Studio server:', err);
  process.exit(1);
});
