import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  CheckCircle2,
  Film,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Sparkles,
  Type as TypeIcon,
} from 'lucide-react';
import { Campaign, SceneItem, TransitionType } from '../types/campaign';

interface Props {
  campaign: Campaign;
  generatingAllImages: boolean;
  generatingSceneImageId: string | null;
  onGenerateAllImages: () => Promise<void>;
  onGenerateSingleImage: (sceneId: string, updatedPrompt?: string) => Promise<void>;
  onUpdateScenes: (updatedScenes: SceneItem[]) => Promise<void>;
  onProceedToVideo: (initialSceneId?: string) => void;
}

export const StoryboardStage: React.FC<Props> = ({
  campaign,
  generatingAllImages,
  generatingSceneImageId,
  onGenerateAllImages,
  onGenerateSingleImage,
  onUpdateScenes,
  onProceedToVideo,
}) => {
  const [editingPrompts, setEditingPrompts] = useState<Record<string, string>>({});

  const handleMoveScene = async (index: number, direction: -1 | 1) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= campaign.scenes.length) return;
    const copy = [...campaign.scenes];
    const [moved] = copy.splice(index, 1);
    copy.splice(targetIdx, 0, moved);
    const renumbered = copy.map((s, idx) => ({ ...s, sceneNumber: idx + 1 }));
    await onUpdateScenes(renumbered);
  };

  const handleToggleApprove = async (sceneId: string) => {
    const updated = campaign.scenes.map((s) =>
      s.id === sceneId ? { ...s, approved: !s.approved } : s
    );
    await onUpdateScenes(updated);
  };

  const handleUpdateField = async (
    sceneId: string,
    field: keyof SceneItem,
    value: string | number
  ) => {
    const updated = campaign.scenes.map((s) =>
      s.id === sceneId ? { ...s, [field]: value } : s
    );
    await onUpdateScenes(updated);
  };

  const readyImageCount = campaign.scenes.filter((s) => Boolean(s.imageUrl)).length;
  const approvedCount = campaign.scenes.filter((s) => s.approved).length;

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="bg-[#111318] border border-white/10 rounded-sm p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-amber-400">
              STAGE 03 • RAPID STORYBOARD GENERATION
            </span>
            <span className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/30 rounded-sm text-[11px] font-mono text-amber-300">
              Model: gemini-3.1-flash-lite-image (Nano Banana 2 Lite)
            </span>
          </div>
          <h2 className="text-lg font-bold text-white font-display">
            Visual Continuity Storyboard Grid ({readyImageCount}/{campaign.scenes.length} Generated • {approvedCount} Approved)
          </h2>
          <p className="text-xs text-[#9499A6]">
            Scene 1 acts as the visual reference anchor for subsequent frames. Approve, edit prompts, reorder scenes, or regenerate any shot.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={onGenerateAllImages}
            disabled={generatingAllImages || Boolean(generatingSceneImageId)}
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-semibold text-xs rounded-sm flex items-center gap-2 transition cursor-pointer"
          >
            {generatingAllImages ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Generating Storyboard Frames...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>
                  {readyImageCount === campaign.scenes.length
                    ? 'Regenerate All Storyboard Frames'
                    : 'Generate All Storyboard Frames (Nano Banana 2 Lite)'}
                </span>
              </>
            )}
          </button>

          <button
            onClick={() => onProceedToVideo()}
            className="px-4 py-2.5 bg-[#171A21] hover:bg-[#1F232D] border border-white/15 text-white font-semibold text-xs rounded-sm flex items-center gap-2 transition cursor-pointer"
          >
            <span>Proceed to Video Director (Gemini Omni Flash)</span>
            <ArrowRight className="w-4 h-4 text-sky-400" />
          </button>
        </div>
      </div>

      {/* Storyboard Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {campaign.scenes.map((scene, index) => {
          const isGeneratingThis =
            generatingSceneImageId === scene.id || scene.status === 'generating_image';
          const promptValue =
            editingPrompts[scene.id] !== undefined ? editingPrompts[scene.id] : scene.imagePrompt;

          return (
            <div
              key={scene.id}
              className={`bg-[#111318] border rounded-sm overflow-hidden flex flex-col justify-between transition ${
                scene.approved ? 'border-white/15' : 'border-white/5 opacity-60'
              }`}
            >
              {/* Top Bar: Scene Number, Reorder, Approve */}
              <div>
                <div className="px-4 py-2.5 bg-[#171A21] border-b border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono text-xs font-bold rounded-sm">
                      SCENE 0{scene.sceneNumber}
                    </span>
                    <span className="text-xs font-semibold text-white truncate max-w-[150px]">
                      {scene.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleMoveScene(index, -1)}
                      disabled={index === 0}
                      title="Move Scene Earlier"
                      className="p-1 text-[#9499A6] hover:text-white disabled:opacity-30 border border-white/10 rounded-sm"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveScene(index, 1)}
                      disabled={index === campaign.scenes.length - 1}
                      title="Move Scene Later"
                      className="p-1 text-[#9499A6] hover:text-white disabled:opacity-30 border border-white/10 rounded-sm"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleApprove(scene.id)}
                      className={`ml-1 px-2 py-1 text-[11px] font-mono rounded-sm border flex items-center gap-1 transition cursor-pointer ${
                        scene.approved
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                          : 'bg-[#090A0D] border-white/10 text-[#9499A6]'
                      }`}
                    >
                      <Check className="w-3 h-3" />
                      {scene.approved ? 'Approved' : 'Hold'}
                    </button>
                  </div>
                </div>

                {/* Keyframe Viewport */}
                <div className="relative aspect-video bg-[#090A0D] border-b border-white/10 overflow-hidden flex items-center justify-center">
                  {isGeneratingThis ? (
                    <div className="flex flex-col items-center gap-2 text-amber-400">
                      <Loader2 className="w-7 h-7 animate-spin" />
                      <span className="text-xs font-mono">
                        Synthesizing via gemini-3.1-flash-lite-image...
                      </span>
                    </div>
                  ) : scene.imageUrl ? (
                    <>
                      <img
                        src={scene.imageUrl}
                        alt={scene.title}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-2 left-2 flex items-center gap-1.5">
                        <span className="px-2 py-0.5 bg-black/75 backdrop-blur-xs border border-white/15 rounded-sm text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> {scene.imageModelUsed || 'gemini-3.1-flash-lite-image'}
                        </span>
                        {index === 0 && (
                          <span className="px-2 py-0.5 bg-amber-500/90 text-black font-mono text-[10px] font-semibold rounded-sm">
                            CONTINUITY ANCHOR
                          </span>
                        )}
                      </div>
                      {scene.videoUrl && (
                        <div className="absolute bottom-2 right-2">
                          <span className="px-2 py-0.5 bg-sky-500/90 text-black font-mono text-[10px] font-semibold rounded-sm flex items-center gap-1">
                            <Film className="w-3 h-3" /> MP4 Clip Ready
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-[#9499A6] p-4 text-center">
                      <ImageIcon className="w-7 h-7 opacity-40" />
                      <span className="text-xs font-mono">No storyboard frame generated yet</span>
                    </div>
                  )}
                </div>

                {/* Scene Controls & Prompt Editor */}
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-[#9499A6] mb-1">
                        Duration (s)
                      </label>
                      <input
                        type="number"
                        min={2}
                        max={10}
                        value={scene.durationSeconds}
                        onChange={(e) =>
                          handleUpdateField(scene.id, 'durationSeconds', Number(e.target.value))
                        }
                        className="w-full px-2 py-1.5 bg-[#090A0D] border border-white/10 rounded-sm font-mono text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-[#9499A6] mb-1">
                        Transition
                      </label>
                      <select
                        value={scene.transitionType}
                        onChange={(e) =>
                          handleUpdateField(
                            scene.id,
                            'transitionType',
                            e.target.value as TransitionType
                          )
                        }
                        className="w-full px-2 py-1.5 bg-[#090A0D] border border-white/10 rounded-sm font-mono text-xs text-white"
                      >
                        <option value="fade">fade</option>
                        <option value="dissolve">dissolve</option>
                        <option value="wipeleft">wipeleft</option>
                        <option value="smoothleft">smoothleft</option>
                        <option value="cut">cut</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-[#9499A6] mb-1">
                        Camera Move
                      </label>
                      <div className="px-2 py-1.5 bg-[#090A0D] border border-white/10 rounded-sm font-mono text-[11px] text-sky-400 truncate flex items-center gap-1">
                        <Camera className="w-3 h-3 shrink-0" />
                        <span className="truncate">{scene.cameraMovement}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono uppercase text-[#9499A6] mb-1 flex items-center gap-1">
                      <TypeIcon className="w-3 h-3 text-amber-400" /> Scene Lower-Third Overlay Copy
                    </label>
                    <input
                      type="text"
                      value={scene.overlayText || ''}
                      onChange={(e) => handleUpdateField(scene.id, 'overlayText', e.target.value)}
                      placeholder="Optional on-screen super text..."
                      className="w-full px-2.5 py-1.5 bg-[#090A0D] border border-white/10 rounded-sm text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono uppercase text-[#9499A6] mb-1">
                      Nano Banana 2 Lite Image Prompt
                    </label>
                    <textarea
                      rows={3}
                      value={promptValue}
                      onChange={(e) =>
                        setEditingPrompts({ ...editingPrompts, [scene.id]: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 bg-[#090A0D] border border-white/10 focus:border-amber-400 rounded-sm text-xs text-zinc-200 outline-none leading-relaxed"
                    />
                  </div>

                  {scene.error && (
                    <div className="p-2 bg-red-500/10 border border-red-500/30 rounded-sm text-[11px] text-red-300 font-mono">
                      {scene.error}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer Actions */}
              <div className="px-4 py-3 bg-[#171A21] border-t border-white/10 flex items-center justify-between gap-2">
                <button
                  type="button"
                  disabled={isGeneratingThis || generatingAllImages}
                  onClick={() => onGenerateSingleImage(scene.id, promptValue)}
                  className="flex-1 py-1.5 px-3 bg-[#090A0D] hover:bg-amber-500/15 border border-white/15 hover:border-amber-400/50 text-xs font-mono text-white hover:text-amber-300 rounded-sm flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingThis ? 'animate-spin' : ''}`} />
                  <span>{scene.imageUrl ? 'Regenerate Frame' : 'Generate Frame'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => onProceedToVideo(scene.id)}
                  className="py-1.5 px-3 bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-300 text-xs font-mono rounded-sm flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Film className="w-3.5 h-3.5" />
                  <span>Animate / Edit</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
