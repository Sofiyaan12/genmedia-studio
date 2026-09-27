import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  FileText,
  Globe,
  ImagePlus,
  Loader2,
  Play,
  Sparkles,
  Trash2,
  Wand2,
} from 'lucide-react';
import { AspectRatio, Campaign, CreativeBrief } from '../types/campaign';

interface Props {
  activeCampaign: Campaign | null;
  isPlanning: boolean;
  isRunningSingleLoop?: boolean;
  isLocalizing?: boolean;
  onPlanCampaign: (brief: CreativeBrief) => Promise<void>;
  onRunSingleLoopAutopilot?: () => Promise<void>;
  onLocalizeCampaign?: (locale: string, language: string) => Promise<void>;
  onProceedToStoryboard: () => void;
  onProceedToMaster?: () => void;
}

const LOCALIZATION_MARKETS = [
  { locale: 'Hyderabad (India)', language: 'Telugu', code: 'TE' },
  { locale: 'Mumbai / Delhi', language: 'Hindi', code: 'HI' },
  { locale: 'Chennai', language: 'Tamil', code: 'TA' },
  { locale: 'Tokyo', language: 'Japanese', code: 'JA' },
  { locale: 'Madrid / LATAM', language: 'Spanish', code: 'ES' },
  { locale: 'Dubai', language: 'Arabic', code: 'AR' },
  { locale: 'Paris', language: 'French', code: 'FR' },
];

const CINEMA_LOOKS = [
  {
    id: 'champagne',
    label: 'Warm Champagne 35mm',
    styleText: 'Tactile Anamorphic Macro Cinematography, Warm Golden Rim Lighting, Obsidian & Champagne Palette',
  },
  {
    id: 'editorial',
    label: 'High-Contrast Editorial',
    styleText: 'High-Contrast Editorial Film, Natural Window Shadows, Rich Organic Textures, Leica 35mm Aesthetic',
  },
  {
    id: 'noir',
    label: 'Architectural Neo-Noir',
    styleText: 'Neo-Noir Architectural Tracking Shots, Rain-Slicked Reflections, Dramatic Chiaroscuro Lighting',
  },
  {
    id: 'velvet',
    label: 'Soft Velvet Luxury',
    styleText: 'Diffused Studio Softbox Illumination, Shallow Depth of Field Bokeh, Warm Travertine & Ivory Tones',
  },
];

const STUDIO_PRESETS: Array<{ label: string; meta: string; brief: CreativeBrief }> = [
  {
    label: 'KONA AERO — Espresso System',
    meta: 'Luxury Hardware · 16:9',
    brief: {
      brandName: 'KONA AERO',
      productDescription:
        'Architectural matte-black titanium espresso and pour-over brewing system with precision thermal extraction and borosilicate glass carafe.',
      targetAudience: 'Specialty coffee enthusiasts, industrial designers, and modern home baristas',
      campaignObjective: 'Launch the KONA AERO flagship brewer with a tactile, sensory-driven commercial',
      creativeStyle: 'Tactile Anamorphic Macro Cinematography, Warm Golden Rim Lighting, Obsidian & Champagne Palette',
      durationSeconds: 12,
      aspectRatio: '16:9',
      language: 'English',
    },
  },
  {
    label: 'AETHERIA — Botanical Elixir',
    meta: 'Editorial Beverage · 9:16',
    brief: {
      brandName: 'AETHERIA',
      productDescription:
        'Sparkling adaptogenic botanical aperitif crafted with wild Himalayan yuzu, saffron flower, and smoked cedarwood in an emerald fluted glass bottle.',
      targetAudience: 'Mindful nightlife seekers, culinary creatives, and luxury hospitality lounges',
      campaignObjective: 'Position AETHERIA as the definitive evening ritual for golden-hour gatherings',
      creativeStyle: 'High-Contrast Editorial Film, Emerald & Warm Terracotta Lighting, Slow-Motion Condensation',
      durationSeconds: 15,
      aspectRatio: '9:16',
      language: 'English',
    },
  },
  {
    label: 'VELOCE CARBON — Urban E-Bike',
    meta: 'Performance Mobility · 16:9',
    brief: {
      brandName: 'VELOCE CARBON',
      productDescription:
        'Ultralight monocoque carbon-fiber commuter e-bike with integrated laser-etched LED cockpit and silent harmonic drive.',
      targetAudience: 'Urban architects, tech founders, and design-forward city riders',
      campaignObjective: 'Demonstrate effortless speed and sculptural minimalism across wet city streets',
      creativeStyle: 'Neo-Noir Architectural Tracking Shots, Rain-Slicked Reflections, Warm Sodium & Slate Accents',
      durationSeconds: 15,
      aspectRatio: '16:9',
      language: 'English',
    },
  },
  {
    label: 'MAISON LUMIÈRE — Extrait de Parfum',
    meta: 'Haute Parfumerie · 16:9',
    brief: {
      brandName: 'MAISON LUMIÈRE',
      productDescription:
        'Hand-blown smoked crystal flacon holding rare Damask rose, warm ambergris, and charred Atlas cedar.',
      targetAudience: 'Collectors of niche fragrance, luxury fashion editors, and evening connoisseurs',
      campaignObjective: 'Evoke an intimate, sculptural sensory portrait of liquid gold and shadow',
      creativeStyle: 'Diffused Studio Softbox Illumination, Shallow Depth of Field Bokeh, Warm Travertine & Ivory Tones',
      durationSeconds: 12,
      aspectRatio: '16:9',
      language: 'English',
    },
  },
];

