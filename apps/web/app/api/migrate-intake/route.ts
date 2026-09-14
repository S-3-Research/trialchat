import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Note: Clerk auth has been removed; this route requires a real auth
// mechanism to function and currently always responds as unauthenticated.
export async function POST(req: NextRequest) {
  try {
    const userId: string | null = null;
    
    console.log('[migrate-intake] Starting migration, userId:', userId);
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { role, response_style, intent } = body;

    console.log('[migrate-intake] Received data:', { role, response_style, intent });

    if (!role || !response_style || !intent) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: role, response_style, intent' },
        { status: 400 }
      );
    }

    // Map role to is_caregiver boolean
    const isCaregiver = role === 'caregiver';

    const payload = {
      clerk_user_id: userId,
      is_caregiver: isCaregiver,
      intake_role: role,
      intake_response_style: response_style,
      intake_intent: intent,
      intake_completed_at: new Date().toISOString(),
    };

    console.log('[migrate-intake] Upserting to Supabase:', payload);

    // Update or insert user profile with intake data
    const { data, error } = await supabase
      .from('user_profiles')
      .upsert(payload, {
        onConflict: 'clerk_user_id',
      })
      .select()
      .single();

    if (error) {
      console.error('[migrate-intake] Supabase error:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to save intake data', 
          details: error.message,
          hint: error.hint,
        },
        { status: 500 }
      );
    }

    console.log('[migrate-intake] Successfully migrated intake data for user:', userId, 'Data:', data);

    return NextResponse.json({
      success: true,
      message: 'Intake data migrated successfully',
      data,
    });
  } catch (error) {
    console.error('[migrate-intake] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: errorMessage },
      { status: 500 }
    );
  }
}
