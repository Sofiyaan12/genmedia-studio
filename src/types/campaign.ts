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
  voiceoverScript?: string;
}

export type SubtitleStyle = 'broadcast' | 'cinema_yellow' | 'cyber_cyan' | 'minimal';

export interface SubtitleCue {
  startSeconds: number;
  endSeconds: number;
  text: string;
}

export interface SceneVersion {
  version: number;
  timestamp: string;
  instruction: string;
  imageUrl?: string;
  videoUrl?: string;
  rawVideoUrl?: string;
  subtitlesBurnedIn?: boolean;
  overlayText?: string;
  subtitleCues?: SubtitleCue[];
  subtitleStyle?: SubtitleStyle;
  cameraMovement: string;
  videoPrompt: string;
  directorNotes?: string;
  interactionId?: string;
}

export interface LocalizedMarketVariant {
  locale: string;
  language: string;
  campaignMessage: string;
  soundtrackPrompt: string;
  sceneOverlays: string[];
  videoUrl?: string;
  adaptedAt: string;
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
  voiceoverLine?: string;
  transitionType: TransitionType;
  overlayText: string;
  subtitleCues?: SubtitleCue[];
  subtitleStyle?: SubtitleStyle;
  subtitlesBurnedIn?: boolean;
  rawVideoUrl?: string;
  approved: boolean;
  status: 'pending' | 'generating_image' | 'image_ready' | 'generating_video' | 'video_ready' | 'error';
  imageUrl?: string;
  imageModelUsed?: string;
  generationLatencyMs?: number;
  resolutionTag?: string;
  videoUrl?: string;
  videoModelUsed?: string;
  videoLatencyMs?: number;
  physicsSimulationNote?: string;
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

export interface VoiceoverData {
  script: string;
  voiceName: string;
  status: 'idle' | 'generating' | 'ready' | 'error';
  audioUrl?: string;
  modelUsed?: string;
  durationSeconds?: number;
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

export type RenderStageKey =
  | 'init'
  | 'scene_prep'
  | 'concat'
  | 'audio_mix'
  | 'validate'
  | 'completed'
  | 'failed';

export interface RenderProgressEvent {
  campaignId: string;
  jobId: string;
  stageKey: RenderStageKey;
  stageLabel: string;
  progress: number;
  sceneIndex?: number;
  totalScenes?: number;
  currentFrame?: number;
  fps?: number;
  speed?: string;
  timemark?: string;
  message: string;
  timestamp: string;
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

export type SpecializedAgentId =
  | 'orchestrator'
  | 'campaign_planner'
  | 'scriptwriter'
  | 'storyboard_architect'
  | 'visual_continuity'
  | 'image_generator'
  | 'video_generator'
  | 'audio_generator'
  | 'editor'
  | 'renderer'
  | 'qa_inspector';

export type WorkflowStageKey =
  | 'prompt_analysis'
  | 'campaign_planning'
  | 'storyboard'
  | 'image_generation'
  | 'video_generation'
  | 'music_voiceover'
  | 'editing'
  | 'quality_checks'
  | 'final_export';

export interface AgentTaskNode {
  id: string;
  agentId: SpecializedAgentId;
  agentName: string;
  stageKey: WorkflowStageKey;
  title: string;
  description: string;
  modelId: string;
  dependencies: string[];
  status: 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'skipped';
  progress: number;
  retries: number;
  maxRetries: number;
  affectedSceneNumbers?: number[];
  startedAt?: string;
  completedAt?: string;
  latencyMs?: number;
  outputSummary?: string;
  error?: string;
}

export interface AgentActivityLog {
  id: string;
  timestamp: string;
  agentId: SpecializedAgentId;
  agentName: string;
  level: 'info' | 'action' | 'checkpoint' | 'success' | 'warn' | 'error';
  message: string;
  detail?: string;
}

export interface WorkflowCheckpoint {
  id: string;
  timestamp: string;
  stageKey: WorkflowStageKey;
  label: string;
  completedTaskIds: string[];
  campaignStatus: Campaign['status'];
  resumable: boolean;
}

export interface AgentOrchestrationState {
  runId: string;
  campaignId: string;
  mode: 'full_production' | 'selective_modification' | 'resume_checkpoint';
  userPrompt: string;
  intentSummary: string;
  spokenResponse: string;
  spokenAudioUrl?: string;
  status: 'idle' | 'running' | 'paused_checkpoint' | 'completed' | 'failed';
  overallProgress: number;
  activeAgentId?: SpecializedAgentId;
  activeStageKey?: WorkflowStageKey;
  affectedScopes: string[];
  tasks: AgentTaskNode[];
  logs: AgentActivityLog[];
  checkpoints: WorkflowCheckpoint[];
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
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
  voiceover?: VoiceoverData;
  finalRender: FinalRenderData;
  localizedVariants?: LocalizedMarketVariant[];
  orchestrationState?: AgentOrchestrationState;
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