export const BriefAndPlannerStage: React.FC<Props> = ({
  activeCampaign,
  isPlanning,
  isRunningSingleLoop = false,
  isLocalizing = false,
  onPlanCampaign,
  onRunSingleLoopAutopilot,
  onLocalizeCampaign,
  onProceedToStoryboard,
  onProceedToMaster,
}) => {
  const [brief, setBrief] = useState<CreativeBrief>({
    brandName: activeCampaign?.brandName || STUDIO_PRESETS[0].brief.brandName,
    productDescription:
      activeCampaign?.productDescription || STUDIO_PRESETS[0].brief.productDescription,
    targetAudience: activeCampaign?.targetAudience || STUDIO_PRESETS[0].brief.targetAudience,
    campaignObjective:
      activeCampaign?.campaignObjective || STUDIO_PRESETS[0].brief.campaignObjective,
    creativeStyle: activeCampaign?.creativeStyle || STUDIO_PRESETS[0].brief.creativeStyle,
    durationSeconds: activeCampaign?.durationSeconds || 12,
    aspectRatio: activeCampaign?.aspectRatio || '16:9',
    language: activeCampaign?.language || 'English',
  });

  const [refPreview, setRefPreview] = useState<string | null>(
    activeCampaign?.referenceImageUrl || null
  );
  const [rightViewMode, setRightViewMode] = useState<'blueprint' | 'script'>('blueprint');
  const [copiedScript, setCopiedScript] = useState(false);

  const handleApplyPreset = (presetBrief: CreativeBrief) => {
    setBrief({ ...presetBrief });
  };

  const handlePolishBrief = () => {
    setBrief((prev) => {
      const alreadyPolished = prev.productDescription.includes('85mm anamorphic');
      if (alreadyPolished) return prev;
      return {
        ...prev,
        productDescription: `${prev.productDescription.replace(/\.$/, '')}, captured with tactile surface micro-contrast, natural specular highlights, and 85mm anamorphic shallow depth of field.`,
      };
    });
  };

  const handleReferenceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      setRefPreview(result);
      setBrief((prev) => ({
        ...prev,
        referenceImageBase64: result,
        referenceImageMimeType: file.type || 'image/jpeg',
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onPlanCampaign(brief);
  };

  const buildShootingScriptMarkdown = (camp: Campaign) => {
    const lines = [
      `# ${camp.brandName} — Commercial Production Script`,
      `Format: ${camp.aspectRatio} · Duration: ${camp.durationSeconds}s · Language: ${camp.language}`,
      `Creative Concept: ${camp.plan?.creativeConcept || ''}`,
      `Musical Direction: ${camp.plan?.musicalMood || ''}`,
      ``,
      `## Scene Breakdown`,
      ...camp.scenes.map(
        (s) =>
          `### Scene 0${s.sceneNumber}: ${s.title} (${s.durationSeconds}s · ${s.cameraMovement})\n- Visual Frame: ${s.imagePrompt}\n- Motion & Physics: ${s.videoPrompt}\n- On-Screen Super / VO: "${s.overlayText || ''}"\n- Audio Cue: ${s.audioDirection}`
      ),
    ];
    return lines.join('\n\n');
  };

  const handleCopyScript = () => {
    if (!activeCampaign) return;
    navigator.clipboard.writeText(buildShootingScriptMarkdown(activeCampaign));
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  const handleDownloadScript = () => {
    if (!activeCampaign) return;
    const md = buildShootingScriptMarkdown(activeCampaign);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeCampaign.brandName.toLowerCase().replace(/\s+/g, '_')}_production_script.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start"
    >
      {/* Left Column: Creative Brief Form (5 cols) */}
      <div className="xl:col-span-5 glass-panel rounded-2xl p-6 space-y-6">
        <div className="flex items-start justify-between border-b border-white/[0.08] pb-4">
          <div>
            <div className="text-xs text-[#E2B86B] font-medium">01. Creative Brief</div>
            <h2 className="text-2xl font-semibold text-[#F5F3EF] font-display mt-0.5">
              Commercial Production Brief
            </h2>
          </div>
          <button
            type="button"
            onClick={handlePolishBrief}
            title="Enrich description with tactile cinema lens & lighting notes"
            className="px-3 py-1.5 btn-glass rounded-xl text-xs text-[#E2B86B] flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Polish Copy</span>
          </button>
        </div>

        {/* Curated Brand Presets */}
        <div className="space-y-2">
          <div className="text-xs text-[#9A9893]">Curated Campaign Templates</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {STUDIO_PRESETS.map((p, idx) => {
              const isCurrent = brief.brandName === p.brief.brandName;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleApplyPreset(p.brief)}
                  className={`p-3 text-left rounded-xl border transition-all cursor-pointer ${
                    isCurrent
                      ? 'bg-[#E2B86B]/12 border-[#E2B86B]/50 text-[#F5F3EF]'
                      : 'glass-subpanel text-[#D6D3CD]'
                  }`}
                >
                  <div className="text-xs font-semibold text-[#F5F3EF] truncate">{p.label}</div>
                  <div className="text-[11px] text-[#9A9893] mt-0.5">{p.meta}</div>
                </button>
              );
            })}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs text-[#9A9893] mb-1.5">Brand Name</label>
              <input
                type="text"
                required
                value={brief.brandName}
                onChange={(e) => setBrief({ ...brief, brandName: e.target.value })}
                className="w-full px-3.5 py-2.5 glass-input rounded-xl text-sm"
                placeholder="e.g. KONA AERO"
              />
            </div>
            <div>
              <label className="block text-xs text-[#9A9893] mb-1.5">Primary Language</label>
              <input
                type="text"
                value={brief.language}
                onChange={(e) => setBrief({ ...brief, language: e.target.value })}
                className="w-full px-3.5 py-2.5 glass-input rounded-xl text-sm"
                placeholder="English"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-[#9A9893] mb-1.5">
              Product Essence &amp; Materials
            </label>
            <textarea
              rows={3}
              required
              value={brief.productDescription}
              onChange={(e) => setBrief({ ...brief, productDescription: e.target.value })}
              className="w-full px-3.5 py-2.5 glass-input rounded-xl text-xs leading-relaxed"
              placeholder="Describe the design details, materials, and sensory character..."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs text-[#9A9893] mb-1.5">Target Audience</label>
              <input
                type="text"
                value={brief.targetAudience}
                onChange={(e) => setBrief({ ...brief, targetAudience: e.target.value })}
                className="w-full px-3.5 py-2 glass-input rounded-xl text-xs"
              />
            </div>
            <div>
              <label className="block text-xs text-[#9A9893] mb-1.5">Campaign Objective</label>
              <input
                type="text"
                value={brief.campaignObjective}
                onChange={(e) => setBrief({ ...brief, campaignObjective: e.target.value })}
                className="w-full px-3.5 py-2 glass-input rounded-xl text-xs"
              />
            </div>
          </div>

          {/* Aesthetic Look & Color Grade Selector */}
          <div className="space-y-2">
            <label className="block text-xs text-[#9A9893]">
              Aesthetic Look &amp; Cinematography Direction
            </label>
            <div className="flex flex-wrap gap-1.5">
              {CINEMA_LOOKS.map((look) => {
                const active = brief.creativeStyle === look.styleText;
                return (
                  <button
                    key={look.id}
                    type="button"
                    onClick={() => setBrief({ ...brief, creativeStyle: look.styleText })}
                    className={`px-3 py-1.5 rounded-lg text-xs transition cursor-pointer whitespace-nowrap ${
                      active
                        ? 'bg-[#E2B86B]/20 border border-[#E2B86B]/60 text-[#E2B86B] font-medium'
                        : 'btn-glass text-[#9A9893] hover:text-[#F5F3EF]'
                    }`}
                  >
                    {look.label}
                  </button>
                );
              })}
            </div>
            <input
              type="text"
              value={brief.creativeStyle}
              onChange={(e) => setBrief({ ...brief, creativeStyle: e.target.value })}
              className="w-full px-3.5 py-2 glass-input rounded-xl text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs text-[#9A9893] mb-1.5">Duration</label>
              <select
                value={brief.durationSeconds}
                onChange={(e) => setBrief({ ...brief, durationSeconds: Number(e.target.value) })}
                className="w-full px-3.5 py-2.5 glass-input rounded-xl text-xs font-mono tabular-nums"
              >
                <option value={12}>12 Seconds · 3 Scenes</option>
                <option value={15}>15 Seconds · 4 Scenes</option>
                <option value={20}>20 Seconds · 4 Scenes</option>
                <option value={30}>30 Seconds · 5 Scenes</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#9A9893] mb-1.5">Aspect Ratio</label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['16:9', '9:16', '1:1'] as AspectRatio[]).map((ratio) => (
                  <button
                    key={ratio}
                    type="button"
                    onClick={() => setBrief({ ...brief, aspectRatio: ratio })}
                    className={`py-2 text-xs font-mono rounded-xl border transition cursor-pointer ${
                      brief.aspectRatio === ratio
                        ? 'bg-[#E2B86B]/20 border-[#E2B86B] text-[#E2B86B] font-medium'
                        : 'glass-input text-[#9A9893] hover:text-[#F5F3EF]'
                    }`}
                  >
                    {ratio}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Optional Reference Image Upload */}
          <div>
            <label className="block text-xs text-[#9A9893] mb-1.5">
              Product Reference Photo (Optional Continuity Anchor)
            </label>
            <div className="flex items-center gap-3">
              <label className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 glass-subpanel rounded-xl cursor-pointer text-xs text-[#9A9893] hover:text-[#F5F3EF]">
                <ImagePlus className="w-4 h-4 text-[#E2B86B]" />
                <span>{refPreview ? 'Change Reference Image' : 'Upload Product Still (PNG / JPG)'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleReferenceUpload}
                  className="hidden"
                />
              </label>
              {refPreview && (
                <div className="relative w-12 h-10 rounded-xl overflow-hidden border border-white/15 group">
                  <img src={refPreview} alt="Reference" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => {
                      setRefPreview(null);
                      setBrief({
                        ...brief,
                        referenceImageBase64: undefined,
                        referenceImageMimeType: undefined,
                      });
                    }}
                    className="absolute inset-0 bg-black/75 opacity-0 group-hover:opacity-100 flex items-center justify-center text-red-400 transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={isPlanning}
            className="w-full py-3 px-5 btn-champagne rounded-xl text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 whitespace-nowrap"
          >
            {isPlanning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Architecting Campaign &amp; Storyboard...</span>
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                <span>Architect Campaign Blueprint</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Right Column: Director's Blueprint, Script Teleprompter & Localization (7 cols) */}
      <div className="xl:col-span-7 glass-panel rounded-2xl p-6 flex flex-col justify-between space-y-6">
        {activeCampaign?.plan ? (
          <div className="space-y-6">
            {/* Header & View Mode Switcher */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
              <div>
                <div className="flex items-center gap-2 text-xs text-[#9A9893]">
                  <span className="text-[#E2B86B] font-medium">02. Director&apos;s Blueprint</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">{activeCampaign.aspectRatio}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">{activeCampaign.durationSeconds}s</span>
                  <span aria-hidden="true">·</span>
                  <span>{activeCampaign.language}</span>
                </div>
                <h2 className="text-2xl font-semibold text-[#F5F3EF] font-display mt-0.5">
                  {activeCampaign.brandName}
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Segmented View Toggle: Blueprint vs Shooting Script */}
                <div className="flex items-center p-1 bg-black/40 border border-white/[0.08] rounded-xl">
                  <button
                    type="button"
                    onClick={() => setRightViewMode('blueprint')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer whitespace-nowrap ${
                      rightViewMode === 'blueprint'
                        ? 'bg-[#E2B86B] text-black'
                        : 'text-[#9A9893] hover:text-[#F5F3EF]'
                    }`}
                  >
                    Visual Blueprint
                  </button>
                  <button
                    type="button"
                    onClick={() => setRightViewMode('script')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer whitespace-nowrap ${
                      rightViewMode === 'script'
                        ? 'bg-[#E2B86B] text-black'
                        : 'text-[#9A9893] hover:text-[#F5F3EF]'
                    }`}
                  >
                    Shooting Script
                  </button>
                </div>

                <button
                  type="button"
                  onClick={onProceedToStoryboard}
                  className="px-4 py-2.5 btn-champagne rounded-xl text-xs flex items-center gap-2 cursor-pointer whitespace-nowrap"
                >
                  <span>Open Storyboard</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {rightViewMode === 'script' ? (
              /* NEW FEATURE: Commercial Shooting Script & Teleprompter View */
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 glass-subpanel rounded-xl p-4">
                  <div>
                    <div className="text-xs font-medium text-[#F5F3EF]">
                      Commercial Shooting Script &amp; Teleprompter
                    </div>
                    <div className="text-xs text-[#9A9893]">
                      Formatted scene timecodes, camera blocking, voiceover supers, and audio cues
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyScript}
                      className="px-3 py-1.5 btn-glass rounded-xl text-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      {copiedScript ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-[#E2B86B]" />
                          <span>Copy Script</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadScript}
                      className="px-3 py-1.5 btn-glass rounded-xl text-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <Download className="w-3.5 h-3.5 text-[#E2B86B]" />
                      <span>Export .MD</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                  {activeCampaign.scenes.map((scene, idx) => {
                    const startSec = activeCampaign.scenes
                      .slice(0, idx)
                      .reduce((acc, s) => acc + s.durationSeconds, 0);
                    const endSec = startSec + scene.durationSeconds;
                    return (
                      <div
                        key={scene.id}
                        className="glass-subpanel rounded-2xl p-5 space-y-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] pb-2.5 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="text-[#E2B86B] font-mono font-medium tabular-nums">
                              0{scene.sceneNumber}. {scene.title}
                            </span>
                            <span aria-hidden="true" className="text-white/20">·</span>
                            <span className="text-[#9A9893]">{scene.cameraMovement}</span>
                          </div>
                          <span className="font-mono text-xs text-[#9A9893] tabular-nums">
                            00:0{startSec} – 00:{endSec < 10 ? `0${endSec}` : endSec}
                          </span>
                        </div>

                        {scene.overlayText && (
                          <div className="p-3 bg-black/40 border-l-2 border-[#E2B86B] rounded-r-xl">
                            <div className="text-[11px] text-[#9A9893]">On-Screen Super / Voiceover</div>
                            <div className="text-base font-display italic text-[#F5F3EF] mt-0.5">
                              &ldquo;{scene.overlayText}&rdquo;
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-[#D6D3CD]">
                          <div>
                            <span className="text-[#9A9893] block mb-0.5">Visual Composition</span>
                            {scene.imagePrompt}
                          </div>
                          <div>
                            <span className="text-[#9A9893] block mb-0.5">Motion &amp; Acoustic Cue</span>
                            {scene.videoPrompt} ({scene.audioDirection})
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Standard Visual Blueprint View */
              <div className="space-y-5">
                {/* Concept & Message */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="glass-subpanel rounded-2xl p-4 space-y-2">
                    <div className="text-xs font-medium text-[#E2B86B]">Creative Concept</div>
                    <p className="text-xs text-[#D6D3CD] leading-relaxed">
                      {activeCampaign.plan.creativeConcept}
                    </p>
                  </div>
                  <div className="glass-subpanel rounded-2xl p-4 space-y-2">
                    <div className="text-xs font-medium text-[#E2B86B]">
                      Narrative &amp; Acoustic Direction
                    </div>
                    <p className="text-xs text-[#D6D3CD] leading-relaxed">
                      {activeCampaign.plan.campaignMessage}
                    </p>
                    <div className="pt-1 text-xs text-[#9A9893]">
                      Score Mood · <span className="text-[#F5F3EF]">{activeCampaign.plan.musicalMood}</span>
                    </div>
                  </div>
                </div>

                {/* Visual Identity & Continuity Anchors */}
                <div className="glass-subpanel rounded-2xl p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs font-medium text-[#F5F3EF]">
                      Visual Identity &amp; Continuity Palette
                    </span>
                    <div className="flex items-center gap-2">
                      {activeCampaign.plan.visualIdentity.colorPalette.map((color, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-1.5 text-xs font-mono text-[#9A9893]"
                        >
                          <span
                            className="w-3 h-3 rounded-full border border-white/20"
                            style={{ backgroundColor: color.startsWith('#') ? color : '#E2B86B' }}
                          />
                          <span>{color}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                    <div className="p-3 bg-black/35 border border-white/[0.05] rounded-xl">
                      <div className="text-[#9A9893]">Lighting Signature</div>
                      <div className="text-[#F5F3EF] mt-1 leading-relaxed">
                        {activeCampaign.plan.visualIdentity.lightingStyle}
                      </div>
                    </div>
                    <div className="p-3 bg-black/35 border border-white/[0.05] rounded-xl">
                      <div className="text-[#9A9893]">Optics &amp; Framing</div>
                      <div className="text-[#F5F3EF] mt-1 leading-relaxed">
                        {activeCampaign.plan.visualIdentity.lensAndFraming}
                      </div>
                    </div>
                    <div className="p-3 bg-black/35 border border-white/[0.05] rounded-xl">
                      <div className="text-[#9A9893]">Continuity Anchor</div>
                      <div className="text-[#F5F3EF] mt-1 leading-relaxed">
                        {activeCampaign.plan.visualIdentity.continuityAnchors}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Global Market Localization Bar */}
                {onLocalizeCampaign && (
                  <div className="glass-subpanel rounded-2xl p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs">
                        <Globe className="w-4 h-4 text-[#E2B86B]" />
                        <span className="font-medium text-[#F5F3EF]">
                          Regional Cultural &amp; Linguistic Adaptation
                        </span>
                      </div>
                      <span className="text-xs text-[#9A9893]">
                        Translates supers, adapts musical motifs &amp; renders localized MP4
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {LOCALIZATION_MARKETS.map((m) => {
                        const isCurrentLang =
                          activeCampaign.language?.toLowerCase() === m.language.toLowerCase();
                        return (
                          <button
                            key={m.locale}
                            type="button"
                            disabled={isLocalizing}
                            onClick={() => onLocalizeCampaign(m.locale, m.language)}
                            className={`px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50 whitespace-nowrap ${
                              isCurrentLang
                                ? 'bg-[#E2B86B]/20 border border-[#E2B86B] text-[#E2B86B] font-medium'
                                : 'btn-glass text-[#D6D3CD]'
                            }`}
                          >
                            <span className="font-mono text-[11px] text-[#E2B86B]">{m.code}</span>
                            <span>{m.language}</span>
                          </button>
                        );
                      })}
                    </div>

                    {isLocalizing && (
                      <div className="flex items-center gap-2 text-xs text-[#E2B86B] pt-1">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Adapting scene supers, regional instrumentation, and rendering MP4...</span>
                      </div>
                    )}

                    {activeCampaign.localizedVariants &&
                      activeCampaign.localizedVariants.length > 0 && (
                        <div className="pt-2 border-t border-white/[0.06] grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {activeCampaign.localizedVariants.slice(0, 4).map((v, i) => (
                            <div
                              key={i}
                              className="p-2.5 bg-black/40 border border-white/[0.06] rounded-xl flex items-center justify-between gap-2 text-xs"
                            >
                              <div className="truncate">
                                <div className="text-[#F5F3EF] font-medium">
                                  {v.locale} · {v.language}
                                </div>
                                <div className="text-[11px] text-[#9A9893] truncate">
                                  {v.sceneOverlays.join(' · ')}
                                </div>
                              </div>
                              {v.videoUrl && onProceedToMaster && (
                                <button
                                  type="button"
                                  onClick={onProceedToMaster}
                                  className="px-2.5 py-1 btn-glass rounded-lg text-[11px] text-[#E2B86B] flex items-center gap-1 shrink-0 cursor-pointer whitespace-nowrap"
                                >
                                  <Play className="w-3 h-3 fill-current" /> Watch
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                  </div>
                )}

                {/* Scene-by-Scene Breakdown */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-[#9A9893]">
                    <span className="font-medium text-[#F5F3EF]">
                      Scene Sequence ({activeCampaign.scenes.length} Scenes)
                    </span>
                    <span>Scene 01 anchors visual continuity across all shots</span>
                  </div>

                  <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
                    {activeCampaign.scenes.map((scene) => (
                      <div
                        key={scene.id}
                        className="glass-subpanel rounded-2xl p-4 grid grid-cols-1 md:grid-cols-12 gap-4 items-start"
                      >
                        <div className="md:col-span-4 space-y-1">
                          <div className="flex items-center gap-2 text-xs text-[#9A9893]">
                            <span className="text-[#E2B86B] font-mono font-semibold tabular-nums">
                              0{scene.sceneNumber}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {scene.durationSeconds}s
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{scene.transitionType}</span>
                          </div>
                          <div className="text-sm font-semibold text-[#F5F3EF]">{scene.title}</div>
                          <div className="text-xs text-[#9A9893] flex items-center gap-1.5">
                            <Camera className="w-3.5 h-3.5 text-[#E2B86B]" />
                            <span>{scene.cameraMovement}</span>
                          </div>
                        </div>

                        <div className="md:col-span-8 space-y-2 text-xs text-[#D6D3CD]">
                          <p className="leading-relaxed">{scene.imagePrompt}</p>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#9A9893]">
                            <span>Motion: {scene.videoPrompt}</span>
                            {scene.overlayText && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-[#E2B86B]">
                                  Super: &ldquo;{scene.overlayText}&rdquo;
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center py-20 px-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl glass-subpanel flex items-center justify-center text-[#E2B86B]">
              <FileText className="w-5 h-5" />
            </div>
            <h3 className="text-2xl font-semibold text-[#F5F3EF] font-display">
              Ready to Architect Your Commercial Film
            </h3>
            <p className="text-xs text-[#9A9893] max-w-md leading-relaxed">
              Select a curated brand template or compose a custom brief on the left to generate a cohesive visual identity, color palette, and multi-scene storyboard.
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
};
