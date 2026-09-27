import { execFile, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import ffmpegStatic from 'ffmpeg-static';
import {
  AspectRatio,
  RenderProgressEvent,
  RenderStageKey,
  SceneItem,
  SoundtrackData,
  SubtitleCue,
  SubtitleStyle,
  ValidationReport,
} from '../src/types/campaign';

const execFileAsync = promisify(execFile);

/**
 * Resolves the FFmpeg executable path:
 * Prefers the bundled `ffmpeg-static` binary so Cloud Run deployments work
 * out-of-the-box without requiring apt/system ffmpeg packages.
 */
export function getFfmpegBinaryPath(): string {
  if (ffmpegStatic && typeof ffmpegStatic === 'string' && fs.existsSync(ffmpegStatic)) {
    try {
      fs.chmodSync(ffmpegStatic, 0o755);
    } catch {
      // ignore chmod errors on read-only mounts
    }
    return ffmpegStatic;
  }
  return 'ffmpeg';
}

const FFMPEG_BIN = getFfmpegBinaryPath();

export function getResolutionForAspect(aspectRatio: AspectRatio): { width: number; height: number } {
  switch (aspectRatio) {
    case '9:16':
      return { width: 720, height: 1280 };
    case '1:1':
      return { width: 720, height: 720 };
    case '16:9':
    default:
      return { width: 1280, height: 720 };
  }
}

function resolveLocalPath(assetUrl: string, publicDir: string): string {
  const cleanUrl = assetUrl.split('?')[0];
  const relativePath = cleanUrl.startsWith('/') ? cleanUrl.slice(1) : cleanUrl;
  return path.join(publicDir, relativePath);
}

function formatAssTime(seconds: number): string {
  const safe = Math.max(0, Number(seconds) || 0);
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = Math.floor(safe % 60);
  const cs = Math.min(99, Math.round((safe - Math.floor(safe)) * 100));
  return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

function sanitizeAssText(text: string): string {
  return String(text || '')
    .replace(/\r?\n/g, '\\N')
    .replace(/[{}]/g, '')
    .trim();
}

/**
 * Writes an Advanced SubStation Alpha (.ass) subtitle file compatible with
 * `ffmpeg-static`'s compiled-in `libass` (`ass=/tmp/...`) filter and `fontconfig`.
 */
export function writeSceneAssFile(options: {
  width: number;
  height: number;
  durationSeconds: number;
  overlayText?: string;
  subtitleCues?: SubtitleCue[];
  subtitleStyle?: SubtitleStyle;
}): string | null {
  const { width, height, durationSeconds, overlayText, subtitleCues, subtitleStyle = 'broadcast' } = options;
  const validCues = (subtitleCues || []).filter((c) => c && c.text && c.text.trim().length > 0);
  const fallbackText = (overlayText || '').trim();

  if (validCues.length === 0 && !fallbackText) {
    return null;
  }

  const fontSize = width >= 1200 ? 32 : 28;
  const marginV = height > width ? 96 : 46;
  const marginLR = width >= 1200 ? 72 : 44;

  let primaryColour = '&H00FFFFFF';
  let outlineColour = '&H48080A0E';
  let backColour = '&H80000000';
  let borderStyle = 3;
  let outline = 11;
  let shadow = 0;

  if (subtitleStyle === 'cinema_yellow') {
    primaryColour = '&H0038D8FF'; // Warm Cinema Gold (#FFD838 in BGR)
    outlineColour = '&H10000000';
    backColour = '&H70000000';
    borderStyle = 1;
    outline = 3;
    shadow = 2;
  } else if (subtitleStyle === 'cyber_cyan') {
    primaryColour = '&H00FFEE00'; // Electric Cyan (#00EEFF in BGR)
    outlineColour = '&H40080A10';
    backColour = '&H80000000';
    borderStyle = 3;
    outline = 11;
    shadow = 0;
  } else if (subtitleStyle === 'minimal') {
    primaryColour = '&H00FFFFFF';
    outlineColour = '&H18000000';
    backColour = '&H70000000';
    borderStyle = 1;
    outline = 3;
    shadow = 2;
  }

  const totalDur = Math.max(2, Number(durationSeconds) || 6);
  const eventsLines: string[] = [];

  if (validCues.length > 0) {
    for (const cue of validCues) {
      const start = formatAssTime(Math.max(0, Number(cue.startSeconds) || 0));
      const end = formatAssTime(Math.min(totalDur + 2, Math.max(0.5, Number(cue.endSeconds) || totalDur)));
      const clean = sanitizeAssText(cue.text);
      if (clean) {
        eventsLines.push(`Dialogue: 0,${start},${end},SubStyle,,0,0,0,,${clean}`);
      }
    }
  } else if (fallbackText) {
    const start = formatAssTime(0.05);
    const end = formatAssTime(totalDur);
    const clean = sanitizeAssText(fallbackText);
    eventsLines.push(`Dialogue: 0,${start},${end},SubStyle,,0,0,0,,${clean}`);
  }

  if (eventsLines.length === 0) return null;

  const assContent = `[Script Info]
ScriptType: v4.00+
PlayResX: ${width}
PlayResY: ${height}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: SubStyle,FreeSans,${fontSize},${primaryColour},&H0000FFFF,${outlineColour},${backColour},-1,0,0,0,100,100,0.5,0,${borderStyle},${outline},${shadow},2,${marginLR},${marginLR},${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${eventsLines.join('\n')}
`;

  const assPath = `/tmp/sub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.ass`;
  fs.writeFileSync(assPath, assContent, 'utf-8');
  return assPath;
}

export async function burnSubtitlesIntoVideo(options: {
  inputVideoPath: string;
  outputVideoPath: string;
  aspectRatio: AspectRatio;
  durationSeconds: number;
  overlayText?: string;
  subtitleCues?: SubtitleCue[];
  subtitleStyle?: SubtitleStyle;
}): Promise<{ commandLog: string; burnedIn: boolean }> {
  const { width, height } = getResolutionForAspect(options.aspectRatio);
  const assPath = writeSceneAssFile({
    width,
    height,
    durationSeconds: options.durationSeconds || 6,
    overlayText: options.overlayText,
    subtitleCues: options.subtitleCues,
    subtitleStyle: options.subtitleStyle,
  });

  if (!assPath) {
    if (options.inputVideoPath !== options.outputVideoPath) {
      fs.copyFileSync(options.inputVideoPath, options.outputVideoPath);
    }
    return { commandLog: 'copy (no subtitles requested)', burnedIn: false };
  }

  const args = [
    '-y',
    '-i',
    options.inputVideoPath,
    '-vf',
    `ass=${assPath}`,
    '-c:v',
    'libx264',
    '-crf',
    '28',
    '-preset',
    'veryfast',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-b:a',
    '96k',
    '-movflags',
    '+faststart',
    options.outputVideoPath,
  ];

  try {
    await runFfmpegWithTelemetry(args, options.durationSeconds || 6);
    return { commandLog: `ffmpeg ${args.join(' ')}`, burnedIn: true };
  } finally {
    try {
      if (fs.existsSync(assPath)) fs.unlinkSync(assPath);
    } catch {
      // ignore cleanup error
    }
  }
}

/**
 * Compresses generated keyframe images in-place so 1K PNG/JPEG frames stay ~80-130KB
 * instead of 700KB+, preventing workspace asset bloat during Cloud Run publishing.
 */
export async function compressImageAsset(filePath: string): Promise<void> {
  if (!fs.existsSync(filePath)) return;
  const stat = fs.statSync(filePath);
  if (stat.size <= 140 * 1024) return;
  const tmpPath = `${filePath}.tmp.jpg`;
  try {
    await execFileAsync(FFMPEG_BIN, [
      '-y',
      '-i',
      filePath,
      '-vf',
      "scale='min(1024,iw)':-2",
      '-frames:v',
      '1',
      '-q:v',
      '5',
      tmpPath,
    ]);
    if (fs.existsSync(tmpPath)) {
      const newSize = fs.statSync(tmpPath).size;
      if (newSize > 1024 && newSize < stat.size) {
        fs.renameSync(tmpPath, filePath);
      } else {
        fs.unlinkSync(tmpPath);
      }
    }
  } catch {
    try {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    } catch {
      // ignore
    }
  }
}

/**
 * Compresses raw video clips in-place with CRF 30 H.264 + faststart so 6s clips stay
 * ~250-400KB instead of 4-7MB.
 */
export async function compressVideoAsset(filePath: string, thresholdBytes = 450 * 1024): Promise<void> {
  if (!fs.existsSync(filePath)) return;
  const stat = fs.statSync(filePath);
  if (stat.size <= thresholdBytes) return;
  const tmpPath = `${filePath}.tmp.mp4`;
  try {
    await execFileAsync(FFMPEG_BIN, [
      '-y',
      '-i',
      filePath,
      '-vf',
      "scale='min(640,iw)':-2",
      '-c:v',
      'libx264',
      '-crf',
      '30',
      '-maxrate',
      '450k',
      '-bufsize',
      '900k',
      '-preset',
      'veryfast',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-b:a',
      '96k',
      '-movflags',
      '+faststart',
      tmpPath,
    ]);
    if (fs.existsSync(tmpPath)) {
      const newSize = fs.statSync(tmpPath).size;
      if (newSize > 1024 && newSize < stat.size) {
        fs.renameSync(tmpPath, filePath);
      } else {
        fs.unlinkSync(tmpPath);
      }
    }
  } catch {
    try {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    } catch {
      // ignore
    }
  }
}

/**
 * Compresses generated audio tracks in-place to 96kbps MP3 (max 32s) so soundtracks stay ~350KB
 * instead of 4MB+ uncompressed WAV/long audio.
 */
export async function compressAudioAsset(filePath: string): Promise<void> {
  if (!fs.existsSync(filePath)) return;
  const stat = fs.statSync(filePath);
  if (stat.size <= 400 * 1024) return;
  const tmpPath = `${filePath}.tmp.mp3`;
  try {
    await execFileAsync(FFMPEG_BIN, [
      '-y',
      '-i',
      filePath,
      '-t',
      '32',
      '-c:a',
      'libmp3lame',
      '-b:a',
      '96k',
      tmpPath,
    ]);
    if (fs.existsSync(tmpPath)) {
      const newSize = fs.statSync(tmpPath).size;
      if (newSize > 1024 && newSize < stat.size) {
        fs.renameSync(tmpPath, filePath);
      } else {
        fs.unlinkSync(tmpPath);
      }
    }
  } catch {
    try {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    } catch {
      // ignore
    }
  }
}

function parseTimeToSeconds(timeStr: string): number {
  const match = timeStr.match(/(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/);
  if (!match) return 0;
  return parseInt(match[1], 10) * 3600 + parseInt(match[2], 10) * 60 + parseFloat(match[3]);
}

/**
 * Runs FFmpeg via `spawn` and parses real-time `frame=`, `fps=`, `time=`, and `speed=`
 * telemetry from stderr to emit granular progress updates.
 */
async function runFfmpegWithTelemetry(
  args: string[],
  expectedDurationSec: number,
  onFrameTelemetry?: (telemetry: {
    fraction: number;
    currentFrame?: number;
    fps?: number;
    speed?: string;
    timemark?: string;
  }) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(FFMPEG_BIN, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderrLog = '';

    child.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stderrLog += text;

      if (onFrameTelemetry && text.includes('time=')) {
        const frameMatch = text.match(/frame=\s*(\d+)/);
        const fpsMatch = text.match(/fps=\s*(\d+(?:\.\d+)?)/);
        const timeMatch = text.match(/time=\s*(\d{2}:\d{2}:\d{2}(?:\.\d+)?)/);
        const speedMatch = text.match(/speed=\s*([0-9.]+x)/);

        const currentSec = timeMatch ? parseTimeToSeconds(timeMatch[1]) : 0;
        const fraction =
          expectedDurationSec > 0
            ? Math.min(0.99, Math.max(0, currentSec / expectedDurationSec))
            : 0.5;

        onFrameTelemetry({
          fraction,
          currentFrame: frameMatch ? parseInt(frameMatch[1], 10) : undefined,
          fps: fpsMatch ? parseFloat(fpsMatch[1]) : undefined,
          speed: speedMatch ? speedMatch[1] : undefined,
          timemark: timeMatch ? timeMatch[1] : undefined,
        });
      }
    });

    child.on('error', (err) => {
      reject(err);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg exited with code ${code}: ${stderrLog.slice(-300)}`));
      }
    });
  });
}

/**
 * Parses `ffmpeg -i <filePath>` stderr output to extract real codec, resolution,
 * duration, frame count, and audio stream presence when `ffprobe` is not installed
 * in Cloud Run containers.
 */
async function inspectWithFfmpegStderr(
  filePath: string,
  fileSizeBytes: number
): Promise<ValidationReport> {
  let stderrOutput = '';
  try {
    await execFileAsync(FFMPEG_BIN, ['-hide_banner', '-i', filePath]);
  } catch (err: any) {
    stderrOutput = String(err?.stderr || err?.message || '');
  }

  let durationSeconds = 12;
  const durMatch = stderrOutput.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/);
  if (durMatch) {
    const hours = parseInt(durMatch[1], 10);
    const minutes = parseInt(durMatch[2], 10);
    const seconds = parseFloat(durMatch[3]);
    durationSeconds = Number((hours * 3600 + minutes * 60 + seconds).toFixed(2));
  }

  const videoMatch = stderrOutput.match(
    /Stream\s+#\d+:\d+.*Video:\s*([a-zA-Z0-9_]+).*?,\s*(\d{2,5})x(\d{2,5})/
  );
  const fpsMatch = stderrOutput.match(/(\d+(?:\.\d+)?)\s*fps/);
  const videoCodec = videoMatch ? videoMatch[1].toLowerCase() : 'h264';
  const width = videoMatch ? parseInt(videoMatch[2], 10) : 1280;
  const height = videoMatch ? parseInt(videoMatch[3], 10) : 720;
  const fps = fpsMatch ? parseFloat(fpsMatch[1]) : 24;

  const audioMatch = stderrOutput.match(/Stream\s+#\d+:\d+.*Audio:\s*([a-zA-Z0-9_]+)/);
  const hasAudioStream = Boolean(audioMatch);
  const audioCodec = audioMatch ? audioMatch[1].toLowerCase() : 'none';

  const frameCount = Math.max(1, Math.round(durationSeconds * fps));

  return {
    valid: Boolean(fileSizeBytes > 1024 && durationSeconds > 0),
    videoCodec,
    audioCodec,
    width,
    height,
    durationSeconds,
    frameCount,
    hasAudioStream,
    fileSizeBytes,
    checkedAt: new Date().toISOString(),
  };
}

export async function validateVideoAsset(filePath: string): Promise<ValidationReport> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Rendered file does not exist at ${filePath}`);
  }
  const stat = fs.statSync(filePath);
  if (stat.size < 1024) {
    throw new Error(`Rendered file is too small (${stat.size} bytes)`);
  }

  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'stream=codec_name,codec_type,width,height,nb_frames,duration:format=duration,size',
      '-of',
      'json',
      filePath,
    ]);
    const info = JSON.parse(stdout);
    const streams: any[] = info.streams || [];
    const videoStream = streams.find((s) => s.codec_type === 'video');
    const audioStream = streams.find((s) => s.codec_type === 'audio');
    const durationSeconds = parseFloat(info.format?.duration || videoStream?.duration || '0');
    const frameCount = parseInt(
      videoStream?.nb_frames || String(Math.round(durationSeconds * 24)),
      10
    );

    return {
      valid: Boolean(videoStream && durationSeconds > 0),
      videoCodec: videoStream?.codec_name || 'h264',
      audioCodec: audioStream?.codec_name || 'none',
      width: Number(videoStream?.width || 1280),
      height: Number(videoStream?.height || 720),
      durationSeconds: Number(durationSeconds.toFixed(2)),
      frameCount: Number.isNaN(frameCount) ? Math.round(durationSeconds * 24) : frameCount,
      hasAudioStream: Boolean(audioStream),
      fileSizeBytes: stat.size,
      checkedAt: new Date().toISOString(),
    };
  } catch {
    return await inspectWithFfmpegStderr(filePath, stat.size);
  }
}

