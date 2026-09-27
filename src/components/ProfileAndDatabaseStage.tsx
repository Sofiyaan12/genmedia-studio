import React, { useState } from 'react';
import { motion } from 'motion/react';
import { User } from 'firebase/auth';
import {
  ArrowUpRight,
  Code2,
  Copy,
  Database,
  Eye,
  LogIn,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  User as UserIcon,
} from 'lucide-react';
import { Campaign, PipelineJob } from '../types/campaign';

type StudioTab = 'agent' | 'brief' | 'storyboard' | 'video' | 'master' | 'docs' | 'profile';

interface Props {
  user: User | null;
  isGuest: boolean;
  campaigns: Campaign[];
  jobs: PipelineJob[];
  activeCampaignId: string;
  isSyncingCloud: boolean;
  onGoogleSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onOpenAuthPortal: () => void;
  onSelectCampaignAndNavigate: (campaignId: string, tab: StudioTab) => void;
  onCreateNewCampaign: () => void;
  onCloneStarterToUserDb: () => Promise<void>;
  onSyncAllToCloud: () => Promise<void>;
  onDeleteCampaign: (id: string) => Promise<void>;
}

export const ProfileAndDatabaseStage: React.FC<Props> = ({
  user,
  campaigns,
  jobs,
  activeCampaignId,
  isSyncingCloud,
  onGoogleSignIn,
  onSignOut,
  onOpenAuthPortal,
  onSelectCampaignAndNavigate,
  onCreateNewCampaign,
  onCloneStarterToUserDb,
  onSyncAllToCloud,
  onDeleteCampaign,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [inspectedDocId, setInspectedDocId] = useState<string | null>(null);
  const [cloningStarter, setCloningStarter] = useState(false);

  const totalScenes = campaigns.reduce((acc, c) => acc + (c.scenes?.length || 0), 0);
  const totalImages = campaigns.reduce(
    (acc, c) => acc + (c.scenes?.filter((s) => Boolean(s.imageUrl)).length || 0),
    0
  );
  const totalVideos = campaigns.reduce(
    (acc, c) =>
      acc +
      (c.scenes?.reduce(
        (vAcc, s) => vAcc + (s.videoUrl ? 1 : 0) + (s.versionHistory?.length || 0),
        0
      ) || 0),
    0
  );
  const totalSoundtracks = campaigns.reduce(
    (acc, c) => acc + (c.soundtrack?.audioUrl ? 1 : 0) + (c.soundtrack?.history?.length || 0),
    0
  );
  const totalMasterRenders = campaigns.filter(
    (c) => c.finalRender?.status === 'completed' && Boolean(c.finalRender?.videoUrl)
  ).length;

  const filteredCampaigns = campaigns.filter(
    (c) =>
      !searchTerm.trim() ||
      c.brandName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.productDescription.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCloneStarter = async () => {
    setCloningStarter(true);
    try {
      await onCloneStarterToUserDb();
    } finally {
      setCloningStarter(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-6"
    >
      {/* Section 1: Producer Profile & Cloud Library Card */}
      <div className="glass-panel rounded-2xl p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4">
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || 'User'}
                className="w-16 h-16 rounded-2xl border border-[#E2B86B]/50 object-cover shrink-0"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl glass-subpanel flex items-center justify-center text-[#E2B86B] shrink-0">
                <UserIcon className="w-7 h-7" />
              </div>
            )}

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#9A9893]">
                <span className="text-[#E2B86B] font-medium">
                  {user ? 'Authenticated Producer' : 'Guest Showcase Session'}
                </span>
                <span aria-hidden="true">·</span>
                <span>{user ? 'Private Cloud Sync Active' : 'Read-Only Mode'}</span>
              </div>

              <h2 className="text-2xl font-semibold text-[#F5F3EF] font-display">
                {user ? user.displayName || user.email || 'Creative Producer' : 'Guest Studio Viewer'}
              </h2>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#9A9893]">
                <span>{user?.email || 'Not signed in'}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono">{user?.uid || 'public-demo'}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {user ? (
              <>
                <button
                  type="button"
                  onClick={onSyncAllToCloud}
                  disabled={isSyncingCloud}
                  className="px-4 py-2.5 btn-glass rounded-xl text-xs font-medium flex items-center gap-2 cursor-pointer whitespace-nowrap"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-[#E2B86B] ${isSyncingCloud ? 'animate-spin' : ''}`} />
                  <span>{isSyncingCloud ? 'Syncing Cloud...' : 'Sync Library'}</span>
                </button>

                <button
                  type="button"
                  onClick={onCreateNewCampaign}
                  className="px-4 py-2.5 btn-champagne rounded-xl text-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Campaign</span>
                </button>

                <button
                  type="button"
                  onClick={onSignOut}
                  className="px-4 py-2.5 btn-glass rounded-xl text-xs text-[#9A9893] hover:text-red-300 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onGoogleSignIn}
                  className="px-5 py-2.5 btn-champagne rounded-xl text-xs flex items-center gap-2 cursor-pointer whitespace-nowrap"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Sign in with Google</span>
                </button>

                <button
                  type="button"
                  onClick={onOpenAuthPortal}
                  className="px-4 py-2.5 btn-glass rounded-xl text-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Eye className="w-3.5 h-3.5 text-[#E2B86B]" />
                  <span>Portal Overview</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Section 2: Studio Archive Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="glass-panel rounded-2xl p-4">
          <div className="text-xs text-[#9A9893]">Campaigns</div>
          <div className="text-2xl font-semibold text-[#F5F3EF] font-mono mt-1 tabular-nums">
            {campaigns.length}
          </div>
          <div className="text-[11px] text-[#E2B86B] mt-0.5 tabular-nums">
            {totalScenes} Total Scenes
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-4">
          <div className="text-xs text-[#9A9893]">1K Storyboards</div>
          <div className="text-2xl font-semibold text-[#F5F3EF] font-mono mt-1 tabular-nums">
            {totalImages}
          </div>
          <div className="text-[11px] text-[#9A9893] mt-0.5">Nano Banana 2 Lite</div>
        </div>

        <div className="glass-panel rounded-2xl p-4">
          <div className="text-xs text-[#9A9893]">Motion Clips &amp; Takes</div>
          <div className="text-2xl font-semibold text-[#F5F3EF] font-mono mt-1 tabular-nums">
            {totalVideos}
          </div>
          <div className="text-[11px] text-[#9A9893] mt-0.5">Gemini Omni Flash</div>
        </div>

        <div className="glass-panel rounded-2xl p-4">
          <div className="text-xs text-[#9A9893]">Musical Scores</div>
          <div className="text-2xl font-semibold text-[#F5F3EF] font-mono mt-1 tabular-nums">
            {totalSoundtracks}
          </div>
          <div className="text-[11px] text-[#9A9893] mt-0.5">Lyria 3.5</div>
        </div>

        <div className="glass-panel rounded-2xl p-4">
          <div className="text-xs text-[#9A9893]">Master Exports</div>
          <div className="text-2xl font-semibold text-[#F5F3EF] font-mono mt-1 tabular-nums">
            {totalMasterRenders}
          </div>
          <div className="text-[11px] text-emerald-400 mt-0.5">24fps Validated</div>
        </div>

        <div className="glass-panel rounded-2xl p-4">
          <div className="text-xs text-[#9A9893]">Recorded Jobs</div>
          <div className="text-2xl font-semibold text-[#F5F3EF] font-mono mt-1 tabular-nums">
            {jobs.length}
          </div>
          <div className="text-[11px] text-[#9A9893] mt-0.5">Cloud Activity</div>
        </div>
      </div>

      {/* Section 3: Campaign Library Explorer */}
      <div className="glass-panel rounded-2xl p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
          <div>
            <div className="text-xs text-[#E2B86B] font-medium">Cloud Archive</div>
            <h3 className="text-2xl font-semibold text-[#F5F3EF] font-display mt-0.5">
              {user
                ? `${user.displayName || user.email}'s Production Library (${campaigns.length})`
                : `Curated Showcase Library (${campaigns.length})`}
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#9A9893] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by brand or description..."
                className="pl-9 pr-3.5 py-2 glass-input rounded-xl text-xs w-64"
              />
            </div>

            {user && (
              <button
                type="button"
                disabled={cloningStarter}
                onClick={handleCloneStarter}
                className="px-3.5 py-2 btn-glass rounded-xl text-xs font-medium text-[#E2B86B] flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>
                  {cloningStarter ? 'Cloning Showcase...' : 'Clone KONA AERO Showcase'}
                </span>
              </button>
            )}
          </div>
        </div>

        {filteredCampaigns.length === 0 ? (
          <div className="p-12 glass-subpanel rounded-2xl text-center space-y-3">
            <Database className="w-7 h-7 text-[#E2B86B] mx-auto opacity-60" />
            <div className="text-lg font-display text-[#F5F3EF]">
              No Campaigns Found in Library
            </div>
            <p className="text-xs text-[#9A9893] max-w-md mx-auto">
              Start a new production brief or clone the flagship KONA AERO commercial into your personal cloud workspace.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredCampaigns.map((camp) => {
              const isSelected = camp.id === activeCampaignId;
              const imgCount = camp.scenes?.filter((s) => Boolean(s.imageUrl)).length || 0;
              const vidCount = camp.scenes?.filter((s) => Boolean(s.videoUrl)).length || 0;
              const hasAudio = Boolean(camp.soundtrack?.audioUrl);
              const hasMaster =
                camp.finalRender?.status === 'completed' && Boolean(camp.finalRender?.videoUrl);
              const isInspecting = inspectedDocId === camp.id;

              return (
                <div
                  key={camp.id}
                  className={`p-5 rounded-2xl border transition-all space-y-3 ${
                    isSelected
                      ? 'bg-[#E2B86B]/[0.06] border-[#E2B86B]/50'
                      : 'glass-subpanel border-white/[0.07]'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#9A9893]">
                        <span className="text-lg font-semibold text-[#F5F3EF] font-display">
                          {camp.brandName}
                        </span>
                        {isSelected && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-[#E2B86B] font-medium">Active in Studio</span>
                          </>
                        )}
                        <span aria-hidden="true">·</span>
                        <span className="text-emerald-400 capitalize">{camp.status}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono text-[11px]">{camp.id}</span>
                      </div>

                      <p className="text-xs text-[#D6D3CD] line-clamp-1 max-w-3xl">
                        {camp.productDescription}
                      </p>

                      {/* Unboxed Metadata Row */}
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#9A9893] font-mono tabular-nums pt-0.5">
                        <span>
                          {camp.aspectRatio} ({camp.durationSeconds}s)
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          Frames {imgCount}/{camp.scenes.length}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          Clips {vidCount}/{camp.scenes.length}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>Score: {hasAudio ? 'Ready' : 'Pending'}</span>
                        <span aria-hidden="true">·</span>
                        <span>Master: {hasMaster ? 'Verified' : 'Pending'}</span>
                      </div>
                    </div>

                    {/* Stage Jump Actions */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => onSelectCampaignAndNavigate(camp.id, 'brief')}
                        className="px-3 py-1.5 btn-glass rounded-xl text-xs flex items-center gap-1 cursor-pointer whitespace-nowrap"
                      >
                        <span>Brief</span>
                        <ArrowUpRight className="w-3 h-3 text-[#E2B86B]" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onSelectCampaignAndNavigate(camp.id, 'storyboard')}
                        className="px-3 py-1.5 btn-glass rounded-xl text-xs flex items-center gap-1 cursor-pointer whitespace-nowrap"
                      >
                        <span>Storyboard ({imgCount})</span>
                        <ArrowUpRight className="w-3 h-3 text-[#E2B86B]" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onSelectCampaignAndNavigate(camp.id, 'video')}
                        className="px-3 py-1.5 btn-glass rounded-xl text-xs flex items-center gap-1 cursor-pointer whitespace-nowrap"
                      >
                        <span>Motion ({vidCount})</span>
                        <ArrowUpRight className="w-3 h-3 text-[#E2B86B]" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onSelectCampaignAndNavigate(camp.id, 'master')}
                        className="px-3 py-1.5 btn-champagne rounded-xl text-xs flex items-center gap-1 cursor-pointer whitespace-nowrap"
                      >
                        <span>Master</span>
                        <ArrowUpRight className="w-3 h-3" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setInspectedDocId(isInspecting ? null : camp.id)}
                        className="p-2 btn-glass rounded-xl text-xs text-[#9A9893] hover:text-[#F5F3EF] cursor-pointer"
                        title="Inspect Document JSON"
                      >
                        <Code2 className="w-3.5 h-3.5" />
                      </button>

                      {user && (
                        <button
                          type="button"
                          onClick={() => onDeleteCampaign(camp.id)}
                          className="p-2 btn-glass rounded-xl text-[#9A9893] hover:text-red-300 cursor-pointer"
                          title="Delete Campaign"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {isInspecting && (
                    <div className="pt-3 border-t border-white/[0.07]">
                      <pre className="p-4 bg-black/50 border border-white/[0.08] rounded-xl text-[11px] font-mono text-[#D6D3CD] overflow-x-auto max-h-64">
                        {JSON.stringify(camp, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Section 4: Recent Studio Activity Table */}
      <div className="glass-panel rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
          <div>
            <div className="text-xs text-[#E2B86B] font-medium">Activity Log</div>
            <h3 className="text-xl font-semibold text-[#F5F3EF] font-display mt-0.5">
              Recent Generation &amp; Render Tasks ({jobs.length})
            </h3>
          </div>
        </div>

        {jobs.length === 0 ? (
          <div className="p-6 text-center text-xs text-[#9A9893]">
            No studio tasks recorded for this session yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/[0.08] text-[#9A9893]">
                  <th className="py-2.5 px-3 font-medium">Stage</th>
                  <th className="py-2.5 px-3 font-medium">Engine</th>
                  <th className="py-2.5 px-3 font-medium">Status</th>
                  <th className="py-2.5 px-3 font-medium text-right">Progress</th>
                  <th className="py-2.5 px-3 font-medium">Summary</th>
                  <th className="py-2.5 px-3 font-medium text-right">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06] text-[#D6D3CD]">
                {jobs.slice(0, 15).map((job) => (
                  <tr key={job.id} className="hover:bg-white/[0.02]">
                    <td className="py-2.5 px-3 capitalize text-[#F5F3EF]">{job.type}</td>
                    <td className="py-2.5 px-3 font-mono text-[#E2B86B]">{job.modelId}</td>
                    <td className="py-2.5 px-3 capitalize">
                      <span
                        className={
                          job.status === 'completed'
                            ? 'text-emerald-400'
                            : job.status === 'failed'
                              ? 'text-red-400'
                              : 'text-[#E2B86B]'
                        }
                      >
                        {job.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-right tabular-nums">
                      {job.progress}%
                    </td>
                    <td className="py-2.5 px-3 max-w-md truncate text-[#9A9893]">{job.message}</td>
                    <td className="py-2.5 px-3 font-mono text-right text-[#9A9893] tabular-nums">
                      {new Date(job.updatedAt).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </motion.div>
  );
};
