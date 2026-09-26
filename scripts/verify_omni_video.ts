import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY!;
const ai = new GoogleGenAI({ apiKey });
const outDir = path.resolve(process.cwd(), 'public', 'verified_samples');

async function verifyVideoAndConversationalEdit() {
  const imgPath = path.join(outDir, 'verified_image_gemini-3.1-flash-lite-image.jpg');
  const imgBase64 = fs.readFileSync(imgPath).toString('base64');

  // Test 1: Text-to-video on gemini-omni-1.1-flash via interactions.create
  try {
    console.log('1. Testing gemini-omni-1.1-flash text-to-video...');
    const inter1: any = await (ai as any).interactions.create({
      model: 'gemini-omni-1.1-flash',
      input: 'Cinematic commercial shot of a matte-black espresso machine pouring rich golden crema into a glass cup, slow push-in camera movement, warm morning sunlight.',
      response_modalities: ['video'],
    });
    const vidOut = (inter1.outputs || []).find((o: any) => o.type === 'video' && o.data);
    if (vidOut) {
      const vidPath = path.join(outDir, 'verified_video_gemini-omni-1.1-flash.mp4');
      const buf = Buffer.from(vidOut.data, 'base64');
      fs.writeFileSync(vidPath, buf);
      console.log(`[SUCCESS] Text-to-video saved (${buf.length} bytes), interactionId=${inter1.id}`);
    } else {
      console.log('[WARN] No video output in inter1:', inter1.outputs?.map((o: any) => o.type));
    }

    // Test 2: Conversational video editing using previous_interaction_id!
    if (inter1.id) {
      console.log('2. Testing gemini-omni-1.1-flash conversational video edit with previous_interaction_id...');
      const inter2: any = await (ai as any).interactions.create({
        model: 'gemini-omni-1.1-flash',
        previous_interaction_id: inter1.id,
        input: 'Make the lighting warmer golden hour and change camera movement to a smooth orbital pan right.',
        response_modalities: ['video'],
      });
      const vidOut2 = (inter2.outputs || []).find((o: any) => o.type === 'video' && o.data);
      if (vidOut2) {
        const vidPath2 = path.join(outDir, 'verified_video_edited_gemini-omni-1.1-flash.mp4');
        const buf2 = Buffer.from(vidOut2.data, 'base64');
        fs.writeFileSync(vidPath2, buf2);
        console.log(`[SUCCESS] Conversational video edit saved (${buf2.length} bytes), interactionId=${inter2.id}`);
      }
    }
  } catch (e: any) {
    console.log('[ERROR] Test 1/2:', e?.message?.slice(0, 300));
  }

  // Test 3: Image + Text to Video via generateContent on gemini-omni-1.1-flash
  try {
    console.log('3. Testing gemini-omni-1.1-flash via generateContent with responseModalities: ["VIDEO"]...');
    const res = await ai.models.generateContent({
      model: 'gemini-omni-1.1-flash',
      contents: [
        {
          inlineData: {
            data: imgBase64,
            mimeType: 'image/jpeg',
          },
        },
        'Animate this storyboard frame into a cinematic commercial video clip with slow push-in camera movement and rising steam.',
      ],
      config: {
        responseModalities: ['VIDEO'],
      },
    });
    const parts = res.candidates?.[0]?.content?.parts || [];
    const vidPart = parts.find((p: any) => p.inlineData?.data && p.inlineData?.mimeType?.startsWith('video/'));
    if (vidPart?.inlineData?.data) {
      const buf = Buffer.from(vidPart.inlineData.data, 'base64');
      console.log(`[SUCCESS] generateContent image+text->VIDEO succeeded (${buf.length} bytes, ${vidPart.inlineData.mimeType})`);
    } else {
      console.log('[INFO] generateContent parts:', parts.map((p: any) => p.inlineData?.mimeType || 'text'));
    }
  } catch (e: any) {
    console.log('[INFO] generateContent image+text->VIDEO:', e?.message?.slice(0, 250));
  }
}

verifyVideoAndConversationalEdit().catch(console.error);
