"use client";

import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { createClient } from "@/lib/supabase/client";

const BUCKET = "student-documents";

const TAG_OPTIONS = ["賞状", "PDF", "画像", "提出物", "その他"];

type Props = {
  students: { student_id: string; last_name: string; first_name: string }[];
  onUploaded: () => void;
};

export function DocumentUpload({ students, onUploaded }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const formData = new FormData(form);

    const studentId = formData.get("student_id") as string;
    const tag = formData.get("tag") as string;
    const notes = formData.get("notes") as string;
    const file = formData.get("file") as File;

    if (!studentId || !file || file.size === 0) {
      setError("生徒とファイルを選択してください。");
      return;
    }

    setUploading(true);

    const supabase = createClient();
    const ext = file.name.split(".").pop() ?? "";
    const storagePath = `${studentId}/${Date.now()}-${file.name}`;

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, file);

    if (uploadError) {
      setError(`アップロードエラー: ${uploadError.message}`);
      setUploading(false);
      return;
    }

    const { error: dbError } = await supabase.from("student_documents").insert({
      student_id: studentId,
      file_name: file.name,
      storage_path: storagePath,
      file_type: ext,
      tag: tag || null,
      notes: notes || null
    });

    if (dbError) {
      setError(`DB保存エラー: ${dbError.message}`);
      setUploading(false);
      return;
    }

    setUploading(false);
    formRef.current?.reset();
    onUploaded();
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
      {error && (
        <div className="md:col-span-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="upload-student">生徒</Label>
        <NativeSelect id="upload-student" name="student_id" required>
          <option value="">選択してください</option>
          {students.map((s) => (
            <option key={s.student_id} value={s.student_id}>
              {s.last_name} {s.first_name}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="space-y-2">
        <Label htmlFor="upload-tag">タグ</Label>
        <NativeSelect id="upload-tag" name="tag">
          <option value="">なし</option>
          {TAG_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="upload-file">ファイル（PDF・画像・その他）</Label>
        <Input id="upload-file" name="file" type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" required />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="upload-notes">メモ（任意）</Label>
        <Input id="upload-notes" name="notes" placeholder="例：2024年度 漢字検定3級" />
      </div>
      <div className="md:col-span-2">
        <Button type="submit" disabled={uploading}>
          {uploading ? "アップロード中..." : "アップロード"}
        </Button>
      </div>
    </form>
  );
}
