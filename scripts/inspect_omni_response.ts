import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const outDir = path.resolve(process.cwd(), 'public', 'verified_samples');

async function inspectOmni() {
  const inter: any = await (ai as any).interactions.create({
    model: 'gemini-omni-1.1-flash',
    input: 'Generate a short video of coffee pouring.',
    response_modalities: ['video'],
  });
  console.log('Top-level keys:', Object.keys(inter));
  console.log('status:', inter.status, 'id:', inter.id);
  if (inter.outputs) {
    console.log('outputs length:', inter.outputs.length);
    inter.outputs.forEach((o: any, i: number) => {
      console.log(`output[${i}] keys:`, Object.keys(o), 'type:', o.type, 'mime_type:', o.mime_type, 'data length:', o.data?.length);
      if (o.type === 'video' && o.data) {
        const p = path.join(outDir, 'verified_video_gemini-omni-1.1-flash.mp4');
        fs.writeFileSync(p, Buffer.from(o.data, 'base64'));
        console.log('Saved MP4 to:', p);
      }
    });
  } else {
    console.log('Full object (truncated):', JSON.stringify(inter).slice(0, 500));
  }
}

inspectOmni().catch(console.error);
