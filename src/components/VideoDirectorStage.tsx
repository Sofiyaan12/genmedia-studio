import React, { useState } from 'react';
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  Film,
  History,
  Loader2,
  MessageSquarePlus,
  Play,
  RotateCcw,
  Send,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { Campaign, SceneItem, SceneVersion } from '../types/campaign';

interface Props {
  campaign: Campaign;
  selectedSceneId: string;
  onSelectScene: (sceneId: string) => void;
  generatingSceneVideoId: string | null;
  onGenerateOrEditVideo: (
    sceneId: string,
    options?: { instruction?: string; videoPrompt?: string; cameraMovement?: string }
  ) => Promise<void>;
  onRestoreSceneVersion: (sceneId: string, version: SceneVersion) => Promise<void>;
  onProceedToScoreAndRender: () => void;
}

const DIRECTOR_EDIT_CHIPS = [
  'Change the camera movement to a smooth orbital pan right',
  'Make the lighting warmer golden hour with richer rim highlights',
  'Extend the macro focus and add slow-motion atmospheric particles',
  'Change the background to warm brutalist architectural concrete',
  'Make the transition smoother with a slow pull-back reveal',
];

export const VideoDirectorStage: React.FC<Props> = ({
  campaign,
  selectedSceneId,
  onSelectScene,
  generatingSceneVideoId,
  onGenerateOrEditVideo,
  onRestoreSceneVersion,
  onProceedToScoreAndRender,
}) => {
  const activeScene: SceneItem =
    campaign.scenes.find((s) => s.id === selectedSceneId) || campaign.scenes[0];

  const [editInstruction, setEditInstruction] = useState('');
  const [previewVersionUrl, setPreviewVersionUrl] = useState<string | null>(null);
  const [customCameraMove, setCustomCameraMove] = useState(activeScene?.cameraMovement || '');

  React.useEffect(() => {
    setPreviewVersionUrl(null);
    setCustomCameraMove(activeScene?.cameraMovement || '');
  }, [activeScene?.id, activeScene?.cameraMovement]);

  if (!activeScene) return null;

  const isGeneratingThis =
    generatingSceneVideoId === activeScene.id || activeScene.status === 'generating_video';
  const displayedVideoUrl = previewVersionUrl || activeScene.videoUrl;
  const readyVideosCount = campaign.scenes.filter((s) => Boolean(s.videoUrl)).length;

  const handleApplyConversationalEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editInstruction.trim()) return;
    const instructionToSend = editInstruction.trim();
    setEditInstruction('');
    setPreviewVersionUrl(null);
    await onGenerateOrEditVideo(activeScene.id, {
      instruction: instructionToSend,
      cameraMovement: customCameraMove || activeScene.cameraMovement,
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Status Header */}
      <div className="bg-[#111318] border border-white/10 rounded-sm p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-sky-400">
              STAGE 04 • VIDEO GENERATION & CONVERSATIONAL EDITING
            </span>
            <span className="px-2 py-0.5 bg-sky-500/10 border border-sky-500/30 rounded-sm text-[11px] font-mono text-sky-300">
              Model: gemini-omni-1.1-flash (Interactions API)
            </span>
          </div>
          <h2 className="text-lg font-bold text-white font-display">
            Multimodal Scene Animator & Conversational Director ({readyVideosCount}/{campaign.scenes.length} Clips Ready)
          </h2>
          <p className="text-xs text-[#9499A6]">
            Select any scene below to synthesize native MP4 video or request conversational edits while preserving previous versions.
          </p>
        </div>

        <button
          onClick={onProceedToScoreAndRender}
          className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs rounded-sm flex items-center gap-2 transition cursor-pointer"
        >
          <span>Proceed to Lyria 3.5 Soundtrack & FFmpeg Master</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Scene Timeline Selector Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {campaign.scenes.map((scene) => {
          const isSelected = scene.id === activeScene.id;
          const isBusy = generatingSceneVideoId === scene.id || scene.status === 'generating_video';
          return (
            <button
              key={scene.id}
              type="button"
              onClick={() => onSelectScene(scene.id)}
              className={`p-2.5 rounded-sm border text-left transition flex flex-col justify-between gap-2 cursor-pointer ${
                isSelected
                  ? 'bg-[#171A21] border-sky-400 ring-1 ring-sky-400/30'
                  : 'bg-[#111318] border-white/10 hover:border-white/25'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-[11px] font-mono font-bold text-amber-400">
                  SCENE 0{scene.sceneNumber}
                </span>
                {isBusy ? (
                  <Loader2 className="w-3.5 h-3.5 text-sky-400 animate-spin" />
                ) : scene.videoUrl ? (
                  <span className="px-1.5 py-0.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-sm text-[10px] font-mono">
                    MP4 v{(scene.versionHistory?.length || 0) + 1}
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 bg-white/5 text-[#9499A6] rounded-sm text-[10px] font-mono">
                    Still Only
                  </span>
                )}
              </div>

              <div className="aspect-video w-full bg-[#090A0D] rounded-xs overflow-hidden border border-white/10 relative">
                {scene.imageUrl ? (
                  <img src={scene.imageUrl} alt={scene.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[10px] font-mono text-[#9499A6]">
                    No Frame
                  </div>
                )}
              </div>

              <div className="truncate text-xs font-medium text-white">{scene.title}</div>
            </button>
          );
        })}
      </div>

      {/* Main Split Director Console */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left 7 Cols: Video Program Monitor & Version History Bar */}
        <div className="xl:col-span-7 bg-[#111318] border border-white/10 rounded-sm overflow-hidden flex flex-col justify-between">
          <div>
            {/* Monitor Top HUD */}
            <div className="px-4 py-3 bg-[#171A21] border-b border-white/10 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="px-2 py-0.5 bg-sky-500/15 border border-sky-500/30 text-sky-300 font-mono text-xs font-bold rounded-sm">
                  SCENE 0{activeScene.sceneNumber} MONITOR
                </span>
                <span className="text-sm font-bold text-white">{activeScene.title}</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono text-[#9499A6]">
                <span className="px-2 py-0.5 bg-[#090A0D] border border-white/10 rounded-sm text-sky-400">
                  {activeScene.cameraMovement}
                </span>
                <span className="px-2 py-0.5 bg-[#090A0D] border border-white/10 rounded-sm">
                  {activeScene.durationSeconds}.00s
                </span>
              </div>
            </div>

            {/* Video Player / Keyframe Canvas */}
            <div className="relative aspect-video bg-black flex items-center justify-center border-b border-white/10">
              {isGeneratingThis ? (
                <div className="flex flex-col items-center gap-3 text-sky-400 p-6 text-center">
                  <Loader2 className="w-9 h-9 animate-spin" />
                  <div className="text-sm font-semibold text-white">
                    Gemini Omni Flash (`gemini-omni-1.1-flash`) is synthesizing MP4 video...
                  </div>
                  <p className="text-xs font-mono text-[#9499A6] max-w-md">
                    Executing Interactions API (`response_modalities: [&apos;video&apos;]`). Previous version is safely preserved in scene history.
                  </p>
                </div>
              ) : displayedVideoUrl ? (
                <video
                  key={displayedVideoUrl}
                  src={displayedVideoUrl}
                  controls
                  autoPlay
                  loop
                  className="w-full h-full object-contain bg-black"
                />
              ) : activeScene.imageUrl ? (
                <div className="relative w-full h-full">
                  <img
                    src={activeScene.imageUrl}
                    alt={activeScene.title}
                    className="w-full h-full object-cover opacity-75"
                  />
                  <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-3 p-6 text-center">
                    <Film className="w-8 h-8 text-sky-400" />
                    <div className="text-sm font-semibold text-white">
                      Storyboard Keyframe Ready for Video Synthesis
                    </div>
                    <button
                      type="button"
                      onClick={() => onGenerateOrEditVideo(activeScene.id)}
                      className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-black font-semibold text-xs rounded-sm flex items-center gap-2 transition cursor-pointer"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>Generate Scene Video with Gemini Omni Flash</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-xs font-mono text-[#9499A6] p-8">
                  Generate a storyboard image first or click &ldquo;Generate Initial Video Clip&rdquo; on the right.
                </div>
              )}

              {previewVersionUrl && (
                <div className="absolute top-3 left-3 px-2.5 py-1 bg-amber-500 text-black font-mono text-xs font-bold rounded-sm shadow">
                  PREVIEWING HISTORICAL VERSION • Click &ldquo;Current Take&rdquo; or &ldquo;Restore This Take&rdquo; below
                </div>
              )}
            </div>

            {/* Director Notes & Provenance Metadata */}
            <div className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Model: {activeScene.videoModelUsed || 'gemini-omni-1.1-flash'}</span>
                </div>
                {activeScene.interactionId && (
                  <span className="text-[11px] text-[#9499A6] truncate max-w-xs" title={activeScene.interactionId}>
                    Interaction ID: {activeScene.interactionId.slice(0, 28)}...
                  </span>
                )}
              </div>

              {activeScene.directorNotes && (
                <div className="p-2.5 bg-[#090A0D] border border-white/10 rounded-sm text-xs text-zinc-300 font-mono">
                  <span className="text-sky-400 mr-1.5">[Director Log]:</span>
                  {activeScene.directorNotes}
                </div>
              )}
            </div>
          </div>

          {/* Non-Destructive Version History Strip */}
          <div className="p-4 bg-[#171A21] border-t border-white/10 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase text-white font-semibold flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-amber-400" /> Non-Destructive Take History ({(activeScene.versionHistory?.length || 0) + (activeScene.videoUrl ? 1 : 0)} Takes)
              </span>
              <span className="text-[11px] font-mono text-[#9499A6]">
                Only this scene is regenerated during conversational edits
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {activeScene.versionHistory?.map((ver) => {
                const isPreviewing = previewVersionUrl === ver.videoUrl;
                return (
                  <div
                    key={ver.version}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm border text-xs font-mono transition ${
                      isPreviewing
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                        : 'bg-[#090A0D] border-white/10 text-zinc-300'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setPreviewVersionUrl(ver.videoUrl || null)}
                      className="hover:text-white cursor-pointer flex items-center gap-1"
                    >
                      <span className="font-bold">v{ver.version}:</span>
                      <span className="truncate max-w-[160px]">{ver.instruction}</span>
                    </button>
                    <button
                      type="button"
                      title="Restore this version as active scene clip"
                      onClick={() => {
                        setPreviewVersionUrl(null);
                        onRestoreSceneVersion(activeScene.id, ver);
                      }}
                      className="ml-1 p-1 hover:bg-white/10 rounded-xs text-amber-400 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}

              {activeScene.videoUrl && (
                <button
                  type="button"
                  onClick={() => setPreviewVersionUrl(null)}
                  className={`px-3 py-1.5 rounded-sm border text-xs font-mono cursor-pointer transition ${
                    !previewVersionUrl
                      ? 'bg-sky-500/20 border-sky-400 text-sky-300 font-semibold'
                      : 'bg-[#090A0D] border-white/10 text-[#9499A6] hover:text-white'
                  }`}
                >
                  Current Active Take (v{(activeScene.versionHistory?.length || 0) + 1})
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right 5 Cols: Conversational Editing & Scene Motion Controls */}
        <div className="xl:col-span-5 bg-[#111318] border border-white/10 rounded-sm p-5 flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <div className="border-b border-white/10 pb-3">
              <span className="text-[11px] font-mono uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                <MessageSquarePlus className="w-3.5 h-3.5" /> CONVERSATIONAL SCENE EDITOR
              </span>
              <h3 className="text-base font-bold text-white font-display mt-0.5">
                Direct Scene 0{activeScene.sceneNumber} with Natural Language
              </h3>
            </div>

            {/* Initial or Full Scene Video Generation Button */}
            <div className="p-3.5 bg-[#171A21] border border-white/10 rounded-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase text-[#9499A6]">
                  Base Motion Prompt & Camera Spec
                </span>
                <Camera className="w-3.5 h-3.5 text-sky-400" />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-[#9499A6] mb-1">
                  Camera Movement
                </label>
                <input
                  type="text"
                  value={customCameraMove}
                  onChange={(e) => setCustomCameraMove(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-[#090A0D] border border-white/10 rounded-sm text-xs font-mono text-sky-300"
                />
              </div>

              <div className="text-xs text-zinc-300 bg-[#090A0D] p-2.5 rounded-sm border border-white/5 leading-relaxed">
                {activeScene.videoPrompt}
              </div>

              <button
                type="button"
                disabled={isGeneratingThis}
                onClick={() =>
                  onGenerateOrEditVideo(activeScene.id, {
                    cameraMovement: customCameraMove || activeScene.cameraMovement,
                  })
                }
                className="w-full py-2 px-3 bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-black font-semibold text-xs rounded-sm flex items-center justify-center gap-2 transition cursor-pointer"
              >
                {isGeneratingThis ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Generating via gemini-omni-1.1-flash...</span>
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4" />
                    <span>
                      {activeScene.videoUrl
                        ? 'Regenerate Base Scene Clip (gemini-omni-1.1-flash)'
                        : 'Generate Initial Video Clip (gemini-omni-1.1-flash)'}
                    </span>
                  </>
                )}
              </button>
            </div>

            {/* Conversational Director Prompts */}
            <div className="space-y-2.5">
              <div className="text-[11px] font-mono uppercase text-amber-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Quick Conversational Edit Presets:
              </div>
              <div className="flex flex-col gap-1.5">
                {DIRECTOR_EDIT_CHIPS.map((chip, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setEditInstruction(chip)}
                    className="px-3 py-2 bg-[#171A21] hover:bg-[#1F242F] border border-white/10 hover:border-sky-400/40 rounded-sm text-left text-xs text-zinc-200 hover:text-white transition cursor-pointer"
                  >
                    &ldquo;{chip}&rdquo;
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleApplyConversationalEdit} className="space-y-3 pt-2">
              <div>
                <label className="block text-[11px] font-mono uppercase text-[#9499A6] mb-1">
                  Conversational Edit Instruction (Chains `previous_interaction_id`)
                </label>
                <textarea
                  rows={3}
                  value={editInstruction}
                  onChange={(e) => setEditInstruction(e.target.value)}
                  placeholder="e.g., Make the lighting warmer golden hour, slow down the camera push-in, and add subtle rising steam..."
                  className="w-full px-3 py-2 bg-[#090A0D] border border-white/15 focus:border-sky-400 rounded-sm text-xs text-white outline-none leading-relaxed"
                />
              </div>

              <button
                type="submit"
                disabled={isGeneratingThis || !editInstruction.trim()}
                className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-semibold text-xs rounded-sm flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Apply Conversational Edit to Scene 0{activeScene.sceneNumber} Only</span>
              </button>
            </form>

            {activeScene.error && (
              <div className="p-2.5 bg-red-500/10 border border-red-500/30 rounded-sm text-xs text-red-300 font-mono">
                {activeScene.error}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
