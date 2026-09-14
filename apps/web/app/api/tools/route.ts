import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { UserProfile, UserTrialInterest } from "@/lib/types/supabase";

export const runtime = "edge";

// Initialize Supabase client
// 此 client 仅在 server 端使用，使用 secret key 绕过 RLS（非 NEXT_PUBLIC_ 前缀）
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SECRET_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: NextRequest) {
  console.log("🔧 [API/Tools] Request received:", request.url);
  try {
    const body = await request.json();
    console.log("🔧 [API/Tools] Request body:", JSON.stringify(body, null, 2));
    const { toolName, params } = body;

    if (!toolName) {
      console.log("❌ [API/Tools] No tool name provided");
      return NextResponse.json(
        { success: false, error: "Tool name is required" },
        { status: 400 }
      );
    }

    console.log(`🔧 [API/Tools] Calling tool: ${toolName}`);

    // Handle different tools
    switch (toolName) {
      case "get_weather":
        return handleGetWeather(params);

      // Supabase tools
      case "get_user_profile":
        return handleGetUserProfile(params);
      
      case "save_user_profile":
        return handleSaveUserProfile(params);
      
      case "get_trial_interests":
        return handleGetTrialInterests(params);
      
      case "save_trial_interest":
        return handleSaveTrialInterest(params);
      
      case "get_trials":
        return handleGetTrials(params);

      // Add more tool handlers here
      default:
        console.log(`❌ [API/Tools] Unknown tool: ${toolName}`);
        return NextResponse.json(
          { success: false, error: `Unknown tool: ${toolName}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("❌ [API/Tools] Error handling tool request:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// =====================================================
// Supabase Tool Handlers
// =====================================================

/**
 * Get user profile from Supabase
 * Params: { clerk_user_id?: string } (可选，不传则使用当前登录用户)
 */
async function handleGetUserProfile(params: Record<string, unknown>) {
  // 获取当前登录用户
  console.log("Fetching user profile with params:", params);
  const currentUserId: string | null = null;
  if (!currentUserId) {
    return NextResponse.json(
      { success: false, error: "Not authenticated" },
      { status: 401 }
    );
  }

  // 使用传入的 clerk_user_id 或当前用户 ID
  const clerkUserId = String(params.clerk_user_id ?? currentUserId);

  // Security: Verify user can only access their own data
  if (clerkUserId !== currentUserId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized: You can only access your own data" },
      { status: 403 }
    );
  }

  try {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("clerk_user_id", clerkUserId)
      .single();

    if (error) {
      // If user doesn't exist, return null data (not an error)
      if (error.code === "PGRST116") {
        return NextResponse.json({
          success: true,
          data: null,
          message: "User profile not found",
        });
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      data: data as UserProfile,
    });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch user profile" },
      { status: 500 }
    );
  }
}

/**
 * Save or update user profile in Supabase
 * Params: { clerk_user_id?: string, ...profile_data } (clerk_user_id 可选)
 */
async function handleSaveUserProfile(params: Record<string, unknown>) {
  // 获取当前登录用户
  const currentUserId: string | null = null;
  
  if (!currentUserId) {
    return NextResponse.json(
      { success: false, error: "Not authenticated" },
      { status: 401 }
    );
  }

  // 使用传入的 clerk_user_id 或当前用户 ID
  const clerkUserId = String(params.clerk_user_id ?? currentUserId);

  // Security: Verify user can only modify their own data
  if (clerkUserId !== currentUserId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized: You can only modify your own data" },
      { status: 403 }
    );
  }

  try {
    // Prepare profile data
    const profileData: Partial<UserProfile> = {
      clerk_user_id: clerkUserId,
      full_name: params.full_name ? String(params.full_name) : undefined,
      email: params.email ? String(params.email) : undefined,
      age: params.age ? Number(params.age) : undefined,
      gender: params.gender ? String(params.gender) : undefined,
      has_adrd: params.has_adrd !== undefined ? Boolean(params.has_adrd) : undefined,
      diagnosis_type: params.diagnosis_type ? String(params.diagnosis_type) : undefined,
      diagnosed_date: params.diagnosed_date ? String(params.diagnosed_date) : undefined,
      current_medications: params.current_medications as Record<string, unknown> | undefined,
      is_caregiver: params.is_caregiver !== undefined ? Boolean(params.is_caregiver) : undefined,
      relationship_to_patient: params.relationship_to_patient ? String(params.relationship_to_patient) : undefined,
      preferred_language: params.preferred_language ? String(params.preferred_language) : undefined,
      location: params.location as UserProfile['location'] | undefined,
      mobility_status: params.mobility_status as UserProfile['mobility_status'] | undefined,
      travel_radius_miles: params.travel_radius_miles ? Number(params.travel_radius_miles) : undefined,
      last_active_at: new Date().toISOString(),
    };

    // Remove undefined values
    Object.keys(profileData).forEach(
      (key) => profileData[key as keyof UserProfile] === undefined && delete profileData[key as keyof UserProfile]
    );

    // Upsert (insert or update)
    const { data, error } = await supabase
      .from("user_profiles")
      .upsert(profileData, {
        onConflict: "clerk_user_id",
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: data as UserProfile,
      message: "User profile saved successfully",
    });
  } catch (error) {
    console.error("Error saving user profile:", error);
    return NextResponse.json(
      { success: false, error: "Failed to save user profile" },
      { status: 500 }
    );
  }
}

/**
 * Get user's trial interests
 * Params: { clerk_user_id?: string, trial_status?: string }
 */
async function handleGetTrialInterests(params: Record<string, unknown>) {
  // 获取当前登录用户
  const currentUserId: string | null = null;
  
  if (!currentUserId) {
    return NextResponse.json(
      { success: false, error: "Not authenticated" },
      { status: 401 }
    );
  }

  // 使用传入的 clerk_user_id 或当前用户 ID
  const clerkUserId = String(params.clerk_user_id ?? currentUserId);
  const trialStatus = params.trial_status ? String(params.trial_status) : undefined;

  // Security: Verify user can only access their own data
  if (clerkUserId !== currentUserId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized: You can only access your own data" },
      { status: 403 }
    );
  }

  try {
    let query = supabase
      .from("user_trial_interests")
      .select("*")
      .eq("clerk_user_id", clerkUserId)
      .order("interested_at", { ascending: false });

    if (trialStatus) {
      query = query.eq("trial_status", trialStatus);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: data as UserTrialInterest[],
      count: data.length,
    });
  } catch (error) {
    console.error("Error fetching trial interests:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch trial interests" },
      { status: 500 }
    );
  }
}

/**
 * Save or update trial interest
 * Params: { clerk_user_id?, trial_id, trial_name?, trial_status?, user_notes?, match_score? }
 */
async function handleSaveTrialInterest(params: Record<string, unknown>) {
  // 获取当前登录用户
  const currentUserId: string | null = null;
  
  if (!currentUserId) {
    return NextResponse.json(
      { success: false, error: "Not authenticated" },
      { status: 401 }
    );
  }

  // 使用传入的 clerk_user_id 或当前用户 ID
  const clerkUserId = String(params.clerk_user_id ?? currentUserId);
  const trialId = String(params.trial_id ?? "");

  if (!trialId) {
    return NextResponse.json(
      { success: false, error: "trial_id is required" },
      { status: 400 }
    );
  }

  // Security: Verify user can only modify their own data
  if (clerkUserId !== currentUserId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized: You can only modify your own data" },
      { status: 403 }
    );
  }

  try {
    const trialData: Partial<UserTrialInterest> = {
      clerk_user_id: clerkUserId,
      trial_id: trialId,
      trial_name: params.trial_name ? String(params.trial_name) : undefined,
      trial_status: params.trial_status as UserTrialInterest['trial_status'] | undefined,
      user_notes: params.user_notes ? String(params.user_notes) : undefined,
      match_score: params.match_score ? Number(params.match_score) : undefined,
    };

    // Remove undefined values
    Object.keys(trialData).forEach(
      (key) => trialData[key as keyof UserTrialInterest] === undefined && delete trialData[key as keyof UserTrialInterest]
    );

    // Check if already exists
    const { data: existing } = await supabase
      .from("user_trial_interests")
      .select("id")
      .eq("clerk_user_id", clerkUserId)
      .eq("trial_id", trialId)
      .single();

    let result;
    if (existing) {
      // Update existing
      result = await supabase
        .from("user_trial_interests")
        .update(trialData)
        .eq("id", existing.id)
        .select()
        .single();
    } else {
      // Insert new
      result = await supabase
        .from("user_trial_interests")
        .insert(trialData)
        .select()
        .single();
    }

    if (result.error) throw result.error;

    return NextResponse.json({
      success: true,
      data: result.data as UserTrialInterest,
      message: "Trial interest saved successfully",
    });
  } catch (error) {
    console.error("Error saving trial interest:", error);
    return NextResponse.json(
      { success: false, error: "Failed to save trial interest" },
      { status: 500 }
    );
  }
}

// =====================================================
// Clinical Trials Search Tool Handler
// =====================================================

/**
 * Search for clinical trials based on patient criteria
 * Params: { age?, sex?, city?, state?, conditions?, pref_distance?, top_n?, ... }
 */
async function handleGetTrials(params: Record<string, unknown>) {
  console.log("🔬 [API/Tools] Searching clinical trials with params:", params);
  
  try {
    const apiUrl = "https://ltqkud1tu1.execute-api.us-west-2.amazonaws.com/Prod/get_trials";
    
    // Build request body from params
    const requestBody: Record<string, unknown> = {};
    
    // Patient demographics
    if (params.age !== undefined) requestBody.age = Number(params.age);
    if (params.min_age !== undefined) requestBody.min_age = Number(params.min_age);
    if (params.max_age !== undefined) requestBody.max_age = Number(params.max_age);
    if (params.sex) requestBody.sex = String(params.sex);
    
    // Location
    if (params.street) requestBody.street = String(params.street);
    if (params.city) requestBody.city = String(params.city);
    if (params.county) requestBody.county = String(params.county);
    if (params.state) requestBody.state = String(params.state);
    if (params.country) requestBody.country = String(params.country);
    if (params.zipcode) requestBody.zipcode = String(params.zipcode);
    if (params.lat !== undefined) requestBody.lat = Number(params.lat);
    if (params.lon !== undefined) requestBody.lon = Number(params.lon);
    
    // Medical conditions
    if (params.conditions && Array.isArray(params.conditions)) {
      requestBody.conditions = params.conditions.map(String);
    }
    
    // Preferences
    if (params.pref_distance !== undefined) requestBody.pref_distance = Number(params.pref_distance);
    if (params.drive_duration !== undefined) requestBody.drive_duration = Number(params.drive_duration);
    if (params.top_n !== undefined) requestBody.top_n = Number(params.top_n);
    
    // Dates
    if (params.start_year !== undefined) requestBody.start_year = Number(params.start_year);
    if (params.start_month !== undefined) requestBody.start_month = Number(params.start_month);
    if (params.start_day !== undefined) requestBody.start_day = Number(params.start_day);
    if (params.end_year !== undefined) requestBody.end_year = Number(params.end_year);
    if (params.end_month !== undefined) requestBody.end_month = Number(params.end_month);
    if (params.end_day !== undefined) requestBody.end_day = Number(params.end_day);
    
    // Trial filters
    if (params.intervention_types && Array.isArray(params.intervention_types)) {
      requestBody.intervention_types = params.intervention_types.map(String);
    }
    if (params.phases && Array.isArray(params.phases)) {
      requestBody.phases = params.phases.map(String);
    }

    // Pagination
    requestBody.page = params.page !== undefined ? Math.max(1, Number(params.page)) : 1;

    console.log("🔬 [API/Tools] Calling external API with body:", JSON.stringify(requestBody, null, 2));

    const apiKey = process.env.CLINICAL_TRIALS_API_KEY;
    if (!apiKey) {
      console.error("🔬 [API/Tools] CLINICAL_TRIALS_API_KEY not set");
      return NextResponse.json(
        { success: false, error: "Clinical trials API key not configured" },
        { status: 500 }
      );
    }

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("🔬 [API/Tools] External API error:", errorData);
      return NextResponse.json(
        { 
          success: false, 
          error: `Clinical trials API error: ${response.status}`,
          details: errorData
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    const matchedTrials = data.matched_trial || [];
    console.log("🔬 [API/Tools] Found trials:", matchedTrials.length);
    

    return NextResponse.json({
      success: true,
      count: matchedTrials.length,
      trials: matchedTrials,
      summary: data.summary_report || `Found ${matchedTrials.length} matching trials`,
    });
  } catch (error) {
    console.error("🔬 [API/Tools] Error fetching clinical trials:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch clinical trials" },
      { status: 500 }
    );
  }
}

// =====================================================
// Weather Tool Handler (existing)
// =====================================================


// Helper function to map weather condition to icon
function getWeatherIcon(condition: string): string {
  const iconMap: Record<string, string> = {
    Clear: "https://cdn.openai.com/API/storybook/mostly-sunny.png",
    Clouds: "https://cdn.openai.com/API/storybook/mixed-sun.png",
    Rain: "https://cdn.openai.com/API/storybook/rain.png",
    Drizzle: "https://cdn.openai.com/API/storybook/rain.png",
    Thunderstorm: "https://cdn.openai.com/API/storybook/rain.png",
    Snow: "https://cdn.openai.com/API/storybook/windy.png",
    Mist: "https://cdn.openai.com/API/storybook/mixed-sun.png",
    Fog: "https://cdn.openai.com/API/storybook/mixed-sun.png",
  };
  return (
    iconMap[condition] ||
    "https://cdn.openai.com/API/storybook/mostly-sunny.png"
  );
}

// Helper function to get background gradient based on condition
function getWeatherBackground(condition: string): string {
  const backgroundMap: Record<string, string> = {
    Clear: "linear-gradient(111deg, #F59E0B 0%, #F59E0B 56.92%, #FCD34D 100%)",
    Clouds: "linear-gradient(111deg, #6B7280 0%, #9CA3AF 56.92%, #D1D5DB 100%)",
    Rain: "linear-gradient(111deg, #1E40AF 0%, #3B82F6 56.92%, #60A5FA 100%)",
    Snow: "linear-gradient(111deg, #E0F2FE 0%, #BAE6FD 56.92%, #7DD3FC 100%)",
  };
  return (
    backgroundMap[condition] ||
    "linear-gradient(111deg, #1769C8 0%, #258AE3 56.92%, #31A3F8 100%)"
  );
}

async function handleGetWeather(params: Record<string, unknown>) {
  const location = String(params.location ?? "");
  const unit = String(params.unit ?? "f");

  // simulate error
  // return NextResponse.json(
  //   { success: false, error: "Weather data not found for this location" },
  //   { status: 404 }
  // );

  if (!location) {
    return NextResponse.json(
      { success: false, error: "Location is required" },
      { status: 400 }
    );
  }

  try {
    const apiKey = process.env.OPENWEATHER_API_KEY;

    if (!apiKey) {
      // Fallback to mock data if no API key
      console.warn("OPENWEATHER_API_KEY not set, returning mock data");
      const unitSymbol = unit === "c" ? "°" : "°";
      return NextResponse.json({
        success: true,
        background:
          "linear-gradient(111deg, #1769C8 0%, #258AE3 56.92%, #31A3F8 100%)",
        conditionImage: "https://cdn.openai.com/API/storybook/mixed-sun.png",
        lowTemperature: `47${unitSymbol}`,
        highTemperature: `69${unitSymbol}`,
        location: location,
        conditionDescription: "Partly sunny skies accompanied by some clouds",
        forecast: [
          {
            conditionImage:
              "https://cdn.openai.com/API/storybook/mostly-sunny.png",
            temperature: `54${unitSymbol}`,
          },
          {
            conditionImage: "https://cdn.openai.com/API/storybook/rain.png",
            temperature: `54${unitSymbol}`,
          },
          {
            conditionImage:
              "https://cdn.openai.com/API/storybook/mixed-sun.png",
            temperature: `54${unitSymbol}`,
          },
          {
            conditionImage: "https://cdn.openai.com/API/storybook/windy.png",
            temperature: `54${unitSymbol}`,
          },
          {
            conditionImage:
              "https://cdn.openai.com/API/storybook/mostly-sunny.png",
            temperature: `54${unitSymbol}`,
          },
        ],
        note: "This is mock data. Add OPENWEATHER_API_KEY to .env.local for real data.",
      });
    }

    const units = unit === "c" ? "metric" : "imperial";

    // Fetch current weather
    const weatherResponse = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
        location
      )}&units=${units}&appid=${apiKey}`
    );

    if (!weatherResponse.ok) {
      return NextResponse.json(
        { success: false, error: "Weather data not found for this location" },
        { status: 404 }
      );
    }

    const weatherData = await weatherResponse.json();

    // Fetch forecast data
    const forecastResponse = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(
        location
      )}&units=${units}&appid=${apiKey}&cnt=5`
    );

    const forecastData = forecastResponse.ok
      ? await forecastResponse.json()
      : null;
    const unitSymbol = unit === "c" ? "°" : "°";

    // Build forecast array
    const forecast =
      forecastData?.list?.slice(0, 5).map((item: { weather: Array<{ main: string }>; main: { temp: number } }) => ({
        conditionImage: getWeatherIcon(item.weather[0].main),
        temperature: `${Math.round(item.main.temp)}${unitSymbol}`,
      })) || [];

    return NextResponse.json({
      success: true,
      background: getWeatherBackground(weatherData.weather[0].main),
      conditionImage: getWeatherIcon(weatherData.weather[0].main),
      lowTemperature: `${Math.round(weatherData.main.temp_min)}${unitSymbol}`,
      highTemperature: `${Math.round(weatherData.main.temp_max)}${unitSymbol}`,
      location: weatherData.name,
      conditionDescription:
        weatherData.weather[0].description.charAt(0).toUpperCase() +
        weatherData.weather[0].description.slice(1),
      forecast: forecast,
    });
  } catch (error) {
    console.error("Error fetching weather data:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch weather data" },
      { status: 500 }
    );
  }
}
