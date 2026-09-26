import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { assembleFinalAdvertisement } from '../server/ffmpegRenderer';
import {
  generateAdaptiveSoundtrack,
  generateCampaignPlanAndStoryboard,
  generateOrEditSceneVideo,
  generateSceneStoryboardImage,
  getVerifiedModelsReport,
} from '../server/genmediaService';
import { Campaign, CreativeBrief } from '../src/types/campaign';

dotenv.config();

const PUBLIC_DIR = path.resolve(process.cwd(), 'public');
const DATA_DIR = path.resolve(process.cwd(), 'data');
const SAMPLES_DIR = path.join(PUBLIC_DIR, 'verified_samples');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(SAMPLES_DIR, { recursive: true });

async function runEndToEndVerification() {
  console.log('=== MILESTONE 1 & 6: LIVE END-TO-END PIPELINE VERIFICATION ===');

  const brief: CreativeBrief = {
    brandName: 'KONA AERO',
    productDescription:
      'Architectural matte-black titanium espresso and pour-over brewing system with precision thermal extraction and borosilicate glass carafe.',
    targetAudience: 'Specialty coffee enthusiasts, industrial designers, and modern home baristas',
    campaignObjective: 'Launch the KONA AERO flagship brewer with a tactile, sensory-driven commercial',
    creativeStyle: 'Tactile Anamorphic Macro Cinematography, Warm Golden Rim Lighting, Obsidian & Amber Palette',
    durationSeconds: 12,
    aspectRatio: '16:9',
    language: 'English',
  };

  console.log('Step 1: Generating structured AI Campaign Plan & Storyboard...');
  const { plan, scenes } = await generateCampaignPlanAndStoryboard(brief);
  const topScenes = scenes.slice(0, 3);
  console.log(`[PASS] Planned ${topScenes.length} scenes. Concept: ${plan.creativeConcept.slice(0, 100)}...`);

  let anchorImagePath: string | undefined;
  for (let i = 0; i < topScenes.length; i++) {
    const scene = topScenes[i];
    console.log(`Step 2.${i + 1}: Generating storyboard image for Scene ${scene.sceneNumber} via gemini-3.1-flash-lite-image...`);
    const imgRes = await generateSceneStoryboardImage({
      scene,
      brief,
      plan,
      referenceImagePath: anchorImagePath,
      publicDir: PUBLIC_DIR,
    });
    scene.imageUrl = imgRes.imageUrl;
    scene.imageModelUsed = imgRes.modelUsed;
    scene.status = 'image_ready';
    console.log(`[PASS] Scene ${scene.sceneNumber} image saved: ${scene.imageUrl}`);

    if (i === 0) {
      anchorImagePath = path.join(PUBLIC_DIR, scene.imageUrl.replace(/^\//, ''));
      fs.copyFileSync(anchorImagePath, path.join(SAMPLES_DIR, 'verified_image_gemini-3.1-flash-lite-image.jpg'));
    }
  }

  // Generate native video for Scene 1 and Scene 2 via gemini-omni-1.1-flash, plus conversational edit on Scene 1
  for (let i = 0; i < topScenes.length; i++) {
    const scene = topScenes[i];
    console.log(`Step 3.${i + 1}: Generating video clip for Scene ${scene.sceneNumber} via gemini-omni-1.1-flash...`);
    const vidRes = await generateOrEditSceneVideo({
      scene,
      brief,
      plan,
      publicDir: PUBLIC_DIR,
    });
    scene.videoUrl = vidRes.videoUrl;
    scene.videoModelUsed = vidRes.modelUsed;
    scene.interactionId = vidRes.interactionId;
    scene.directorNotes = vidRes.directorNotes;
    scene.status = 'video_ready';
    console.log(`[PASS] Scene ${scene.sceneNumber} video saved: ${scene.videoUrl} (interactionId=${scene.interactionId})`);

    if (i === 0) {
      const localVid = path.join(PUBLIC_DIR, scene.videoUrl.replace(/^\//, ''));
      fs.copyFileSync(localVid, path.join(SAMPLES_DIR, 'verified_video_gemini-omni-1.1-flash.mp4'));

      // Perform a real conversational edit on Scene 1 to verify stateful editing & version history preservation
      console.log('Step 3.1b: Testing conversational video edit on Scene 1 via gemini-omni-1.1-flash...');
      scene.versionHistory.push({
        version: 1,
        timestamp: new Date().toISOString(),
        instruction: 'Initial scene video generation',
        imageUrl: scene.imageUrl,
        videoUrl: scene.videoUrl,
        cameraMovement: scene.cameraMovement,
        videoPrompt: scene.videoPrompt,
        directorNotes: scene.directorNotes,
        interactionId: scene.interactionId,
      });

      const editInstruction = 'Make the lighting warmer golden hour with richer rising steam and a smooth orbital pan right';
      const editedRes = await generateOrEditSceneVideo({
        scene,
        brief,
        plan,
        conversationalInstruction: editInstruction,
        publicDir: PUBLIC_DIR,
      });
      scene.videoUrl = editedRes.videoUrl;
      scene.interactionId = editedRes.interactionId;
      scene.directorNotes = editedRes.directorNotes;
      scene.videoPrompt = editedRes.updatedVideoPrompt;
      scene.cameraMovement = editedRes.updatedCameraMovement;
      const editedLocalVid = path.join(PUBLIC_DIR, scene.videoUrl.replace(/^\//, ''));
      fs.copyFileSync(editedLocalVid, path.join(SAMPLES_DIR, 'verified_video_edited_gemini-omni-1.1-flash.mp4'));
      console.log(`[PASS] Scene 1 conversational edit saved: ${scene.videoUrl}`);
    }
  }

  // Step 4: Generate or attach Lyria 3.5 soundtrack
  const campaignId = 'camp_kona_aero_flagship';
  console.log('Step 4: Generating soundtrack via lyria-3.5...');
  const musicRes = await generateAdaptiveSoundtrack({
    campaignId,
    mood: plan.musicalMood,
    prompt: plan.soundtrackPrompt,
    brief,
    publicDir: PUBLIC_DIR,
  });
  const localAudio = path.join(PUBLIC_DIR, musicRes.audioUrl.replace(/^\//, ''));
  fs.copyFileSync(localAudio, path.join(SAMPLES_DIR, 'verified_audio_lyria-3.5.mp3'));
  console.log(`[PASS] Lyria 3.5 soundtrack saved: ${musicRes.audioUrl}`);

  const soundtrack = {
    mood: plan.musicalMood,
    prompt: plan.soundtrackPrompt,
    status: 'ready' as const,
    audioUrl: musicRes.audioUrl,
    modelUsed: musicRes.modelUsed,
    generatedLyricsOrNotes: musicRes.generatedLyricsOrNotes,
    includeInFinalMix: true,
    volumeLevel: 0.85,
    history: [],
  };

  // Step 5: Assemble & Validate Final Video via FFmpeg
  console.log('Step 5: Assembling final MP4 commercial via FFmpeg + ffprobe validation...');
  const renderRes = await assembleFinalAdvertisement({
    campaignId,
    scenes: topScenes,
    soundtrack,
    aspectRatio: brief.aspectRatio,
    brandName: brief.brandName,
    publicDir: PUBLIC_DIR,
  });
  console.log('[PASS] Final MP4 rendered & validated:', renderRes.videoUrl, JSON.stringify(renderRes.validationReport));

  const now = new Date().toISOString();
  const campaign: Campaign = {
    id: campaignId,
    ownerId: 'public-demo',
    brandName: brief.brandName,
    productDescription: brief.productDescription,
    targetAudience: brief.targetAudience,
    campaignObjective: brief.campaignObjective,
    creativeStyle: brief.creativeStyle,
    durationSeconds: brief.durationSeconds,
    aspectRatio: brief.aspectRatio,
    language: brief.language,
    status: 'completed',
    plan,
    scenes: topScenes,
    soundtrack,
    finalRender: {
      status: 'completed',
      videoUrl: renderRes.videoUrl,
      renderedAt: now,
      resolution: `${renderRes.validationReport.width}x${renderRes.validationReport.height}`,
      fps: 24,
      durationSeconds: renderRes.validationReport.durationSeconds,
      fileSizeBytes: renderRes.validationReport.fileSizeBytes,
      ffmpegCommandLog: renderRes.commandLog,
      validationReport: renderRes.validationReport,
    },
    createdAt: now,
    updatedAt: now,
  };

  fs.writeFileSync(path.join(DATA_DIR, 'campaigns.json'), JSON.stringify([campaign], null, 2));
  const report = getVerifiedModelsReport(PUBLIC_DIR);
  fs.writeFileSync(path.join(SAMPLES_DIR, 'verification_report.json'), JSON.stringify(report, null, 2));
  console.log('=== END-TO-END PIPELINE TEST COMPLETED SUCCESSFULLY ===');
}

runEndToEndVerification().catch((err) => {
  console.error('E2E Pipeline Test Failed:', err);
  process.exit(1);
});
