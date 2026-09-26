export type AspectRatio = '16:9' | '9:16' | '1:1';

export type TransitionType = 'fade' | 'dissolve' | 'wipeleft' | 'smoothleft' | 'cut';

export interface CreativeBrief {
  brandName: string;
  productDescription: string;
  targetAudience: string;
  campaignObjective: string;
  creativeStyle: string;
  durationSeconds: number;
  aspectRatio: AspectRatio;
  language: string;
  referenceImageUrl?: string;
  referenceImageBase64?: string;
  referenceImageMimeType?: string;
}

export interface VisualIdentity {
  colorPalette: string[];
  lightingStyle: string;
  lensAndFraming: string;
  continuityAnchors: string;
}

export interface CampaignPlan {
  creativeConcept: string;
  campaignMessage: string;
  visualIdentity: VisualIdentity;
  musicalMood: string;
  soundtrackPrompt: string;
}

export interface SceneVersion {
  version: number;
  timestamp: string;
  instruction: string;
  imageUrl?: string;
  videoUrl?: string;
  cameraMovement: string;
  videoPrompt: string;
  directorNotes?: string;
  interactionId?: string;
}

export interface SceneItem {
  id: string;
  sceneNumber: number;
  title: string;
  durationSeconds: number;
  imagePrompt: string;
  videoPrompt: string;
  cameraMovement: string;
  audioDirection: string;
  transitionType: TransitionType;
  overlayText: string;
  approved: boolean;
  status: 'pending' | 'generating_image' | 'image_ready' | 'generating_video' | 'video_ready' | 'error';
  imageUrl?: string;
  imageModelUsed?: string;
  videoUrl?: string;
  videoModelUsed?: string;
  videoKeyframes?: string[];
  voiceoverUrl?: string;
  directorNotes?: string;
  interactionId?: string;
  versionHistory: SceneVersion[];
  error?: string;
}

export interface SoundtrackVersion {
  version: number;
  timestamp: string;
  mood: string;
  prompt: string;
  audioUrl: string;
  modelUsed: string;
}

export interface SoundtrackData {
  mood: string;
  prompt: string;
  status: 'idle' | 'generating' | 'ready' | 'error';
  audioUrl?: string;
  modelUsed?: string;
  generatedLyricsOrNotes?: string;
  durationSeconds?: number;
  includeInFinalMix: boolean;
  volumeLevel: number;
  history: SoundtrackVersion[];
  error?: string;
}

export interface ValidationReport {
  valid: boolean;
  videoCodec: string;
  audioCodec: string;
  width: number;
  height: number;
  durationSeconds: number;
  frameCount: number;
  hasAudioStream: boolean;
  fileSizeBytes: number;
  checkedAt: string;
}

export interface FinalRenderData {
  status: 'idle' | 'rendering' | 'validating' | 'completed' | 'error';
  videoUrl?: string;
  renderedAt?: string;
  resolution?: string;
  fps?: number;
  durationSeconds?: number;
  fileSizeBytes?: number;
  ffmpegCommandLog?: string;
  validationReport?: ValidationReport;
  error?: string;
}

export interface Campaign {
  id: string;
  ownerId: string;
  brandName: string;
  productDescription: string;
  targetAudience: string;
  campaignObjective: string;
  creativeStyle: string;
  durationSeconds: number;
  aspectRatio: AspectRatio;
  language: string;
  referenceImageUrl?: string;
  status:
    | 'draft'
    | 'planned'
    | 'storyboarding'
    | 'video_production'
    | 'scoring'
    | 'rendering'
    | 'completed'
    | 'failed';
  plan?: CampaignPlan;
  scenes: SceneItem[];
  soundtrack: SoundtrackData;
  finalRender: FinalRenderData;
  createdAt: string;
  updatedAt: string;
}

export interface PipelineJob {
  id: string;
  campaignId: string;
  ownerId: string;
  type: 'plan' | 'scene_image' | 'scene_video' | 'scene_edit' | 'soundtrack' | 'final_render';
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress: number;
  modelId: string;
  message: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ModelVerificationReport {
  timestamp: string;
  imageModel: {
    requestedId: string;
    verifiedId: string;
    sdkMethod: string;
    status: 'verified' | 'fallback' | 'error';
    capabilities: string[];
    limitations: string[];
    sampleAssetUrl?: string;
  };
  videoOmniModel: {
    requestedId: string;
    verifiedId: string;
    sdkMethod: string;
    status: 'verified' | 'fallback' | 'error';
    capabilities: string[];
    limitations: string[];
    sampleFrameUrl?: string;
    sampleAudioUrl?: string;
    sampleVideoUrl?: string;
  };
  musicModel: {
    requestedId: string;
    verifiedId: string;
    sdkMethod: string;
    status: 'verified' | 'fallback' | 'error';
    capabilities: string[];
    limitations: string[];
    sampleAudioUrl?: string;
  };
  ffmpegEngine: {
    binaryPath: string;
    version: string;
    capabilities: string[];
  };
}