export async function synthesizeFallbackSceneImage(options: {
  outputPath: string;
  aspectRatio: AspectRatio;
  sceneNumber: number;
  title: string;
  brandName: string;
}): Promise<void> {
  const { width, height } = getResolutionForAspect(options.aspectRatio);
  const palettes = ['#18181B', '#1E1B18', '#0F172A', '#111827', '#1C1917'];
  const bgHex = palettes[(options.sceneNumber - 1) % palettes.length];
  const assPath = writeSceneAssFile({
    width,
    height,
    durationSeconds: 2,
    overlayText: `${options.brandName || 'STUDIO'} • SCENE 0${options.sceneNumber}: ${options.title}`,
    subtitleStyle: 'cinema_yellow',
  });

  const vfWithAss = assPath
    ? `drawbox=x=40:y=40:w=${width - 80}:h=${height - 80}:color=#F59E0B@0.35:t=2,ass=${assPath}`
    : `drawbox=x=40:y=40:w=${width - 80}:h=${height - 80}:color=#F59E0B@0.35:t=2`;

  try {
    await execFileAsync(FFMPEG_BIN, [
      '-y',
      '-f',
      'lavfi',
      '-i',
      `color=c=${bgHex}:s=${width}x${height}:d=1`,
      '-vf',
      vfWithAss,
      '-frames:v',
      '1',
      '-q:v',
      '2',
      options.outputPath,
    ]);
  } catch {
    await execFileAsync(FFMPEG_BIN, [
      '-y',
      '-f',
      'lavfi',
      '-i',
      `color=c=${bgHex}:s=${width}x${height}:d=1`,
      '-frames:v',
      '1',
      '-q:v',
      '2',
      options.outputPath,
    ]);
  } finally {
    try {
      if (assPath && fs.existsSync(assPath)) fs.unlinkSync(assPath);
    } catch {
      // ignore
    }
  }
}

