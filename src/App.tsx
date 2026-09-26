/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import {
  AlertCircle,
  CheckCircle2,
  Clapperboard,
  Cpu,
  Film,
  FolderKanban,
  Image as ImageIcon,
  Loader2,
  LogIn,
  LogOut,
  Music,
  Plus,
  Sparkles,
  Trash2,
  Wand2,
} from 'lucide-react';
import { auth, db, logOut, signInWithGoogle } from './firebase';
import {
  Campaign,
  CreativeBrief,
  ModelVerificationReport,
  PipelineJob,
  SceneItem,
  SceneVersion,
} from './types/campaign';
import { BriefAndPlannerStage } from './components/BriefAndPlannerStage';
import { StoryboardStage } from './components/StoryboardStage';
import { VideoDirectorStage } from './components/VideoDirectorStage';
import { SoundtrackAndRenderStage } from './components/SoundtrackAndRenderStage';
import { ModelVerificationModal } from './components/ModelVerificationModal';

type StudioTab = 'brief' | 'storyboard' | 'video' | 'master';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [activeCampaignId, setActiveCampaignId] = useState<string>('');
  const [jobs, setJobs] = useState<PipelineJob[]>([]);
  const [activeTab, setActiveTab] = useState<StudioTab>('brief');
  const [selectedSceneId, setSelectedSceneId] = useState<string>('');

  // Loading & operation states
  const [initialLoading, setInitialLoading] = useState(true);
  const [isPlanning, setIsPlanning] = useState(false);
  const [generatingAllImages, setGeneratingAllImages] = useState(false);
  const [generatingSceneImageId, setGeneratingSceneImageId] = useState<string | null>(null);
  const [generatingSceneVideoId, setGeneratingSceneVideoId] = useState<string | null>(null);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [isRenderingFinal, setIsRenderingFinal] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Model Verification Modal
  const [verificationReport, setVerificationReport] = useState<ModelVerificationReport | null>(null);
  const [isVerificationOpen, setIsVerificationOpen] = useState(false);
  const [showCampaignDrawer, setShowCampaignDrawer] = useState(false);

  const activeCampaign = campaigns.find((c) => c.id === activeCampaignId) || campaigns[0] || null;

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsub();
  }, []);

  const syncCampaignToFirestore = async (camp: Campaign) => {
    try {
      await setDoc(doc(db, 'campaigns', camp.id), {
        id: camp.id,
        ownerId: user?.uid || camp.ownerId || 'public-demo',
        brandName: camp.brandName,
        productDescription: camp.productDescription,
        targetAudience: camp.targetAudience,
        campaignObjective: camp.campaignObjective,
        creativeStyle: camp.creativeStyle,
        durationSeconds: camp.durationSeconds,
        aspectRatio: camp.aspectRatio,
        language: camp.language,
        status: camp.status,
        plan: camp.plan || {},
        scenes: camp.scenes || [],
        soundtrack: camp.soundtrack || {},
        finalRender: camp.finalRender || {},
        createdAt: camp.createdAt,
        updatedAt: new Date().toISOString(),
      });
    } catch {
      // Non-blocking mirror sync to Firestore
    }
  };

  const fetchWorkspaceData = async () => {
    try {
      const [campRes, verifyRes] = await Promise.all([
        fetch('/api/campaigns'),
        fetch('/api/models/verify'),
      ]);
      if (campRes.ok) {
        const data = await campRes.json();
        const loaded: Campaign[] = data.campaigns || [];
        setCampaigns(loaded);
        setJobs(data.jobs || []);
        if (loaded.length > 0 && !activeCampaignId) {
          setActiveCampaignId(loaded[0].id);
          if (loaded[0].scenes?.[0]) {
            setSelectedSceneId(loaded[0].scenes[0].id);
          }
        }
      }
      if (verifyRes.ok) {
        const rep = await verifyRes.json();
        setVerificationReport(rep);
      }
    } catch (err: any) {
      setErrorBanner(err?.message || 'Failed to load studio workspace');
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspaceData();
  }, []);

  const updateCampaignInState = (updated: Campaign) => {
    setCampaigns((prev) => {
      const exists = prev.some((c) => c.id === updated.id);
      if (exists) {
        return prev.map((c) => (c.id === updated.id ? updated : c));
      }
      return [updated, ...prev];
    });
    setActiveCampaignId(updated.id);
    syncCampaignToFirestore(updated);
  };

  // Stage 1 & 2: Plan Campaign
  const handlePlanCampaign = async (brief: CreativeBrief) => {
    setIsPlanning(true);
    setErrorBanner(null);
    try {
      const res = await fetch('/api/campaigns/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brief,
          ownerId: user?.uid || 'public-demo',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Campaign planning failed');
      updateCampaignInState(data.campaign);
      if (data.campaign.scenes?.[0]) {
        setSelectedSceneId(data.campaign.scenes[0].id);
      }
      if (data.job) setJobs((prev) => [data.job, ...prev]);
    } catch (err: any) {
      setErrorBanner(err?.message || 'Failed to generate campaign plan');
    } finally {
      setIsPlanning(false);
    }
  };

  // Stage 3: Generate All Storyboard Images
  const handleGenerateAllImages = async () => {
    if (!activeCampaign) return;
    setGeneratingAllImages(true);
    setErrorBanner(null);
    try {
      const res = await fetch(`/api/campaigns/${activeCampaign.id}/storyboard/generate-all`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Storyboard generation failed');
      updateCampaignInState(data.campaign);
      if (data.job) setJobs((prev) => [data.job, ...prev]);
    } catch (err: any) {
      setErrorBanner(err?.message || 'Storyboard generation failed');
    } finally {
      setGeneratingAllImages(false);
    }
  };

  // Stage 3: Generate Single Scene Image
  const handleGenerateSingleImage = async (sceneId: string, updatedPrompt?: string) => {
    if (!activeCampaign) return;
    setGeneratingSceneImageId(sceneId);
    setErrorBanner(null);
    try {
      const res = await fetch(`/api/campaigns/${activeCampaign.id}/scenes/${sceneId}/image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imagePrompt: updatedPrompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Scene image generation failed');
      updateCampaignInState(data.campaign);
      if (data.job) setJobs((prev) => [data.job, ...prev]);
    } catch (err: any) {
      setErrorBanner(err?.message || 'Scene image generation failed');
    } finally {
      setGeneratingSceneImageId(null);
    }
  };

  // Stage 3: Update Scenes (Reorder, Approve, Overlay Copy)
  const handleUpdateScenes = async (updatedScenes: SceneItem[]) => {
    if (!activeCampaign) return;
    try {
      const res = await fetch(`/api/campaigns/${activeCampaign.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenes: updatedScenes }),
      });
      if (res.ok) {
        const updated = await res.json();
        updateCampaignInState(updated);
      }
    } catch (err: any) {
      setErrorBanner(err?.message || 'Failed to update storyboard scenes');
    }
  };

  // Stage 4: Generate or Edit Scene Video via Gemini Omni Flash
  const handleGenerateOrEditVideo = async (
    sceneId: string,
    options?: { instruction?: string; videoPrompt?: string; cameraMovement?: string }
  ) => {
    if (!activeCampaign) return;
    setGeneratingSceneVideoId(sceneId);
    setErrorBanner(null);
    try {
      const res = await fetch(`/api/campaigns/${activeCampaign.id}/scenes/${sceneId}/video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options || {}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Scene video generation failed');
      updateCampaignInState(data.campaign);
      if (data.job) setJobs((prev) => [data.job, ...prev]);
    } catch (err: any) {
      setErrorBanner(err?.message || 'Scene video generation failed');
    } finally {
      setGeneratingSceneVideoId(null);
    }
  };

  // Stage 4: Restore Previous Scene Version
  const handleRestoreSceneVersion = async (sceneId: string, version: SceneVersion) => {
    if (!activeCampaign) return;
    const updatedScenes = activeCampaign.scenes.map((s) => {
      if (s.id !== sceneId) return s;
      return {
        ...s,
        videoUrl: version.videoUrl,
        cameraMovement: version.cameraMovement,
        videoPrompt: version.videoPrompt,
        directorNotes: `Restored v${version.version}: ${version.instruction}`,
        interactionId: version.interactionId,
      };
    });
    await handleUpdateScenes(updatedScenes);
  };

  // Stage 5: Generate Soundtrack via Lyria 3.5
  const handleGenerateSoundtrack = async (mood: string, prompt: string) => {
    if (!activeCampaign) return;
    setIsGeneratingAudio(true);
    setErrorBanner(null);
    try {
      const res = await fetch(`/api/campaigns/${activeCampaign.id}/soundtrack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mood, prompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Soundtrack generation failed');
      updateCampaignInState(data.campaign);
      if (data.job) setJobs((prev) => [data.job, ...prev]);
    } catch (err: any) {
      setErrorBanner(err?.message || 'Soundtrack generation failed');
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  // Stage 6 & 7: Assemble Final Video via FFmpeg
  const handleAssembleFinalVideo = async (includeInFinalMix: boolean, volumeLevel: number) => {
    if (!activeCampaign) return;
    setIsRenderingFinal(true);
    setErrorBanner(null);
    try {
      const res = await fetch(`/api/campaigns/${activeCampaign.id}/render`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ includeInFinalMix, volumeLevel }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'FFmpeg rendering failed');
      updateCampaignInState(data.campaign);
      if (data.job) setJobs((prev) => [data.job, ...prev]);
    } catch (err: any) {
      setErrorBanner(err?.message || 'FFmpeg rendering failed');
    } finally {
      setIsRenderingFinal(false);
    }
  };

  const handleDeleteCampaign = async (id: string) => {
    try {
      await fetch(`/api/campaigns/${id}`, { method: 'DELETE' });
      const remaining = campaigns.filter((c) => c.id !== id);
      setCampaigns(remaining);
      if (activeCampaignId === id) {
        setActiveCampaignId(remaining[0]?.id || '');
      }
    } catch {
      // ignore
    }
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-[#090A0D] text-[#F4F5F8] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
        <div className="text-xs font-mono uppercase tracking-widest text-[#9499A6]">
          Initializing GenMedia Studio Workstation...
        </div>
      </div>
    );
  }

  const readyImages = activeCampaign?.scenes.filter((s) => Boolean(s.imageUrl)).length || 0;
  const readyVideos = activeCampaign?.scenes.filter((s) => Boolean(s.videoUrl)).length || 0;
  const totalScenes = activeCampaign?.scenes.length || 0;

  return (
    <div className="min-h-screen bg-[#090A0D] text-[#F4F5F8] flex flex-col">
      {/* Top Studio Header Bar */}
      <header className="sticky top-0 z-30 bg-[#111318]/95 backdrop-blur border-b border-white/10 px-4 lg:px-6 py-3">
        <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-4">
          {/* Brand Title */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-sm bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Clapperboard className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight text-white font-display">
                  GENMEDIA STUDIO
                </h1>
                <span className="px-2 py-0.5 bg-white/5 border border-white/10 rounded-sm text-[10px] font-mono text-amber-400">
                  DEEPMIND HYDERABAD HACKATHON
                </span>
              </div>
              <p className="text-[11px] font-mono text-[#9499A6]">
                Nano Banana 2 Lite (`gemini-3.1-flash-lite-image`) • Gemini Omni Flash (`gemini-omni-1.1-flash`) • Lyria 3.5 (`lyria-3.5`) • FFmpeg
              </p>
            </div>
          </div>

          {/* Right Controls: Campaign Switcher, Verified Models Report, Auth */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowCampaignDrawer(!showCampaignDrawer)}
              className="px-3 py-1.5 bg-[#171A21] hover:bg-[#1F242D] border border-white/15 rounded-sm text-xs font-mono text-white flex items-center gap-2 transition cursor-pointer"
            >
              <FolderKanban className="w-3.5 h-3.5 text-amber-400" />
              <span>
                Campaign: {activeCampaign ? activeCampaign.brandName : 'New Campaign'} ({campaigns.length})
              </span>
            </button>

            <button
              type="button"
              onClick={() => setIsVerificationOpen(true)}
              className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-sm text-xs font-mono text-emerald-300 flex items-center gap-1.5 transition cursor-pointer"
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>Verified Models Report</span>
            </button>

            {user ? (
              <div className="flex items-center gap-2 pl-2 border-l border-white/10">
                <span className="text-xs font-mono text-[#9499A6] hidden sm:inline">
                  {user.displayName || user.email}
                </span>
                <button
                  type="button"
                  onClick={() => logOut()}
                  className="p-1.5 bg-[#171A21] hover:bg-white/10 border border-white/10 rounded-sm text-xs text-[#9499A6] hover:text-white cursor-pointer"
                  title="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => signInWithGoogle().catch(() => {})}
                className="px-3 py-1.5 bg-[#171A21] hover:bg-white/10 border border-white/15 rounded-sm text-xs font-mono text-zinc-300 flex items-center gap-1.5 cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5 text-amber-400" />
                <span>Cloud Sync</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Collapsible Campaign History & Switcher Bar */}
      {showCampaignDrawer && (
        <div className="bg-[#171A21] border-b border-white/15 px-4 lg:px-6 py-4">
          <div className="max-w-[1600px] mx-auto space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase text-amber-400 font-semibold">
                Persisted Campaign History & Asset Workspaces
              </span>
              <button
                type="button"
                onClick={() => {
                  setActiveCampaignId('');
                  setActiveTab('brief');
                  setShowCampaignDrawer(false);
                }}
                className="px-3 py-1 bg-amber-500 text-black font-semibold text-xs rounded-sm flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> New Campaign Brief
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {campaigns.map((camp) => {
                const isSelected = camp.id === activeCampaign?.id;
                return (
                  <div
                    key={camp.id}
                    className={`p-3 rounded-sm border flex flex-col justify-between gap-2 transition ${
                      isSelected
                        ? 'bg-[#111318] border-amber-400'
                        : 'bg-[#090A0D] border-white/10 hover:border-white/25'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveCampaignId(camp.id);
                          if (camp.scenes?.[0]) setSelectedSceneId(camp.scenes[0].id);
                          setShowCampaignDrawer(false);
                        }}
                        className="text-left cursor-pointer"
                      >
                        <div className="text-sm font-bold text-white hover:text-amber-400">
                          {camp.brandName}
                        </div>
                        <div className="text-[11px] font-mono text-[#9499A6]">
                          {camp.aspectRatio} • {camp.durationSeconds}s • {camp.scenes.length} Scenes
                        </div>
                      </button>
                      {campaigns.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleDeleteCampaign(camp.id)}
                          className="p-1 text-[#9499A6] hover:text-red-400 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-mono pt-2 border-t border-white/10">
                      <span className="uppercase text-emerald-400">{camp.status}</span>
                      <span className="text-[#9499A6]">
                        {new Date(camp.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 4-Stage Production Pipeline Navigation */}
      <div className="bg-[#111318] border-b border-white/10 px-4 lg:px-6">
        <div className="max-w-[1600px] mx-auto grid grid-cols-2 lg:grid-cols-4">
          <button
            type="button"
            onClick={() => setActiveTab('brief')}
            className={`py-3 px-4 border-b-2 text-left flex items-center justify-between transition cursor-pointer ${
              activeTab === 'brief'
                ? 'border-amber-400 bg-white/[0.03] text-white'
                : 'border-transparent text-[#9499A6] hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Wand2 className="w-4 h-4 text-amber-400" />
              <div>
                <div className="text-[10px] font-mono uppercase text-[#9499A6]">STEP 01 & 02</div>
                <div className="text-xs font-semibold">Brief & AI Campaign Planner</div>
              </div>
            </div>
            {activeCampaign?.plan && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          </button>

          <button
            type="button"
            disabled={!activeCampaign}
            onClick={() => setActiveTab('storyboard')}
            className={`py-3 px-4 border-b-2 text-left flex items-center justify-between transition cursor-pointer disabled:opacity-40 ${
              activeTab === 'storyboard'
                ? 'border-amber-400 bg-white/[0.03] text-white'
                : 'border-transparent text-[#9499A6] hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <ImageIcon className="w-4 h-4 text-amber-400" />
              <div>
                <div className="text-[10px] font-mono uppercase text-[#9499A6]">
                  STEP 03 • NANO BANANA 2 LITE
                </div>
                <div className="text-xs font-semibold">
                  Storyboard Grid ({readyImages}/{totalScenes})
                </div>
              </div>
            </div>
            {readyImages === totalScenes && totalScenes > 0 && (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            )}
          </button>

          <button
            type="button"
            disabled={!activeCampaign}
            onClick={() => setActiveTab('video')}
            className={`py-3 px-4 border-b-2 text-left flex items-center justify-between transition cursor-pointer disabled:opacity-40 ${
              activeTab === 'video'
                ? 'border-sky-400 bg-white/[0.03] text-white'
                : 'border-transparent text-[#9499A6] hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Film className="w-4 h-4 text-sky-400" />
              <div>
                <div className="text-[10px] font-mono uppercase text-[#9499A6]">
                  STEP 04 • GEMINI OMNI FLASH
                </div>
                <div className="text-xs font-semibold">
                  Video & Conversational Edit ({readyVideos}/{totalScenes})
                </div>
              </div>
            </div>
            {readyVideos > 0 && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          </button>

          <button
            type="button"
            disabled={!activeCampaign}
            onClick={() => setActiveTab('master')}
            className={`py-3 px-4 border-b-2 text-left flex items-center justify-between transition cursor-pointer disabled:opacity-40 ${
              activeTab === 'master'
                ? 'border-emerald-400 bg-white/[0.03] text-white'
                : 'border-transparent text-[#9499A6] hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Music className="w-4 h-4 text-emerald-400" />
              <div>
                <div className="text-[10px] font-mono uppercase text-[#9499A6]">
                  STEP 05–07 • LYRIA 3.5 + FFMPEG
                </div>
                <div className="text-xs font-semibold">Soundtrack & Master MP4 Export</div>
              </div>
            </div>
            {activeCampaign?.finalRender?.status === 'completed' && (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            )}
          </button>
        </div>
      </div>

      {/* Main Studio Workspace */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 lg:px-6 py-6 space-y-5">
        {errorBanner && (
          <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-sm flex items-center justify-between gap-3 text-xs text-red-200 font-mono">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorBanner}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorBanner(null)}
              className="px-2 py-0.5 bg-white/10 hover:bg-white/20 rounded-xs text-[11px]"
            >
              Dismiss
            </button>
          </div>
        )}

        {activeTab === 'brief' && (
          <BriefAndPlannerStage
            activeCampaign={activeCampaign}
            isPlanning={isPlanning}
            onPlanCampaign={handlePlanCampaign}
            onProceedToStoryboard={() => setActiveTab('storyboard')}
          />
        )}

        {activeTab === 'storyboard' && activeCampaign && (
          <StoryboardStage
            campaign={activeCampaign}
            generatingAllImages={generatingAllImages}
            generatingSceneImageId={generatingSceneImageId}
            onGenerateAllImages={handleGenerateAllImages}
            onGenerateSingleImage={handleGenerateSingleImage}
            onUpdateScenes={handleUpdateScenes}
            onProceedToVideo={(sceneId) => {
              if (sceneId) setSelectedSceneId(sceneId);
              setActiveTab('video');
            }}
          />
        )}

        {activeTab === 'video' && activeCampaign && (
          <VideoDirectorStage
            campaign={activeCampaign}
            selectedSceneId={selectedSceneId || activeCampaign.scenes[0]?.id || ''}
            onSelectScene={setSelectedSceneId}
            generatingSceneVideoId={generatingSceneVideoId}
            onGenerateOrEditVideo={handleGenerateOrEditVideo}
            onRestoreSceneVersion={handleRestoreSceneVersion}
            onProceedToScoreAndRender={() => setActiveTab('master')}
          />
        )}

        {activeTab === 'master' && activeCampaign && (
          <SoundtrackAndRenderStage
            campaign={activeCampaign}
            isGeneratingAudio={isGeneratingAudio}
            isRenderingFinal={isRenderingFinal}
            onGenerateSoundtrack={handleGenerateSoundtrack}
            onAssembleFinalVideo={handleAssembleFinalVideo}
          />
        )}
      </main>

      {/* Bottom Pipeline Job Status Bar */}
      <footer className="bg-[#111318] border-t border-white/10 px-4 lg:px-6 py-2.5 text-xs font-mono text-[#9499A6]">
        <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>
              {jobs[0]
                ? `Latest Pipeline Job [${jobs[0].modelId}]: ${jobs[0].message} (${jobs[0].status.toUpperCase()})`
                : 'Pipeline Ready • All 3 Hackathon Models & FFmpeg Verified'}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span>Image: gemini-3.1-flash-lite-image</span>
            <span>Video: gemini-omni-1.1-flash</span>
            <span>Audio: lyria-3.5</span>
          </div>
        </div>
      </footer>

      <ModelVerificationModal
        isOpen={isVerificationOpen}
        onClose={() => setIsVerificationOpen(false)}
        report={verificationReport}
      />
    </div>
  );
}
