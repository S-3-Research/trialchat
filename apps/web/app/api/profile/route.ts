import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// GET - 获取用户 profile
// Note: Clerk auth has been removed; this route requires a real auth
// mechanism to function and currently always responds as unauthenticated.
export async function GET() {
  try {
    const userId: string | null = null;
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("clerk_user_id", userId)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 表示没有找到记录，这是正常的
      console.error("Error fetching profile:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ profile: data || null });
  } catch (error) {
    console.error("Error in GET /api/profile:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST/PUT - 更新或创建用户 profile
export async function POST(request: Request) {
  try {
    const userId: string | null = null;
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // 先检查是否已存在
    const { data: existingProfile } = await supabase
      .from("user_profiles")
      .select("id")
      .eq("clerk_user_id", userId)
      .single();

    let result;
    if (existingProfile) {
      // 更新现有记录
      result = await supabase
        .from("user_profiles")
        .update({
          ...body,
          updated_at: new Date().toISOString(),
          last_active_at: new Date().toISOString(),
        })
        .eq("clerk_user_id", userId)
        .select()
        .single();
    } else {
      // 创建新记录
      result = await supabase
        .from("user_profiles")
        .insert({
          clerk_user_id: userId,
          ...body,
        })
        .select()
        .single();
    }

    if (result.error) {
      console.error("Error updating profile:", result.error);
      return NextResponse.json(
        { error: result.error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ profile: result.data });
  } catch (error) {
    console.error("Error in POST /api/profile:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - 删除用户 profile
export async function DELETE() {
  try {
    const userId: string | null = null;
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { error } = await supabase
      .from("user_profiles")
      .delete()
      .eq("clerk_user_id", userId);

    if (error) {
      console.error("Error deleting profile:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/profile:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
