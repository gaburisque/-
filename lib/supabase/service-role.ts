import { createClient } from "@supabase/supabase-js";

/**
 * Supabase Admin API（ユーザーの作成・削除など）用。
 * `SUPABASE_SERVICE_ROLE_KEY` はサーバー専用。クライアントや NEXT_PUBLIC に置かないこと。
 */
export function createServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "ログイン用アカウントをアプリから作成するには、サーバー環境変数 SUPABASE_SERVICE_ROLE_KEY が必要です（Supabase Dashboard → Project Settings → API → service_role）。"
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}
