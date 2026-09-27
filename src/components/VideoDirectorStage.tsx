import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  Camera,
  Captions,
  Columns2,
  Film,
  History,
  Loader2,
  Play,
  RotateCcw,
  Send,
  Sparkles,
  Wand2,
} from 'lucide-react';
import {
  Campaign,
  SceneItem,
  SceneVersion,
  SubtitleCue,
  SubtitleStyle,
} from '../types/campaign';

interface Props {
  campaign: Campaign;
  selectedSceneId: string;
  onSelectScene: (sceneId: string) => void;
  generatingSceneVideoId: string | null;
  generatingAllVideos?: boolean;
  onGenerateOrEditVideo: (
    sceneId: string,
    options?: {
      instruction?: string;
      videoPrompt?: string;
      cameraMovement?: string;
      overlayText?: string;
      subtitleCues?: SubtitleCue[];
      subtitleStyle?: SubtitleStyle;
    }
  ) => Promise<void>;
  onGenerateAllVideos?: () => Promise<void>;
  onRestoreSceneVersion: (sceneId: string, version: SceneVersion) => Promise<void>;
  onProceedToScoreAndRender: () => void;
}

const DIRECTOR_EDIT_CHIPS = [
  'Add timed broadcast subtitles for this scene',
  'Add warm cinema gold subtitles with narrative voiceover captions',
  'Add realistic condensation droplets and slow-motion steam with an orbital pan right',
  'Shift to golden-hour volumetric light refraction with natural fluid ripple dynamics',
  'Extend macro depth-of-field bokeh and add floating atmospheric particles with slow push-in',
];

const SUBTITLE_STYLES: { id: SubtitleStyle; label: string }[] = [
  { id: 'broadcast', label: 'Broadcast Box' },
  { id: 'cinema_yellow', label: 'Cinema Gold' },
  { id: 'cyber_cyan', label: 'Cool Slate' },
  { id: 'minimal', label: 'Minimal Outline' },
];

const MONITOR_LUTS: { id: string; label: string; cssFilter: string }[] = [
  { id: 'none', label: 'Original Grade', cssFilter: 'none' },
  { id: 'champagne', label: 'Warm 35mm', cssFilter: 'sepia(0.18) contrast(1.06) brightness(1.02)' },
  { id: 'noir', label: 'Noir Silver', cssFilter: 'grayscale(0.92) contrast(1.18)' },
  { id: 'anamorphic', label: 'Anamorphic Contrast', cssFilter: 'contrast(1.12) saturate(1.12)' },
  { id: 'velvet', label: 'Soft Velvet', cssFilter: 'contrast(0.95) brightness(1.04) saturate(0.9)' },
];

