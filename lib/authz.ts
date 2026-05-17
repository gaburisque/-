import { createClient } from "@/lib/supabase/server";

type StaffRole = "admin" | "staff";

type StaffRow = {
  staff_id: string;
  auth_user_id: string | null;
  email: string | null;
  role: StaffRole;
};

/**
 * Returns whether the current authenticated user is treated as admin.
 * Falls back to email lookup for transitional data where auth_user_id is not linked yet.
 */
export async function isCurrentUserAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return false;

  const baseSelect = "staff_id,auth_user_id,email,role";
  const byAuth = await supabase
    .from("staff")
    .select(baseSelect)
    .eq("auth_user_id", user.id)
    .maybeSingle();

  let staff = byAuth.data as StaffRow | null;

  if (!staff && user.email) {
    const byEmail = await supabase
      .from("staff")
      .select(baseSelect)
      .eq("email", user.email)
      .maybeSingle();
    staff = byEmail.data as StaffRow | null;
  }

  return staff?.role === "admin";
}