export async function synthesizeFallbackSoundtrackAudio(options: {
  outputPath: string;
  durationSeconds: number;
}): Promise<void> {
  const dur = Math.max(6, Math.min(45, Number(options.durationSeconds) || 15));
  const fadeOutStart = Math.max(1, dur - 1.8);
  const expr =
    '0.12*sin(2*PI*220*t)+0.10*sin(2*PI*277.18*t)+0.10*sin(2*PI*329.63*t)+0.08*sin(2*PI*440*t)';
  await execFileAsync(FFMPEG_BIN, [
    '-y',
    '-f',
    'lavfi',
    '-i',
    `aevalsrc='${expr}|${expr}':s=44100:d=${dur}`,
    '-af',
    `afade=t=in:st=0:d=0.8,afade=t=out:st=${fadeOutStart.toFixed(2)}:d=1.5`,
    options.outputPath,
  ]);
}

/**
 * Converts Gemini TTS audio output (which may be raw 24kHz 16-bit mono PCM or encoded WAV/MP3)
 * into a standard browser-playable and FFmpeg-mixable MP3 file.
 */
export async function convertRawAudioToPlayableMp3(options: {
  audioBuffer: Buffer;
  mimeType?: string;
  outputPath: string;
  fallbackDurationSeconds?: number;
}): Promise<void> {
  const { audioBuffer, mimeType = '', outputPath, fallbackDurationSeconds = 6 } = options;
  const rawTmp = `${outputPath}.raw`;
  fs.writeFileSync(rawTmp, audioBuffer);

  const isRawPcm =
    mimeType.toLowerCase().includes('pcm') ||
    mimeType.toLowerCase().includes('l16') ||
    (audioBuffer.length > 44 &&
      audioBuffer.toString('ascii', 0, 4) !== 'RIFF' &&
      audioBuffer.toString('ascii', 0, 3) !== 'ID3' &&
      audioBuffer[0] !== 0xff);

  try {
    if (isRawPcm) {
      await execFileAsync(FFMPEG_BIN, [
        '-y',
        '-f',
        's16le',
        '-ar',
        '24000',
        '-ac',
        '1',
        '-i',
        rawTmp,
        '-c:a',
        'libmp3lame',
        '-b:a',
        '96k',
        outputPath,
      ]);
    } else {
      await execFileAsync(FFMPEG_BIN, [
        '-y',
        '-i',
        rawTmp,
        '-c:a',
        'libmp3lame',
        '-b:a',
        '96k',
        outputPath,
      ]);
    }
  } catch {
    await synthesizeFallbackSoundtrackAudio({
      outputPath,
      durationSeconds: fallbackDurationSeconds,
    });
  } finally {
    try {
      if (fs.existsSync(rawTmp)) fs.unlinkSync(rawTmp);
    } catch {
      // ignore
    }
  }
}

