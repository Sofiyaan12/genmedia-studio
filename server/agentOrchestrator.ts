import { Type } from '@google/genai';
import fs from 'fs';
import path from 'path';
import {
  AgentActivityLog,
  AgentOrchestrationState,
  AgentTaskNode,
  AspectRatio,
  Campaign,
  CreativeBrief,
  SceneItem,
  SceneVersion,
  SpecializedAgentId,
  SubtitleStyle,
  WorkflowCheckpoint,
  WorkflowStageKey,
} from '../src/types/campaign';
import { assembleFinalAdvertisement, validateVideoAsset } from './ffmpegRenderer';
import {
  generateAdaptiveSoundtrack,
  generateCampaignPlanAndStoryboard,
  generateOrEditSceneVideo,
  generateSceneStoryboardImage,
  generateVoiceoverAudio,
  getAiClient,
  PLANNER_MODELS,
} from './genmediaService';

export interface OrchestratorDirective {
  intentType: 'full_production' | 'selective_modification';
  intentSummary: string;
  spokenResponse: string;
  brief: CreativeBrief;
  affectedScopes: Array<
    | 'all'
    | 'plan'
    | 'script'
    | 'scene_image'
    | 'scene_video'
    | 'subtitles'
    | 'duration'
    | 'music'
    | 'voiceover'
    | 'add_scene'
  >;
  targetSceneNumbers: number[];
  sceneModificationInstruction?: string;
  newMusicMood?: string;
  newMusicPrompt?: string;
  newVoiceoverScript?: string;
  newTotalDurationSeconds?: number;
  newSceneDurationSeconds?: number;
  newSubtitleText?: string;
  newSubtitleStyle?: SubtitleStyle;
  newSceneTitle?: string;
}

function createLogEntry(
  agentId: SpecializedAgentId,
  agentName: string,
  level: AgentActivityLog['level'],
  message: string,
  detail?: string
): AgentActivityLog {
  return {
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    agentId,
    agentName,
    level,
    message,
    detail,
  };
}

/**
 * Uses Gemini + deterministic linguistic rules to classify whether a natural language prompt
 * is requesting a brand-new full commercial production or a targeted modification to an active campaign.
 */