export const VideoDirectorStage: React.FC<Props> = ({
  campaign,
  selectedSceneId,
  onSelectScene,
  generatingSceneVideoId,
  generatingAllVideos = false,
  onGenerateOrEditVideo,
  onGenerateAllVideos,
  onRestoreSceneVersion,
  onProceedToScoreAndRender,
}) => {
  const activeScene: SceneItem =
    campaign.scenes.find((s) => s.id === selectedSceneId) || campaign.scenes[0];

  const [editInstruction, setEditInstruction] = useState('');
  const [previewVersion, setPreviewVersion] = useState<SceneVersion | null>(null);
  const [compareSplit, setCompareSplit] = useState(false);
  const [monitorLut, setMonitorLut] = useState<string>('none');
  const [customCameraMove, setCustomCameraMove] = useState(activeScene?.cameraMovement || '');
  const [customSubtitleText, setCustomSubtitleText] = useState(activeScene?.overlayText || '');
  const [selectedSubtitleStyle, setSelectedSubtitleStyle] = useState<SubtitleStyle>(
    activeScene?.subtitleStyle || 'broadcast'
  );
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);

  React.useEffect(() => {
    setPreviewVersion(null);
    setCompareSplit(false);
    setCustomCameraMove(activeScene?.cameraMovement || '');
    setCustomSubtitleText(activeScene?.overlayText || '');
    setSelectedSubtitleStyle(activeScene?.subtitleStyle || 'broadcast');
    setVideoCurrentTime(0);
  }, [
    activeScene?.id,
    activeScene?.cameraMovement,
    activeScene?.overlayText,
    activeScene?.subtitleStyle,
  ]);

  if (!activeScene) return null;

  const isGeneratingThis =
    generatingSceneVideoId === activeScene.id || activeScene.status === 'generating_video';
  const displayedVideoUrl = previewVersion?.videoUrl || activeScene.videoUrl;
  const isDisplayedBurnedIn = previewVersion
    ? Boolean(previewVersion.subtitlesBurnedIn)
    : Boolean(activeScene.subtitlesBurnedIn);

  const activeCues: SubtitleCue[] =
    (previewVersion ? previewVersion.subtitleCues : activeScene.subtitleCues) ||
    (activeScene.overlayText
      ? [
          {
            startSeconds: 0,
            endSeconds: activeScene.durationSeconds || 6,
            text: activeScene.overlayText,
          },
        ]
      : []);

  const currentLiveCue =
    activeCues.find(
      (c) => videoCurrentTime >= c.startSeconds && videoCurrentTime <= c.endSeconds + 0.25
    ) || activeCues[0];

  const readyVideosCount = campaign.scenes.filter((s) => Boolean(s.videoUrl)).length;
  const latestPreviousTake =
    activeScene.versionHistory && activeScene.versionHistory.length > 0
      ? activeScene.versionHistory[activeScene.versionHistory.length - 1]
      : null;

  const activeCssFilter =
    MONITOR_LUTS.find((l) => l.id === monitorLut)?.cssFilter || 'none';

  const handleApplyConversationalEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editInstruction.trim()) return;
    const instructionToSend = editInstruction.trim();
    setEditInstruction('');
    setPreviewVersion(null);
    await onGenerateOrEditVideo(activeScene.id, {
      instruction: instructionToSend,
      cameraMovement: customCameraMove || activeScene.cameraMovement,
      subtitleStyle: selectedSubtitleStyle,
    });
  };

  const handleBurnDirectSubtitle = async () => {
    setPreviewVersion(null);
    await onGenerateOrEditVideo(activeScene.id, {
      overlayText: customSubtitleText.trim(),
      subtitleStyle: selectedSubtitleStyle,
      cameraMovement: customCameraMove || activeScene.cameraMovement,
    });
  };

  const handleAutoGenerateAiSubtitles = async () => {
    setPreviewVersion(null);
    await onGenerateOrEditVideo(activeScene.id, {
      instruction: `add timed ${
        selectedSubtitleStyle === 'cinema_yellow'
          ? 'cinema yellow '
          : selectedSubtitleStyle === 'cyber_cyan'
            ? 'cyber cyan '
            : ''
      }subtitles`,
      cameraMovement: customCameraMove || activeScene.cameraMovement,
      subtitleStyle: selectedSubtitleStyle,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-6"
    >
      {/* Top Studio Header */}
      <div className="glass-panel rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#9A9893]">
            <span className="text-[#E2B86B] font-medium">03. Motion &amp; Direction</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {readyVideosCount}/{campaign.scenes.length} Clips Synthesized
            </span>
            <span aria-hidden="true">·</span>
            <span>Conversational Multi-Turn Editing</span>
          </div>
          <h2 className="text-2xl font-semibold text-[#F5F3EF] font-display">
            Motion Synthesis &amp; Subtitle Director
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {onGenerateAllVideos && (
            <button
              type="button"
              onClick={onGenerateAllVideos}
              disabled={generatingAllVideos || Boolean(generatingSceneVideoId)}
              className="px-4 py-2.5 btn-glass rounded-xl text-xs font-medium flex items-center gap-2 cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              {generatingAllVideos ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#E2B86B]" />
                  <span>Synthesizing All Scenes...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-[#E2B86B]" />
                  <span>
                    {readyVideosCount === campaign.scenes.length
                      ? 'Regenerate All Clips'
                      : 'Animate All Storyboard Frames'}
                  </span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={onProceedToScoreAndRender}
            className="px-4 py-2.5 btn-champagne rounded-xl text-xs flex items-center gap-2 cursor-pointer whitespace-nowrap"
          >
            <span>Score &amp; Master Assembly</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Scene Timeline Selector Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {campaign.scenes.map((scene) => {
          const isSelected = scene.id === activeScene.id;
          const isBusy =
            generatingAllVideos ||
            generatingSceneVideoId === scene.id ||
            scene.status === 'generating_video';
          const hasSubs = Boolean(
            (scene.subtitleCues && scene.subtitleCues.length > 0) ||
              (scene.overlayText && scene.overlayText.trim().length > 0)
          );
          return (
            <button
              key={scene.id}
              type="button"
              onClick={() => onSelectScene(scene.id)}
              className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between gap-2.5 cursor-pointer ${
                isSelected
                  ? 'glass-panel border-[#E2B86B] ring-1 ring-[#E2B86B]/30'
                  : 'glass-subpanel border-white/[0.07]'
              }`}
            >
              <div className="flex items-center justify-between w-full text-xs">
                <span className="font-mono font-semibold text-[#E2B86B] tabular-nums">
                  0{scene.sceneNumber}
                </span>
                <div className="flex items-center gap-1.5 text-[11px] text-[#9A9893] font-mono tabular-nums">
                  {hasSubs && <span className="text-[#E2B86B]">CC</span>}
                  {hasSubs && <span aria-hidden="true">·</span>}
                  {isBusy ? (
                    <Loader2 className="w-3.5 h-3.5 text-[#E2B86B] animate-spin" />
                  ) : scene.videoUrl ? (
                    <span className="text-emerald-300">
                      v{(scene.versionHistory?.length || 0) + 1}
                    </span>
                  ) : (
                    <span>Still</span>
                  )}
                </div>
              </div>

              <div className="aspect-video w-full bg-black rounded-xl overflow-hidden border border-white/[0.08] relative">
                {scene.imageUrl ? (
                  <img
                    src={scene.imageUrl}
                    alt={scene.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[11px] text-[#9A9893]">
                    No Frame
                  </div>
                )}
              </div>

              <div className="truncate text-xs font-medium text-[#F5F3EF]">{scene.title}</div>
            </button>
          );
        })}
      </div>

      {/* Main Split Director Console */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left 7 Cols: Video Program Monitor, LUT Grade & Take History */}
        <div className="xl:col-span-7 glass-panel rounded-2xl overflow-hidden flex flex-col justify-between">
          <div>
            {/* Monitor Top Bar */}
            <div className="px-5 py-4 border-b border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-[#E2B86B] font-mono font-semibold tabular-nums">
                  0{activeScene.sceneNumber}
                </span>
                <span aria-hidden="true" className="text-white/20">·</span>
                <span className="text-sm font-medium text-[#F5F3EF]">{activeScene.title}</span>
                <span aria-hidden="true" className="text-white/20">·</span>
                <span className="text-[#9A9893]">{activeScene.cameraMovement}</span>
                <span aria-hidden="true" className="text-white/20">·</span>
                <span className="font-mono text-[#9A9893] tabular-nums">
                  {activeScene.durationSeconds}.0s
                </span>
              </div>

              <div className="flex items-center gap-2">
                {latestPreviousTake && activeScene.videoUrl && (
                  <button
                    type="button"
                    onClick={() => setCompareSplit(!compareSplit)}
                    className={`px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                      compareSplit
                        ? 'bg-[#E2B86B] text-black font-medium'
                        : 'btn-glass text-[#D6D3CD]'
                    }`}
                  >
                    <Columns2 className="w-3.5 h-3.5" />
                    <span>{compareSplit ? 'Exit Split Compare' : 'Compare Takes (A/B)'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Video Player OR Split A/B Comparison Viewport */}
            <div className="relative aspect-video bg-black flex items-center justify-center border-b border-white/[0.08] overflow-hidden">
              {isGeneratingThis || generatingAllVideos ? (
                <div className="w-full h-full generation-glow flex flex-col items-center justify-center gap-3 p-8 text-center">
                  <Loader2 className="w-8 h-8 text-[#E2B86B] animate-spin" />
                  <div className="text-base font-display text-[#F5F3EF]">
                    Synthesizing motion &amp; burning broadcast captions...
                  </div>
                  <p className="text-xs text-[#9A9893] max-w-md">
                    Your previous take is safely preserved in the non-destructive version history below.
                  </p>
                </div>
              ) : compareSplit && latestPreviousTake && activeScene.videoUrl ? (
                /* NEW FEATURE: Side-by-Side A/B Take Comparison */
                <div className="grid grid-cols-2 w-full h-full divide-x divide-white/15">
                  <div className="relative w-full h-full bg-black flex flex-col">
                    <div className="absolute top-3 left-3 z-10 px-2.5 py-1 bg-black/75 backdrop-blur-md border border-white/15 rounded-lg text-[11px] text-[#9A9893]">
                      Prior Take (v{latestPreviousTake.version})
                    </div>
                    <video
                      src={latestPreviousTake.videoUrl}
                      controls
                      autoPlay
                      loop
                      muted
                      style={{ filter: activeCssFilter }}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="relative w-full h-full bg-black flex flex-col">
                    <div className="absolute top-3 left-3 z-10 px-2.5 py-1 bg-black/75 backdrop-blur-md border border-[#E2B86B]/40 rounded-lg text-[11px] text-[#E2B86B]">
                      Current Take (v{(activeScene.versionHistory?.length || 0) + 1})
                    </div>
                    <video
                      src={activeScene.videoUrl}
                      controls
                      autoPlay
                      loop
                      style={{ filter: activeCssFilter }}
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>
              ) : displayedVideoUrl ? (
                <div className="relative w-full h-full">
                  <video
                    key={displayedVideoUrl}
                    src={displayedVideoUrl}
                    controls
                    autoPlay
                    loop
                    onTimeUpdate={(e) => setVideoCurrentTime(e.currentTarget.currentTime)}
                    style={{ filter: activeCssFilter }}
                    className="w-full h-full object-contain bg-black transition-all duration-200"
                  />
                  {!isDisplayedBurnedIn && currentLiveCue?.text && (
                    <div className="pointer-events-none absolute bottom-12 inset-x-6 flex justify-center">
                      <div
                        className={`px-4 py-1.5 rounded-xl border text-sm font-medium tracking-wide text-center shadow-lg backdrop-blur-md ${
                          selectedSubtitleStyle === 'cinema_yellow'
                            ? 'bg-black/75 text-[#E2B86B] border-[#E2B86B]/40'
                            : selectedSubtitleStyle === 'cyber_cyan'
                              ? 'bg-black/80 text-sky-200 border-sky-400/30'
                              : 'bg-black/80 text-white border-white/20'
                        }`}
                      >
                        {currentLiveCue.text}
                      </div>
                    </div>
                  )}
                </div>
              ) : activeScene.imageUrl ? (
                <div className="relative w-full h-full">
                  <img
                    src={activeScene.imageUrl}
                    alt={activeScene.title}
                    referrerPolicy="no-referrer"
                    style={{ filter: activeCssFilter }}
                    className="w-full h-full object-cover opacity-70"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/30 flex flex-col items-center justify-center gap-3.5 p-6 text-center">
                    <Film className="w-7 h-7 text-[#E2B86B]" />
                    <div className="text-lg font-display text-[#F5F3EF]">
                      1K Storyboard Keyframe Ready for Motion Synthesis
                    </div>
                    <button
                      type="button"
                      onClick={() => onGenerateOrEditVideo(activeScene.id)}
                      className="px-5 py-2.5 btn-champagne rounded-xl text-xs flex items-center gap-2 cursor-pointer whitespace-nowrap"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Synthesize Scene Motion</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-[#9A9893] p-8">
                  Generate a storyboard keyframe first or click &ldquo;Synthesize Clip&rdquo; on the right.
                </div>
              )}

              {previewVersion && !compareSplit && (
                <div className="absolute top-3 left-3 px-3 py-1.5 bg-black/80 backdrop-blur-md border border-[#E2B86B]/50 text-[#E2B86B] text-xs rounded-xl">
                  Previewing Take v{previewVersion.version} · Click &ldquo;Active Take&rdquo; below to return
                </div>
              )}
            </div>

            {/* Live Cinema LUT Filter Bar & Active Captions Summary */}
            <div className="p-5 space-y-4">
              {/* Optical Color Grade Preview Strip */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-[#9A9893]">Monitor Optical Look</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {MONITOR_LUTS.map((lut) => (
                    <button
                      key={lut.id}
                      type="button"
                      onClick={() => setMonitorLut(lut.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs transition cursor-pointer whitespace-nowrap ${
                        monitorLut === lut.id
                          ? 'bg-[#E2B86B]/20 border border-[#E2B86B] text-[#E2B86B] font-medium'
                          : 'btn-glass text-[#9A9893] hover:text-[#F5F3EF]'
                      }`}
                    >
                      {lut.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Active Timed Subtitles Strip */}
              <div className="glass-subpanel rounded-2xl p-4 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-[#F5F3EF] font-medium flex items-center gap-1.5">
                    <Captions className="w-3.5 h-3.5 text-[#E2B86B]" />
                    <span>
                      Scene Captions ({activeCues.length > 0 ? `${activeCues.length} Timed Cue${activeCues.length > 1 ? 's' : ''}` : 'None'})
                    </span>
                  </span>
                  <span className="text-[#9A9893]">
                    {isDisplayedBurnedIn
                      ? 'Burned into MP4 stream'
                      : activeCues.length > 0
                        ? 'Live overlay active'
                        : 'Add captions on the right'}
                  </span>
                </div>

                {activeCues.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {activeCues.map((cue, idx) => (
                      <div
                        key={idx}
                        className="px-3 py-2 bg-black/40 border border-white/[0.06] rounded-xl text-xs flex items-center gap-2.5"
                      >
                        <span className="text-[#E2B86B] font-mono shrink-0 tabular-nums">
                          {Number(cue.startSeconds).toFixed(1)}s–{Number(cue.endSeconds).toFixed(1)}s
                        </span>
                        <span className="text-[#F5F3EF] truncate" title={cue.text}>
                          &ldquo;{cue.text}&rdquo;
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {activeScene.directorNotes && (
                <div className="text-xs text-[#9A9893] px-1">
                  Latest Direction · <span className="text-[#D6D3CD]">{activeScene.directorNotes}</span>
                </div>
              )}
            </div>
          </div>

          {/* Non-Destructive Version History Strip */}
          <div className="px-5 py-4 bg-white/[0.015] border-t border-white/[0.07] space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#F5F3EF] font-medium flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-[#E2B86B]" />
                <span>
                  Take History ({(activeScene.versionHistory?.length || 0) + (activeScene.videoUrl ? 1 : 0)} Takes)
                </span>
              </span>
              <span className="text-[#9A9893]">Non-destructive scene rollback</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {activeScene.versionHistory?.map((ver) => {
                const isPreviewing = previewVersion?.version === ver.version;
                return (
                  <div
                    key={ver.version}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs transition ${
                      isPreviewing
                        ? 'bg-[#E2B86B]/20 border-[#E2B86B] text-[#E2B86B]'
                        : 'glass-input text-[#D6D3CD]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setCompareSplit(false);
                        setPreviewVersion(ver);
                      }}
                      className="hover:text-white cursor-pointer flex items-center gap-1.5"
                    >
                      <span className="font-mono font-semibold tabular-nums">v{ver.version}</span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate max-w-[150px]">{ver.instruction}</span>
                    </button>
                    <button
                      type="button"
                      title="Restore this take as active scene clip"
                      onClick={() => {
                        setPreviewVersion(null);
                        onRestoreSceneVersion(activeScene.id, ver);
                      }}
                      className="ml-1 p-1 hover:bg-white/10 rounded-lg text-[#E2B86B] cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}

              {activeScene.videoUrl && (
                <button
                  type="button"
                  onClick={() => {
                    setCompareSplit(false);
                    setPreviewVersion(null);
                  }}
                  className={`px-3 py-1.5 rounded-xl border text-xs cursor-pointer transition whitespace-nowrap ${
                    !previewVersion && !compareSplit
                      ? 'bg-[#E2B86B]/20 border-[#E2B86B] text-[#E2B86B] font-medium'
                      : 'glass-input text-[#9A9893] hover:text-[#F5F3EF]'
                  }`}
                >
                  Active Take (v{(activeScene.versionHistory?.length || 0) + 1})
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right 5 Cols: Conversational Direction, Subtitles & Camera Controls */}
        <div className="xl:col-span-5 glass-panel rounded-2xl p-6 space-y-6">
          <div className="border-b border-white/[0.08] pb-4">
            <div className="text-xs text-[#E2B86B] font-medium">Director&apos;s Console</div>
            <h3 className="text-2xl font-semibold text-[#F5F3EF] font-display mt-0.5">
              Direct Scene 0{activeScene.sceneNumber}
            </h3>
          </div>

          {/* Subtitles & Captions Studio Box */}
          <div className="glass-subpanel rounded-2xl p-4 space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-[#F5F3EF]">
                On-Screen Subtitles &amp; Captions
              </span>
              <button
                type="button"
                disabled={isGeneratingThis || generatingAllVideos}
                onClick={handleAutoGenerateAiSubtitles}
                className="px-3 py-1 btn-glass rounded-lg text-xs text-[#E2B86B] flex items-center gap-1.5 cursor-pointer disabled:opacity-40 whitespace-nowrap"
              >
                <Sparkles className="w-3 h-3" />
                <span>Auto-Time Captions</span>
              </button>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={customSubtitleText}
                onChange={(e) => setCustomSubtitleText(e.target.value)}
                placeholder="Enter caption text to burn into video..."
                className="flex-1 px-3 py-2 glass-input rounded-xl text-xs"
              />
              <button
                type="button"
                disabled={isGeneratingThis || generatingAllVideos}
                onClick={handleBurnDirectSubtitle}
                className="px-3.5 py-2 btn-champagne rounded-xl text-xs cursor-pointer disabled:opacity-40 whitespace-nowrap"
              >
                Burn Caption
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {SUBTITLE_STYLES.map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setSelectedSubtitleStyle(st.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs transition cursor-pointer whitespace-nowrap ${
                    selectedSubtitleStyle === st.id
                      ? 'bg-[#E2B86B]/20 border border-[#E2B86B] text-[#E2B86B] font-medium'
                      : 'btn-glass text-[#9A9893] hover:text-[#F5F3EF]'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          {/* Conversational Direction Form */}
          <form onSubmit={handleApplyConversationalEdit} className="space-y-3">
            <div>
              <label className="block text-xs text-[#9A9893] mb-1.5">
                Conversational Motion &amp; Lighting Instruction
              </label>
              <textarea
                rows={3}
                value={editInstruction}
                onChange={(e) => setEditInstruction(e.target.value)}
                placeholder='e.g., "Slow orbital pan right with warm golden rim light and subtle steam"...'
                className="w-full px-3.5 py-2.5 glass-input rounded-xl text-xs leading-relaxed"
              />
            </div>

            <button
              type="submit"
              disabled={isGeneratingThis || generatingAllVideos || !editInstruction.trim()}
              className="w-full py-3 px-4 btn-champagne rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 whitespace-nowrap"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Apply Direction to Scene 0{activeScene.sceneNumber}</span>
            </button>
          </form>

          {/* Directorial Suggestions */}
          <div className="space-y-2">
            <div className="text-xs text-[#9A9893]">Directorial Suggestions</div>
            <div className="flex flex-col gap-1.5">
              {DIRECTOR_EDIT_CHIPS.map((chip, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setEditInstruction(chip)}
                  className="px-3.5 py-2 glass-subpanel rounded-xl text-left text-xs text-[#D6D3CD] hover:text-[#F5F3EF] cursor-pointer"
                >
                  &ldquo;{chip}&rdquo;
                </button>
              ))}
            </div>
          </div>

          {/* Base Camera & Motion Spec */}
          <div className="glass-subpanel rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#F5F3EF] font-medium">Camera Blocking &amp; Base Prompt</span>
              <Camera className="w-3.5 h-3.5 text-[#E2B86B]" />
            </div>

            <input
              type="text"
              value={customCameraMove}
              onChange={(e) => setCustomCameraMove(e.target.value)}
              className="w-full px-3 py-2 glass-input rounded-xl text-xs"
            />

            <p className="text-xs text-[#9A9893] leading-relaxed">{activeScene.videoPrompt}</p>

            <button
              type="button"
              disabled={isGeneratingThis || generatingAllVideos}
              onClick={() =>
                onGenerateOrEditVideo(activeScene.id, {
                  cameraMovement: customCameraMove || activeScene.cameraMovement,
                  subtitleStyle: selectedSubtitleStyle,
                })
              }
              className="w-full py-2.5 px-4 btn-glass rounded-xl text-xs font-medium flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              <Wand2 className="w-3.5 h-3.5 text-[#E2B86B]" />
              <span>
                {activeScene.videoUrl ? 'Regenerate Base Scene Clip' : 'Synthesize Initial Clip'}
              </span>
            </button>
          </div>

          {activeScene.error && (
            <div className="p-3 bg-red-500/10 border border-red-500/25 rounded-xl text-xs text-red-300">
              {activeScene.error}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