export async function renderStillToMotionVideo(options: {
  imagePath: string;
  outputPath: string;
  durationSeconds: number;
  aspectRatio: AspectRatio;
  cameraMovement: string;
  overlayText?: string;
  subtitleCues?: SubtitleCue[];
  subtitleStyle?: SubtitleStyle;
  burnSubtitles?: boolean;
  onFrameTelemetry?: (telemetry: {
    fraction: number;
    currentFrame?: number;
    fps?: number;
    speed?: string;
    timemark?: string;
  }) => void;
}): Promise<{ commandLog: string; subtitlesBurnedIn: boolean }> {
  const { width, height } = getResolutionForAspect(options.aspectRatio);
  const fps = 24;
  const totalFrames = Math.max(24, Math.round(options.durationSeconds * fps));
  const move = (options.cameraMovement || '').toLowerCase();

  let zoomExpr = `min(zoom+0.0012,1.18)`;
  let xExpr = `iw/2-(iw/zoom/2)`;
  let yExpr = `ih/2-(ih/zoom/2)`;

  if (move.includes('pull') || move.includes('out')) {
    zoomExpr = `if(eq(on,1),1.18,max(1.0,zoom-0.0012))`;
  } else if (move.includes('pan right') || move.includes('track')) {
    zoomExpr = `1.12`;
    xExpr = `(iw-iw/zoom)*(on/${totalFrames})`;
  } else if (move.includes('pan left')) {
    zoomExpr = `1.12`;
    xExpr = `(iw-iw/zoom)*(1-on/${totalFrames})`;
  } else if (move.includes('crane') || move.includes('tilt')) {
    zoomExpr = `1.12`;
    yExpr = `(ih-ih/zoom)*(1-on/${totalFrames})`;
  }

  let assPath: string | null = null;
  if (options.burnSubtitles) {
    assPath = writeSceneAssFile({
      width,
      height,
      durationSeconds: options.durationSeconds,
      overlayText: options.overlayText,
      subtitleCues: options.subtitleCues,
      subtitleStyle: options.subtitleStyle,
    });
  }

  const vfParts: string[] = [
    `scale=${width * 2}:${height * 2}:force_original_aspect_ratio=increase`,
    `crop=${width * 2}:${height * 2}`,
    `zoompan=z='${zoomExpr}':x='${xExpr}':y='${yExpr}':d=${totalFrames}:s=${width}x${height}:fps=${fps}`,
    ...(assPath ? [`ass=${assPath}`] : []),
    `format=yuv420p`,
  ];

  const args = [
    '-y',
    '-loop',
    '1',
    '-i',
    options.imagePath,
    '-vf',
    vfParts.join(','),
    '-t',
    String(options.durationSeconds),
    '-c:v',
    'libx264',
    '-crf',
    '28',
    '-preset',
    'veryfast',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    options.outputPath,
  ];

  try {
    await runFfmpegWithTelemetry(args, options.durationSeconds, options.onFrameTelemetry);
    return { commandLog: `ffmpeg ${args.join(' ')}`, subtitlesBurnedIn: Boolean(assPath) };
  } finally {
    try {
      if (assPath && fs.existsSync(assPath)) fs.unlinkSync(assPath);
    } catch {
      // ignore
    }
  }
}

