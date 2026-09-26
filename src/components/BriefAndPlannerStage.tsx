import React, { useState } from 'react';
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  Clock,
  Compass,
  FileText,
  ImagePlus,
  Layers,
  Loader2,
  Palette,
  Sparkles,
  Trash2,
  Wand2,
} from 'lucide-react';
import { AspectRatio, Campaign, CreativeBrief } from '../types/campaign';

interface Props {
  activeCampaign: Campaign | null;
  isPlanning: boolean;
  onPlanCampaign: (brief: CreativeBrief) => Promise<void>;
  onProceedToStoryboard: () => void;
}

const STUDIO_PRESETS: Array<{ label: string; tag: string; brief: CreativeBrief }> = [
  {
    label: 'KONA AERO — Espresso System',
    tag: 'Luxury Hardware • 16:9',
    brief: {
      brandName: 'KONA AERO',
      productDescription:
        'Architectural matte-black titanium espresso and pour-over brewing system with precision thermal extraction and borosilicate glass carafe.',
      targetAudience: 'Specialty coffee enthusiasts, industrial designers, and modern home baristas',
      campaignObjective: 'Launch the KONA AERO flagship brewer with a tactile, sensory-driven commercial',
      creativeStyle: 'Tactile Anamorphic Macro Cinematography, Warm Golden Rim Lighting, Obsidian & Amber Palette',
      durationSeconds: 12,
      aspectRatio: '16:9',
      language: 'English',
    },
  },
  {
    label: 'AETHERIA — Botanical Elixir',
    tag: 'Editorial Beverage • 9:16',
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
    tag: 'Performance Mobility • 16:9',
    brief: {
      brandName: 'VELOCE CARBON',
      productDescription:
        'Ultralight monocoque carbon-fiber commuter e-bike with integrated laser-etched LED cockpit and silent harmonic drive.',
      targetAudience: 'Urban architects, tech founders, and design-forward city riders',
      campaignObjective: 'Demonstrate effortless speed and sculptural minimalism across wet neon city streets',
      creativeStyle: 'Neo-Noir Architectural Tracking Shots, Rain-Slicked Reflections, Sodium Vapor & Cyan Accents',
      durationSeconds: 15,
      aspectRatio: '16:9',
      language: 'English',
    },
  },
];

