import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('GEMINI_API_KEY is not set in environment');
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });
const outDir = path.resolve(process.cwd(), 'public', 'verified_samples');
fs.mkdirSync(outDir, { recursive: true });

async function verifyImageModel() {
  console.log('=== 1. Verifying Image Model (Nano Banana 2 Lite) ===');
  const candidates = [
    'gemini-3.1-flash-lite-image',
    'gemini-3.1-flash-lite-image-preview',
    'gemini-3.1-flash-image-preview',
    'gemini-2.5-flash-image'
  ];

  for (const modelId of candidates) {
    try {
      console.log(`Testing generateContent with model: ${modelId}...`);
      const res = await ai.models.generateContent({
        model: modelId,
        contents: 'A sleek matte-black espresso machine on a warm travertine countertop, morning sunlight, commercial product photography, 16:9',
        config: {
          responseModalities: ['IMAGE'],
        },
      });
      const parts = res.candidates?.[0]?.content?.parts || [];
      const imgPart = parts.find((p: any) => p.inlineData?.data);
      if (imgPart && imgPart.inlineData?.data) {
        const ext = imgPart.inlineData.mimeType?.includes('png') ? 'png' : 'jpg';
        const filePath = path.join(outDir, `verified_image_${modelId}.${ext}`);
        fs.writeFileSync(filePath, Buffer.from(imgPart.inlineData.data, 'base64'));
        console.log(`[SUCCESS] ${modelId} generated image (${imgPart.inlineData.mimeType}, saved to ${filePath})`);
        return { verifiedModel: modelId, method: 'ai.models.generateContent', filePath, mimeType: imgPart.inlineData.mimeType };
      } else {
        console.log(`[WARN] ${modelId} returned no inlineData image parts.`);
      }
    } catch (err: any) {
      console.log(`[FAIL] ${modelId} via generateContent: ${err?.status || ''} ${err?.message?.slice(0, 200)}`);
    }
  }
  return null;
}

async function verifyOmniFlash() {
  console.log('\n=== 2. Verifying Gemini Omni Flash (gemini-omni-1.1-flash) ===');
  const results: Record<string, any> = {};

  // Test 2A: ai.interactions.create with text + image output
  try {
    console.log('Testing ai.interactions.create with gemini-omni-1.1-flash (response_modalities: ["text", "image"])...');
    const interaction: any = await (ai as any).interactions.create({
      model: 'gemini-omni-1.1-flash',
      input: 'Generate a cinematic storyboard frame of coffee pouring into a glass cup in slow motion with warm golden rim lighting, and provide a 1-sentence director note.',
      response_modalities: ['text', 'image'],
    });
    const outputs = interaction.outputs || [];
    console.log(`[SUCCESS] gemini-omni-1.1-flash interaction ID: ${interaction.id}, outputs count: ${outputs.length}`);
    for (const out of outputs) {
      if (out.type === 'text') {
        console.log(`  -> Text output: ${out.text?.slice(0, 140)}`);
      } else if (out.type === 'image' && out.data) {
        const filePath = path.join(outDir, 'verified_omni_frame.png');
        fs.writeFileSync(filePath, Buffer.from(out.data, 'base64'));
        console.log(`  -> Image output saved to ${filePath} (${out.mime_type})`);
        results.imageAndText = { status: 'supported', interactionId: interaction.id, filePath };
      }
    }
  } catch (err: any) {
    console.log(`[FAIL] gemini-omni-1.1-flash (text+image): ${err?.status || ''} ${err?.message?.slice(0, 250)}`);
    results.imageAndText = { status: 'failed', error: err?.message?.slice(0, 250) };
  }

  // Test 2B: Does gemini-omni-1.1-flash support 'video' in response_modalities?
  try {
    console.log('Testing ai.interactions.create with gemini-omni-1.1-flash (response_modalities: ["video"])...');
    const interaction: any = await (ai as any).interactions.create({
      model: 'gemini-omni-1.1-flash',
      input: 'Generate a short video of coffee pouring.',
      response_modalities: ['video'],
    });
    console.log(`[SUCCESS] gemini-omni-1.1-flash video output:`, interaction);
    results.nativeVideo = { status: 'supported' };
  } catch (err: any) {
    console.log(`[INFO] gemini-omni-1.1-flash response_modalities: ["video"] result: ${err?.status || ''} ${err?.message?.slice(0, 250)}`);
    results.nativeVideo = { status: 'unsupported_modality', error: err?.message?.slice(0, 250) };
  }

  // Test 2C: Does gemini-omni-1.1-flash support 'audio' in response_modalities?
  try {
    console.log('Testing ai.interactions.create with gemini-omni-1.1-flash (response_modalities: ["audio"])...');
    const interaction: any = await (ai as any).interactions.create({
      model: 'gemini-omni-1.1-flash',
      input: 'Say: Experience the art of pure espresso.',
      response_modalities: ['audio'],
      generation_config: {
        speech_config: {
          voice: 'kore',
        },
      },
    });
    const outputs = interaction.outputs || [];
    const audioOut = outputs.find((o: any) => o.type === 'audio' && o.data);
    if (audioOut) {
      const filePath = path.join(outDir, 'verified_omni_voiceover.wav');
      fs.writeFileSync(filePath, Buffer.from(audioOut.data, 'base64'));
      console.log(`[SUCCESS] gemini-omni-1.1-flash audio output saved to ${filePath} (${audioOut.mime_type})`);
      results.audioOutput = { status: 'supported', filePath, mimeType: audioOut.mime_type };
    }
  } catch (err: any) {
    console.log(`[INFO] gemini-omni-1.1-flash audio output: ${err?.status || ''} ${err?.message?.slice(0, 250)}`);
    results.audioOutput = { status: 'failed', error: err?.message?.slice(0, 250) };
  }

  return results;
}

