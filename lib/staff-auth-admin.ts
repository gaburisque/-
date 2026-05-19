import { createServiceRoleClient } from "@/lib/supabase/service-role";

/** 長期 ban（実質停止）。解除時は `none` を指定する。 */
export const STAFF_LOGIN_BAN_DURATION = "876000h";

export function createStaffAdminClient() {
  return createServiceRoleClient();
}

export function isAuthUserLoginDisabled(bannedUntil: string | null | undefined): boolean {
  if (!bannedUntil) return false;
  return new Date(bannedUntil) > new Date();
}

export async function fetchLoginDisabledByAuthUserIds(
  authUserIds: string[]
): Promise<Map<string, boolean>> {
  const result = new Map<string, boolean>();
  const unique = [...new Set(authUserIds.filter(Boolean))];
  if (unique.length === 0) return result;

  const admin = createStaffAdminClient();
  await Promise.all(
    unique.map(async (authUserId) => {
      const { data, error } = await admin.auth.admin.getUserById(authUserId);
      if (error || !data.user) {
        result.set(authUserId, false);
        return;
      }
      result.set(authUserId, isAuthUserLoginDisabled(data.user.banned_until));
    })
  );
  return result;
}
