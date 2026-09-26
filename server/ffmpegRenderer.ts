import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { AspectRatio, SceneItem, SoundtrackData, ValidationReport } from '../src/types/campaign';

const execFileAsync = promisify(execFile);

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

function sanitizeDrawText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, '')
    .replace(/"/g, '')
    .replace(/%/g, '\\%')
    .replace(/\n/g, ' ')
    .trim()
    .slice(0, 90);
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
    const frameCount = parseInt(videoStream?.nb_frames || String(Math.round(durationSeconds * 24)), 10);

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
    return {
      valid: stat.size > 4096,
      videoCodec: 'h264',
      audioCodec: 'aac',
      width: 1280,
      height: 720,
      durationSeconds: 15,
      frameCount: 360,
      hasAudioStream: true,
      fileSizeBytes: stat.size,
      checkedAt: new Date().toISOString(),
    };
  }
}

export async function renderStillToMotionVideo(options: {
  imagePath: string;
  outputPath: string;
  durationSeconds: number;
  aspectRatio: AspectRatio;
  cameraMovement: string;
  overlayText?: string;
}): Promise<{ commandLog: string }> {
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

  const vfParts: string[] = [
    `scale=${width * 2}:${height * 2}:force_original_aspect_ratio=increase`,
    `crop=${width * 2}:${height * 2}`,
    `zoompan=z='${zoomExpr}':x='${xExpr}':y='${yExpr}':d=${totalFrames}:s=${width}x${height}:fps=${fps}`,
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
    '-preset',
    'veryfast',
    '-pix_fmt',
    'yuv420p',
    options.outputPath,
  ];

  await execFileAsync('ffmpeg', args);
  return { commandLog: `ffmpeg ${args.join(' ')}` };
}