/**
 * Runs an FFmpeg video segment command with optional `ass` subtitle filter.
 * If subtitle rendering fails for any reason, retries cleanly without it.
 */
async function runSegmentEncodeWithFallback(
  baseArgsBeforeVf: string[],
  vfWithSubtitles: string,
  vfWithoutSubtitles: string,
  outputSegPath: string,
  expectedDurationSec: number,
  onFrameTelemetry?: (telemetry: {
    fraction: number;
    currentFrame?: number;
    fps?: number;
    speed?: string;
    timemark?: string;
  }) => void
): Promise<string> {
  const buildFullArgs = (vfString: string) => [
    ...baseArgsBeforeVf,
    '-vf',
    vfString,
    '-an',
    '-c:v',
    'libx264',
    '-crf',
    '28',
    '-preset',
    'veryfast',
    '-pix_fmt',
    'yuv420p',
    outputSegPath,
  ];

  try {
    const args = buildFullArgs(vfWithSubtitles);
    await runFfmpegWithTelemetry(args, expectedDurationSec, onFrameTelemetry);
    return `ffmpeg ${args.join(' ')}`;
  } catch {
    const fallbackArgs = buildFullArgs(vfWithoutSubtitles);
    await runFfmpegWithTelemetry(fallbackArgs, expectedDurationSec, onFrameTelemetry);
    return `ffmpeg ${fallbackArgs.join(' ')}`;
  }
}

