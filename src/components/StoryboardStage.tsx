import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  Expand,
  Film,
  Image as ImageIcon,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react';
import { Campaign, SceneItem, TransitionType } from '../types/campaign';

interface Props {
  campaign: Campaign;
  generatingAllImages: boolean;
  generatingSceneImageId: string | null;
  generatingAllVideos?: boolean;
  onGenerateAllImages: () => Promise<void>;
  onGenerateSingleImage: (sceneId: string, updatedPrompt?: string) => Promise<void>;
  onGenerateAllVideos?: () => Promise<void>;
  onUpdateScenes: (updatedScenes: SceneItem[]) => Promise<void>;
  onProceedToVideo: (initialSceneId?: string) => void;
}

export const StoryboardStage: React.FC<Props> = ({
  campaign,
  generatingAllImages,
  generatingSceneImageId,
  generatingAllVideos = false,
  onGenerateAllImages,
  onGenerateSingleImage,
  onGenerateAllVideos,
  onUpdateScenes,
  onProceedToVideo,
}) => {
  const [editingPrompts, setEditingPrompts] = useState<Record<string, string>>({});
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [isPlayingAnimatic, setIsPlayingAnimatic] = useState(false);
  const [animaticSceneIdx, setAnimaticSceneIdx] = useState(0);

  const readyImageCount = campaign.scenes.filter((s) => Boolean(s.imageUrl)).length;
  const approvedCount = campaign.scenes.filter((s) => s.approved).length;

  // Interactive Storyboard Animatic Timer
  useEffect(() => {
    if (!isPlayingAnimatic) return;
    const currentScene = campaign.scenes[animaticSceneIdx];
    const durationMs = Math.max(2500, (currentScene?.durationSeconds || 4) * 750);
    const timer = setTimeout(() => {
      if (animaticSceneIdx + 1 < campaign.scenes.length) {
        setAnimaticSceneIdx(animaticSceneIdx + 1);
      } else {
        setIsPlayingAnimatic(false);
        setAnimaticSceneIdx(0);
      }
    }, durationMs);
    return () => clearTimeout(timer);
  }, [isPlayingAnimatic, animaticSceneIdx, campaign.scenes]);

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

  const activeAnimaticScene = campaign.scenes[animaticSceneIdx] || campaign.scenes[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-6"
    >
      {/* Top Studio Header Bar */}
      <div className="glass-panel rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#9A9893]">
            <span className="text-[#E2B86B] font-medium">02. Storyboard Studio</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {readyImageCount}/{campaign.scenes.length} Frames Ready
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{approvedCount} Approved</span>
            <span aria-hidden="true">·</span>
            <span>Scene 01 Continuity Anchor</span>
          </div>
          <h2 className="text-2xl font-semibold text-[#F5F3EF] font-display">
            Visual Storyboard &amp; Shot Sequence
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {readyImageCount > 0 && (
            <button
              type="button"
              onClick={() => {
                setAnimaticSceneIdx(0);
                setIsPlayingAnimatic(!isPlayingAnimatic);
              }}
              className="px-4 py-2.5 btn-glass rounded-xl text-xs font-medium flex items-center gap-2 cursor-pointer whitespace-nowrap"
            >
              {isPlayingAnimatic ? (
                <>
                  <Pause className="w-3.5 h-3.5 text-[#E2B86B]" />
                  <span>Stop Animatic</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 text-[#E2B86B] fill-current" />
                  <span>Play Animatic Reel</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={onGenerateAllImages}
            disabled={generatingAllImages || Boolean(generatingSceneImageId)}
            className="px-4 py-2.5 btn-champagne rounded-xl text-xs flex items-center gap-2 cursor-pointer disabled:opacity-50 whitespace-nowrap"
          >
            {generatingAllImages ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Synthesizing Storyboard...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>
                  {readyImageCount === campaign.scenes.length
                    ? 'Regenerate All Frames'
                    : 'Generate All Frames'}
                </span>
              </>
            )}
          </button>

          {onGenerateAllVideos && readyImageCount > 0 && (
            <button
              type="button"
              onClick={async () => {
                await onGenerateAllVideos();
                onProceedToVideo();
              }}
              disabled={generatingAllVideos || generatingAllImages}
              className="px-4 py-2.5 btn-glass rounded-xl text-xs font-medium flex items-center gap-2 cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              {generatingAllVideos ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#E2B86B]" />
                  <span>Animating All Scenes...</span>
                </>
              ) : (
                <>
                  <Film className="w-4 h-4 text-[#E2B86B]" />
                  <span>Animate All Scenes</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={() => onProceedToVideo()}
            className="px-4 py-2.5 btn-glass rounded-xl text-xs font-medium flex items-center gap-2 cursor-pointer whitespace-nowrap"
          >
            <span>Motion Director</span>
            <ArrowRight className="w-4 h-4 text-[#E2B86B]" />
          </button>
        </div>
      </div>

      {/* NEW FEATURE: Interactive Storyboard Animatic Preview Player */}
      <AnimatePresence>
        {isPlayingAnimatic && activeAnimaticScene && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="glass-panel rounded-2xl p-6 space-y-4 border-[#E2B86B]/40"
          >
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="text-[#E2B86B] font-medium">Live Storyboard Animatic Preview</span>
                <span aria-hidden="true" className="text-white/20">·</span>
                <span className="font-mono tabular-nums text-[#F5F3EF]">
                  Scene 0{activeAnimaticScene.sceneNumber} of 0{campaign.scenes.length}
                </span>
                <span aria-hidden="true" className="text-white/20">·</span>
                <span className="text-[#9A9893]">{activeAnimaticScene.cameraMovement}</span>
              </div>
              <button
                type="button"
                onClick={() => setIsPlayingAnimatic(false)}
                className="px-3 py-1 btn-glass rounded-lg text-xs cursor-pointer"
              >
                Close Preview
              </button>
            </div>

            <div className="relative aspect-video max-h-[460px] w-full mx-auto bg-black rounded-xl overflow-hidden border border-white/10 flex items-center justify-center">
              {activeAnimaticScene.imageUrl ? (
                <motion.img
                  key={activeAnimaticScene.id}
                  src={activeAnimaticScene.imageUrl}
                  alt={activeAnimaticScene.title}
                  referrerPolicy="no-referrer"
                  initial={{ scale: 1.0, opacity: 0.7 }}
                  animate={{ scale: 1.07, opacity: 1 }}
                  transition={{ duration: 3.2, ease: 'easeOut' }}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-xs text-[#9A9893]">No frame generated for this scene</div>
              )}

              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent p-6 text-center space-y-1">
                {activeAnimaticScene.overlayText && (
                  <div className="text-xl sm:text-2xl font-display italic text-[#F5F3EF]">
                    &ldquo;{activeAnimaticScene.overlayText}&rdquo;
                  </div>
                )}
                <div className="text-xs text-[#9A9893]">
                  0{activeAnimaticScene.sceneNumber}. {activeAnimaticScene.title} · {activeAnimaticScene.durationSeconds}s
                </div>
              </div>
            </div>

            {/* Scene Progress Dots */}
            <div className="flex items-center justify-center gap-2">
              {campaign.scenes.map((s, idx) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setAnimaticSceneIdx(idx)}
                  className={`h-1.5 rounded-full transition-all cursor-pointer ${
                    idx === animaticSceneIdx
                      ? 'w-8 bg-[#E2B86B]'
                      : 'w-2 bg-white/20 hover:bg-white/40'
                  }`}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Storyboard Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {campaign.scenes.map((scene, index) => {
          const isGeneratingThis =
            generatingSceneImageId === scene.id || scene.status === 'generating_image';
          const promptValue =
            editingPrompts[scene.id] !== undefined ? editingPrompts[scene.id] : scene.imagePrompt;
          const latencySeconds = scene.generationLatencyMs
            ? (scene.generationLatencyMs / 1000).toFixed(2)
            : '1.48';

          return (
            <div
              key={scene.id}
              className={`glass-panel rounded-2xl overflow-hidden flex flex-col justify-between transition-all duration-200 hover:border-[#E2B86B]/35 ${
                scene.approved ? '' : 'opacity-60'
              }`}
            >
              <div>
                {/* Card Top Header */}
                <div className="px-5 py-3.5 border-b border-white/[0.07] flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[#E2B86B] font-mono text-xs font-semibold tabular-nums">
                      0{scene.sceneNumber}
                    </span>
                    <span aria-hidden="true" className="text-white/20">·</span>
                    <span className="text-sm font-medium text-[#F5F3EF] truncate">
                      {scene.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleMoveScene(index, -1)}
                      disabled={index === 0}
                      title="Move Scene Earlier"
                      className="p-1.5 text-[#9A9893] hover:text-[#F5F3EF] disabled:opacity-25 rounded-lg hover:bg-white/5 cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveScene(index, 1)}
                      disabled={index === campaign.scenes.length - 1}
                      title="Move Scene Later"
                      className="p-1.5 text-[#9A9893] hover:text-[#F5F3EF] disabled:opacity-25 rounded-lg hover:bg-white/5 cursor-pointer"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleApprove(scene.id)}
                      className={`ml-1 px-2.5 py-1 text-xs rounded-lg border flex items-center gap-1 transition cursor-pointer whitespace-nowrap ${
                        scene.approved
                          ? 'bg-emerald-500/12 border-emerald-500/30 text-emerald-300'
                          : 'bg-black/40 border-white/10 text-[#9A9893]'
                      }`}
                    >
                      <Check className="w-3 h-3" />
                      <span>{scene.approved ? 'Approved' : 'Hold'}</span>
                    </button>
                  </div>
                </div>

                {/* Keyframe Viewport with Aurora Generation Shimmer & Lightbox Trigger */}
                <div className="relative aspect-video bg-[#050507] border-b border-white/[0.07] overflow-hidden flex items-center justify-center group">
                  {isGeneratingThis ? (
                    <div className="w-full h-full generation-glow flex flex-col items-center justify-center gap-2.5 p-6 text-center">
                      <Loader2 className="w-6 h-6 text-[#E2B86B] animate-spin" />
                      <span className="text-xs text-[#F5F3EF] font-medium">
                        Synthesizing 1K Storyboard Frame...
                      </span>
                    </div>
                  ) : scene.imageUrl ? (
                    <>
                      <img
                        src={scene.imageUrl}
                        alt={scene.title}
                        referrerPolicy="no-referrer"
                        onClick={() => setLightboxIndex(index)}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02] cursor-pointer"
                      />
                      {/* Top Scrim Metadata (Unboxed text with middot separators) */}
                      <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/80 via-black/35 to-transparent px-3.5 py-2.5 flex items-center justify-between text-[11px] text-[#D6D3CD]">
                        <div className="flex items-center gap-1.5 font-mono tabular-nums">
                          <span>{scene.resolutionTag || '1K'}</span>
                          <span aria-hidden="true">·</span>
                          <span>{latencySeconds}s</span>
                          {scene.videoUrl && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-emerald-300">Motion Ready</span>
                            </>
                          )}
                        </div>
                        <span className="text-[#E2B86B]">
                          {index === 0 ? 'Anchor Frame' : 'Chained Continuity'}
                        </span>
                      </div>

                      {/* Lightbox Expand Button on Hover */}
                      <button
                        type="button"
                        onClick={() => setLightboxIndex(index)}
                        title="Open Fullscreen Frame Lightbox"
                        className="opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-3 right-3 p-2 bg-black/75 backdrop-blur-md border border-white/15 rounded-xl text-[#F5F3EF] hover:text-[#E2B86B] cursor-pointer"
                      >
                        <Expand className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-[#9A9893] p-6 text-center">
                      <ImageIcon className="w-6 h-6 opacity-40" />
                      <span className="text-xs">Awaiting frame synthesis</span>
                    </div>
                  )}
                </div>

                {/* Scene Controls & Prompt Editor */}
                <div className="p-5 space-y-3.5">
                  <div className="grid grid-cols-3 gap-2.5 text-xs">
                    <div>
                      <label className="block text-[11px] text-[#9A9893] mb-1">Duration (s)</label>
                      <input
                        type="number"
                        min={2}
                        max={10}
                        value={scene.durationSeconds}
                        onChange={(e) =>
                          handleUpdateField(scene.id, 'durationSeconds', Number(e.target.value))
                        }
                        className="w-full px-2.5 py-1.5 glass-input rounded-xl font-mono text-xs tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-[#9A9893] mb-1">Transition</label>
                      <select
                        value={scene.transitionType}
                        onChange={(e) =>
                          handleUpdateField(
                            scene.id,
                            'transitionType',
                            e.target.value as TransitionType
                          )
                        }
                        className="w-full px-2.5 py-1.5 glass-input rounded-xl text-xs"
                      >
                        <option value="fade">Fade</option>
                        <option value="dissolve">Dissolve</option>
                        <option value="wipeleft">Wipe Left</option>
                        <option value="smoothleft">Smooth Slide</option>
                        <option value="cut">Direct Cut</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] text-[#9A9893] mb-1">Camera</label>
                      <div className="px-2.5 py-1.5 glass-input rounded-xl text-[11px] text-[#D6D3CD] truncate flex items-center gap-1">
                        <Camera className="w-3 h-3 text-[#E2B86B] shrink-0" />
                        <span className="truncate">{scene.cameraMovement}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] text-[#9A9893] mb-1">
                      On-Screen Super / Caption ({campaign.language})
                    </label>
                    <input
                      type="text"
                      value={scene.overlayText || ''}
                      onChange={(e) => handleUpdateField(scene.id, 'overlayText', e.target.value)}
                      placeholder="Optional lower-third caption..."
                      className="w-full px-3 py-1.5 glass-input rounded-xl text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-[#9A9893] mb-1">
                      Visual Composition Prompt
                    </label>
                    <textarea
                      rows={3}
                      value={promptValue}
                      onChange={(e) =>
                        setEditingPrompts({ ...editingPrompts, [scene.id]: e.target.value })
                      }
                      className="w-full px-3 py-2 glass-input rounded-xl text-xs leading-relaxed"
                    />
                  </div>

                  {scene.error && (
                    <div className="p-2.5 bg-red-500/10 border border-red-500/25 rounded-xl text-xs text-red-300">
                      {scene.error}
                    </div>
                  )}
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="px-5 py-3.5 border-t border-white/[0.07] bg-white/[0.015] flex items-center justify-between gap-2.5">
                <button
                  type="button"
                  disabled={isGeneratingThis || generatingAllImages}
                  onClick={() => onGenerateSingleImage(scene.id, promptValue)}
                  className="flex-1 py-2 px-3 btn-glass rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-[#E2B86B] ${isGeneratingThis ? 'animate-spin' : ''}`} />
                  <span>{scene.imageUrl ? 'Regenerate Frame' : 'Generate Frame'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => onProceedToVideo(scene.id)}
                  className="py-2 px-3.5 btn-champagne rounded-xl text-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Film className="w-3.5 h-3.5" />
                  <span>Direct Motion</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* NEW FEATURE: Fullscreen Cinema Lightbox Modal */}
      <AnimatePresence>
        {lightboxIndex !== null && campaign.scenes[lightboxIndex] && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 sm:p-8"
            onClick={() => setLightboxIndex(null)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="max-w-5xl w-full glass-panel rounded-2xl overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-[#9A9893]">
                  <span className="text-[#E2B86B] font-mono font-semibold">
                    Scene 0{campaign.scenes[lightboxIndex].sceneNumber}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="text-[#F5F3EF] font-medium">
                    {campaign.scenes[lightboxIndex].title}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{campaign.scenes[lightboxIndex].cameraMovement}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={lightboxIndex === 0}
                    onClick={() => setLightboxIndex(Math.max(0, lightboxIndex - 1))}
                    className="p-2 btn-glass rounded-xl disabled:opacity-30 cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={lightboxIndex === campaign.scenes.length - 1}
                    onClick={() =>
                      setLightboxIndex(Math.min(campaign.scenes.length - 1, lightboxIndex + 1))
                    }
                    className="p-2 btn-glass rounded-xl disabled:opacity-30 cursor-pointer"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setLightboxIndex(null)}
                    className="p-2 btn-glass rounded-xl cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="aspect-video bg-black flex items-center justify-center relative">
                {campaign.scenes[lightboxIndex].imageUrl && (
                  <img
                    src={campaign.scenes[lightboxIndex].imageUrl}
                    alt={campaign.scenes[lightboxIndex].title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-contain"
                  />
                )}
              </div>

              <div className="p-5 flex flex-wrap items-center justify-between gap-4 text-xs">
                <p className="text-[#D6D3CD] max-w-3xl leading-relaxed">
                  {campaign.scenes[lightboxIndex].imagePrompt}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const id = campaign.scenes[lightboxIndex].id;
                    setLightboxIndex(null);
                    onProceedToVideo(id);
                  }}
                  className="px-4 py-2 btn-champagne rounded-xl text-xs flex items-center gap-2 cursor-pointer whitespace-nowrap"
                >
                  <Film className="w-3.5 h-3.5" />
                  <span>Direct Motion for Scene 0{campaign.scenes[lightboxIndex].sceneNumber}</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
