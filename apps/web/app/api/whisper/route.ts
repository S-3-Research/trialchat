import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    console.log('[Whisper API] Receiving request...');
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;

    if (!audioFile) {
      console.error('[Whisper API] No audio file in request');
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      );
    }

    console.log('[Whisper API] Audio file received:', {
      name: audioFile.name,
      size: audioFile.size,
      type: audioFile.type,
    });

    // Call OpenAI Whisper API
    console.log('[Whisper API] Calling OpenAI Whisper...');
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      // 不指定语言，让 Whisper 自动检测并保持原语言
    });

    console.log('[Whisper API] Success! Transcription:', transcription.text);

    return NextResponse.json({
      success: true,
      text: transcription.text,
    });
  } catch (error) {
    console.error('[Whisper API] ERROR DETAILS:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      error: error,
    });
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
