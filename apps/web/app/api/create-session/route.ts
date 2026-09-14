import { WORKFLOW_ID } from "@/lib/config";

import { fetch as undiciFetch, ProxyAgent } from "undici";

// Node.js runtime（非 Edge），支持代理配置
// Edge Runtime 的 fetch 是沙箱，不读取系统代理，本地访问 api.openai.com 会 fetch failed
export const runtime = "nodejs";

// 本地开发时读取 HTTPS_PROXY（如 Clash 的 http://127.0.0.1:7893）
// Vercel 生产环境不需要代理，此变量留空即可
const _proxyUrl = process.env.HTTPS_PROXY;
const _dispatcher = _proxyUrl ? new ProxyAgent(_proxyUrl) : undefined;
function proxiedFetch(url: string, init: RequestInit): Promise<Response> {
  if (_dispatcher) {
    return undiciFetch(url, { ...init, dispatcher: _dispatcher } as Parameters<typeof undiciFetch>[1]) as unknown as Promise<Response>;
  }
  return fetch(url, init);
}

export async function POST(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey)
      return new Response("Missing OpenAI API Key", { status: 500 });

    // Sign-in is not supported; all requests are treated as guests.
    const userId: string | null = null;
    const parsedBody = await request.json();
    
    // Guest users: use stable ID from request body to preserve chat history
    // If guest_user_id is provided in the request, use it; otherwise generate a new one.
    // `is_test` (set by the frontend when ?test=true was used) decides the
    // fallback prefix (`test_` vs `guest_`) so test conversations stay tagged
    // even if the client somehow failed to pass a stable guest_user_id.
    const isTestRequest = parsedBody?.is_test === true;
    let effectiveUserId = userId;
    if (!userId) {
      effectiveUserId = parsedBody?.guest_user_id || `${isTestRequest ? "test" : "guest"}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      console.log("[create-session] Guest user ID:", effectiveUserId, parsedBody?.guest_user_id ? "(provided)" : "(generated)");
    }
    
    console.log("Effective User ID:", effectiveUserId);

    const resolvedWorkflowId =
      parsedBody?.workflow?.id ?? parsedBody?.workflowId ?? WORKFLOW_ID;

    // -------------------------------------------------------------
    // 改动点 3: 读取 intake data 并传递到 workflow state_variables
    // -------------------------------------------------------------
    const intakeData = parsedBody?.intake_data;
    const stateVariables: Record<string, string | number | boolean> = {};
    
    if (intakeData) {
      console.log("[create-session] Intake data received:", intakeData);
      
      // Add intake data to workflow state variables
      if (intakeData.role) stateVariables.user_role = intakeData.role;
      if (intakeData.response_style) stateVariables.response_style = intakeData.response_style;
      if (intakeData.intent) stateVariables.user_intent = intakeData.intent;
      
      console.log("[create-session] State variables:", stateVariables);
    }

    // -------------------------------------------------------------
    // 4. 发送给 OpenAI / ChatKit
    // -------------------------------------------------------------
    const upstreamUrl = `${
      process.env.CHATKIT_API_BASE || "https://api.openai.com"
    }/v1/chatkit/sessions`;

    const payload: Record<string, unknown> = {
      workflow: { 
        id: resolvedWorkflowId,
        ...(Object.keys(stateVariables).length > 0 && { state_variables: stateVariables })
      },
      user: effectiveUserId, // Use effectiveUserId (guest or authenticated)
      chatkit_configuration: parsedBody?.chatkit_configuration || {},
    };

    console.log("[create-session] Final payload being sent:", JSON.stringify(payload, null, 2));

    const upstreamResponse = await proxiedFetch(upstreamUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiApiKey}`,
        "OpenAI-Beta": "chatkit_beta=v1",
      },
      body: JSON.stringify(payload),
    });

    const upstreamJson = await upstreamResponse.json();
    console.log(
      `[Clerk+Supabase] Received response from ChatKit upstream:`,
      upstreamJson
    );

    if (!upstreamResponse.ok) {
      console.error("Upstream Error:", upstreamJson);
      return new Response(JSON.stringify(upstreamJson), {
        status: upstreamResponse.status,
      });
    }

    return new Response(JSON.stringify(upstreamJson), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Internal Error:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
    });
  }
}

export async function GET(): Promise<Response> {
  return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
    status: 405,
    headers: { "Content-Type": "application/json" },
  });
}