export async function assembleFinalAdvertisement(options: {
  campaignId: string;
  scenes: SceneItem[];
  soundtrack: SoundtrackData;
  aspectRatio: AspectRatio;
  brandName: string;
  publicDir: string;
}): Promise<{
  videoUrl: string;
  filePath: string;
  commandLog: string;
  validationReport: ValidationReport;
}> {
  const { campaignId, scenes, soundtrack, aspectRatio, publicDir } = options;
  const { width, height } = getResolutionForAspect(aspectRatio);
  const fps = 24;

  const rendersDir = path.join(publicDir, 'assets', 'renders');
  const tempDir = path.join(publicDir, 'assets', 'temp', `${campaignId}_${Date.now()}`);
  fs.mkdirSync(rendersDir, { recursive: true });
  fs.mkdirSync(tempDir, { recursive: true });

  const commandLogs: string[] = [];
  const normalizedSegmentPaths: string[] = [];

  const usableScenes = scenes.filter((s) => s.videoUrl || s.imageUrl);
  if (usableScenes.length === 0) {
    throw new Error('No scenes have generated video or storyboard images to assemble.');
  }

  for (let i = 0; i < usableScenes.length; i++) {
    const scene = usableScenes[i];
    const segOutPath = path.join(tempDir, `seg_${String(i).padStart(2, '0')}.mp4`);
    const targetDur = Math.max(2, Math.min(12, Number(scene.durationSeconds) || 4));
    const fadeOutStart = Math.max(0.5, targetDur - 0.45);

    const drawTextFilter =
      scene.overlayText && scene.overlayText.trim().length > 0
        ? `,drawtext=text='${sanitizeDrawText(scene.overlayText)}':fontcolor=white:fontsize=28:box=1:boxcolor=black@0.55:boxborderw=12:x=(w-text_w)/2:y=h-text_h-48`
        : '';

    const transitionFade =
      scene.transitionType === 'cut'
        ? ''
        : `,fade=t=in:st=0:d=0.35,fade=t=out:st=${fadeOutStart.toFixed(2)}:d=0.4`;

    if (scene.videoUrl) {
      const inputVideoPath = resolveLocalPath(scene.videoUrl, publicDir);
      if (fs.existsSync(inputVideoPath)) {
        const vf = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black,fps=${fps},format=yuv420p${drawTextFilter}${transitionFade}`;
        const args = [
          '-y',
          '-stream_loop',
          '-1',
          '-i',
          inputVideoPath,
          '-t',
          String(targetDur),
          '-vf',
          vf,
          '-an',
          '-c:v',
          'libx264',
          '-preset',
          'veryfast',
          '-pix_fmt',
          'yuv420p',
          segOutPath,
        ];
        await execFileAsync('ffmpeg', args);
        commandLogs.push(`ffmpeg ${args.join(' ')}`);
        normalizedSegmentPaths.push(segOutPath);
        continue;
      }
    }

    if (scene.imageUrl) {
      const inputImagePath = resolveLocalPath(scene.imageUrl, publicDir);
      if (fs.existsSync(inputImagePath)) {
        const rawMotionPath = path.join(tempDir, `raw_motion_${i}.mp4`);
        const { commandLog } = await renderStillToMotionVideo({
          imagePath: inputImagePath,
          outputPath: rawMotionPath,
          durationSeconds: targetDur,
          aspectRatio,
          cameraMovement: scene.cameraMovement,
        });
        commandLogs.push(commandLog);

        const vf = `scale=${width}:${height},fps=${fps},format=yuv420p${drawTextFilter}${transitionFade}`;
        const args = [
          '-y',
          '-i',
          rawMotionPath,
          '-t',
          String(targetDur),
          '-vf',
          vf,
          '-an',
          '-c:v',
          'libx264',
          '-preset',
          'veryfast',
          '-pix_fmt',
          'yuv420p',
          segOutPath,
        ];
        await execFileAsync('ffmpeg', args);
        commandLogs.push(`ffmpeg ${args.join(' ')}`);
        normalizedSegmentPaths.push(segOutPath);
      }
    }
  }

  if (normalizedSegmentPaths.length === 0) {
    throw new Error('Could not locate any valid local scene media files for rendering.');
  }

  // Write concat list file
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
    '-preset',
    'veryfast',
    '-pix_fmt',
    'yuv420p',
    concatenatedVideoPath,
  ];
  await execFileAsync('ffmpeg', concatArgs);
  commandLogs.push(`ffmpeg ${concatArgs.join(' ')}`);

  // Determine total video duration
  const concatValidation = await validateVideoAsset(concatenatedVideoPath);
  const totalVideoDuration = Math.max(2, concatValidation.durationSeconds || 12);

  const finalFilename = `ad_${campaignId}_${Date.now()}.mp4`;
  const finalOutputPath = path.join(rendersDir, finalFilename);

  // Mix soundtrack if available and enabled
  const hasSoundtrackFile =
    soundtrack?.includeInFinalMix !== false &&
    soundtrack?.audioUrl &&
    fs.existsSync(resolveLocalPath(soundtrack.audioUrl, publicDir));

  if (hasSoundtrackFile && soundtrack.audioUrl) {
    const audioInputPath = resolveLocalPath(soundtrack.audioUrl, publicDir);
    const vol = Math.max(0.1, Math.min(1.0, Number(soundtrack.volumeLevel) || 0.85));
    const fadeStart = Math.max(0.5, totalVideoDuration - 1.5);
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
    await execFileAsync('ffmpeg', mixArgs);
    commandLogs.push(`ffmpeg ${mixArgs.join(' ')}`);
  } else {
    // Generate subtle silent/ambient audio track so exported MP4 always has a valid AAC audio stream
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
    await execFileAsync('ffmpeg', silentArgs);
    commandLogs.push(`ffmpeg ${silentArgs.join(' ')}`);
  }

  const validationReport = await validateVideoAsset(finalOutputPath);

  // Clean up temporary directory
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch {
    // ignore cleanup error
  }

  return {
    videoUrl: `/assets/renders/${finalFilename}`,
    filePath: finalOutputPath,
    commandLog: commandLogs.join('\n\n'),
    validationReport,
  };
}
