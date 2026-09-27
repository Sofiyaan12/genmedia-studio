import dotenv from 'dotenv';
import { EventEmitter } from 'events';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  executeOrchestratedWorkflow,
  parseOrchestratorDirective,
} from './server/agentOrchestrator';
import { assembleFinalAdvertisement } from './server/ffmpegRenderer';
import {
  generateAdaptiveSoundtrack,
  generateCampaignPlanAndStoryboard,
  generateOrEditSceneVideo,
  generateSceneStoryboardImage,
  generateVoiceoverAudio,
  getVerifiedModelsReport,
  localizeCampaignForMarket,
  transcribeVoicePrompt,
} from './server/genmediaService';
import {
  AgentOrchestrationState,
  Campaign,
  CreativeBrief,
  PipelineJob,
  RenderProgressEvent,
  SceneVersion,
} from './src/types/campaign';

dotenv.config();

const renderProgressEmitter = new EventEmitter();
renderProgressEmitter.setMaxListeners(50);
const latestRenderProgressMap = new Map<string, RenderProgressEvent>();
const activeAutopilotJobsMap = new Map<string, string>();

const agentStateEmitter = new EventEmitter();
agentStateEmitter.setMaxListeners(50);
const activeAgentRunsMap = new Map<string, string>();

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

function assetExistsOnDisk(assetUrl?: string): boolean {
  if (!assetUrl) return false;
  if (!assetUrl.startsWith('/assets/')) return true;
  const cleanRel = assetUrl.split('?')[0].replace(/^\//, '');
  return fs.existsSync(path.join(PUBLIC_DIR, cleanRel));
}

function sanitizeCampaignAssets(camp: Campaign): Campaign {
  if (camp.referenceImageUrl && !assetExistsOnDisk(camp.referenceImageUrl)) {
    camp.referenceImageUrl = undefined;
  }
  if (camp.soundtrack?.audioUrl && !assetExistsOnDisk(camp.soundtrack.audioUrl)) {
    camp.soundtrack.audioUrl = undefined;
    if (camp.soundtrack.status === 'ready') camp.soundtrack.status = 'idle';
  }
  if (camp.voiceover?.audioUrl && !assetExistsOnDisk(camp.voiceover.audioUrl)) {
    camp.voiceover.audioUrl = undefined;
    if (camp.voiceover.status === 'ready') camp.voiceover.status = 'idle';
  }
  if (
    camp.orchestrationState?.spokenAudioUrl &&
    !assetExistsOnDisk(camp.orchestrationState.spokenAudioUrl)
  ) {
    camp.orchestrationState.spokenAudioUrl = undefined;
  }
  if (camp.finalRender?.videoUrl && !assetExistsOnDisk(camp.finalRender.videoUrl)) {
    camp.finalRender.videoUrl = undefined;
    if (camp.finalRender.status === 'completed') {
      camp.finalRender.status = 'idle';
    }
    if (camp.status === 'completed') {
      camp.status = 'planned';
    }
  }
  for (const scene of camp.scenes || []) {
    if (scene.imageUrl && !assetExistsOnDisk(scene.imageUrl)) {
      scene.imageUrl = undefined;
    }
    if (scene.videoUrl && !assetExistsOnDisk(scene.videoUrl)) {
      scene.videoUrl = undefined;
    }
    if (scene.rawVideoUrl && !assetExistsOnDisk(scene.rawVideoUrl)) {
      scene.rawVideoUrl = undefined;
    }
    if (!scene.videoUrl && scene.status === 'video_ready') {
      scene.status = scene.imageUrl ? 'image_ready' : 'pending';
    } else if (!scene.imageUrl && scene.status === 'image_ready') {
      scene.status = 'pending';
    }
    if (Array.isArray(scene.versionHistory)) {
      scene.versionHistory = scene.versionHistory.filter(
        (v) =>
          (!v.imageUrl || assetExistsOnDisk(v.imageUrl)) &&
          (!v.videoUrl || assetExistsOnDisk(v.videoUrl))
      );
    }
  }
  return camp;
}

function loadCampaigns(): Campaign[] {
  try {
    if (fs.existsSync(CAMPAIGNS_FILE)) {
      const raw: Campaign[] = JSON.parse(fs.readFileSync(CAMPAIGNS_FILE, 'utf-8'));
      return raw.map((c) => sanitizeCampaignAssets(c));
    }
  } catch (e) {
    console.error('Failed to read campaigns.json:', e);
  }
  return [];
}

function saveCampaigns(campaigns: Campaign[]): void {
  const sanitized = campaigns.map((c) => sanitizeCampaignAssets(c));
  fs.writeFileSync(CAMPAIGNS_FILE, JSON.stringify(sanitized, null, 2));
}

/**
 * Automatically removes unreferenced media files in public/assets so the workspace
 * bundle stays compact and never exceeds Cloud Run / AI Studio publishing limits.
 */
function pruneUnreferencedAssets(campaignsList?: Campaign[]): void {
  try {
    const campaigns = campaignsList || loadCampaigns();
    const referenced = new Set<string>();
    for (const c of campaigns) {
      if (c.referenceImageUrl) referenced.add(c.referenceImageUrl.split('?')[0]);
      if (c.soundtrack?.audioUrl) referenced.add(c.soundtrack.audioUrl.split('?')[0]);
      if (c.voiceover?.audioUrl) referenced.add(c.voiceover.audioUrl.split('?')[0]);
      if (c.orchestrationState?.spokenAudioUrl) {
        referenced.add(c.orchestrationState.spokenAudioUrl.split('?')[0]);
      }
      for (const h of c.soundtrack?.history || []) {
        if (h.audioUrl) referenced.add(h.audioUrl.split('?')[0]);
      }
      if (c.finalRender?.videoUrl) referenced.add(c.finalRender.videoUrl.split('?')[0]);
      for (const v of c.localizedVariants || []) {
        if (v.videoUrl) referenced.add(v.videoUrl.split('?')[0]);
      }
      for (const s of c.scenes || []) {
        if (s.imageUrl) referenced.add(s.imageUrl.split('?')[0]);
        if (s.videoUrl) referenced.add(s.videoUrl.split('?')[0]);
        if (s.rawVideoUrl) referenced.add(s.rawVideoUrl.split('?')[0]);
        if (s.voiceoverUrl) referenced.add(s.voiceoverUrl.split('?')[0]);
        for (const vh of s.versionHistory || []) {
          if (vh.imageUrl) referenced.add(vh.imageUrl.split('?')[0]);
          if (vh.videoUrl) referenced.add(vh.videoUrl.split('?')[0]);
          if (vh.rawVideoUrl) referenced.add(vh.rawVideoUrl.split('?')[0]);
        }
      }
    }

    for (const sub of ['images', 'videos', 'audio', 'renders']) {
      const dir = path.join(PUBLIC_DIR, 'assets', sub);
      if (!fs.existsSync(dir)) continue;
      for (const file of fs.readdirSync(dir)) {
        const rel = `/assets/${sub}/${file}`;
        if (!referenced.has(rel)) {
          try {
            fs.unlinkSync(path.join(dir, file));
          } catch {
            // ignore
          }
        }
      }
    }
  } catch {
    // ignore cleanup errors
  }
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

function ensureCampaignLoaded(campaignId: string, incomingCampaign?: Campaign): Campaign | undefined {
  const list = loadCampaigns();
  const existing = list.find((c) => c.id === campaignId);
  if (existing) {
    return existing;
  }
  if (incomingCampaign && incomingCampaign.id === campaignId) {
    return upsertCampaign(incomingCampaign);
  }
  return list[0];
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

  // 2. List Campaigns & Jobs (Scoped to Authenticated User ownerId + Public Demo Showcase)
  app.get('/api/campaigns', (req, res) => {
    const requestedOwner = typeof req.query.ownerId === 'string' ? req.query.ownerId.trim() : '';
    const allCampaigns = loadCampaigns();
    const allJobs = loadJobs();
    const demoCampaigns = allCampaigns.filter((c) => c.ownerId === 'public-demo');

    if (requestedOwner && requestedOwner !== 'public-demo') {
      const userCampaigns = allCampaigns.filter((c) => c.ownerId === requestedOwner);
      const userJobs = allJobs.filter((j) => j.ownerId === requestedOwner).slice(0, 30);
      const combined = [...demoCampaigns, ...userCampaigns];
      if (combined.length > 0) {
        res.json({ campaigns: combined, jobs: userJobs });
        return;
      }
    }

    const demoJobs = allJobs.filter((j) => j.ownerId === 'public-demo').slice(0, 25);
    res.json({
      campaigns: demoCampaigns.length > 0 ? demoCampaigns : allCampaigns.slice(0, 2),
      jobs: demoJobs.length > 0 ? demoJobs : allJobs.slice(0, 15),
    });
  });

  // 2b. Clone Flagship Demo Showcase into Authenticated User's Personal Database
  app.post('/api/campaigns/clone-starter', (req, res) => {
    const ownerId = typeof req.body?.ownerId === 'string' ? req.body.ownerId.trim() : '';
    if (!ownerId || ownerId === 'public-demo') {
      res.status(401).json({ error: 'Google Sign-In required to clone into personal database.' });
      return;
    }

    const all = loadCampaigns();
    const template = all.find((c) => c.ownerId === 'public-demo') || all[0];
    if (!template) {
      res.status(404).json({ error: 'No starter template found' });
      return;
    }

    const now = new Date().toISOString();
    const cloned: Campaign = {
      ...JSON.parse(JSON.stringify(template)),
      id: `camp_${Date.now().toString(36)}`,
      ownerId,
      createdAt: now,
      updatedAt: now,
    };

    upsertCampaign(cloned);
    const job = createJob(
      cloned.id,
      ownerId,
      'plan',
      'firestore-sync',
      `Cloned ${cloned.brandName} flagship campaign into personal database`
    );
    const completedJob = upsertJob({ ...job, status: 'completed', progress: 100 });
    res.json({ campaign: cloned, job: completedJob });
  });

  app.get('/api/campaigns/:id', (req, res) => {
    const campaign = loadCampaigns().find((c) => c.id === req.params.id);
    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }
    res.json(campaign);
  });

  // 3. Create & Plan Campaign (Step 1 & 2 — Requires Authenticated Google User)
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

  // 3b. Hydrate Backend Store from Firestore Cloud Sync
  app.post('/api/campaigns/sync', (req, res) => {
    const incomingList: Campaign[] = Array.isArray(req.body?.campaigns) ? req.body.campaigns : [];
    const current = loadCampaigns();
    let changed = false;

    for (const rawInc of incomingList) {
      if (!rawInc || !rawInc.id) continue;
      const inc = sanitizeCampaignAssets(rawInc);
      const existingIdx = current.findIndex((c) => c.id === inc.id);
      if (existingIdx < 0) {
        current.push(inc);
        changed = true;
      } else {
        const existingTime = new Date(current[existingIdx].updatedAt || 0).getTime();
        const incTime = new Date(inc.updatedAt || 0).getTime();
        if (incTime > existingTime) {
          current[existingIdx] = sanitizeCampaignAssets({ ...current[existingIdx], ...inc });
          changed = true;
        }
      }
    }

    if (changed) {
      saveCampaigns(current);
    }
    res.json({ campaigns: current });
  });

  // 4. Update Campaign (Scene reorder, approval toggle, prompt edits, version rollback)
  app.put('/api/campaigns/:id', (req, res) => {
    const existing = ensureCampaignLoaded(req.params.id, req.body);
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
    pruneUnreferencedAssets(list);
    res.json({ ok: true });
  });

  // 5. Generate Single Scene Storyboard Image via Nano Banana 2 Lite (gemini-3.1-flash-lite-image)
  app.post('/api/campaigns/:id/scenes/:sceneId/image', async (req, res) => {
    const campaign = ensureCampaignLoaded(req.params.id, req.body?.campaign);
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
        freshScene.generationLatencyMs = result.generationLatencyMs;
        freshScene.resolutionTag = result.resolutionTag;
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
    const campaign = ensureCampaignLoaded(req.params.id, req.body?.campaign);
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
        if (i > 0) {
          await new Promise((r) => setTimeout(r, 1200));
        }
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
          scene.generationLatencyMs = result.generationLatencyMs;
          scene.resolutionTag = result.resolutionTag;
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
    const campaign = ensureCampaignLoaded(req.params.id, req.body?.campaign);
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
    const customOverlayText: string | undefined = req.body.overlayText;
    const customSubtitleCues = req.body.subtitleCues;
    const customSubtitleStyle = req.body.subtitleStyle;
    if (req.body.videoPrompt) scene.videoPrompt = req.body.videoPrompt;
    if (req.body.cameraMovement) scene.cameraMovement = req.body.cameraMovement;

    const job = createJob(
      campaign.id,
      campaign.ownerId,
      conversationalInstruction || customOverlayText !== undefined || customSubtitleCues
        ? 'scene_edit'
        : 'scene_video',
      'gemini-omni-1.1-flash',
      conversationalInstruction
        ? `Conversational edit on Scene ${scene.sceneNumber} via gemini-omni-1.1-flash: "${conversationalInstruction}"`
        : customOverlayText !== undefined
          ? `Burning subtitle on Scene ${scene.sceneNumber}: "${customOverlayText}"`
          : `Generating Scene ${scene.sceneNumber} video clip via gemini-omni-1.1-flash...`
    );

    try {
      // Preserve previous version in versionHistory before modifying
      if (scene.videoUrl) {
        const prevVersion: SceneVersion = {
          version: (scene.versionHistory?.length || 0) + 1,
          timestamp: new Date().toISOString(),
          instruction:
            conversationalInstruction ||
            (customOverlayText !== undefined ? `Subtitle: ${customOverlayText}` : 'Initial video generation'),
          imageUrl: scene.imageUrl,
          videoUrl: scene.videoUrl,
          rawVideoUrl: scene.rawVideoUrl,
          subtitlesBurnedIn: scene.subtitlesBurnedIn,
          overlayText: scene.overlayText,
          subtitleCues: scene.subtitleCues,
          subtitleStyle: scene.subtitleStyle,
          cameraMovement: scene.cameraMovement,
          videoPrompt: scene.videoPrompt,
          directorNotes: scene.directorNotes,
          interactionId: scene.interactionId,
        };
        scene.versionHistory = [...(scene.versionHistory || []), prevVersion].slice(-2);
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
        customOverlayText,
        customSubtitleCues,
        customSubtitleStyle,
        publicDir: PUBLIC_DIR,
      });

      const freshCampaign = loadCampaigns().find((c) => c.id === campaign.id) || campaign;
      const freshScene = freshCampaign.scenes.find((s) => s.id === scene.id);
      if (freshScene) {
        freshScene.videoUrl = result.videoUrl;
        freshScene.rawVideoUrl = result.rawVideoUrl;
        freshScene.subtitlesBurnedIn = result.subtitlesBurnedIn;
        freshScene.overlayText = result.updatedOverlayText;
        freshScene.subtitleCues = result.updatedSubtitleCues;
        freshScene.subtitleStyle = result.updatedSubtitleStyle;
        freshScene.videoModelUsed = result.modelUsed;
        freshScene.videoLatencyMs = result.videoLatencyMs;
        freshScene.physicsSimulationNote = result.physicsSimulationNote;
        freshScene.interactionId = result.interactionId;
        freshScene.directorNotes = result.directorNotes;
        freshScene.videoPrompt = result.updatedVideoPrompt;
        freshScene.cameraMovement = result.updatedCameraMovement;
        freshScene.status = 'video_ready';
        freshScene.error = undefined;
      }
      upsertCampaign(freshCampaign);
      pruneUnreferencedAssets();

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

  // 7b. Generate All Scene Videos in Chained Loop via Gemini Omni Flash (gemini-omni-1.1-flash)
  app.post('/api/campaigns/:id/videos/generate-all', async (req, res) => {
    const campaign = ensureCampaignLoaded(req.params.id, req.body?.campaign);
    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    const job = createJob(
      campaign.id,
      campaign.ownerId,
      'scene_video',
      'gemini-omni-1.1-flash',
      `Synthesizing physics-accurate videos for all ${campaign.scenes.length} scenes via gemini-omni-1.1-flash...`
    );

    try {
      campaign.status = 'video_production';
      upsertCampaign(campaign);

      let completedCount = 0;
      await Promise.all(
        campaign.scenes.map(async (scene, idx) => {
          if (scene.approved === false) return;
          await new Promise((r) => setTimeout(r, idx * 200));

          scene.status = 'generating_video';
          upsertCampaign(campaign);

          try {
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
              publicDir: PUBLIC_DIR,
              timeoutMs: 16000,
            });

            scene.videoUrl = result.videoUrl;
            scene.rawVideoUrl = result.rawVideoUrl;
            scene.subtitlesBurnedIn = result.subtitlesBurnedIn;
            scene.overlayText = result.updatedOverlayText;
            scene.subtitleCues = result.updatedSubtitleCues;
            scene.subtitleStyle = result.updatedSubtitleStyle;
            scene.videoModelUsed = result.modelUsed;
            scene.videoLatencyMs = result.videoLatencyMs;
            scene.physicsSimulationNote = result.physicsSimulationNote;
            scene.interactionId = result.interactionId;
            scene.directorNotes = result.directorNotes;
            scene.status = 'video_ready';
            scene.error = undefined;
          } catch (sceneErr: any) {
            scene.status = scene.imageUrl ? 'image_ready' : 'error';
            scene.error = sceneErr?.message || 'Scene video generation failed';
          }
          completedCount++;
          upsertCampaign(campaign);
          upsertJob({
            ...job,
            progress: Math.round((completedCount / campaign.scenes.length) * 100),
            message: `Synthesized ${completedCount}/${campaign.scenes.length} scene videos via gemini-omni-1.1-flash...`,
          });
        })
      );

      upsertJob({
        ...job,
        status: 'completed',
        progress: 100,
        message: `Completed Gemini Omni Flash video loop for ${campaign.scenes.length} scenes`,
      });

      res.json({ campaign, job });
    } catch (err: any) {
      upsertJob({
        ...job,
        status: 'failed',
        error: err?.message || 'Batch video loop failed',
        message: 'Batch video generation failed',
      });
      res.status(500).json({ error: err?.message || 'Batch video generation failed' });
    }
  });

  // 7c. High-Velocity Single-Loop Autopilot (NB2 Lite 1K -> Omni Flash Physics Video -> Lyria 3.5 -> FFmpeg Master MP4)
  app.post('/api/campaigns/:id/single-loop-autopilot', async (req, res) => {
    const campaign = ensureCampaignLoaded(req.params.id, req.body?.campaign);
    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    const existingJobId = activeAutopilotJobsMap.get(campaign.id);
    if (existingJobId) {
      const existingJob = loadJobs().find((j) => j.id === existingJobId);
      res.json({
        accepted: true,
        running: true,
        campaign,
        job: existingJob,
      });
      return;
    }

    const job = createJob(
      campaign.id,
      campaign.ownerId,
      'final_render',
      'gemini-3.1-flash-lite-image -> gemini-omni-1.1-flash -> lyria-3.5 -> ffmpeg',
      `Executing High-Velocity Chained Multimodal Loop for ${campaign.brandName}...`
    );

    activeAutopilotJobsMap.set(campaign.id, job.id);

    const publishLoopProgress = (event: RenderProgressEvent) => {
      latestRenderProgressMap.set(campaign.id, event);
      renderProgressEmitter.emit('progress', event);
      upsertJob({
        ...job,
        status:
          event.stageKey === 'completed'
            ? 'completed'
            : event.stageKey === 'failed'
              ? 'failed'
              : 'running',
        progress: event.progress,
        message: event.message,
      });
    };

    const totalScenesCount = campaign.scenes.length || 3;
    publishLoopProgress({
      campaignId: campaign.id,
      jobId: job.id,
      stageKey: 'init',
      stageLabel: 'Node 01/04 • Nano Banana 2 Lite (1K Keyframe Loop)',
      progress: 6,
      sceneIndex: 1,
      totalScenes: totalScenesCount,
      message: `[Loop Node 1/4 • NB2 Lite 1K] Initializing 1K visual continuity loop for ${campaign.brandName}...`,
      timestamp: new Date().toISOString(),
    });

    const executeAutopilotPipeline = async (): Promise<{ campaign: Campaign; job: PipelineJob }> => {
      const brief: CreativeBrief = {
        brandName: campaign.brandName,
        productDescription: campaign.productDescription,
        targetAudience: campaign.targetAudience,
        campaignObjective: campaign.campaignObjective,
        creativeStyle: campaign.creativeStyle,
        durationSeconds: campaign.durationSeconds,
        aspectRatio: campaign.aspectRatio,
        language: campaign.language,
      };

      try {
        // Phase 1: Rapid 1K Storyboard Generation with Reference Chaining (Nano Banana 2 Lite)
        campaign.status = 'storyboarding';
        upsertCampaign(campaign);

        let anchorImagePath: string | undefined;
        if (campaign.referenceImageUrl) {
          const candidate = path.join(PUBLIC_DIR, campaign.referenceImageUrl.replace(/^\//, ''));
          if (fs.existsSync(candidate)) anchorImagePath = candidate;
        }

        const hasLocalFile = (url?: string) => {
          if (!url) return false;
          const clean = url.split('?')[0].replace(/^\//, '');
          return fs.existsSync(path.join(PUBLIC_DIR, clean));
        };

        // Ensure Scene 1 anchor image is generated first for cross-scene continuity
        if (campaign.scenes.length > 0) {
          const firstScene = campaign.scenes[0];
          if (!hasLocalFile(firstScene.imageUrl)) {
            publishLoopProgress({
              campaignId: campaign.id,
              jobId: job.id,
              stageKey: 'init',
              stageLabel: 'Node 01/04 • Nano Banana 2 Lite (1K Keyframe Loop)',
              progress: 10,
              sceneIndex: 1,
              totalScenes: totalScenesCount,
              message: `[Loop Node 1/4 • NB2 Lite 1K] Generating Scene 01 continuity anchor frame...`,
              timestamp: new Date().toISOString(),
            });

            const imgRes = await generateSceneStoryboardImage({
              scene: firstScene,
              brief,
              plan: campaign.plan,
              referenceImagePath: anchorImagePath,
              publicDir: PUBLIC_DIR,
              timeoutMs: 12000,
            });
            firstScene.imageUrl = imgRes.imageUrl;
            firstScene.imageModelUsed = imgRes.modelUsed;
            firstScene.generationLatencyMs = imgRes.generationLatencyMs;
            firstScene.resolutionTag = imgRes.resolutionTag;
            firstScene.status = firstScene.videoUrl ? 'video_ready' : 'image_ready';
            firstScene.error = undefined;
            upsertCampaign(campaign);
          }

          if (!anchorImagePath && firstScene.imageUrl) {
            const candidate = path.join(PUBLIC_DIR, firstScene.imageUrl.split('?')[0].replace(/^\//, ''));
            if (fs.existsSync(candidate)) anchorImagePath = candidate;
          }
        }

        // Generate remaining scene 1K frames in parallel burst
        const remainingImageScenes = campaign.scenes.slice(1);
        let completedImages = 1;
        await Promise.all(
          remainingImageScenes.map(async (scene, idx) => {
            await new Promise((r) => setTimeout(r, idx * 150));
            if (!hasLocalFile(scene.imageUrl)) {
              const imgRes = await generateSceneStoryboardImage({
                scene,
                brief,
                plan: campaign.plan,
                referenceImagePath: anchorImagePath,
                publicDir: PUBLIC_DIR,
                timeoutMs: 12000,
              });
              scene.imageUrl = imgRes.imageUrl;
              scene.imageModelUsed = imgRes.modelUsed;
              scene.generationLatencyMs = imgRes.generationLatencyMs;
              scene.resolutionTag = imgRes.resolutionTag;
              scene.status = scene.videoUrl ? 'video_ready' : 'image_ready';
              scene.error = undefined;
            }
            completedImages++;
            upsertCampaign(campaign);
            publishLoopProgress({
              campaignId: campaign.id,
              jobId: job.id,
              stageKey: 'init',
              stageLabel: 'Node 01/04 • Nano Banana 2 Lite (1K Keyframe Loop)',
              progress: Math.round(10 + (completedImages / totalScenesCount) * 18),
              sceneIndex: completedImages,
              totalScenes: totalScenesCount,
              message: `[Loop Node 1/4 • NB2 Lite 1K] Ready ${completedImages}/${totalScenesCount} 1K storyboard frames with continuity anchor...`,
              timestamp: new Date().toISOString(),
            });
          })
        );

        // Phase 2: Chained Physics Video Generation (Gemini Omni Flash)
        campaign.status = 'video_production';
        upsertCampaign(campaign);

        publishLoopProgress({
          campaignId: campaign.id,
          jobId: job.id,
          stageKey: 'scene_prep',
          stageLabel: 'Node 02/04 • Gemini Omni Flash (Physics Video Loop)',
          progress: 32,
          sceneIndex: 1,
          totalScenes: totalScenesCount,
          message: `[Loop Node 2/4 • Gemini Omni Flash] Animating ${totalScenesCount} scenes with real-world physical dynamics...`,
          timestamp: new Date().toISOString(),
        });

        let completedVideos = 0;
        await Promise.all(
          campaign.scenes.map(async (scene, idx) => {
            await new Promise((r) => setTimeout(r, idx * 200));
            if (!hasLocalFile(scene.videoUrl)) {
              const vidRes = await generateOrEditSceneVideo({
                scene,
                brief,
                plan: campaign.plan,
                publicDir: PUBLIC_DIR,
                timeoutMs: 14000,
              });
              scene.videoUrl = vidRes.videoUrl;
              scene.rawVideoUrl = vidRes.rawVideoUrl;
              scene.subtitlesBurnedIn = vidRes.subtitlesBurnedIn;
              scene.overlayText = vidRes.updatedOverlayText;
              scene.subtitleCues = vidRes.updatedSubtitleCues;
              scene.subtitleStyle = vidRes.updatedSubtitleStyle;
              scene.videoModelUsed = vidRes.modelUsed;
              scene.videoLatencyMs = vidRes.videoLatencyMs;
              scene.physicsSimulationNote = vidRes.physicsSimulationNote;
              scene.interactionId = vidRes.interactionId;
              scene.directorNotes = vidRes.directorNotes;
              scene.status = 'video_ready';
              scene.error = undefined;
            } else {
              scene.status = 'video_ready';
            }
            completedVideos++;
            upsertCampaign(campaign);
            publishLoopProgress({
              campaignId: campaign.id,
              jobId: job.id,
              stageKey: 'scene_prep',
              stageLabel: 'Node 02/04 • Gemini Omni Flash (Physics Video Loop)',
              progress: Math.round(32 + (completedVideos / totalScenesCount) * 28),
              sceneIndex: completedVideos,
              totalScenes: totalScenesCount,
              message: `[Loop Node 2/4 • Gemini Omni Flash] Synthesized ${completedVideos}/${totalScenesCount} physics-grounded MP4 clips...`,
              timestamp: new Date().toISOString(),
            });
          })
        );

        // Phase 3: Adaptive Soundtrack Scoring (Lyria 3.5)
        campaign.status = 'scoring';
        publishLoopProgress({
          campaignId: campaign.id,
          jobId: job.id,
          stageKey: 'audio_mix',
          stageLabel: 'Node 03/04 • Lyria 3.5 (Adaptive Commercial Score)',
          progress: 64,
          sceneIndex: totalScenesCount,
          totalScenes: totalScenesCount,
          message: `[Loop Node 3/4 • Lyria 3.5] Composing adaptive ${campaign.soundtrack.mood || 'commercial'} score...`,
          timestamp: new Date().toISOString(),
        });

        if (!hasLocalFile(campaign.soundtrack?.audioUrl)) {
          const audioRes = await generateAdaptiveSoundtrack({
            campaignId: campaign.id,
            mood: campaign.soundtrack.mood || 'Uplifting Commercial Electronic',
            prompt:
              campaign.soundtrack.prompt ||
              `Instrumental ${campaign.creativeStyle} soundtrack for ${campaign.brandName}`,
            brief,
            publicDir: PUBLIC_DIR,
            timeoutMs: 12000,
          });
          campaign.soundtrack.audioUrl = audioRes.audioUrl;
          campaign.soundtrack.modelUsed = audioRes.modelUsed;
          campaign.soundtrack.generatedLyricsOrNotes = audioRes.generatedLyricsOrNotes;
          campaign.soundtrack.status = 'ready';
          campaign.soundtrack.error = undefined;
          upsertCampaign(campaign);
        } else {
          campaign.soundtrack.status = 'ready';
          upsertCampaign(campaign);
        }

        publishLoopProgress({
          campaignId: campaign.id,
          jobId: job.id,
          stageKey: 'audio_mix',
          stageLabel: 'Node 03/04 • Lyria 3.5 (Adaptive Commercial Score)',
          progress: 72,
          sceneIndex: totalScenesCount,
          totalScenes: totalScenesCount,
          message: `[Loop Node 3/4 • Lyria 3.5] Adaptive stereo soundtrack ready. Entering FFmpeg master assembly...`,
          timestamp: new Date().toISOString(),
        });

        // Phase 4: Automated FFmpeg Master Assembly & Validation
        campaign.status = 'rendering';
        campaign.finalRender = { status: 'rendering' };
        upsertCampaign(campaign);

        const approvedScenes = campaign.scenes.filter((s) => s.approved !== false);
        const renderResult = await assembleFinalAdvertisement({
          campaignId: campaign.id,
          jobId: job.id,
          scenes: approvedScenes.length > 0 ? approvedScenes : campaign.scenes,
          soundtrack: campaign.soundtrack,
          aspectRatio: campaign.aspectRatio,
          brandName: campaign.brandName,
          publicDir: PUBLIC_DIR,
          onProgress: (event) => {
            const scaledPct =
              event.stageKey === 'completed'
                ? 100
                : Math.min(99, Math.round(74 + (event.progress / 100) * 25));
            publishLoopProgress({
              ...event,
              progress: scaledPct,
              stageLabel:
                event.stageKey === 'completed'
                  ? 'Loop Complete • Validated Master MP4 Ready'
                  : `Node 04/04 • ${event.stageLabel}`,
              message:
                event.stageKey === 'completed'
                  ? event.message
                  : `[Loop Node 4/4 • FFmpeg] ${event.message}`,
            });
          },
        });

        campaign.finalRender = {
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
        campaign.status = renderResult.validationReport.valid ? 'completed' : 'failed';
        upsertCampaign(campaign);

        const completedJob = upsertJob({
          ...job,
          status: 'completed',
          progress: 100,
          message: `Chained Single-Loop Complete: 1K Storyboard -> Omni Flash Video -> Lyria 3.5 -> Master MP4 (${renderResult.validationReport.durationSeconds}s)`,
        });

        publishLoopProgress({
          campaignId: campaign.id,
          jobId: job.id,
          stageKey: 'completed',
          stageLabel: 'Loop Complete • Validated Broadcast MP4 Ready',
          progress: 100,
          sceneIndex: totalScenesCount,
          totalScenes: totalScenesCount,
          message: `Chained Single-Loop Complete (${renderResult.validationReport.width}x${renderResult.validationReport.height} @ 24fps, ${renderResult.validationReport.durationSeconds}s)`,
          timestamp: new Date().toISOString(),
        });

        return { campaign, job: completedJob };
      } catch (err: any) {
        campaign.status = 'failed';
        upsertCampaign(campaign);
        const failedJob = upsertJob({
          ...job,
          status: 'failed',
          error: err?.message || 'Single-loop autopilot failed',
          message: 'Single-loop autopilot failed',
        });
        publishLoopProgress({
          campaignId: campaign.id,
          jobId: job.id,
          stageKey: 'failed',
          stageLabel: 'Loop Error',
          progress: 0,
          message: err?.message || 'Single-loop autopilot failed',
          timestamp: new Date().toISOString(),
        });
        throw Object.assign(err, { campaign, job: failedJob });
      } finally {
        activeAutopilotJobsMap.delete(campaign.id);
      }
    };

    if (req.body?.asyncMode === true) {
      executeAutopilotPipeline().catch((e) => {
        console.error('Background autopilot error:', e?.message || e);
      });
      res.json({
        accepted: true,
        running: true,
        campaign,
        job,
      });
      return;
    }

    try {
      const result = await executeAutopilotPipeline();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({
        error: err?.message || 'Single-loop autopilot failed',
        campaign: err?.campaign || campaign,
      });
    }
  });

  // 7d. Multi-Market Localized Ad Engine (Adapts Scene Copy + Lyria Prompt + Re-Assembles Master MP4)
  app.post('/api/campaigns/:id/localize', async (req, res) => {
    const campaign = ensureCampaignLoaded(req.params.id, req.body?.campaign);
    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    const targetLocale = String(req.body?.locale || 'India (National)');
    const targetLanguage = String(req.body?.language || 'Hindi');

    const job = createJob(
      campaign.id,
      campaign.ownerId,
      'final_render',
      'gemini-3-flash-preview + lyria-3.5 + ffmpeg-static',
      `Localizing "${campaign.brandName}" campaign for ${targetLocale} (${targetLanguage})...`
    );

    try {
      const localized = await localizeCampaignForMarket({
        campaign,
        targetLocale,
        targetLanguage,
      });

      campaign.language = targetLanguage;
      if (campaign.plan) {
        campaign.plan.campaignMessage = localized.campaignMessage;
        campaign.plan.soundtrackPrompt = localized.soundtrackPrompt;
      }
      campaign.soundtrack.prompt = localized.soundtrackPrompt;

      campaign.scenes = campaign.scenes.map((scene, idx) => ({
        ...scene,
        overlayText: localized.sceneOverlays[idx] || scene.overlayText,
      }));

      // Re-assemble the localized master MP4 if scenes have media ready
      const approvedScenes = campaign.scenes.filter((s) => s.approved !== false && (s.videoUrl || s.imageUrl));
      let localizedVideoUrl = campaign.finalRender?.videoUrl;

      if (approvedScenes.length > 0) {
        const renderResult = await assembleFinalAdvertisement({
          campaignId: campaign.id,
          jobId: job.id,
          scenes: approvedScenes,
          soundtrack: campaign.soundtrack,
          aspectRatio: campaign.aspectRatio,
          brandName: campaign.brandName,
          publicDir: PUBLIC_DIR,
        });
        localizedVideoUrl = renderResult.videoUrl;
        campaign.finalRender = {
          status: 'completed',
          videoUrl: renderResult.videoUrl,
          renderedAt: new Date().toISOString(),
          resolution: `${renderResult.validationReport.width}x${renderResult.validationReport.height}`,
          fps: 24,
          durationSeconds: renderResult.validationReport.durationSeconds,
          fileSizeBytes: renderResult.validationReport.fileSizeBytes,
          ffmpegCommandLog: renderResult.commandLog,
          validationReport: renderResult.validationReport,
        };
      }

      const newVariant = {
        locale: targetLocale,
        language: targetLanguage,
        campaignMessage: localized.campaignMessage,
        soundtrackPrompt: localized.soundtrackPrompt,
        sceneOverlays: localized.sceneOverlays,
        videoUrl: localizedVideoUrl,
        adaptedAt: new Date().toISOString(),
      };

      campaign.localizedVariants = [
        newVariant,
        ...(campaign.localizedVariants || []).filter((v) => v.locale !== targetLocale),
      ];
      upsertCampaign(campaign);

      const completedJob = upsertJob({
        ...job,
        status: 'completed',
        progress: 100,
        message: `Localized "${campaign.brandName}" ad for ${targetLocale} (${targetLanguage})`,
      });

      res.json({ campaign, variant: newVariant, job: completedJob });
    } catch (err: any) {
      upsertJob({
        ...job,
        status: 'failed',
        error: err?.message || 'Localization failed',
        message: 'Campaign localization failed',
      });
      res.status(500).json({ error: err?.message || 'Campaign localization failed' });
    }
  });

  // 8. Generate Adaptive Soundtrack via Lyria 3.5 (lyria-3.5)
  app.post('/api/campaigns/:id/soundtrack', async (req, res) => {
    const campaign = ensureCampaignLoaded(req.params.id, req.body?.campaign);
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

  // 9a. Polling & SSE Endpoints for Real-Time FFmpeg Rendering & Autopilot Progress
  app.get('/api/campaigns/:id/render-progress', (req, res) => {
    const campaignId = req.params.id;
    const progressEvent = latestRenderProgressMap.get(campaignId) || null;
    const activeJobId = activeAutopilotJobsMap.get(campaignId);
    const campaign = loadCampaigns().find((c) => c.id === campaignId) || null;
    const job = activeJobId ? loadJobs().find((j) => j.id === activeJobId) || null : null;
    res.json({
      progress: progressEvent,
      autopilotRunning: Boolean(activeJobId),
      campaign,
      job,
    });
  });

  app.get('/api/campaigns/:id/render-progress/stream', (req, res) => {
    const campaignId = req.params.id;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const sendEvent = (event: RenderProgressEvent) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    const existing = latestRenderProgressMap.get(campaignId);
    if (existing) {
      sendEvent(existing);
    }

    const listener = (event: RenderProgressEvent) => {
      if (event.campaignId === campaignId) {
        sendEvent(event);
      }
    };

    renderProgressEmitter.on('progress', listener);

    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 15000);

    req.on('close', () => {
      clearInterval(heartbeat);
      renderProgressEmitter.off('progress', listener);
    });
  });

  // 9. Assemble Final Video via FFmpeg + Validate Output (Step 6 & 7)
  app.post('/api/campaigns/:id/render', async (req, res) => {
    const campaign = ensureCampaignLoaded(req.params.id, req.body?.campaign);
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

    const approvedScenes = campaign.scenes.filter((s) => s.approved !== false);
    const scenesToRender = approvedScenes.length > 0 ? approvedScenes : campaign.scenes;

    const job = createJob(
      campaign.id,
      campaign.ownerId,
      'final_render',
      'ffmpeg-static',
      `Assembling ${approvedScenes.length} scenes + Lyria 3.5 soundtrack via FFmpeg...`
    );

    const publishRenderProgress = (event: RenderProgressEvent) => {
      latestRenderProgressMap.set(campaign.id, event);
      renderProgressEmitter.emit('progress', event);
      upsertJob({
        ...job,
        status: event.stageKey === 'completed' ? 'completed' : event.stageKey === 'failed' ? 'failed' : 'running',
        progress: event.progress,
        message: event.message,
      });
    };

    try {
      campaign.finalRender = {
        status: 'rendering',
      };
      campaign.status = 'rendering';
      upsertCampaign(campaign);

      const renderResult = await assembleFinalAdvertisement({
        campaignId: campaign.id,
        jobId: job.id,
        scenes: scenesToRender,
        soundtrack: campaign.soundtrack,
        aspectRatio: campaign.aspectRatio,
        brandName: campaign.brandName,
        publicDir: PUBLIC_DIR,
        onProgress: publishRenderProgress,
      });

      const freshCampaign = loadCampaigns().find((c) => c.id === campaign.id) || campaign;
      // Preserve any auto-animated scene.videoUrl updates synthesized during rendering
      for (const updatedScene of scenesToRender) {
        const target = freshCampaign.scenes.find((s) => s.id === updatedScene.id);
        if (target && updatedScene.videoUrl && !target.videoUrl) {
          target.videoUrl = updatedScene.videoUrl;
          target.status = 'video_ready';
        }
      }

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
      publishRenderProgress({
        campaignId: campaign.id,
        jobId: job.id,
        stageKey: 'failed',
        stageLabel: 'Render Error',
        progress: 0,
        message: err?.message || 'FFmpeg rendering failed',
        timestamp: new Date().toISOString(),
      });

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

  // 10. Autonomous Multi-Agent Orchestrator Endpoint (Full Production or Selective Natural Language Modification)
  app.post('/api/agent/orchestrate', async (req, res) => {
    const prompt: string = String(req.body?.prompt || '').trim();
    const ownerId: string = String(req.body?.ownerId || 'public-demo').trim();
    const forceNewCampaign: boolean = Boolean(req.body?.forceNewCampaign);
    const asyncMode: boolean = req.body?.asyncMode !== false;

    if (!prompt) {
      res.status(400).json({ error: 'A natural language or spoken creative prompt is required.' });
      return;
    }

    const incomingCampaignId: string | undefined = req.body?.campaignId || req.body?.campaign?.id;
    const existingCampaign = incomingCampaignId
      ? ensureCampaignLoaded(incomingCampaignId, req.body?.campaign)
      : undefined;

    try {
      const directive = await parseOrchestratorDirective({
        prompt,
        existingCampaign: forceNewCampaign ? null : existingCampaign,
        forceNewCampaign,
        referenceImageBase64: req.body?.referenceImageBase64,
        referenceImageMimeType: req.body?.referenceImageMimeType,
      });

      const now = new Date().toISOString();
      let targetCampaign: Campaign;

      if (directive.intentType === 'full_production' || !existingCampaign || forceNewCampaign) {
        const campaignId = `camp_${Date.now().toString(36)}`;
        let referenceImageUrl = directive.brief.referenceImageUrl;
        if (directive.brief.referenceImageBase64 && directive.brief.referenceImageMimeType) {
          const ext = directive.brief.referenceImageMimeType.includes('png') ? 'png' : 'jpg';
          const refFilename = `ref_${campaignId}.${ext}`;
          const refPath = path.join(PUBLIC_DIR, 'assets', 'images', refFilename);
          fs.writeFileSync(
            refPath,
            Buffer.from(
              directive.brief.referenceImageBase64.replace(/^data:[^;]+;base64,/, ''),
              'base64'
            )
          );
          referenceImageUrl = `/assets/images/${refFilename}`;
        }

        targetCampaign = {
          id: campaignId,
          ownerId,
          brandName: directive.brief.brandName,
          productDescription: directive.brief.productDescription,
          targetAudience: directive.brief.targetAudience,
          campaignObjective: directive.brief.campaignObjective,
          creativeStyle: directive.brief.creativeStyle,
          durationSeconds: directive.brief.durationSeconds,
          aspectRatio: directive.brief.aspectRatio,
          language: directive.brief.language,
          referenceImageUrl,
          status: 'draft',
          scenes: [],
          soundtrack: {
            mood: 'Cinematic Commercial Score',
            prompt: `Adaptive commercial soundtrack for ${directive.brief.brandName}`,
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
        upsertCampaign(targetCampaign);
      } else {
        targetCampaign = existingCampaign;
      }

      const job = createJob(
        targetCampaign.id,
        targetCampaign.ownerId,
        directive.intentType === 'selective_modification' ? 'scene_edit' : 'final_render',
        'multi-agent-orchestrator',
        directive.intentSummary
      );

      activeAgentRunsMap.set(targetCampaign.id, job.id);

      const publishAgentUpdate = (updatedCamp: Campaign, updatedState: AgentOrchestrationState) => {
        updatedCamp.orchestrationState = updatedState;
        upsertCampaign(updatedCamp);
        upsertJob({
          ...job,
          status:
            updatedState.status === 'completed'
              ? 'completed'
              : updatedState.status === 'failed'
                ? 'failed'
                : 'running',
          progress: updatedState.overallProgress,
          message:
            updatedState.logs[0]?.message ||
            updatedState.intentSummary ||
            'Orchestrating specialized agents...',
        });
        agentStateEmitter.emit('state', {
          campaignId: updatedCamp.id,
          campaign: updatedCamp,
          orchestrationState: updatedState,
        });
      };

      const runPromise = executeOrchestratedWorkflow({
        campaign: targetCampaign,
        directive,
        publicDir: PUBLIC_DIR,
        onUpdate: publishAgentUpdate,
      })
        .then((resData) => {
          pruneUnreferencedAssets();
          return resData;
        })
        .finally(() => {
          activeAgentRunsMap.delete(targetCampaign.id);
        });

      if (asyncMode) {
        runPromise.catch((e) => {
          console.error('Background agent orchestration error:', e?.message || e);
        });
        // Give 150ms for initial state hydration before returning
        await new Promise((r) => setTimeout(r, 150));
        const hydrated = loadCampaigns().find((c) => c.id === targetCampaign.id) || targetCampaign;
        res.json({
          accepted: true,
          running: true,
          directive,
          campaign: hydrated,
          orchestrationState: hydrated.orchestrationState,
          job,
        });
        return;
      }

      const completed = await runPromise;
      res.json({
        accepted: true,
        running: false,
        directive,
        campaign: completed.campaign,
        orchestrationState: completed.state,
        job: loadJobs().find((j) => j.id === job.id) || job,
      });
    } catch (err: any) {
      res.status(500).json({
        error: err?.message || 'Agent orchestration failed',
      });
    }
  });

  // 10b. Resume Orchestrated Workflow from Saved Checkpoint
  app.post('/api/agent/resume/:id', async (req, res) => {
    const campaign = ensureCampaignLoaded(req.params.id, req.body?.campaign);
    if (!campaign || !campaign.orchestrationState) {
      res.status(404).json({ error: 'No resumable orchestration checkpoint found for this campaign.' });
      return;
    }

    const asyncMode: boolean = req.body?.asyncMode !== false;
    const savedState = campaign.orchestrationState;

    const directive = await parseOrchestratorDirective({
      prompt: savedState.userPrompt || campaign.productDescription,
      existingCampaign: savedState.mode === 'selective_modification' ? campaign : null,
      forceNewCampaign: savedState.mode === 'full_production',
    });

    const job = createJob(
      campaign.id,
      campaign.ownerId,
      'final_render',
      'multi-agent-orchestrator',
      `Resuming checkpointed workflow for ${campaign.brandName}...`
    );

    activeAgentRunsMap.set(campaign.id, job.id);

    const publishAgentUpdate = (updatedCamp: Campaign, updatedState: AgentOrchestrationState) => {
      updatedCamp.orchestrationState = updatedState;
      upsertCampaign(updatedCamp);
      upsertJob({
        ...job,
        status:
          updatedState.status === 'completed'
            ? 'completed'
            : updatedState.status === 'failed'
              ? 'failed'
              : 'running',
        progress: updatedState.overallProgress,
        message: updatedState.logs[0]?.message || 'Resuming multi-agent workflow...',
      });
      agentStateEmitter.emit('state', {
        campaignId: updatedCamp.id,
        campaign: updatedCamp,
        orchestrationState: updatedState,
      });
    };

    const runPromise = executeOrchestratedWorkflow({
      campaign,
      directive,
      publicDir: PUBLIC_DIR,
      resumeFromState: savedState,
      onUpdate: publishAgentUpdate,
    }).finally(() => {
      activeAgentRunsMap.delete(campaign.id);
    });

    if (asyncMode) {
      runPromise.catch((e) => {
        console.error('Resume agent orchestration error:', e?.message || e);
      });
      res.json({
        accepted: true,
        running: true,
        campaign,
        orchestrationState: campaign.orchestrationState,
        job,
      });
      return;
    }

    try {
      const completed = await runPromise;
      res.json({
        accepted: true,
        running: false,
        campaign: completed.campaign,
        orchestrationState: completed.state,
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to resume workflow' });
    }
  });

  // 10c. Poll & Stream Live Multi-Agent Orchestration State
  app.get('/api/agent/status/:id', (req, res) => {
    const campaignId = req.params.id;
    const campaign = loadCampaigns().find((c) => c.id === campaignId) || null;
    const activeJobId = activeAgentRunsMap.get(campaignId);
    const job = activeJobId ? loadJobs().find((j) => j.id === activeJobId) || null : null;
    res.json({
      running: Boolean(activeJobId),
      campaign,
      orchestrationState: campaign?.orchestrationState || null,
      job,
    });
  });

  app.get('/api/agent/stream/:id', (req, res) => {
    const campaignId = req.params.id;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const sendPayload = (payload: any) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    const currentCampaign = loadCampaigns().find((c) => c.id === campaignId);
    if (currentCampaign?.orchestrationState) {
      sendPayload({
        campaignId,
        campaign: currentCampaign,
        orchestrationState: currentCampaign.orchestrationState,
      });
    }

    const listener = (payload: any) => {
      if (payload.campaignId === campaignId) {
        sendPayload(payload);
      }
    };

    agentStateEmitter.on('state', listener);
    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 15000);

    req.on('close', () => {
      clearInterval(heartbeat);
      agentStateEmitter.off('state', listener);
    });
  });

  // 10d. Voice Transcription (gemini-3.5-transcribe) & Speech Synthesis (gemini-3.8-flash-lite-tts)
  app.post('/api/agent/transcribe', async (req, res) => {
    try {
      const base64Audio = String(req.body?.base64Audio || '');
      const mimeType = String(req.body?.mimeType || 'audio/webm');
      if (!base64Audio) {
        res.status(400).json({ error: 'base64Audio is required' });
        return;
      }
      const result = await transcribeVoicePrompt({ base64Audio, mimeType });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Voice transcription failed' });
    }
  });

  app.post('/api/agent/speak', async (req, res) => {
    try {
      const text = String(req.body?.text || '').trim();
      const campaignId = String(req.body?.campaignId || 'studio');
      const voiceName = req.body?.voiceName || 'Kore';
      if (!text) {
        res.status(400).json({ error: 'text is required' });
        return;
      }
      const result = await generateVoiceoverAudio({
        campaignId,
        script: text,
        voiceName,
        publicDir: PUBLIC_DIR,
        prefix: 'assistant_tts',
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Speech generation failed' });
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

  pruneUnreferencedAssets();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`GenMedia Studio server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start GenMedia Studio server:', err);
  process.exit(1);
});