export const BriefAndPlannerStage: React.FC<Props> = ({
  activeCampaign,
  isPlanning,
  onPlanCampaign,
  onProceedToStoryboard,
}) => {
  const [brief, setBrief] = useState<CreativeBrief>({
    brandName: activeCampaign?.brandName || STUDIO_PRESETS[0].brief.brandName,
    productDescription: activeCampaign?.productDescription || STUDIO_PRESETS[0].brief.productDescription,
    targetAudience: activeCampaign?.targetAudience || STUDIO_PRESETS[0].brief.targetAudience,
    campaignObjective: activeCampaign?.campaignObjective || STUDIO_PRESETS[0].brief.campaignObjective,
    creativeStyle: activeCampaign?.creativeStyle || STUDIO_PRESETS[0].brief.creativeStyle,
    durationSeconds: activeCampaign?.durationSeconds || 12,
    aspectRatio: activeCampaign?.aspectRatio || '16:9',
    language: activeCampaign?.language || 'English',
  });

  const [refPreview, setRefPreview] = useState<string | null>(activeCampaign?.referenceImageUrl || null);

  const handleApplyPreset = (presetBrief: CreativeBrief) => {
    setBrief({ ...presetBrief });
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

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
      {/* Left Column: Creative Brief Form (5 cols) */}
      <div className="xl:col-span-5 bg-[#111318] border border-white/10 rounded-sm p-5 space-y-5">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div>
            <span className="text-[11px] font-mono uppercase tracking-wider text-amber-400">
              STAGE 01 • CREATIVE BRIEF INPUT
            </span>
            <h2 className="text-lg font-bold text-white font-display mt-0.5">
              Commercial Production Brief
            </h2>
          </div>
          <FileText className="w-4 h-4 text-[#9499A6]" />
        </div>

        {/* Studio Quick Presets */}
        <div className="space-y-2">
          <div className="text-[11px] font-mono uppercase text-[#9499A6]">
            Load Production Preset or Enter Custom Brief:
          </div>
          <div className="grid grid-cols-1 gap-1.5">
            {STUDIO_PRESETS.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleApplyPreset(p.brief)}
                className="flex items-center justify-between px-3 py-2 text-left bg-[#171A21] hover:bg-[#1E222B] border border-white/10 hover:border-amber-500/40 rounded-sm transition group"
              >
                <span className="text-xs font-medium text-white group-hover:text-amber-400 transition">
                  {p.label}
                </span>
                <span className="text-[11px] font-mono text-[#9499A6]">{p.tag}</span>
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-mono uppercase text-[#9499A6] mb-1">
                Product / Brand Name *
              </label>
              <input
                type="text"
                required
                value={brief.brandName}
                onChange={(e) => setBrief({ ...brief, brandName: e.target.value })}
                className="w-full px-3 py-2 bg-[#090A0D] border border-white/10 focus:border-amber-400 rounded-sm text-sm text-white outline-none"
                placeholder="e.g. KONA AERO"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono uppercase text-[#9499A6] mb-1">
                Language
              </label>
              <input
                type="text"
                value={brief.language}
                onChange={(e) => setBrief({ ...brief, language: e.target.value })}
                className="w-full px-3 py-2 bg-[#090A0D] border border-white/10 focus:border-amber-400 rounded-sm text-sm text-white outline-none"
                placeholder="English"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono uppercase text-[#9499A6] mb-1">
              Product Description *
            </label>
            <textarea
              rows={3}
              required
              value={brief.productDescription}
              onChange={(e) => setBrief({ ...brief, productDescription: e.target.value })}
              className="w-full px-3 py-2 bg-[#090A0D] border border-white/10 focus:border-amber-400 rounded-sm text-xs text-white outline-none leading-relaxed"
              placeholder="Describe key product design details, materials, and unique value proposition..."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-mono uppercase text-[#9499A6] mb-1">
                Target Audience
              </label>
              <input
                type="text"
                value={brief.targetAudience}
                onChange={(e) => setBrief({ ...brief, targetAudience: e.target.value })}
                className="w-full px-3 py-2 bg-[#090A0D] border border-white/10 focus:border-amber-400 rounded-sm text-xs text-white outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono uppercase text-[#9499A6] mb-1">
                Campaign Objective
              </label>
              <input
                type="text"
                value={brief.campaignObjective}
                onChange={(e) => setBrief({ ...brief, campaignObjective: e.target.value })}
                className="w-full px-3 py-2 bg-[#090A0D] border border-white/10 focus:border-amber-400 rounded-sm text-xs text-white outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono uppercase text-[#9499A6] mb-1">
              Creative Style & Visual Direction
            </label>
            <input
              type="text"
              value={brief.creativeStyle}
              onChange={(e) => setBrief({ ...brief, creativeStyle: e.target.value })}
              className="w-full px-3 py-2 bg-[#090A0D] border border-white/10 focus:border-amber-400 rounded-sm text-xs text-white outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-mono uppercase text-[#9499A6] mb-1">
                Target Duration
              </label>
              <select
                value={brief.durationSeconds}
                onChange={(e) => setBrief({ ...brief, durationSeconds: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-[#090A0D] border border-white/10 focus:border-amber-400 rounded-sm text-xs text-white font-mono outline-none"
              >
                <option value={12}>12 Seconds (3 Scenes)</option>
                <option value={15}>15 Seconds (4 Scenes)</option>
                <option value={20}>20 Seconds (4 Scenes)</option>
                <option value={30}>30 Seconds (5 Scenes)</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-mono uppercase text-[#9499A6] mb-1">
                Aspect Ratio
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['16:9', '9:16', '1:1'] as AspectRatio[]).map((ratio) => (
                  <button
                    key={ratio}
                    type="button"
                    onClick={() => setBrief({ ...brief, aspectRatio: ratio })}
                    className={`py-2 text-xs font-mono border rounded-sm transition ${
                      brief.aspectRatio === ratio
                        ? 'bg-amber-500/15 border-amber-400 text-amber-300 font-semibold'
                        : 'bg-[#090A0D] border-white/10 text-[#9499A6] hover:text-white'
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
            <label className="block text-[11px] font-mono uppercase text-[#9499A6] mb-1">
              Optional Brand / Product Reference Image (Cross-Modal Continuity Anchor)
            </label>
            <div className="flex items-center gap-3">
              <label className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-[#090A0D] hover:bg-[#171A21] border border-dashed border-white/20 rounded-sm cursor-pointer text-xs text-[#9499A6] hover:text-white transition">
                <ImagePlus className="w-4 h-4 text-amber-400" />
                <span>{refPreview ? 'Replace Reference Image' : 'Upload Product Photo (PNG/JPG)'}</span>
                <input type="file" accept="image/*" onChange={handleReferenceUpload} className="hidden" />
              </label>
              {refPreview && (
                <div className="relative w-12 h-10 rounded-sm overflow-hidden border border-white/20 group">
                  <img src={refPreview} alt="Reference" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => {
                      setRefPreview(null);
                      setBrief({ ...brief, referenceImageBase64: undefined, referenceImageMimeType: undefined });
                    }}
                    className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 flex items-center justify-center text-red-400 transition"
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
            className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-semibold text-sm rounded-sm flex items-center justify-center gap-2 transition cursor-pointer"
          >
            {isPlanning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Generating AI Campaign Plan & Storyboard...</span>
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                <span>Generate Structured Campaign Plan & Storyboard</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Right Column: Structured AI Campaign Plan & Storyboard Blueprint (7 cols) */}
      <div className="xl:col-span-7 bg-[#111318] border border-white/10 rounded-sm p-5 flex flex-col justify-between space-y-5">
        {activeCampaign?.plan ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
              <div>
                <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> STAGE 02 • AI CAMPAIGN PLANNER OUTPUT
                </span>
                <h2 className="text-lg font-bold text-white font-display mt-0.5">
                  {activeCampaign.brandName} — Director&apos;s Blueprint ({activeCampaign.aspectRatio} • {activeCampaign.durationSeconds}s)
                </h2>
              </div>
              <button
                onClick={onProceedToStoryboard}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs rounded-sm flex items-center gap-2 transition cursor-pointer"
              >
                <span>Open Storyboard Studio</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Concept & Message */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3.5 bg-[#171A21] border border-white/10 rounded-sm space-y-1.5">
                <div className="text-[11px] font-mono uppercase text-amber-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> Creative Concept
                </div>
                <p className="text-xs text-zinc-200 leading-relaxed">{activeCampaign.plan.creativeConcept}</p>
              </div>
              <div className="p-3.5 bg-[#171A21] border border-white/10 rounded-sm space-y-1.5">
                <div className="text-[11px] font-mono uppercase text-sky-400 flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5" /> Core Campaign Message & Audio Direction
                </div>
                <p className="text-xs text-zinc-200 leading-relaxed">{activeCampaign.plan.campaignMessage}</p>
                <div className="pt-1 text-[11px] font-mono text-emerald-400">
                  Musical Mood: {activeCampaign.plan.musicalMood}
                </div>
              </div>
            </div>

            {/* Visual Identity & Cross-Modal Continuity Anchors */}
            <div className="p-4 bg-[#171A21] border border-white/10 rounded-sm space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-mono uppercase text-white font-semibold flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-amber-400" /> Visual Identity & Continuity Anchors
                </span>
                <div className="flex items-center gap-1.5">
                  {activeCampaign.plan.visualIdentity.colorPalette.map((color, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-[#090A0D] border border-white/10 rounded-sm text-[11px] font-mono text-zinc-300"
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-xs border border-white/20"
                        style={{ backgroundColor: color.startsWith('#') ? color : '#F59E0B' }}
                      />
                      {color}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="p-2.5 bg-[#090A0D] border border-white/5 rounded-sm">
                  <div className="text-[10px] font-mono uppercase text-[#9499A6]">Lighting Signature</div>
                  <div className="text-zinc-200 mt-1">{activeCampaign.plan.visualIdentity.lightingStyle}</div>
                </div>
                <div className="p-2.5 bg-[#090A0D] border border-white/5 rounded-sm">
                  <div className="text-[10px] font-mono uppercase text-[#9499A6]">Lens & Framing</div>
                  <div className="text-zinc-200 mt-1">{activeCampaign.plan.visualIdentity.lensAndFraming}</div>
                </div>
                <div className="p-2.5 bg-[#090A0D] border border-white/5 rounded-sm">
                  <div className="text-[10px] font-mono uppercase text-[#9499A6]">Continuity Anchor</div>
                  <div className="text-zinc-200 mt-1">{activeCampaign.plan.visualIdentity.continuityAnchors}</div>
                </div>
              </div>
            </div>

            {/* Scene-by-Scene Storyboard Breakdown */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase text-[#9499A6] flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-amber-400" /> Scene-by-Scene Storyboard Plan ({activeCampaign.scenes.length} Scenes)
                </span>
                <span className="text-[11px] font-mono text-[#9499A6]">
                  Chained to Nano Banana 2 Lite & Gemini Omni Flash
                </span>
              </div>

              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {activeCampaign.scenes.map((scene) => (
                  <div
                    key={scene.id}
                    className="p-3 bg-[#171A21] border border-white/10 rounded-sm grid grid-cols-1 md:grid-cols-12 gap-3 items-start"
                  >
                    <div className="md:col-span-3 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono text-[11px] font-semibold rounded-sm">
                          SCENE 0{scene.sceneNumber}
                        </span>
                        <span className="text-xs font-mono text-[#9499A6] flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {scene.durationSeconds}s
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-white">{scene.title}</div>
                      <div className="text-[11px] font-mono text-sky-400 flex items-center gap-1">
                        <Camera className="w-3 h-3" /> {scene.cameraMovement}
                      </div>
                      <div className="text-[10px] font-mono text-[#9499A6] uppercase">
                        Transition: {scene.transitionType}
                      </div>
                    </div>

                    <div className="md:col-span-9 space-y-1.5 text-xs">
                      <div>
                        <span className="text-[10px] font-mono uppercase text-amber-400/90 mr-1.5">
                          [Image Prompt]:
                        </span>
                        <span className="text-zinc-300">{scene.imagePrompt}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-mono uppercase text-sky-400/90 mr-1.5">
                          [Video Motion]:
                        </span>
                        <span className="text-zinc-300">{scene.videoPrompt}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 pt-1 text-[11px] font-mono text-[#9499A6]">
                        <span>Audio: {scene.audioDirection}</span>
                        {scene.overlayText && (
                          <span className="text-zinc-200 bg-[#090A0D] px-2 py-0.5 rounded-sm border border-white/10">
                            Overlay: &ldquo;{scene.overlayText}&rdquo;
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center py-16 px-6 space-y-3">
            <div className="w-12 h-12 rounded-sm bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Wand2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white font-display">
              Ready to Architect Your Multimodal Campaign
            </h3>
            <p className="text-xs text-[#9499A6] max-w-md leading-relaxed">
              Submit the creative brief on the left to generate a structured campaign concept, visual continuity anchors, and a multi-scene storyboard ready for Nano Banana 2 Lite, Gemini Omni Flash, and Lyria 3.5.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
