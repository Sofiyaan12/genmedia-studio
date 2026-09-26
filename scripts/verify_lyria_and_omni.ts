import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY!;
const ai = new GoogleGenAI({ apiKey });
const outDir = path.resolve(process.cwd(), 'public', 'verified_samples');

async function test() {
  console.log('Keys on ai instance:', Object.keys(ai));
  console.log('Keys on ai.models:', Object.keys(ai.models));

  // 1. Save real video from gemini-omni-1.1-flash with image-to-video input
  try {
    const imgPath = path.join(outDir, 'verified_image_gemini-3.1-flash-lite-image.jpg');
    const imgBase64 = fs.readFileSync(imgPath).toString('base64');
    console.log('Testing gemini-omni-1.1-flash image-to-video via interactions.create...');
    const interaction: any = await (ai as any).interactions.create({
      model: 'gemini-omni-1.1-flash',
      input: [
        {
          type: 'image',
          data: imgBase64,
          mime_type: 'image/jpeg',
        },
        {
          type: 'text',
          text: 'Animate this espresso machine scene with a slow push-in camera movement and warm golden steam rising from the cup.',
        },
      ],
      response_modalities: ['video'],
    });
    console.log('Omni Flash interaction ID:', interaction.id);
    const vidOut = (interaction.outputs || []).find((o: any) => o.type === 'video' && o.data);
    if (vidOut) {
      const vidPath = path.join(outDir, 'verified_video_gemini-omni-1.1-flash.mp4');
      fs.writeFileSync(vidPath, Buffer.from(vidOut.data, 'base64'));
      console.log(`[SUCCESS] Saved Omni Flash MP4 video (${Buffer.from(vidOut.data, 'base64').length} bytes) to ${vidPath}`);
    }
  } catch (e: any) {
    console.log('[FAIL] Omni Flash image-to-video:', e?.message?.slice(0, 300));
  }

  // 2. Test Lyria models via generateContent, interactions.create, and list models
  const lyriaModels = ['lyria-3.5', 'lyria-3-clip-preview', 'lyria-3-pro-preview', 'lyria-realtime-exp'];
  for (const m of lyriaModels) {
    try {
      console.log(`Testing ai.models.generateContent with ${m}...`);
      const res = await ai.models.generateContent({
        model: m,
        contents: 'Upbeat modern electronic commercial background soundtrack, warm synths, 15 seconds, instrumental',
        config: {
          responseModalities: ['AUDIO'],
        },
      });
      const parts = res.candidates?.[0]?.content?.parts || [];
      console.log(`[SUCCESS] ${m} via generateContent returned ${parts.length} parts:`, parts.map((p: any) => p.inlineData?.mimeType || 'text'));
      const audioPart = parts.find((p: any) => p.inlineData?.data && p.inlineData?.mimeType?.startsWith('audio/'));
      if (audioPart?.inlineData?.data) {
        const ext = audioPart.inlineData.mimeType?.includes('mp3') || audioPart.inlineData.mimeType?.includes('mpeg') ? 'mp3' : 'wav';
        const audioPath = path.join(outDir, `verified_audio_${m}.${ext}`);
        fs.writeFileSync(audioPath, Buffer.from(audioPart.inlineData.data, 'base64'));
        console.log(`[SUCCESS] Saved audio from ${m} to ${audioPath}`);
      }
    } catch (e: any) {
      console.log(`[INFO] ${m} via generateContent (AUDIO):`, e?.message?.slice(0, 250));
    }

    try {
      console.log(`Testing ai.models.generateContent (no modality filter) with ${m}...`);
      const res = await ai.models.generateContent({
        model: m,
        contents: 'Upbeat modern electronic commercial background soundtrack, warm synths, instrumental',
      });
      const parts = res.candidates?.[0]?.content?.parts || [];
      console.log(`[SUCCESS] ${m} via generateContent (default) returned ${parts.length} parts:`, parts.map((p: any) => p.inlineData?.mimeType || 'text'));
      const audioPart = parts.find((p: any) => p.inlineData?.data && p.inlineData?.mimeType?.startsWith('audio/'));
      if (audioPart?.inlineData?.data) {
        const ext = audioPart.inlineData.mimeType?.includes('mp3') || audioPart.inlineData.mimeType?.includes('mpeg') ? 'mp3' : 'wav';
        const audioPath = path.join(outDir, `verified_audio_${m}.${ext}`);
        fs.writeFileSync(audioPath, Buffer.from(audioPart.inlineData.data, 'base64'));
        console.log(`[SUCCESS] Saved audio from ${m} to ${audioPath}`);
      }
    } catch (e: any) {
      console.log(`[INFO] ${m} via generateContent (default):`, e?.message?.slice(0, 250));
    }

    try {
      console.log(`Testing ai.interactions.create with ${m}...`);
      const inter: any = await (ai as any).interactions.create({
        model: m,
        input: 'Upbeat modern electronic commercial background soundtrack, warm synths, instrumental',
        response_modalities: ['audio'],
      });
      console.log(`[SUCCESS] ${m} via interactions.create:`, inter.outputs?.map((o: any) => o.type));
      const audioOut = (inter.outputs || []).find((o: any) => o.type === 'audio' && o.data);
      if (audioOut) {
        const audioPath = path.join(outDir, `verified_audio_inter_${m}.wav`);
        fs.writeFileSync(audioPath, Buffer.from(audioOut.data, 'base64'));
        console.log(`[SUCCESS] Saved audio from ${m} interaction to ${audioPath}`);
      }
    } catch (e: any) {
      console.log(`[INFO] ${m} via interactions.create:`, e?.message?.slice(0, 250));
    }
  }

  // Also list available models matching lyria, omni, flash, image
  try {
    const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data: any = await resp.json();
    const matched = (data.models || [])
      .map((m: any) => ({ name: m.name, methods: m.supportedGenerationMethods }))
      .filter((m: any) => /lyria|omni|image|music|audio|veo|flash/i.test(m.name));
    console.log('=== Available Models in API ===');
    console.log(JSON.stringify(matched, null, 2));
  } catch (e: any) {
    console.log('Failed to list models:', e?.message);
  }
}

test().catch(console.error);
