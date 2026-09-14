import { createClient } from '@supabase/supabase-js';

// 这一步是为了防止构建时报错，给个空字符串默认值
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
// 注意：这个 client 只在 server 端（API routes）使用，因此用 secret key
// （非 NEXT_PUBLIC_ 前缀，不会被打包进浏览器 bundle），可绕过 RLS。
// anon/publishable key 只适合需要在浏览器端访问的场景，本项目目前不需要。
const supabaseKey = process.env.SUPABASE_SECRET_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseKey);