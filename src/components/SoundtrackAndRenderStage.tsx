import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  CheckCircle2,
  Circle,
  Download,
  Film,
  Globe2,
  Loader2,
  Maximize2,
  Minimize2,
  Music,
  Sliders,
  Sparkles,
  Terminal,
  Volume2,
} from 'lucide-react';
import { Campaign, RenderProgressEvent, RenderStageKey } from '../types/campaign';

interface Props {
  campaign: Campaign;
  isGeneratingAudio: boolean;
  isRenderingFinal: boolean;
  isLocalizing?: boolean;
  onGenerateSoundtrack: (mood: string, prompt: string) => Promise<void>;
  onAssembleFinalVideo: (includeInFinalMix: boolean, volumeLevel: number) => Promise<void>;
  onLocalizeCampaign?: (locale: string, language: string) => Promise<void>;
}

const MUSICAL_MOODS = [
  'Uplifting Commercial Electronic',
  'Warm Acoustic & Tactile Lo-Fi',
  'Cinematic Anamorphic Orchestral',
  'High-Energy Percussion & Synth',
  'Minimalist Luxury Ambient',
];

const LOCALIZATION_MARKETS = [
  { locale: 'India (National)', language: 'Hindi', label: 'Hindi · India' },
  { locale: 'Hyderabad / Telangana', language: 'Telugu', label: 'Telugu · Hyderabad' },
  { locale: 'Tamil Nadu', language: 'Tamil', label: 'Tamil · Chennai' },
  { locale: 'Japan (Tokyo)', language: 'Japanese', label: 'Japanese · Tokyo' },
  { locale: 'UAE & MENA', language: 'Arabic', label: 'Arabic · Dubai' },
  { locale: 'Western Europe', language: 'French', label: 'French · Paris' },
];

const RENDER_PIPELINE_STAGES: Array<{
  key: RenderStageKey;
  step: string;
  label: string;
}> = [
  { key: 'init', step: '01', label: 'Workspace Init' },
  { key: 'scene_prep', step: '02', label: 'Scene Normalization' },
  { key: 'concat', step: '03', label: 'Shot Assembly' },
  { key: 'audio_mix', step: '04', label: 'Lyria Audio Mix' },
  { key: 'validate', step: '05', label: 'Stream Verification' },
];

const STAGE_ORDER: Record<RenderStageKey, number> = {
  init: 1,
  scene_prep: 2,
  concat: 3,
  audio_mix: 4,
  validate: 5,
  completed: 6,
  failed: 0,
};