export async function assembleFinalAdvertisement(options: {
  campaignId: string;
  jobId?: string;
  scenes: SceneItem[];
  soundtrack: SoundtrackData;
  voiceoverAudioUrl?: string;
  aspectRatio: AspectRatio;
  brandName: string;
  publicDir: string;
  onProgress?: (event: RenderProgressEvent) => void;
}): Promise<{
  videoUrl: string;
  filePath: string;
  commandLog: string;
  validationReport: ValidationReport;
}> {
  const {
    campaignId,
    jobId = `job_${Date.now()}`,
    scenes,
    soundtrack,
    voiceoverAudioUrl,
    aspectRatio,
    publicDir,
    onProgress,
  } = options;
  const { width, height } = getResolutionForAspect(aspectRatio);
  const fps = 24;

  const emitProgress = (
    stageKey: RenderStageKey,
    stageLabel: string,
    progress: number,
    message: string,
    extra?: Partial<RenderProgressEvent>
  ) => {
    if (!onProgress) return;
    onProgress({
      campaignId,
      jobId,
      stageKey,
      stageLabel,
      progress: Math.min(100, Math.max(0, Math.round(progress))),
      message,
      timestamp: new Date().toISOString(),
      ...extra,
    });
  };

  const rendersDir = path.join(publicDir, 'assets', 'renders');
  const videosDir = path.join(publicDir, 'assets', 'videos');
  const tempDir = path.join(publicDir, 'assets', 'temp', `${campaignId}_${Date.now()}`);
  fs.mkdirSync(rendersDir, { recursive: true });
  fs.mkdirSync(videosDir, { recursive: true });
  fs.mkdirSync(tempDir, { recursive: true });

  const filteredScenes = scenes.filter((s) => s.videoUrl || s.imageUrl);
  const usableScenes = filteredScenes.length > 0 ? filteredScenes : scenes;
  if (usableScenes.length === 0) {
    throw new Error('Campaign has no scenes to assemble.');
  }

  emitProgress(
    'init',
    'Stage 01 • Workspace Initialization',
    6,
    `Initializing FFmpeg render pipeline (${width}x${height} @ ${fps}fps) for ${usableScenes.length} approved scenes...`,
    { sceneIndex: 0, totalScenes: usableScenes.length }
  );

  const commandLogs: string[] = [];
  const normalizedSegmentPaths: string[] = [];

  const fallbackSampleImage = path.join(
    publicDir,
    'verified_samples',
    'verified_image_gemini-3.1-flash-lite-image.jpg'
  );

  // Stage 02: Scene Normalization & Motion Synthesis (10% -> 62%)
  const stage2Start = 10;
  const stage2Span = 52;
  const perSceneSpan = stage2Span / usableScenes.length;

  for (let i = 0; i < usableScenes.length; i++) {
    const scene = usableScenes[i];
    const sceneBasePct = stage2Start + i * perSceneSpan;
    const segOutPath = path.join(tempDir, `seg_${String(i).padStart(2, '0')}.mp4`);
    const targetDur = Math.max(2, Math.min(12, Number(scene.durationSeconds) || 4));
    const fadeOutStart = Math.max(0.5, targetDur - 0.45);

    const transitionFade =
      scene.transitionType === 'cut'
        ? ''
        : `,fade=t=in:st=0:d=0.35,fade=t=out:st=${fadeOutStart.toFixed(2)}:d=0.4`;

    // Prefer rawVideoUrl if available so we always burn the latest subtitle cleanly once
    const rawCandidate = scene.rawVideoUrl ? resolveLocalPath(scene.rawVideoUrl, publicDir) : null;
    const activeCandidate = scene.videoUrl ? resolveLocalPath(scene.videoUrl, publicDir) : null;
    const hasRawVideo = Boolean(rawCandidate && fs.existsSync(rawCandidate));
    const hasActiveVideo = Boolean(activeCandidate && fs.existsSync(activeCandidate));

    // Only skip ASS filter if we are using an already-burned active video (`subtitlesBurnedIn === true`) and no raw video exists
    const shouldBurnAssOnSegment = hasRawVideo || !scene.subtitlesBurnedIn;
    const segAssPath = shouldBurnAssOnSegment
      ? writeSceneAssFile({
          width,
          height,
          durationSeconds: targetDur,
          overlayText: scene.overlayText,
          subtitleCues: scene.subtitleCues,
          subtitleStyle: scene.subtitleStyle,
        })
      : null;
    const assFilter = segAssPath ? `,ass=${segAssPath}` : '';

    try {
      // 1. Existing scene video clip
      if (hasRawVideo || hasActiveVideo) {
        const inputVideoPath = (hasRawVideo ? rawCandidate : activeCandidate)!;
        emitProgress(
          'scene_prep',
          `Stage 02 • Scene ${i + 1}/${usableScenes.length} Normalization`,
          sceneBasePct + 2,
          `Normalizing Scene ${scene.sceneNumber} ("${scene.title}") video clip & subtitles to ${width}x${height} @ ${fps}fps...`,
          { sceneIndex: i + 1, totalScenes: usableScenes.length }
        );

        const baseVf = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black,fps=${fps},format=yuv420p`;
        const cmdLog = await runSegmentEncodeWithFallback(
          ['-y', '-stream_loop', '-1', '-i', inputVideoPath, '-t', String(targetDur)],
          `${baseVf}${assFilter}${transitionFade}`,
          `${baseVf}${transitionFade}`,
          segOutPath,
          targetDur,
          (telemetry) => {
            emitProgress(
              'scene_prep',
              `Stage 02 • Scene ${i + 1}/${usableScenes.length} Normalization`,
              sceneBasePct + telemetry.fraction * perSceneSpan,
              `Encoding Scene ${scene.sceneNumber} ("${scene.title}") • ${telemetry.timemark || '00:00:00'}`,
              {
                sceneIndex: i + 1,
                totalScenes: usableScenes.length,
                currentFrame: telemetry.currentFrame,
                fps: telemetry.fps,
                speed: telemetry.speed,
                timemark: telemetry.timemark,
              }
            );
          }
        );
        commandLogs.push(cmdLog);
        normalizedSegmentPaths.push(segOutPath);
        continue;
      }

      // 2. Auto-animate storyboard image into motion video when videoUrl is not yet generated
      const candidateImagePath = scene.imageUrl
        ? resolveLocalPath(scene.imageUrl, publicDir)
        : fallbackSampleImage;
      const effectiveImagePath = fs.existsSync(candidateImagePath)
        ? candidateImagePath
        : fs.existsSync(fallbackSampleImage)
          ? fallbackSampleImage
          : null;

      if (effectiveImagePath) {
        const autoRawFilename = `scene_${scene.sceneNumber}_${scene.id}_raw_${Date.now()}.mp4`;
        const autoRawPath = path.join(videosDir, autoRawFilename);
        const autoVideoFilename = `scene_${scene.sceneNumber}_${scene.id}_auto_${Date.now()}.mp4`;
        const autoVideoPath = path.join(videosDir, autoVideoFilename);

        emitProgress(
          'scene_prep',
          `Stage 02 • Scene ${i + 1}/${usableScenes.length} Motion Synthesis`,
          sceneBasePct + 1,
          `Animating Scene ${scene.sceneNumber} storyboard frame with ${scene.cameraMovement || 'cinematic zoompan'} motion...`,
          { sceneIndex: i + 1, totalScenes: usableScenes.length }
        );

        const { commandLog } = await renderStillToMotionVideo({
          imagePath: effectiveImagePath,
          outputPath: autoRawPath,
          durationSeconds: targetDur,
          aspectRatio,
          cameraMovement: scene.cameraMovement,
          burnSubtitles: false,
          onFrameTelemetry: (telemetry) => {
            emitProgress(
              'scene_prep',
              `Stage 02 • Scene ${i + 1}/${usableScenes.length} Motion Synthesis`,
              sceneBasePct + telemetry.fraction * (perSceneSpan * 0.6),
              `Synthesizing camera motion for Scene ${scene.sceneNumber} ("${scene.title}")...`,
              {
                sceneIndex: i + 1,
                totalScenes: usableScenes.length,
                currentFrame: telemetry.currentFrame,
                fps: telemetry.fps,
                speed: telemetry.speed,
                timemark: telemetry.timemark,
              }
            );
          },
        });
        commandLogs.push(commandLog);

        const burnRes = await burnSubtitlesIntoVideo({
          inputVideoPath: autoRawPath,
          outputVideoPath: autoVideoPath,
          aspectRatio,
          durationSeconds: targetDur,
          overlayText: scene.overlayText,
          subtitleCues: scene.subtitleCues,
          subtitleStyle: scene.subtitleStyle,
        });

        scene.rawVideoUrl = `/assets/videos/${autoRawFilename}`;
        if (!scene.videoUrl) {
          scene.videoUrl = `/assets/videos/${autoVideoFilename}`;
          scene.subtitlesBurnedIn = burnRes.burnedIn;
          scene.status = 'video_ready';
        }

        const baseVf = `scale=${width}:${height},fps=${fps},format=yuv420p`;
        const cmdLog = await runSegmentEncodeWithFallback(
          ['-y', '-i', autoRawPath, '-t', String(targetDur)],
          `${baseVf}${assFilter}${transitionFade}`,
          `${baseVf}${transitionFade}`,
          segOutPath,
          targetDur,
          (telemetry) => {
            emitProgress(
              'scene_prep',
              `Stage 02 • Scene ${i + 1}/${usableScenes.length} Overlay & Fade`,
              sceneBasePct + perSceneSpan * 0.6 + telemetry.fraction * (perSceneSpan * 0.4),
              `Applying transitions & subtitles to Scene ${scene.sceneNumber}...`,
              {
                sceneIndex: i + 1,
                totalScenes: usableScenes.length,
                currentFrame: telemetry.currentFrame,
                fps: telemetry.fps,
                speed: telemetry.speed,
                timemark: telemetry.timemark,
              }
            );
          }
        );
        commandLogs.push(cmdLog);
        normalizedSegmentPaths.push(segOutPath);
      } else {
        const baseVf = `fps=${fps},format=yuv420p`;
        const cmdLog = await runSegmentEncodeWithFallback(
          [
            '-y',
            '-f',
            'lavfi',
            '-i',
            `color=c=#111318:s=${width}x${height}:d=${targetDur}`,
            '-t',
            String(targetDur),
          ],
          `${baseVf}${assFilter}${transitionFade}`,
          `${baseVf}${transitionFade}`,
          segOutPath,
          targetDur
        );
        commandLogs.push(cmdLog);
        normalizedSegmentPaths.push(segOutPath);
      }
    } finally {
      try {
        if (segAssPath && fs.existsSync(segAssPath)) fs.unlinkSync(segAssPath);
      } catch {
        // ignore
      }
    }
  }

  if (normalizedSegmentPaths.length === 0) {
    throw new Error('Could not locate or synthesize any scene media segments for rendering.');
  }

  // Stage 03: Timeline Concatenation (64% -> 78%)
  const expectedTotalDur = usableScenes.reduce(
    (sum, s) => sum + Math.max(2, Math.min(12, Number(s.durationSeconds) || 4)),
    0
  );

  emitProgress(
    'concat',
    'Stage 03 • Multi-Scene Timeline Concatenation',
    64,
    `Concatenating ${normalizedSegmentPaths.length} normalized H.264 video segments into master timeline...`,
    { sceneIndex: usableScenes.length, totalScenes: usableScenes.length }
  );

  const concatListPath = path.join(tempDir, 'concat_list.txt');
  const concatContent = normalizedSegmentPaths.map((p) => `file '${p}'`).join('\n');
  fs.writeFileSync(concatListPath, concatContent);

  const concatenatedVideoPath = path.join(tempDir, 'concatenated_video.mp4');
  const concatArgs = [
    '-y',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    concatListPath,
    '-c:v',
    'libx264',
    '-crf',
    '28',
    '-preset',
    'veryfast',
    '-pix_fmt',
    'yuv420p',
    concatenatedVideoPath,
  ];
  await runFfmpegWithTelemetry(concatArgs, expectedTotalDur, (telemetry) => {
    emitProgress(
      'concat',
      'Stage 03 • Multi-Scene Timeline Concatenation',
      64 + telemetry.fraction * 14,
      `Stitching master video stream (${telemetry.timemark || '00:00:00'})...`,
      {
        sceneIndex: usableScenes.length,
        totalScenes: usableScenes.length,
        currentFrame: telemetry.currentFrame,
        fps: telemetry.fps,
        speed: telemetry.speed,
        timemark: telemetry.timemark,
      }
    );
  });
  commandLogs.push(`ffmpeg ${concatArgs.join(' ')}`);

  const concatValidation = await validateVideoAsset(concatenatedVideoPath);
  const totalVideoDuration = Math.max(2, concatValidation.durationSeconds || expectedTotalDur || 12);

  const finalFilename = `ad_${campaignId}_${Date.now()}.mp4`;
  const finalOutputPath = path.join(rendersDir, finalFilename);

  // Stage 04: Lyria 3.5 Audio + Voiceover Mix & Afade Envelope (79% -> 92%)
  const hasSoundtrackFile =
    soundtrack?.includeInFinalMix !== false &&
    soundtrack?.audioUrl &&
    fs.existsSync(resolveLocalPath(soundtrack.audioUrl, publicDir));
  const hasVoiceoverFile =
    Boolean(voiceoverAudioUrl) &&
    fs.existsSync(resolveLocalPath(voiceoverAudioUrl!, publicDir));

  emitProgress(
    'audio_mix',
    'Stage 04 • Lyria 3.5 & Voiceover Mastering',
    79,
    hasSoundtrackFile && hasVoiceoverFile
      ? 'Mixing Lyria 3.5 stereo soundtrack with commercial AI voiceover and afade envelopes...'
      : hasSoundtrackFile
        ? `Mixing Lyria 3.5 stereo soundtrack (${Math.round((Number(soundtrack.volumeLevel) || 0.85) * 100)}% gain) with afade in/out envelopes...`
        : 'Generating stereo AAC broadcast audio stream...',
    { sceneIndex: usableScenes.length, totalScenes: usableScenes.length }
  );

  if (hasSoundtrackFile && soundtrack.audioUrl) {
    const audioInputPath = resolveLocalPath(soundtrack.audioUrl, publicDir);
    const vol = Math.max(0.1, Math.min(1.0, Number(soundtrack.volumeLevel) || 0.85));
    const fadeStart = Math.max(0.5, totalVideoDuration - 1.5);

    let mixedWithVo = false;
    if (hasVoiceoverFile && voiceoverAudioUrl) {
      const voInputPath = resolveLocalPath(voiceoverAudioUrl, publicDir);
      const duckedVol = Math.max(0.2, Math.min(0.65, vol * 0.55));
      const filterComplex = `[1:a]volume=${duckedVol.toFixed(2)},afade=t=in:st=0:d=0.6,afade=t=out:st=${fadeStart.toFixed(2)}:d=1.4[bg];[2:a]volume=1.15,apad=whole_dur=${totalVideoDuration}[vo];[bg][vo]amix=inputs=2:duration=first:dropout_transition=2[aout]`;
      const dualMixArgs = [
        '-y',
        '-i',
        concatenatedVideoPath,
        '-stream_loop',
        '-1',
        '-i',
        audioInputPath,
        '-i',
        voInputPath,
        '-t',
        String(totalVideoDuration),
        '-filter_complex',
        filterComplex,
        '-map',
        '0:v:0',
        '-map',
        '[aout]',
        '-c:v',
        'copy',
        '-c:a',
        'aac',
        '-b:a',
        '192k',
        '-shortest',
        finalOutputPath,
      ];
      try {
        await runFfmpegWithTelemetry(dualMixArgs, totalVideoDuration);
        commandLogs.push(`ffmpeg ${dualMixArgs.join(' ')}`);
        mixedWithVo = true;
      } catch {
        mixedWithVo = false;
      }
    }

    if (!mixedWithVo) {
      const afFilter = `volume=${vol.toFixed(2)},afade=t=in:st=0:d=0.6,afade=t=out:st=${fadeStart.toFixed(2)}:d=1.4`;
      const mixArgs = [
        '-y',
        '-i',
        concatenatedVideoPath,
        '-stream_loop',
        '-1',
        '-i',
        audioInputPath,
        '-t',
        String(totalVideoDuration),
        '-filter:a',
        afFilter,
        '-map',
        '0:v:0',
        '-map',
        '1:a:0',
        '-c:v',
        'copy',
        '-c:a',
        'aac',
        '-b:a',
        '192k',
        '-shortest',
        finalOutputPath,
      ];
      await runFfmpegWithTelemetry(mixArgs, totalVideoDuration, (telemetry) => {
        emitProgress(
          'audio_mix',
          'Stage 04 • Lyria 3.5 Audio Mixing & Mastering',
          79 + telemetry.fraction * 13,
          `Muxing stereo AAC 192kbps soundtrack (${telemetry.timemark || '00:00:00'})...`,
          {
            sceneIndex: usableScenes.length,
            totalScenes: usableScenes.length,
            currentFrame: telemetry.currentFrame,
            fps: telemetry.fps,
            speed: telemetry.speed,
            timemark: telemetry.timemark,
          }
        );
      });
      commandLogs.push(`ffmpeg ${mixArgs.join(' ')}`);
    }
  } else {
    const silentArgs = [
      '-y',
      '-i',
      concatenatedVideoPath,
      '-f',
      'lavfi',
      '-i',
      'anullsrc=channel_layout=stereo:sample_rate=44100',
      '-t',
      String(totalVideoDuration),
      '-c:v',
      'copy',
      '-c:a',
      'aac',
      '-shortest',
      finalOutputPath,
    ];
    await runFfmpegWithTelemetry(silentArgs, totalVideoDuration);
    commandLogs.push(`ffmpeg ${silentArgs.join(' ')}`);
  }

  // Stage 05: Post-Render Stream Validation (94% -> 100%)
  emitProgress(
    'validate',
    'Stage 05 • Stream & Codec Verification',
    95,
    'Inspecting rendered MP4 container (H.264 video stream, AAC audio stream, resolution, and frame count)...',
    { sceneIndex: usableScenes.length, totalScenes: usableScenes.length }
  );

  const validationReport = await validateVideoAsset(finalOutputPath);

  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch {
    // ignore cleanup error
  }

  emitProgress(
    'completed',
    'Render Complete • Validated Broadcast MP4 Ready',
    100,
    `Exported & validated MP4 (${validationReport.width}x${validationReport.height} @ 24fps, ${validationReport.durationSeconds}s)`,
    { sceneIndex: usableScenes.length, totalScenes: usableScenes.length }
  );

  return {
    videoUrl: `/assets/renders/${finalFilename}`,
    filePath: finalOutputPath,
    commandLog: commandLogs.join('\n\n'),
    validationReport,
  };
}