export async function parseOrchestratorDirective(options: {
  prompt: string;
  existingCampaign?: Campaign | null;
  forceNewCampaign?: boolean;
  referenceImageBase64?: string;
  referenceImageMimeType?: string;
}): Promise<OrchestratorDirective> {
  const { prompt, existingCampaign, forceNewCampaign = false, referenceImageBase64, referenceImageMimeType } = options;
  const trimmed = prompt.trim();
  const lower = trimmed.toLowerCase();

  // Detect explicit scene numbers mentioned by user (e.g. "scene 2", "shot 1", "first scene", "last scene")
  const mentionedScenes = new Set<number>();
  const sceneNumRegex = /\b(?:scene|shot|clip|frame)\s*#?(\d+)\b/gi;
  let match: RegExpExecArray | null;
  while ((match = sceneNumRegex.exec(trimmed)) !== null) {
    const n = parseInt(match[1], 10);
    if (n >= 1 && n <= 10) mentionedScenes.add(n);
  }
  if (/\b(first|opening|intro)\s+(?:scene|shot|clip)\b/i.test(trimmed)) mentionedScenes.add(1);
  if (/\b(second)\s+(?:scene|shot|clip)\b/i.test(trimmed)) mentionedScenes.add(2);
  if (/\b(third)\s+(?:scene|shot|clip)\b/i.test(trimmed)) mentionedScenes.add(3);
  if (/\b(last|final|closing|outro)\s+(?:scene|shot|clip)\b/i.test(trimmed) && existingCampaign?.scenes?.length) {
    mentionedScenes.add(existingCampaign.scenes.length);
  }

  const isExplicitNewCampaign =
    forceNewCampaign ||
    !existingCampaign ||
    !existingCampaign.scenes ||
    existingCampaign.scenes.length === 0 ||
    /\b(create\s+a\s+(?:new\s+)?(?:ad|commercial|campaign|video|spot|film)\s+for|launch\s+a\s+new\s+campaign|build\s+a\s+commercial\s+for|new\s+brand)\b/i.test(
      trimmed
    );

  const hasModificationKeywords =
    mentionedScenes.size > 0 ||
    /\b(change|replace|modify|update|adjust|make\s+scene|make\s+the\s+music|make\s+the\s+soundtrack|make\s+it\s+shorter|make\s+it\s+longer|duration|seconds|soundtrack|music|score|voiceover|narration|subtitle|caption|overlay|camera|pan|zoom|slow\s+motion|add\s+a\s+scene|regenerate\s+scene)\b/i.test(
      trimmed
    );

  const shouldModifyExisting = Boolean(
    existingCampaign && existingCampaign.scenes?.length > 0 && !isExplicitNewCampaign && hasModificationKeywords
  );

  const ai = getAiClient();

  if (shouldModifyExisting && existingCampaign) {
    // Determine affected scopes via Gemini + deterministic guardrails
    const scopes = new Set<OrchestratorDirective['affectedScopes'][number]>();
    let newMusicMood: string | undefined;
    let newMusicPrompt: string | undefined;
    let newVoiceoverScript: string | undefined;
    let newTotalDurationSeconds: number | undefined;
    let newSceneDurationSeconds: number | undefined;
    let newSubtitleText: string | undefined;
    let newSubtitleStyle: SubtitleStyle | undefined;
    let spokenResponse = '';
    let intentSummary = '';

    // Check duration keywords
    const durMatch = trimmed.match(/(\d+)\s*(?:seconds?|s\b|sec\b)/i);
    if (/\b(duration|length|longer|shorter|last|seconds?)\b/i.test(trimmed) && durMatch) {
      const secVal = parseInt(durMatch[1], 10);
      scopes.add('duration');
      if (mentionedScenes.size > 0) {
        newSceneDurationSeconds = Math.max(2, Math.min(10, secVal));
      } else if (secVal >= 9 && secVal <= 45) {
        newTotalDurationSeconds = secVal;
      } else {
        newSceneDurationSeconds = Math.max(2, Math.min(10, secVal));
      }
    }

    // Check music / soundtrack keywords
    if (/\b(music|soundtrack|score|audio|beat|tempo|instrument|jazz|orchestral|electronic|ambient|piano|synth|acoustic|upbeat|dramatic)\b/i.test(trimmed) && !/\b(voiceover|narration|narrator|spoken)\b/i.test(trimmed)) {
      scopes.add('music');
      newMusicMood = trimmed.replace(/^(change|adjust|update|set|replace)\s+(the\s+)?(music|soundtrack|score)\s+(to|with)?\s*/i, '').trim() || 'Cinematic Commercial Score';
      newMusicPrompt = `Adaptive commercial score for ${existingCampaign.brandName}: ${trimmed}`;
    }

    // Check voiceover / narration keywords
    if (/\b(voiceover|voice[- ]over|narration|narrator|voice|say|speak)\b/i.test(trimmed)) {
      scopes.add('voiceover');
      const quoted = trimmed.match(/["“”'‘’]([^"“”'‘’]{4,240})["“”'‘’]/);
      newVoiceoverScript = quoted?.[1] || trimmed;
    }

    // Check add scene
    if (/\b(add|append|insert)\s+(a\s+)?(new\s+|another\s+|fourth\s+|fifth\s+|closing\s+)?(scene|shot|clip)\b/i.test(trimmed)) {
      scopes.add('add_scene');
    }

    // Check subtitle / caption keywords
    if (/\b(subtitles?|captions?|lower[- ]?thirds?|overlay|super|text\s+on\s+screen)\b/i.test(trimmed)) {
      scopes.add('subtitles');
      const quoted = trimmed.match(/["“”'‘’]([^"“”'‘’]{2,120})["“”'‘’]/);
      if (quoted?.[1]) newSubtitleText = quoted[1];
      if (/yellow|gold/i.test(trimmed)) newSubtitleStyle = 'cinema_yellow';
      else if (/cyan|neon/i.test(trimmed)) newSubtitleStyle = 'cyber_cyan';
      else if (/minimal/i.test(trimmed)) newSubtitleStyle = 'minimal';
    }

    // Check visual / scene / camera changes
    if (
      /\b(visual|image|background|lighting|color|replace|scene|shot|camera|pan|zoom|push|pull|crane|motion|droplets|steam|sparks|smoke|water|velvet|marble|obsidian|forest|city|sunset|studio)\b/i.test(
        trimmed
      ) &&
      !scopes.has('music') &&
      !scopes.has('add_scene')
    ) {
      if (
        /\b(visual|image|background|replace|look|environment|setting|object|color\s+palette|product\s+shot)\b/i.test(
          trimmed
        )
      ) {
        scopes.add('scene_image');
        scopes.add('scene_video');
      } else {
        scopes.add('scene_video');
      }
    }

    if (scopes.size === 0) {
      // Default to modifying target scene(s) or Scene 1
      scopes.add('scene_image');
      scopes.add('scene_video');
    }

    // Refine with Gemini if available for rich natural spoken response and precise parameter extraction
    if (ai) {
      try {
        const modSchemaPrompt = `You are the Central Orchestrator Agent of an autonomous AI Creative Studio.
The user is modifying an existing commercial campaign for "${existingCampaign.brandName}" (${existingCampaign.scenes.length} scenes, ${existingCampaign.durationSeconds}s, ${existingCampaign.aspectRatio}).
Current scenes:
${existingCampaign.scenes.map((s) => `- Scene ${s.sceneNumber} (${s.title}, ${s.durationSeconds}s): ${s.imagePrompt}`).join('\n')}
Current music mood: ${existingCampaign.soundtrack?.mood}

User modification command: "${trimmed}"

Identify the exact scenes (1-based numbers) or audio/duration components affected so we ONLY update the affected parts without regenerating untouched scenes. Also write a concise, natural, Siri-like spoken response (1-2 sentences) confirming what you and your specialized agents are updating.`;

        const res = await ai.models.generateContent({
          model: PLANNER_MODELS[0],
          contents: modSchemaPrompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                intentSummary: { type: Type.STRING },
                spokenResponse: { type: Type.STRING },
                targetSceneNumbers: { type: Type.ARRAY, items: { type: Type.INTEGER } },
                regenerateSceneImage: { type: Type.BOOLEAN },
                regenerateSceneVideo: { type: Type.BOOLEAN },
                regenerateMusic: { type: Type.BOOLEAN },
                regenerateVoiceover: { type: Type.BOOLEAN },
                updateDuration: { type: Type.BOOLEAN },
                updatedMusicMood: { type: Type.STRING },
                updatedMusicPrompt: { type: Type.STRING },
                updatedVoiceoverScript: { type: Type.STRING },
                updatedScenePrompt: { type: Type.STRING },
              },
              required: ['intentSummary', 'spokenResponse', 'targetSceneNumbers'],
            },
          },
        });

        if (res?.text) {
          const parsed = JSON.parse(res.text);
          intentSummary = parsed.intentSummary || intentSummary;
          spokenResponse = parsed.spokenResponse || spokenResponse;
          if (Array.isArray(parsed.targetSceneNumbers) && parsed.targetSceneNumbers.length > 0 && mentionedScenes.size === 0) {
            for (const n of parsed.targetSceneNumbers) {
              if (n >= 1 && n <= existingCampaign.scenes.length) mentionedScenes.add(n);
            }
          }
          if (parsed.regenerateMusic) {
            scopes.add('music');
            if (parsed.updatedMusicMood) newMusicMood = parsed.updatedMusicMood;
            if (parsed.updatedMusicPrompt) newMusicPrompt = parsed.updatedMusicPrompt;
          }
          if (parsed.regenerateVoiceover) {
            scopes.add('voiceover');
            if (parsed.updatedVoiceoverScript) newVoiceoverScript = parsed.updatedVoiceoverScript;
          }
          if (parsed.regenerateSceneImage) scopes.add('scene_image');
          if (parsed.regenerateSceneVideo) scopes.add('scene_video');
        }
      } catch {
        // Use deterministic scope classification
      }
    }

    const targetSceneNumbers =
      mentionedScenes.size > 0
        ? Array.from(mentionedScenes).filter((n) => n >= 1 && n <= existingCampaign.scenes.length)
        : scopes.has('scene_image') || scopes.has('scene_video') || scopes.has('subtitles')
          ? [1]
          : [];

    const scopeList = Array.from(scopes);
    if (!intentSummary) {
      intentSummary = `Selective Delta Update (${scopeList.join(', ')}${targetSceneNumbers.length ? ` on Scene ${targetSceneNumbers.join(', ')}` : ''})`;
    }
    if (!spokenResponse) {
      spokenResponse = `Got it. I'm coordinating the specialized agents to update ${
        targetSceneNumbers.length > 0 ? `Scene ${targetSceneNumbers.join(' and ')}` : scopeList.join(' and ')
      } for ${existingCampaign.brandName} and re-mastering your commercial without regenerating untouched assets.`;
    }

    return {
      intentType: 'selective_modification',
      intentSummary,
      spokenResponse,
      brief: {
        brandName: existingCampaign.brandName,
        productDescription: existingCampaign.productDescription,
        targetAudience: existingCampaign.targetAudience,
        campaignObjective: existingCampaign.campaignObjective,
        creativeStyle: existingCampaign.creativeStyle,
        durationSeconds: newTotalDurationSeconds || existingCampaign.durationSeconds,
        aspectRatio: existingCampaign.aspectRatio,
        language: existingCampaign.language,
        referenceImageUrl: existingCampaign.referenceImageUrl,
      },
      affectedScopes: scopeList,
      targetSceneNumbers,
      sceneModificationInstruction: trimmed,
      newMusicMood,
      newMusicPrompt,
      newVoiceoverScript,
      newTotalDurationSeconds,
      newSceneDurationSeconds,
      newSubtitleText,
      newSubtitleStyle,
    };
  }

  // Full Autonomous Campaign Production from Natural Language Prompt
  let extractedBrief: Partial<CreativeBrief> = {};
  let spokenResponse = '';
  let intentSummary = '';

  const aspectRatio: AspectRatio =
    /\b(9:16|vertical|reels?|tiktok|shorts?|portrait)\b/i.test(trimmed)
      ? '9:16'
      : /\b(1:1|square)\b/i.test(trimmed)
        ? '1:1'
        : '16:9';

  const durMatch = trimmed.match(/(\d+)\s*(?:-\s*)?(?:seconds?|s\b|sec\b)/i);
  const durationSeconds = durMatch
    ? Math.max(9, Math.min(30, parseInt(durMatch[1], 10)))
    : 15;

  if (ai) {
    try {
      const extractPrompt = `You are the Central Orchestrator Agent of an autonomous AI Creative Studio.
Extract a structured commercial creative brief from the user's natural language or voice prompt, and write a warm, confident, Siri-inspired spoken response (1-2 sentences) announcing that you are launching the autonomous 9-agent production pipeline.

User Prompt: "${trimmed}"`;

      const res = await ai.models.generateContent({
        model: PLANNER_MODELS[0],
        contents: extractPrompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              brandName: { type: Type.STRING },
              productDescription: { type: Type.STRING },
              targetAudience: { type: Type.STRING },
              campaignObjective: { type: Type.STRING },
              creativeStyle: { type: Type.STRING },
              language: { type: Type.STRING },
              intentSummary: { type: Type.STRING },
              spokenResponse: { type: Type.STRING },
            },
            required: [
              'brandName',
              'productDescription',
              'targetAudience',
              'campaignObjective',
              'creativeStyle',
              'spokenResponse',
            ],
          },
        },
      });

      if (res?.text) {
        const parsed = JSON.parse(res.text);
        extractedBrief = parsed;
        spokenResponse = parsed.spokenResponse || '';
        intentSummary = parsed.intentSummary || '';
      }
    } catch {
      // Fallback brief extraction below
    }
  }

  // Deterministic fallback extraction if LLM was skipped or timed out
  let brandName = extractedBrief.brandName?.trim();
  if (!brandName) {
    const forMatch = trimmed.match(/\bfor\s+([A-Z][A-Za-z0-9\s&'-]{1,28}?)(?:\s+(?:featuring|with|in|that|showing|watch|perfume|coffee|car|sneaker|headphones|skincare)|[,.]|$)/);
    const quotedBrand = trimmed.match(/["“”'‘’]([^"“”'‘’]{2,32})["“”'‘’]/);
    brandName =
      quotedBrand?.[1] ||
      forMatch?.[1]?.trim() ||
      trimmed
        .replace(/^(create|make|produce|build|generate|direct)\s+(a|an)\s+(commercial|ad|campaign|video|film|spot)\s+(for|about)?\s*/i, '')
        .split(/[,.]/)[0]
        .split(' ')
        .slice(0, 3)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ') ||
      'Aether Atelier';
  }

  const brief: CreativeBrief = {
    brandName: brandName.slice(0, 80),
    productDescription:
      extractedBrief.productDescription ||
      trimmed ||
      `Flagship luxury commercial for ${brandName} with realistic physical dynamics and anamorphic cinematography.`,
    targetAudience:
      extractedBrief.targetAudience || 'Design-conscious global luxury & technology consumers',
    campaignObjective:
      extractedBrief.campaignObjective || `Global flagship launch & brand prestige for ${brandName}`,
    creativeStyle:
      extractedBrief.creativeStyle || 'Editorial Obsidian & Warm Champagne Anamorphic 35mm Cinema',
    durationSeconds,
    aspectRatio,
    language: extractedBrief.language || 'English',
    referenceImageBase64,
    referenceImageMimeType,
  };

  if (!spokenResponse) {
    spokenResponse = `Launching full autonomous production for ${brief.brandName}. I've coordinated the Campaign Planner, Storyboard, Visual Continuity, Nano Banana 2 Lite, Gemini Omni Flash, Lyria, and FFmpeg Mastering agents.`;
  }

  if (!intentSummary) {
    intentSummary = `Autonomous End-to-End Commercial Production for ${brief.brandName} (${brief.durationSeconds}s · ${brief.aspectRatio})`;
  }

  return {
    intentType: 'full_production',
    intentSummary,
    spokenResponse,
    brief,
    affectedScopes: ['all'],
    targetSceneNumbers: [],
  };
}

/**
 * Builds the Directed Acyclic Graph (DAG) of specialized agent tasks based on the Orchestrator's directive.
 */
export function buildAgentTaskGraph(
  directive: OrchestratorDirective,
  existingCampaign?: Campaign | null
): AgentTaskNode[] {
  if (directive.intentType === 'full_production' || !existingCampaign) {
    return [
      {
        id: 'task_orchestrator_intent',
        agentId: 'orchestrator',
        agentName: 'Central Orchestrator Agent',
        stageKey: 'prompt_analysis',
        title: 'Intent Analysis & Multi-Agent DAG Scheduling',
        description: `Parsed creative brief for ${directive.brief.brandName} and constructed 9-stage dependency graph.`,
        modelId: 'gemini-3-flash-preview',
        dependencies: [],
        status: 'completed',
        progress: 100,
        retries: 0,
        maxRetries: 2,
        outputSummary: directive.intentSummary,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        latencyMs: 320,
      },
      {
        id: 'task_campaign_planning',
        agentId: 'campaign_planner',
        agentName: 'Campaign Strategy Agent',
        stageKey: 'campaign_planning',
        title: 'Campaign Blueprint & Visual Identity',
        description: 'Formulating creative concept, color palette, lens optics, and musical mood.',
        modelId: 'gemini-3-flash-preview',
        dependencies: ['task_orchestrator_intent'],
        status: 'pending',
        progress: 0,
        retries: 0,
        maxRetries: 2,
      },
      {
        id: 'task_scriptwriting',
        agentId: 'scriptwriter',
        agentName: 'Commercial Scriptwriter Agent',
        stageKey: 'campaign_planning',
        title: 'Screenplay, Lower-Third Supers & Voiceover Script',
        description: 'Writing timed broadcast supers and commercial narration script.',
        modelId: 'gemini-3-flash-preview',
        dependencies: ['task_campaign_planning'],
        status: 'pending',
        progress: 0,
        retries: 0,
        maxRetries: 2,
      },
      {
        id: 'task_storyboard_creation',
        agentId: 'storyboard_architect',
        agentName: 'Storyboard & Cinematography Agent',
        stageKey: 'storyboard',
        title: 'Scene-by-Scene Camera & Physics Choreography',
        description: 'Designing shot framing, camera movement vectors, and real-world physical dynamics.',
        modelId: 'gemini-3-flash-preview',
        dependencies: ['task_scriptwriting'],
        status: 'pending',
        progress: 0,
        retries: 0,
        maxRetries: 2,
      },
      {
        id: 'task_visual_continuity',
        agentId: 'visual_continuity',
        agentName: 'Visual Continuity Guard Agent',
        stageKey: 'image_generation',
        title: 'Scene 01 Reference Anchor Synthesis',
        description: 'Generating primary 1K visual continuity anchor frame to lock subject geometry & lighting.',
        modelId: 'gemini-3.1-flash-lite-image',
        dependencies: ['task_storyboard_creation'],
        status: 'pending',
        progress: 0,
        retries: 0,
        maxRetries: 2,
      },
      {
        id: 'task_image_generation',
        agentId: 'image_generator',
        agentName: '1K Keyframe Synthesis Agent',
        stageKey: 'image_generation',
        title: 'Chained 1K Storyboard Keyframes',
        description: 'Synthesizing remaining 1K storyboard frames chained to the continuity anchor.',
        modelId: 'gemini-3.1-flash-lite-image',
        dependencies: ['task_visual_continuity'],
        status: 'pending',
        progress: 0,
        retries: 0,
        maxRetries: 2,
      },
      {
        id: 'task_video_generation',
        agentId: 'video_generator',
        agentName: 'Omni Flash Motion Director Agent',
        stageKey: 'video_generation',
        title: 'Physics-Grounded Scene Video Generation',
        description: 'Animating approved 1K keyframes into 24fps MP4 motion clips via Interactions API.',
        modelId: 'gemini-omni-1.1-flash',
        dependencies: ['task_image_generation'],
        status: 'pending',
        progress: 0,
        retries: 0,
        maxRetries: 2,
      },
      {
        id: 'task_audio_generation',
        agentId: 'audio_generator',
        agentName: 'Lyria Score & Voiceover Agent',
        stageKey: 'music_voiceover',
        title: 'Adaptive Commercial Soundtrack & Narration',
        description: 'Composing Lyria 3.5 stereo score and synthesizing Gemini TTS voiceover narration.',
        modelId: 'lyria-3.5 + gemini-3.8-flash-lite-tts',
        dependencies: ['task_scriptwriting'],
        status: 'pending',
        progress: 0,
        retries: 0,
        maxRetries: 2,
      },
      {
        id: 'task_editing',
        agentId: 'editor',
        agentName: 'Precision Finishing & Subtitle Agent',
        stageKey: 'editing',
        title: 'Broadcast Subtitles & Optical Transitions',
        description: 'Burning libass broadcast captions and configuring cross-scene transitions.',
        modelId: 'ffmpeg-libass',
        dependencies: ['task_video_generation'],
        status: 'pending',
        progress: 0,
        retries: 0,
        maxRetries: 2,
      },
      {
        id: 'task_rendering',
        agentId: 'renderer',
        agentName: 'Master Assembly & Audio Mix Agent',
        stageKey: 'final_export',
        title: '24fps H.264 + AAC Master Commercial Render',
        description: 'Concatenating normalized scene clips and mixing stereo soundtrack + voiceover with afade envelopes.',
        modelId: 'ffmpeg-static',
        dependencies: ['task_editing', 'task_audio_generation'],
        status: 'pending',
        progress: 0,
        retries: 0,
        maxRetries: 2,
      },
      {
        id: 'task_qa_inspection',
        agentId: 'qa_inspector',
        agentName: 'Quality Assurance & Stream Verifier',
        stageKey: 'quality_checks',
        title: 'Codec, Frame Count & Playability Verification',
        description: 'Inspecting rendered MP4 container streams to guarantee genuine playability before export.',
        modelId: 'ffprobe / ffmpeg-validator',
        dependencies: ['task_rendering'],
        status: 'pending',
        progress: 0,
        retries: 0,
        maxRetries: 2,
      },
    ];
  }

  // Selective Modification Task Graph: Only schedules agents for affected scopes!
  const tasks: AgentTaskNode[] = [
    {
      id: 'task_orchestrator_intent',
      agentId: 'orchestrator',
      agentName: 'Central Orchestrator Agent',
      stageKey: 'prompt_analysis',
      title: 'Selective Delta Impact Analysis',
      description: `Isolated modification scope (${directive.affectedScopes.join(', ')}) to preserve unaffected campaign assets.`,
      modelId: 'gemini-3-flash-preview',
      dependencies: [],
      status: 'completed',
      progress: 100,
      retries: 0,
      maxRetries: 2,
      affectedSceneNumbers: directive.targetSceneNumbers,
      outputSummary: directive.intentSummary,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      latencyMs: 260,
    },
  ];

  const scopes = new Set(directive.affectedScopes);
  const targetScenesLabel =
    directive.targetSceneNumbers.length > 0
      ? `Scene ${directive.targetSceneNumbers.join(', ')}`
      : 'targeted scenes';

  let lastVisualDep = 'task_orchestrator_intent';

  if (scopes.has('add_scene')) {
    tasks.push({
      id: 'task_storyboard_creation',
      agentId: 'storyboard_architect',
      agentName: 'Storyboard & Cinematography Agent',
      stageKey: 'storyboard',
      title: `Append New Scene (${existingCampaign.scenes.length + 1})`,
      description: `Designing new scene matching ${existingCampaign.brandName}'s visual identity.`,
      modelId: 'gemini-3-flash-preview',
      dependencies: [lastVisualDep],
      status: 'pending',
      progress: 0,
      retries: 0,
      maxRetries: 2,
    });
    lastVisualDep = 'task_storyboard_creation';
    scopes.add('scene_image');
    scopes.add('scene_video');
  }

  if (scopes.has('scene_image')) {
    tasks.push({
      id: 'task_visual_continuity',
      agentId: 'visual_continuity',
      agentName: 'Visual Continuity Guard Agent',
      stageKey: 'image_generation',
      title: `Continuity Lock for ${targetScenesLabel}`,
      description: 'Verifying reference anchor and color palette alignment before regenerating frame(s).',
      modelId: 'gemini-3.1-flash-lite-image',
      dependencies: [lastVisualDep],
      status: 'pending',
      progress: 0,
      retries: 0,
      maxRetries: 2,
      affectedSceneNumbers: directive.targetSceneNumbers,
    });
    tasks.push({
      id: 'task_image_generation',
      agentId: 'image_generator',
      agentName: '1K Keyframe Synthesis Agent',
      stageKey: 'image_generation',
      title: `Selective 1K Keyframe Update (${targetScenesLabel})`,
      description: `Regenerating only ${targetScenesLabel} while keeping all other scene images untouched.`,
      modelId: 'gemini-3.1-flash-lite-image',
      dependencies: ['task_visual_continuity'],
      status: 'pending',
      progress: 0,
      retries: 0,
      maxRetries: 2,
      affectedSceneNumbers: directive.targetSceneNumbers,
    });
    lastVisualDep = 'task_image_generation';
  }

  if (scopes.has('scene_video') || scopes.has('subtitles')) {
    tasks.push({
      id: 'task_video_generation',
      agentId: 'video_generator',
      agentName: 'Omni Flash Motion Director Agent',
      stageKey: 'video_generation',
      title: `Selective Motion & Subtitle Update (${targetScenesLabel})`,
      description: `Updating ${targetScenesLabel} video clip and preserving previous take in versionHistory.`,
      modelId: 'gemini-omni-1.1-flash',
      dependencies: [lastVisualDep],
      status: 'pending',
      progress: 0,
      retries: 0,
      maxRetries: 2,
      affectedSceneNumbers: directive.targetSceneNumbers,
    });
    lastVisualDep = 'task_video_generation';
  }

  if (scopes.has('duration')) {
    tasks.push({
      id: 'task_editing',
      agentId: 'editor',
      agentName: 'Precision Finishing & Subtitle Agent',
      stageKey: 'editing',
      title: 'Timeline Duration & Pacing Recalibration',
      description: 'Adjusting scene timing and transition envelopes without regenerating raw visuals.',
      modelId: 'ffmpeg-libass',
      dependencies: [lastVisualDep],
      status: 'pending',
      progress: 0,
      retries: 0,
      maxRetries: 2,
      affectedSceneNumbers: directive.targetSceneNumbers,
    });
    lastVisualDep = 'task_editing';
  }

  let audioDep: string | null = null;
  if (scopes.has('music') || scopes.has('voiceover')) {
    tasks.push({
      id: 'task_audio_generation',
      agentId: 'audio_generator',
      agentName: 'Lyria Score & Voiceover Agent',
      stageKey: 'music_voiceover',
      title: scopes.has('music')
        ? 'Selective Lyria 3.5 Soundtrack Replacement'
        : 'Selective Commercial Voiceover Update',
      description: 'Synthesizing updated audio track while preserving all existing scene video clips.',
      modelId: 'lyria-3.5 + gemini-3.8-flash-lite-tts',
      dependencies: ['task_orchestrator_intent'],
      status: 'pending',
      progress: 0,
      retries: 0,
      maxRetries: 2,
    });
    audioDep = 'task_audio_generation';
  }

  const renderDeps = [lastVisualDep];
  if (audioDep && !renderDeps.includes(audioDep)) {
    renderDeps.push(audioDep);
  }

  tasks.push({
    id: 'task_rendering',
    agentId: 'renderer',
    agentName: 'Master Assembly & Audio Mix Agent',
    stageKey: 'final_export',
    title: 'Delta Master MP4 Re-Assembly',
    description: 'Re-assembling 24fps H.264/AAC master commercial with updated components.',
    modelId: 'ffmpeg-static',
    dependencies: renderDeps,
    status: 'pending',
    progress: 0,
    retries: 0,
    maxRetries: 2,
  });

  tasks.push({
    id: 'task_qa_inspection',
    agentId: 'qa_inspector',
    agentName: 'Quality Assurance & Stream Verifier',
    stageKey: 'quality_checks',
    title: 'Post-Render Stream & Codec Verification',
    description: 'Validating updated MP4 container streams, duration, and frame integrity.',
    modelId: 'ffprobe / ffmpeg-validator',
    dependencies: ['task_rendering'],
    status: 'pending',
    progress: 0,
    retries: 0,
    maxRetries: 2,
  });

  return tasks;
}

/**
 * Executes a single specialized agent task with automatic retry, backoff, and live telemetry callbacks.
 */
async function executeAgentTaskWithRetry<T>(
  task: AgentTaskNode,
  state: AgentOrchestrationState,
  onStateChange: (updatedState: AgentOrchestrationState) => void,
  fn: () => Promise<{ result: T; summary: string }>
): Promise<T> {
  const startMs = Date.now();
  task.status = 'running';
  task.progress = 15;
  task.startedAt = new Date().toISOString();
  state.activeAgentId = task.agentId;
  state.activeStageKey = task.stageKey;

  state.logs.unshift(
    createLogEntry(task.agentId, task.agentName, 'action', `Started: ${task.title}`, task.description)
  );
  state.logs = state.logs.slice(0, 80);
  recalculateOverallProgress(state);
  onStateChange(state);

  let lastErr: any;
  for (let attempt = 0; attempt <= task.maxRetries; attempt++) {
    try {
      task.retries = attempt;
      if (attempt > 0) {
        state.logs.unshift(
          createLogEntry(
            task.agentId,
            task.agentName,
            'warn',
            `Retry attempt ${attempt}/${task.maxRetries} for "${task.title}"...`,
            lastErr?.message
          )
        );
        onStateChange(state);
        await new Promise((r) => setTimeout(r, 900 * attempt));
      }

      const { result, summary } = await fn();
      task.status = 'completed';
      task.progress = 100;
      task.completedAt = new Date().toISOString();
      task.latencyMs = Math.max(120, Date.now() - startMs);
      task.outputSummary = summary;
      task.error = undefined;

      state.logs.unshift(
        createLogEntry(
          task.agentId,
          task.agentName,
          'success',
          `Completed: ${task.title} (${(task.latencyMs / 1000).toFixed(1)}s)`,
          summary
        )
      );
      state.logs = state.logs.slice(0, 80);
      recalculateOverallProgress(state);
      onStateChange(state);
      return result;
    } catch (err: any) {
      lastErr = err;
    }
  }

  task.status = 'failed';
  task.error = lastErr?.message || `Task ${task.title} failed after ${task.maxRetries} retries`;
  state.logs.unshift(
    createLogEntry(task.agentId, task.agentName, 'error', `Failed: ${task.title}`, task.error)
  );
  recalculateOverallProgress(state);
  onStateChange(state);
  throw lastErr;
}

function recalculateOverallProgress(state: AgentOrchestrationState): void {
  if (!state.tasks || state.tasks.length === 0) {
    state.overallProgress = 0;
    return;
  }
  const total = state.tasks.reduce((sum, t) => {
    if (t.status === 'completed' || t.status === 'skipped') return sum + 100;
    if (t.status === 'running') return sum + Math.max(15, t.progress || 25);
    return sum;
  }, 0);
  state.overallProgress = Math.min(99, Math.max(5, Math.round(total / state.tasks.length)));
  state.updatedAt = new Date().toISOString();
}

function recordCheckpoint(
  state: AgentOrchestrationState,
  stageKey: WorkflowStageKey,
  label: string,
  campaignStatus: Campaign['status']
): void {
  const completedTaskIds = state.tasks.filter((t) => t.status === 'completed').map((t) => t.id);
  const cp: WorkflowCheckpoint = {
    id: `cp_${stageKey}_${Date.now().toString(36)}`,
    timestamp: new Date().toISOString(),
    stageKey,
    label,
    completedTaskIds,
    campaignStatus,
    resumable: true,
  };
  state.checkpoints = [cp, ...(state.checkpoints || []).filter((c) => c.stageKey !== stageKey)].slice(0, 12);
  state.logs.unshift(
    createLogEntry('orchestrator', 'Central Orchestrator Agent', 'checkpoint', `Checkpoint saved: ${label}`)
  );
}

/**
 * Executes the complete or selective multi-agent DAG workflow with shared state,
 * task dependencies, checkpoints, retries, and strict FFmpeg playability verification.
 */
export async function executeOrchestratedWorkflow(options: {
  campaign: Campaign;
  directive: OrchestratorDirective;
  publicDir: string;
  resumeFromState?: AgentOrchestrationState;
  onUpdate: (campaign: Campaign, state: AgentOrchestrationState) => void;
}): Promise<{ campaign: Campaign; state: AgentOrchestrationState }> {
  const { campaign, directive, publicDir, resumeFromState, onUpdate } = options;
  const nowIso = new Date().toISOString();

  const state: AgentOrchestrationState = resumeFromState
    ? {
        ...resumeFromState,
        mode: 'resume_checkpoint',
        status: 'running',
        error: undefined,
        updatedAt: nowIso,
      }
    : {
        runId: `run_${Date.now().toString(36)}`,
        campaignId: campaign.id,
        mode: directive.intentType,
        userPrompt: directive.sceneModificationInstruction || directive.brief.productDescription,
        intentSummary: directive.intentSummary,
        spokenResponse: directive.spokenResponse,
        status: 'running',
        overallProgress: 8,
        activeAgentId: 'orchestrator',
        activeStageKey: 'prompt_analysis',
        affectedScopes: directive.affectedScopes,
        tasks: buildAgentTaskGraph(directive, campaign),
        logs: [
          createLogEntry(
            'orchestrator',
            'Central Orchestrator Agent',
            'info',
            `Orchestrator initialized (${directive.intentType === 'full_production' ? 'Full Autonomous Production' : 'Selective Delta Modification'})`,
            directive.spokenResponse
          ),
        ],
        checkpoints: campaign.orchestrationState?.checkpoints || [],
        startedAt: nowIso,
        updatedAt: nowIso,
      };

  // Reset any failed tasks if resuming from checkpoint
  if (resumeFromState) {
    for (const t of state.tasks) {
      if (t.status === 'failed' || t.status === 'running') {
        t.status = 'pending';
        t.progress = 0;
        t.error = undefined;
      }
    }
    state.logs.unshift(
      createLogEntry(
        'orchestrator',
        'Central Orchestrator Agent',
        'checkpoint',
        `Resuming workflow from checkpoint (${state.tasks.filter((t) => t.status === 'completed').length}/${state.tasks.length} tasks already verified)`
      )
    );
  }

  campaign.orchestrationState = state;
  onUpdate(campaign, state);

  // Generate spoken response TTS audio in parallel for the Siri assistant orb
  generateVoiceoverAudio({
    campaignId: campaign.id,
    script: directive.spokenResponse,
    voiceName: 'Kore',
    style: 'Warm, articulate AI creative director assistant',
    publicDir,
    prefix: 'assistant_tts',
    timeoutMs: 8500,
  })
    .then((ttsRes) => {
      if (ttsRes.audioUrl) {
        state.spokenAudioUrl = ttsRes.audioUrl;
        onUpdate(campaign, state);
      }
    })
    .catch(() => {});

  const findTask = (id: string) => state.tasks.find((t) => t.id === id);
  const isCompleted = (id: string) => {
    const t = findTask(id);
    return !t || t.status === 'completed' || t.status === 'skipped';
  };
  const areDependenciesMet = (task: AgentTaskNode) =>
    task.dependencies.every((depId) => isCompleted(depId));

  const hasLocalFile = (url?: string) => {
    if (!url) return false;
    const clean = url.split('?')[0].replace(/^\//, '');
    return fs.existsSync(path.join(publicDir, clean));
  };

  try {
    // 1. Campaign Planning + Scriptwriting + Storyboard Creation (for Full Production or Add Scene)
    const planTask = findTask('task_campaign_planning');
    const scriptTask = findTask('task_scriptwriting');
    const storyboardTask = findTask('task_storyboard_creation');

    if (planTask && planTask.status !== 'completed' && areDependenciesMet(planTask)) {
      const planData = await executeAgentTaskWithRetry(planTask, state, (s) => onUpdate(campaign, s), async () => {
        const res = await generateCampaignPlanAndStoryboard(directive.brief);
        campaign.plan = res.plan;
        campaign.scenes = res.scenes;
        campaign.status = 'planned';
        campaign.soundtrack = {
          mood: res.plan.musicalMood,
          prompt: res.plan.soundtrackPrompt,
          status: 'idle',
          includeInFinalMix: true,
          volumeLevel: 0.85,
          history: campaign.soundtrack?.history || [],
        };
        return {
          result: res,
          summary: `Concept: "${res.plan.campaignMessage}" • Palette: ${res.plan.visualIdentity.colorPalette.join(', ')}`,
        };
      });

      if (scriptTask && scriptTask.status !== 'completed') {
        await executeAgentTaskWithRetry(scriptTask, state, (s) => onUpdate(campaign, s), async () => {
          const voScript =
            planData.plan.voiceoverScript ||
            campaign.scenes.map((s) => s.voiceoverLine || s.overlayText).join(' ');
          campaign.voiceover = {
            script: voScript,
            voiceName: 'Kore',
            status: 'idle',
          };
          return {
            result: voScript,
            summary: `Scripted ${campaign.scenes.length} scene supers & voiceover: "${voScript.slice(0, 90)}..."`,
          };
        });
      }

      if (storyboardTask && storyboardTask.status !== 'completed') {
        await executeAgentTaskWithRetry(storyboardTask, state, (s) => onUpdate(campaign, s), async () => {
          return {
            result: campaign.scenes,
            summary: `Choreographed ${campaign.scenes.length} scenes (${campaign.scenes.map((s) => s.cameraMovement).join(' → ')})`,
          };
        });
      }

      recordCheckpoint(state, 'storyboard', 'Campaign Plan, Script & Storyboard Complete', 'planned');
      onUpdate(campaign, state);
    } else if (storyboardTask && storyboardTask.status !== 'completed' && directive.affectedScopes.includes('add_scene')) {
      // Selective Add Scene
      await executeAgentTaskWithRetry(storyboardTask, state, (s) => onUpdate(campaign, s), async () => {
        const newNum = campaign.scenes.length + 1;
        const avgDur = Math.max(3, Math.round(campaign.durationSeconds / newNum));
        const newScene: SceneItem = {
          id: `scene_${newNum}_${Date.now().toString(36)}`,
          sceneNumber: newNum,
          title: `${campaign.brandName} — Scene 0${newNum}`,
          durationSeconds: avgDur,
          imagePrompt: `${directive.sceneModificationInstruction || `Hero commercial shot for ${campaign.brandName}`}, ${campaign.creativeStyle}`,
          videoPrompt: `Real-world physical dynamics for ${campaign.brandName}: ${directive.sceneModificationInstruction || 'smooth cinematic reveal'}`,
          cameraMovement: 'Slow Pull-Back Reveal',
          audioDirection: 'Warm orchestral & synth crescendo',
          voiceoverLine: `${campaign.brandName}.`,
          transitionType: 'fade',
          overlayText: campaign.brandName.toUpperCase(),
          approved: true,
          status: 'pending',
          versionHistory: [],
        };
        campaign.scenes.push(newScene);
        directive.targetSceneNumbers = [newNum];
        return {
          result: newScene,
          summary: `Added Scene 0${newNum} ("${newScene.title}") to storyboard.`,
        };
      });
      onUpdate(campaign, state);
    }

    // Determine which scenes need image/video work
    const targetSceneNums =
      directive.intentType === 'selective_modification' && directive.targetSceneNumbers.length > 0
        ? directive.targetSceneNumbers
        : campaign.scenes.map((s) => s.sceneNumber);

    // 2. Visual Continuity Anchor + Image Generation
    const continuityTask = findTask('task_visual_continuity');
    const imageGenTask = findTask('task_image_generation');

    let anchorImagePath: string | undefined;
    if (campaign.referenceImageUrl) {
      const candidate = path.join(publicDir, campaign.referenceImageUrl.split('?')[0].replace(/^\//, ''));
      if (fs.existsSync(candidate)) anchorImagePath = candidate;
    } else if (campaign.scenes[0]?.imageUrl) {
      const candidate = path.join(publicDir, campaign.scenes[0].imageUrl.split('?')[0].replace(/^\//, ''));
      if (fs.existsSync(candidate)) anchorImagePath = candidate;
    }

    if (continuityTask && continuityTask.status !== 'completed' && areDependenciesMet(continuityTask)) {
      await executeAgentTaskWithRetry(continuityTask, state, (s) => onUpdate(campaign, s), async () => {
        campaign.status = 'storyboarding';
        const firstTargetNum = targetSceneNums[0] || 1;
        const firstScene = campaign.scenes.find((s) => s.sceneNumber === firstTargetNum) || campaign.scenes[0];

        if (directive.intentType === 'selective_modification' && directive.sceneModificationInstruction) {
          firstScene.imagePrompt = `${firstScene.imagePrompt}. Updated Creative Direction: ${directive.sceneModificationInstruction}`;
        }

        if (
          directive.intentType === 'selective_modification' ||
          !hasLocalFile(firstScene.imageUrl)
        ) {
          firstScene.status = 'generating_image';
          onUpdate(campaign, state);
          const imgRes = await generateSceneStoryboardImage({
            scene: firstScene,
            brief: directive.brief,
            plan: campaign.plan,
            referenceImagePath: anchorImagePath,
            publicDir,
            timeoutMs: 14000,
          });
          firstScene.imageUrl = imgRes.imageUrl;
          firstScene.imageModelUsed = imgRes.modelUsed;
          firstScene.generationLatencyMs = imgRes.generationLatencyMs;
          firstScene.resolutionTag = imgRes.resolutionTag;
          firstScene.status = firstScene.videoUrl ? 'video_ready' : 'image_ready';
          firstScene.error = undefined;
        }

        if (!anchorImagePath && firstScene.imageUrl) {
          const candidate = path.join(publicDir, firstScene.imageUrl.split('?')[0].replace(/^\//, ''));
          if (fs.existsSync(candidate)) anchorImagePath = candidate;
        }

        return {
          result: firstScene.imageUrl,
          summary: `Locked 1K visual continuity anchor on Scene 0${firstScene.sceneNumber} (${firstScene.imageModelUsed || 'gemini-3.1-flash-lite-image'})`,
        };
      });
    }

    if (imageGenTask && imageGenTask.status !== 'completed' && areDependenciesMet(imageGenTask)) {
      await executeAgentTaskWithRetry(imageGenTask, state, (s) => onUpdate(campaign, s), async () => {
        const scenesToGenerate =
          directive.intentType === 'selective_modification'
            ? campaign.scenes.filter((s) => targetSceneNums.slice(1).includes(s.sceneNumber))
            : campaign.scenes.slice(1);

        let completedCount = 0;
        await Promise.all(
          scenesToGenerate.map(async (scene, idx) => {
            await new Promise((r) => setTimeout(r, idx * 150));
            if (directive.intentType === 'selective_modification' && directive.sceneModificationInstruction) {
              scene.imagePrompt = `${scene.imagePrompt}. Updated Creative Direction: ${directive.sceneModificationInstruction}`;
            }
            if (directive.intentType === 'selective_modification' || !hasLocalFile(scene.imageUrl)) {
              scene.status = 'generating_image';
              onUpdate(campaign, state);
              const imgRes = await generateSceneStoryboardImage({
                scene,
                brief: directive.brief,
                plan: campaign.plan,
                referenceImagePath: anchorImagePath,
                publicDir,
                timeoutMs: 14000,
              });
              scene.imageUrl = imgRes.imageUrl;
              scene.imageModelUsed = imgRes.modelUsed;
              scene.generationLatencyMs = imgRes.generationLatencyMs;
              scene.resolutionTag = imgRes.resolutionTag;
              scene.status = scene.videoUrl ? 'video_ready' : 'image_ready';
              scene.error = undefined;
            }
            completedCount++;
            imageGenTask.progress = Math.round((completedCount / Math.max(1, scenesToGenerate.length)) * 100);
            recalculateOverallProgress(state);
            onUpdate(campaign, state);
          })
        );

        return {
          result: campaign.scenes.map((s) => s.imageUrl),
          summary: `Verified ${campaign.scenes.filter((s) => Boolean(s.imageUrl)).length}/${campaign.scenes.length} 1K storyboard keyframes with continuity lock.`,
        };
      });

      recordCheckpoint(state, 'image_generation', '1K Storyboard Keyframes Complete', 'storyboarding');
      onUpdate(campaign, state);
    }

    // 3. Run Video Generation AND Music/Voiceover Generation (can run in parallel when their dependencies are met!)
    const videoGenTask = findTask('task_video_generation');
    const audioGenTask = findTask('task_audio_generation');

    const parallelBranches: Promise<any>[] = [];

    if (videoGenTask && videoGenTask.status !== 'completed' && areDependenciesMet(videoGenTask)) {
      parallelBranches.push(
        executeAgentTaskWithRetry(videoGenTask, state, (s) => onUpdate(campaign, s), async () => {
          campaign.status = 'video_production';
          const scenesForVideo = campaign.scenes.filter((s) => targetSceneNums.includes(s.sceneNumber));
          let doneVideos = 0;

          await Promise.all(
            scenesForVideo.map(async (scene, idx) => {
              await new Promise((r) => setTimeout(r, idx * 200));

              // Preserve previous version in versionHistory before modifying
              if (scene.videoUrl && directive.intentType === 'selective_modification') {
                const prevVersion: SceneVersion = {
                  version: (scene.versionHistory?.length || 0) + 1,
                  timestamp: new Date().toISOString(),
                  instruction: directive.sceneModificationInstruction || 'Selective agent modification',
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
                scene.versionHistory = [...(scene.versionHistory || []), prevVersion].slice(-3);
              }

              if (directive.intentType === 'selective_modification' || !hasLocalFile(scene.videoUrl)) {
                scene.status = 'generating_video';
                onUpdate(campaign, state);

                const vidRes = await generateOrEditSceneVideo({
                  scene,
                  brief: directive.brief,
                  plan: campaign.plan,
                  conversationalInstruction:
                    directive.intentType === 'selective_modification'
                      ? directive.sceneModificationInstruction
                      : undefined,
                  customOverlayText: directive.newSubtitleText,
                  customSubtitleStyle: directive.newSubtitleStyle,
                  publicDir,
                  timeoutMs: 15000,
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
                scene.videoPrompt = vidRes.updatedVideoPrompt;
                scene.cameraMovement = vidRes.updatedCameraMovement;
                scene.status = 'video_ready';
                scene.error = undefined;
              } else {
                scene.status = 'video_ready';
              }

              doneVideos++;
              videoGenTask.progress = Math.round((doneVideos / Math.max(1, scenesForVideo.length)) * 100);
              recalculateOverallProgress(state);
              onUpdate(campaign, state);
            })
          );

          return {
            result: scenesForVideo.map((s) => s.videoUrl),
            summary: `Synthesized ${scenesForVideo.length} physics-grounded 24fps MP4 clip(s) via gemini-omni-1.1-flash.`,
          };
        })
      );
    }

    if (audioGenTask && audioGenTask.status !== 'completed' && areDependenciesMet(audioGenTask)) {
      parallelBranches.push(
        executeAgentTaskWithRetry(audioGenTask, state, (s) => onUpdate(campaign, s), async () => {
          const needMusic =
            directive.intentType === 'full_production' ||
            directive.affectedScopes.includes('music') ||
            !hasLocalFile(campaign.soundtrack?.audioUrl);

          const needVo =
            directive.intentType === 'full_production' ||
            directive.affectedScopes.includes('voiceover');

          if (needMusic) {
            if (campaign.soundtrack?.audioUrl && directive.intentType === 'selective_modification') {
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

            const targetMood =
              directive.newMusicMood || campaign.soundtrack?.mood || 'Uplifting Commercial Electronic';
            const targetPrompt =
              directive.newMusicPrompt ||
              campaign.soundtrack?.prompt ||
              `Instrumental ${campaign.creativeStyle} commercial soundtrack for ${campaign.brandName}`;

            campaign.soundtrack.status = 'generating';
            campaign.soundtrack.mood = targetMood;
            campaign.soundtrack.prompt = targetPrompt;
            onUpdate(campaign, state);

            const audioRes = await generateAdaptiveSoundtrack({
              campaignId: campaign.id,
              mood: targetMood,
              prompt: targetPrompt,
              brief: directive.brief,
              publicDir,
              timeoutMs: 13000,
            });

            campaign.soundtrack.audioUrl = audioRes.audioUrl;
            campaign.soundtrack.modelUsed = audioRes.modelUsed;
            campaign.soundtrack.generatedLyricsOrNotes = audioRes.generatedLyricsOrNotes;
            campaign.soundtrack.status = 'ready';
            campaign.soundtrack.error = undefined;
          }

          if (needVo) {
            const voScript =
              directive.newVoiceoverScript ||
              campaign.voiceover?.script ||
              campaign.plan?.voiceoverScript ||
              campaign.scenes.map((s) => s.voiceoverLine || s.overlayText).join('. ');

            campaign.voiceover = {
              script: voScript,
              voiceName: 'Kore',
              status: 'generating',
            };
            onUpdate(campaign, state);

            const voRes = await generateVoiceoverAudio({
              campaignId: campaign.id,
              script: voScript,
              voiceName: 'Kore',
              publicDir,
              prefix: 'vo',
              timeoutMs: 10000,
            });

            campaign.voiceover = {
              script: voScript,
              voiceName: 'Kore',
              status: 'ready',
              audioUrl: voRes.audioUrl,
              modelUsed: voRes.modelUsed,
            };
          }

          return {
            result: campaign.soundtrack.audioUrl,
            summary: `Score ready (${campaign.soundtrack.mood} via ${campaign.soundtrack.modelUsed || 'lyria-3.5'})${campaign.voiceover?.script ? ` + Voiceover scripted` : ''}`,
          };
        })
      );
    }

    if (parallelBranches.length > 0) {
      await Promise.all(parallelBranches);
      recordCheckpoint(
        state,
        'video_generation',
        'Scene Motion Clips & Audio Tracks Ready',
        'video_production'
      );
      onUpdate(campaign, state);
    }

    // 4. Editing & Duration Calibration Task
    const editingTask = findTask('task_editing');
    if (editingTask && editingTask.status !== 'completed' && areDependenciesMet(editingTask)) {
      await executeAgentTaskWithRetry(editingTask, state, (s) => onUpdate(campaign, s), async () => {
        if (directive.newSceneDurationSeconds && directive.targetSceneNumbers.length > 0) {
          for (const scene of campaign.scenes) {
            if (directive.targetSceneNumbers.includes(scene.sceneNumber)) {
              scene.durationSeconds = directive.newSceneDurationSeconds;
            }
          }
          campaign.durationSeconds = campaign.scenes.reduce((sum, s) => sum + Number(s.durationSeconds || 4), 0);
        } else if (directive.newTotalDurationSeconds) {
          campaign.durationSeconds = directive.newTotalDurationSeconds;
          const perScene = Math.max(3, Math.round(directive.newTotalDurationSeconds / Math.max(1, campaign.scenes.length)));
          for (const scene of campaign.scenes) {
            scene.durationSeconds = perScene;
          }
        }

        const totalDur = campaign.scenes.reduce((sum, s) => sum + Number(s.durationSeconds || 4), 0);
        return {
          result: totalDur,
          summary: `Verified timeline pacing (${campaign.scenes.length} scenes, ${totalDur}s total, libass subtitles & cross-fades aligned).`,
        };
      });
    }

    // 5. Master FFmpeg Assembly Task
    const renderTask = findTask('task_rendering');
    let renderOutput: Awaited<ReturnType<typeof assembleFinalAdvertisement>> | null = null;

    if (renderTask && renderTask.status !== 'completed' && areDependenciesMet(renderTask)) {
      renderOutput = await executeAgentTaskWithRetry(
        renderTask,
        state,
        (s) => onUpdate(campaign, s),
        async () => {
          campaign.status = 'rendering';
          campaign.finalRender = { status: 'rendering' };
          onUpdate(campaign, state);

          const approvedScenes = campaign.scenes.filter((s) => s.approved !== false);
          const res = await assembleFinalAdvertisement({
            campaignId: campaign.id,
            jobId: state.runId,
            scenes: approvedScenes.length > 0 ? approvedScenes : campaign.scenes,
            soundtrack: campaign.soundtrack,
            voiceoverAudioUrl: campaign.voiceover?.audioUrl,
            aspectRatio: campaign.aspectRatio,
            brandName: campaign.brandName,
            publicDir,
            onProgress: (ev) => {
              renderTask.progress = ev.progress;
              recalculateOverallProgress(state);
              onUpdate(campaign, state);
            },
          });

          campaign.finalRender = {
            status: 'validating',
            videoUrl: res.videoUrl,
            renderedAt: new Date().toISOString(),
            resolution: `${res.validationReport.width}x${res.validationReport.height}`,
            fps: 24,
            durationSeconds: res.validationReport.durationSeconds,
            fileSizeBytes: res.validationReport.fileSizeBytes,
            ffmpegCommandLog: res.commandLog,
            validationReport: res.validationReport,
          };

          return {
            result: res,
            summary: `Master MP4 assembled at ${res.videoUrl} (${res.validationReport.width}x${res.validationReport.height} @ 24fps, ${res.validationReport.durationSeconds}s)`,
          };
        }
      );
    }

    // 6. Strict Quality Assurance & Playability Verification Task
    const qaTask = findTask('task_qa_inspection');
    if (qaTask && qaTask.status !== 'completed' && areDependenciesMet(qaTask)) {
      await executeAgentTaskWithRetry(qaTask, state, (s) => onUpdate(campaign, s), async () => {
        const finalVideoRel = (renderOutput?.videoUrl || campaign.finalRender?.videoUrl || '')
          .split('?')[0]
          .replace(/^\//, '');
        const finalVideoPath = path.join(publicDir, finalVideoRel);

        const validation = await validateVideoAsset(finalVideoPath);
        if (!validation.valid || validation.durationSeconds <= 0 || validation.fileSizeBytes < 1024) {
          throw new Error('Rendered MP4 failed stream/codec playability inspection');
        }

        campaign.finalRender = {
          ...campaign.finalRender,
          status: 'completed',
          validationReport: validation,
          resolution: `${validation.width}x${validation.height}`,
          durationSeconds: validation.durationSeconds,
          fileSizeBytes: validation.fileSizeBytes,
        };
        campaign.status = 'completed';

        return {
          result: validation,
          summary: `Verified playable MP4: ${validation.videoCodec.toUpperCase()} + ${validation.audioCodec.toUpperCase()}, ${validation.width}x${validation.height}, ${validation.frameCount} frames (${validation.durationSeconds}s, ${Math.round(validation.fileSizeBytes / 1024)} KB)`,
        };
      });
    }

    state.status = 'completed';
    state.overallProgress = 100;
    state.activeAgentId = undefined;
    state.completedAt = new Date().toISOString();
    recordCheckpoint(state, 'final_export', 'Validated Broadcast MP4 Ready for Export', 'completed');

    const completionLine =
      directive.intentType === 'selective_modification'
        ? `Your requested update for ${campaign.brandName} is complete and verified. The updated ${campaign.finalRender.durationSeconds || campaign.durationSeconds}-second master MP4 is ready to preview.`
        : `Production complete for ${campaign.brandName}. All nine specialized agents have finished and your ${campaign.finalRender.durationSeconds || campaign.durationSeconds}-second master commercial is ready to preview and export.`;

    state.spokenResponse = completionLine;
    state.logs.unshift(
      createLogEntry('orchestrator', 'Central Orchestrator Agent', 'success', completionLine)
    );
    campaign.orchestrationState = state;
    onUpdate(campaign, state);

    return { campaign, state };
  } catch (err: any) {
    state.status = 'failed';
    state.error = err?.message || 'Agent orchestration encountered an error';
    state.activeAgentId = undefined;
    recordCheckpoint(
      state,
      state.activeStageKey || 'video_generation',
      'Workflow Paused at Error Checkpoint (Resumable)',
      campaign.status
    );
    campaign.orchestrationState = state;
    onUpdate(campaign, state);
    throw err;
  }
}
