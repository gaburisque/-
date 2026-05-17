import { redirect } from "next/navigation";

export default function SignupPage() {
  redirect(
    `/login?error=${encodeURIComponent(
      "新規登録は停止中です。管理者にアカウント作成を依頼してください。"
    )}`
  );
}