async function verifyLyria() {
  console.log('\n=== 3. Verifying Music Generation (Lyria 3.5 / Lyria 3) ===');
  const candidates = ['lyria-3.5', 'lyria-3-clip-preview', 'lyria-3-pro-preview'];
  const results: Record<string, any> = {};

  for (const modelId of candidates) {
    try {
      console.log(`Testing ai.music.generate with model: ${modelId}...`);
      const response: any = await (ai as any).music.generate({
        model: modelId,
        prompt: 'Warm acoustic guitar and subtle lo-fi electronic beats for a modern luxury coffee commercial, instrumental, uplifting',
      });
      const parts = response.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData?.data && part.inlineData?.mimeType?.startsWith('audio/')) {
          const ext = part.inlineData.mimeType.includes('mp3') || part.inlineData.mimeType.includes('mpeg') ? 'mp3' : 'wav';
          const filePath = path.join(outDir, `verified_music_${modelId}.${ext}`);
          fs.writeFileSync(filePath, Buffer.from(part.inlineData.data, 'base64'));
          console.log(`[SUCCESS] ${modelId} generated audio (${part.inlineData.mimeType}, saved to ${filePath})`);
          results[modelId] = { status: 'supported', filePath, mimeType: part.inlineData.mimeType };
          return results;
        }
      }
      console.log(`[WARN] ${modelId} returned no audio inlineData.`);
    } catch (err: any) {
      console.log(`[FAIL] ${modelId} via ai.music.generate: ${err?.status || ''} ${err?.message?.slice(0, 250)}`);
      results[modelId] = { status: 'failed', error: err?.message?.slice(0, 250) };
    }
  }
  return results;
}

async function main() {
  const imgResult = await verifyImageModel();
  const omniResult = await verifyOmniFlash();
  const lyriaResult = await verifyLyria();

  const report = {
    timestamp: new Date().toISOString(),
    imageGeneration: imgResult,
    omniFlash: omniResult,
    lyriaMusic: lyriaResult,
  };

  fs.writeFileSync(path.join(outDir, 'verification_report.json'), JSON.stringify(report, null, 2));
  console.log('\n=== Verification Report Saved ===');
  console.log(JSON.stringify(report, null, 2));
}

main().catch(console.error);
