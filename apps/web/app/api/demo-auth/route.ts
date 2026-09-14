import { NextRequest, NextResponse } from 'next/server';

const DEMO_PASSWORDS = {
  'trial-chat': process.env.TRIAL_CHAT_PASSWORD,
};

const MASTER_PASSWORD = process.env.MASTER_DEMO_PASSWORD;

export async function POST(request: NextRequest) {
  try {
    const { demoId, password } = await request.json();

    // Validate demo ID
    if (!demoId || !(demoId in DEMO_PASSWORDS)) {
      return NextResponse.json(
        { success: false, error: 'Invalid demo ID' },
        { status: 400 }
      );
    }

    // Check password
    const isValid =
      password === DEMO_PASSWORDS[demoId as keyof typeof DEMO_PASSWORDS] ||
      password === MASTER_PASSWORD;

    if (isValid) {
      const response = NextResponse.json({ success: true });
      
      // Set cookie with 24-hour expiration
      response.cookies.set(`demo-${demoId}`, 'unlocked', {
        path: '/',
        maxAge: 86400, // 24 hours in seconds
        httpOnly: false, // Allow client-side access for checking
        sameSite: 'strict',
      });

      return response;
    }

    return NextResponse.json(
      { success: false, error: 'Incorrect password' },
      { status: 401 }
    );
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid request' },
      { status: 400 }
    );
  }
}

// Optional: endpoint to check if demo is unlocked
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const demoId = searchParams.get('demoId');

  if (!demoId) {
    return NextResponse.json({ unlocked: false });
  }

  const cookie = request.cookies.get(`demo-${demoId}`);
  return NextResponse.json({ unlocked: cookie?.value === 'unlocked' });
}