export const SoundtrackAndRenderStage: React.FC<Props> = ({
  campaign,
  isGeneratingAudio,
  isRenderingFinal,
  isLocalizing = false,
  onGenerateSoundtrack,
  onAssembleFinalVideo,
  onLocalizeCampaign,
}) => {
  const [mood, setMood] = useState(campaign.soundtrack?.mood || MUSICAL_MOODS[0]);
  const [prompt, setPrompt] = useState(
    campaign.soundtrack?.prompt ||
      `Instrumental ${campaign.creativeStyle} commercial score for ${campaign.brandName}`
  );
  const [includeAudio, setIncludeAudio] = useState(
    campaign.soundtrack?.includeInFinalMix !== false
  );
  const [volumeLevel, setVolumeLevel] = useState(campaign.soundtrack?.volumeLevel || 0.85);
  const [showFfmpegLogs, setShowFfmpegLogs] = useState(false);
  const [renderProgress, setRenderProgress] = useState<RenderProgressEvent | null>(null);
  const [selectedMarket, setSelectedMarket] = useState(LOCALIZATION_MARKETS[0]);
  const [theatreMode, setTheatreMode] = useState(false);

  useEffect(() => {
    if (campaign.soundtrack?.mood) setMood(campaign.soundtrack.mood);
    if (campaign.soundtrack?.prompt) setPrompt(campaign.soundtrack.prompt);
  }, [campaign.soundtrack?.mood, campaign.soundtrack?.prompt]);

  // Subscribe to real-time FFmpeg rendering progress via SSE + automatic polling fallback
  useEffect(() => {
    if (!isRenderingFinal) {
      return;
    }

    const approvedCount = campaign.scenes.filter((s) => s.approved !== false).length || 3;
    setRenderProgress({
      campaignId: campaign.id,
      jobId: 'starting',
      stageKey: 'init',
      stageLabel: 'Stage 01 · Workspace Initialization',
      progress: 4,
      sceneIndex: 0,
      totalScenes: approvedCount,
      message: `Starting cinema render pipeline (${campaign.aspectRatio} @ 24fps)...`,
      timestamp: new Date().toISOString(),
    });

    let isMounted = true;
    let eventSource: EventSource | null = null;

    try {
      eventSource = new EventSource(`/api/campaigns/${campaign.id}/render-progress/stream`);
      eventSource.onmessage = (evt) => {
        if (!isMounted) return;
        try {
          const parsed = JSON.parse(evt.data) as RenderProgressEvent;
          if (parsed && typeof parsed.progress === 'number') {
            setRenderProgress(parsed);
          }
        } catch {
          // ignore
        }
      };
    } catch {
      // polling fallback handles updates
    }

    const pollInterval = setInterval(async () => {
      if (!isMounted) return;
      try {
        const res = await fetch(`/api/campaigns/${campaign.id}/render-progress`);
        if (res.ok) {
          const data = await res.json();
          if (data?.progress && typeof data.progress.progress === 'number') {
            setRenderProgress((prev) => {
              if (
                !prev ||
                data.progress.progress >= prev.progress ||
                data.progress.stageKey !== prev.stageKey
              ) {
                return data.progress;
              }
              return prev;
            });
          }
        }
      } catch {
        // ignore
      }
    }, 800);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [isRenderingFinal, campaign.id, campaign.aspectRatio, campaign.scenes]);

  const handleSoundtrackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onGenerateSoundtrack(mood, prompt);
  };

  const approvedScenes = campaign.scenes.filter((s) => s.approved !== false);
  const validation = campaign.finalRender?.validationReport;

  const activeStageOrder = renderProgress ? STAGE_ORDER[renderProgress.stageKey] || 1 : 1;
  const displayPct = renderProgress ? Math.min(100, Math.max(2, renderProgress.progress)) : 5;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start"
    >
      {/* Left 5 Cols: Adaptive Soundtrack Scoring + Regional Localization */}
      {!theatreMode && (
        <div className="xl:col-span-5 glass-panel rounded-2xl p-6 space-y-6">
          <div className="border-b border-white/[0.08] pb-4">
            <div className="text-xs text-[#E2B86B] font-medium">04. Adaptive Musical Score</div>
            <h2 className="text-2xl font-semibold text-[#F5F3EF] font-display mt-0.5">
              Lyria 3.5 Scoring Deck
            </h2>
            <p className="text-xs text-[#9A9893] mt-1">
              Compose a bespoke instrumental soundtrack tailored to your visual pacing and brand mood.
            </p>
          </div>

          <form onSubmit={handleSoundtrackSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-[#9A9893] mb-1.5">Musical Mood</label>
              <div className="flex flex-wrap gap-1.5">
                {MUSICAL_MOODS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMood(m)}
                    className={`px-3 py-1.5 rounded-xl text-xs transition cursor-pointer whitespace-nowrap ${
                      mood === m
                        ? 'bg-[#E2B86B]/20 border border-[#E2B86B] text-[#E2B86B] font-medium'
                        : 'btn-glass text-[#9A9893] hover:text-[#F5F3EF]'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs text-[#9A9893] mb-1.5">
                Instrumentation &amp; Acoustic Direction
              </label>
              <textarea
                rows={3}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full px-3.5 py-2.5 glass-input rounded-xl text-xs leading-relaxed"
              />
            </div>

            <button
              type="submit"
              disabled={isGeneratingAudio}
              className="w-full py-3 px-4 btn-champagne rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              {isGeneratingAudio ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Composing Score via Lyria 3.5...</span>
                </>
              ) : (
                <>
                  <Music className="w-4 h-4" />
                  <span>
                    {campaign.soundtrack?.audioUrl
                      ? 'Regenerate Musical Score'
                      : 'Compose Custom Score'}
                  </span>
                </>
              )}
            </button>
          </form>

          {/* Audio Player & Mix Controls */}
          {campaign.soundtrack?.audioUrl && (
            <div className="glass-subpanel rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#F5F3EF] font-medium flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-[#E2B86B]" />
                  <span>Master Score</span>
                </span>
                <label className="flex items-center gap-2 text-xs text-[#D6D3CD] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeAudio}
                    onChange={(e) => setIncludeAudio(e.target.checked)}
                    className="accent-[#E2B86B]"
                  />
                  Include in Final Mix
                </label>
              </div>

              <audio
                key={campaign.soundtrack.audioUrl}
                src={campaign.soundtrack.audioUrl}
                controls
                className="w-full h-10"
              />

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-[#9A9893] tabular-nums">
                  <span className="flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-[#E2B86B]" /> Gain Envelope
                  </span>
                  <span className="font-mono text-[#F5F3EF]">{Math.round(volumeLevel * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0.1}
                  max={1.0}
                  step={0.05}
                  value={volumeLevel}
                  onChange={(e) => setVolumeLevel(parseFloat(e.target.value))}
                  className="w-full accent-[#E2B86B]"
                />
              </div>

              {campaign.soundtrack.generatedLyricsOrNotes && (
                <div className="p-3 bg-black/35 border border-white/[0.05] rounded-xl text-xs text-[#9A9893] max-h-24 overflow-y-auto leading-relaxed">
                  {campaign.soundtrack.generatedLyricsOrNotes}
                </div>
              )}
            </div>
          )}

          {/* Commercial Voiceover Narration Track (Gemini TTS) */}
          {(campaign.voiceover?.audioUrl || campaign.plan?.voiceoverScript) && (
            <div className="glass-subpanel rounded-2xl p-5 space-y-3.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#F5F3EF] font-medium flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#E2B86B]" />
                  <span>Voiceover Narration (Gemini TTS · {campaign.voiceover?.voiceName || 'Kore'})</span>
                </span>
                <span className="text-emerald-400 font-mono text-[11px]">Dual-Track Mixed</span>
              </div>

              {campaign.voiceover?.audioUrl && (
                <audio
                  key={campaign.voiceover.audioUrl}
                  src={campaign.voiceover.audioUrl}
                  controls
                  className="w-full h-10"
                />
              )}

              {(campaign.voiceover?.script || campaign.plan?.voiceoverScript) && (
                <div className="p-3 bg-black/35 border border-white/[0.05] rounded-xl text-xs text-[#D6D3CD] leading-relaxed italic">
                  &ldquo;{campaign.voiceover?.script || campaign.plan?.voiceoverScript}&rdquo;
                </div>
              )}
            </div>
          )}

          {/* Multi-Market Localized Ad Engine */}
          {onLocalizeCampaign && (
            <div className="glass-subpanel rounded-2xl p-5 space-y-3.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#F5F3EF] font-medium flex items-center gap-2">
                  <Globe2 className="w-4 h-4 text-[#E2B86B]" />
                  <span>Global Market Adaptation</span>
                </span>
                <span className="text-[#9A9893]">Active · {campaign.language}</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {LOCALIZATION_MARKETS.map((mkt) => {
                  const isSelected = selectedMarket.locale === mkt.locale;
                  return (
                    <button
                      key={mkt.locale}
                      type="button"
                      onClick={() => setSelectedMarket(mkt)}
                      className={`px-3 py-2 rounded-xl text-left text-xs transition cursor-pointer whitespace-nowrap truncate ${
                        isSelected
                          ? 'bg-[#E2B86B]/20 border border-[#E2B86B] text-[#E2B86B] font-medium'
                          : 'btn-glass text-[#D6D3CD]'
                      }`}
                    >
                      {mkt.label}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                disabled={isLocalizing || isRenderingFinal}
                onClick={() => onLocalizeCampaign(selectedMarket.locale, selectedMarket.language)}
                className="w-full py-2.5 px-4 btn-glass rounded-xl text-xs font-medium flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                {isLocalizing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#E2B86B]" />
                    <span>Rendering {selectedMarket.language} Edition...</span>
                  </>
                ) : (
                  <>
                    <Globe2 className="w-4 h-4 text-[#E2B86B]" />
                    <span>Adapt &amp; Render ({selectedMarket.language})</span>
                  </>
                )}
              </button>

              {campaign.localizedVariants && campaign.localizedVariants.length > 0 && (
                <div className="pt-2 border-t border-white/[0.06] space-y-1.5">
                  {campaign.localizedVariants.map((v, idx) => (
                    <div
                      key={`${v.locale}_${idx}`}
                      className="p-2.5 bg-black/40 border border-white/[0.06] rounded-xl flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="truncate text-[#D6D3CD]">
                        <span className="text-[#F5F3EF] font-medium">{v.locale}</span>
                        <span aria-hidden="true" className="mx-1.5 text-white/20">·</span>
                        <span>{v.language}</span>
                      </div>
                      {v.videoUrl && (
                        <a
                          href={v.videoUrl}
                          download={`${campaign.brandName.toLowerCase().replace(/\s+/g, '_')}_${v.language.toLowerCase()}.mp4`}
                          className="text-[#E2B86B] hover:underline shrink-0"
                        >
                          Download MP4
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Right Cols (7 or Full 12 in Theatre Mode): Master Commercial Theatre & Export */}
      <div
        className={`${
          theatreMode ? 'xl:col-span-12' : 'xl:col-span-7'
        } glass-panel rounded-2xl p-6 space-y-6 transition-all duration-200`}
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-[#9A9893]">
              <span className="text-[#E2B86B] font-medium">Master Commercial Theatre</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{campaign.aspectRatio}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">24fps H.264</span>
            </div>
            <h2 className="text-2xl font-semibold text-[#F5F3EF] font-display mt-0.5">
              {campaign.brandName} — Final Master
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setTheatreMode(!theatreMode)}
              title="Toggle Expanded Cinema Theatre Mode"
              className="p-2.5 btn-glass rounded-xl text-xs text-[#D6D3CD] cursor-pointer"
            >
              {theatreMode ? (
                <Minimize2 className="w-4 h-4 text-[#E2B86B]" />
              ) : (
                <Maximize2 className="w-4 h-4 text-[#E2B86B]" />
              )}
            </button>

            <button
              type="button"
              disabled={isRenderingFinal}
              onClick={() => onAssembleFinalVideo(includeAudio, volumeLevel)}
              className="px-4 py-2.5 btn-champagne rounded-xl text-xs flex items-center gap-2 cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              {isRenderingFinal ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="font-mono tabular-nums">Mastering ({displayPct}%)...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>
                    {campaign.finalRender?.videoUrl
                      ? 'Re-Assemble Master MP4'
                      : 'Assemble Master MP4'}
                  </span>
                </>
              )}
            </button>

            {campaign.finalRender?.videoUrl && !isRenderingFinal && (
              <a
                href={campaign.finalRender.videoUrl}
                download={`${campaign.brandName.toLowerCase().replace(/\s+/g, '_')}_ad.mp4`}
                className="px-4 py-2.5 btn-glass rounded-xl text-xs font-medium text-emerald-300 flex items-center gap-1.5 whitespace-nowrap"
              >
                <Download className="w-4 h-4" />
                <span>Download MP4</span>
              </a>
            )}
          </div>
        </div>

        {/* Master Video Player OR Real-Time Glass Progress Workstation */}
        <div className="relative aspect-video bg-black border border-white/[0.1] rounded-2xl overflow-hidden flex items-center justify-center shadow-2xl">
          {isRenderingFinal ? (
            <div className="w-full h-full generation-glow p-6 sm:p-8 flex flex-col justify-between gap-4 overflow-y-auto">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-xs text-[#E2B86B] font-medium">
                    Live Master Assembly in Progress
                  </div>
                  <div className="text-xl font-semibold text-[#F5F3EF] font-display">
                    {renderProgress?.stageLabel || 'Initializing Cinema Render Pipeline...'}
                  </div>
                  <p className="text-xs text-[#9A9893]">
                    {renderProgress?.message ||
                      'Normalizing resolution, burning captions, and mixing Lyria 3.5 score...'}
                  </p>
                </div>

                <div className="px-4 py-2 glass-subpanel rounded-xl text-right shrink-0">
                  <div className="text-[10px] text-[#9A9893]">Progress</div>
                  <div className="text-xl font-mono font-semibold text-[#E2B86B] tabular-nums">
                    {displayPct}%
                  </div>
                </div>
              </div>

              {/* Smooth Progress Bar */}
              <div className="space-y-2">
                <div className="w-full h-2 bg-black/60 border border-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#E2B86B] to-emerald-400 transition-all duration-300 ease-out"
                    style={{ width: `${displayPct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs font-mono text-[#9A9893] tabular-nums">
                  <span>
                    Scene {renderProgress?.sceneIndex ?? 1} of{' '}
                    {renderProgress?.totalScenes ?? approvedScenes.length}
                  </span>
                  <span>Target · {campaign.aspectRatio} @ 24fps</span>
                </div>
              </div>

              {/* 5-Stage Breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
                {RENDER_PIPELINE_STAGES.map((st) => {
                  const stOrder = STAGE_ORDER[st.key];
                  const isCompleted =
                    activeStageOrder > stOrder || renderProgress?.stageKey === 'completed';
                  const isCurrent = activeStageOrder === stOrder && !isCompleted;

                  return (
                    <div
                      key={st.key}
                      className={`p-3 rounded-xl border text-left transition ${
                        isCurrent
                          ? 'bg-[#E2B86B]/15 border-[#E2B86B] text-[#F5F3EF]'
                          : isCompleted
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                            : 'bg-black/40 border-white/[0.07] text-[#9A9893]'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] font-mono mb-1 tabular-nums">
                        <span>{st.step}</span>
                        {isCompleted ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        ) : isCurrent ? (
                          <Loader2 className="w-3.5 h-3.5 text-[#E2B86B] animate-spin" />
                        ) : (
                          <Circle className="w-3 h-3 opacity-30" />
                        )}
                      </div>
                      <div className="text-xs font-medium leading-snug">{st.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : campaign.finalRender?.videoUrl ? (
            <video
              key={campaign.finalRender.videoUrl}
              src={campaign.finalRender.videoUrl}
              controls
              autoPlay
              className="w-full h-full object-contain bg-black"
            />
          ) : (
            <div className="flex flex-col items-center gap-3 text-[#9A9893] p-8 text-center">
              <Film className="w-8 h-8 text-[#E2B86B] opacity-60" />
              <div className="text-lg font-display text-[#F5F3EF]">
                Ready for Master Commercial Assembly
              </div>
              <p className="text-xs max-w-md leading-relaxed">
                Click &ldquo;Assemble Master MP4&rdquo; above to normalize all approved scene clips, apply transitions, mix your Lyria 3.5 score, and verify the broadcast stream.
              </p>
            </div>
          )}
        </div>

        {/* Post-Render Stream Validation Summary (Unboxed clean metrics) */}
        {validation && (
          <div className="glass-subpanel rounded-2xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-emerald-400 font-medium flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>Broadcast Master Stream Verified</span>
              </span>
              <div className="flex flex-wrap items-center gap-2 font-mono text-[#9A9893] tabular-nums">
                <span>{validation.videoCodec.toUpperCase()}</span>
                <span aria-hidden="true">·</span>
                <span>{validation.audioCodec.toUpperCase()}</span>
                <span aria-hidden="true">·</span>
                <span>
                  {validation.width}×{validation.height}
                </span>
                <span aria-hidden="true">·</span>
                <span>{validation.durationSeconds}s</span>
                <span aria-hidden="true">·</span>
                <span>{validation.frameCount} Frames</span>
                <span aria-hidden="true">·</span>
                <span>{(validation.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB</span>
              </div>
            </div>

            {campaign.finalRender?.ffmpegCommandLog && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowFfmpegLogs(!showFfmpegLogs)}
                  className="text-xs text-[#E2B86B] hover:underline flex items-center gap-1.5 cursor-pointer"
                >
                  <Terminal className="w-3.5 h-3.5" />
                  <span>
                    {showFfmpegLogs ? 'Hide Render Command Log' : 'Inspect Render Command Log'}
                  </span>
                </button>
                {showFfmpegLogs && (
                  <pre className="mt-2.5 p-3.5 bg-black/50 border border-white/[0.08] rounded-xl text-[11px] font-mono text-[#D6D3CD] overflow-x-auto whitespace-pre-wrap max-h-44">
                    {campaign.finalRender.ffmpegCommandLog}
                  </pre>
                )}
              </div>
            )}
          </div>
        )}

        {/* Multimodal Asset Strip */}
        <div className="pt-2 space-y-3">
          <div className="text-xs text-[#9A9893]">
            Included Storyboard &amp; Motion Assets ({approvedScenes.length} Approved Shots)
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {campaign.scenes.map((s) => (
              <div key={s.id} className="glass-subpanel rounded-xl p-2.5 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-mono tabular-nums">
                  <span className="text-[#E2B86B] font-semibold">0{s.sceneNumber}</span>
                  <span className="text-[#9A9893]">
                    {s.videoUrl ? `v${(s.versionHistory?.length || 0) + 1} MP4` : '1K Frame'}
                  </span>
                </div>
                {s.imageUrl && (
                  <img
                    src={s.imageUrl}
                    alt={s.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-16 object-cover rounded-lg border border-white/[0.08]"
                  />
                )}
                <div className="flex items-center justify-between text-[11px] pt-0.5">
                  {s.imageUrl && (
                    <a
                      href={s.imageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#9A9893] hover:text-[#F5F3EF] underline"
                    >
                      Still
                    </a>
                  )}
                  {s.videoUrl && (
                    <a
                      href={s.videoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#E2B86B] hover:underline"
                    >
                      Motion Clip
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
