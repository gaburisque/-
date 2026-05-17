"use client";

import { useCallback, useEffect, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { createClient } from "@/lib/supabase/client";
import type { StudentDocument } from "@/lib/types";
import { DocumentUpload } from "./document-upload";

const BUCKET = "student-documents";

const TAG_COLORS: Record<string, string> = {
  賞状: "bg-yellow-100 text-yellow-800",
  PDF: "bg-red-100 text-red-800",
  画像: "bg-blue-100 text-blue-800",
  提出物: "bg-purple-100 text-purple-800",
  その他: "bg-gray-100 text-gray-700"
};

type StudentOption = { student_id: string; last_name: string; first_name: string };

export default function DocumentsPage() {
  const supabase = createClient();
  const [isAdmin, setIsAdmin] = useState(false);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [documents, setDocuments] = useState<StudentDocument[]>([]);
  const [filterStudentId, setFilterStudentId] = useState("");
  const [loading, setLoading] = useState(true);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("student_documents")
      .select("*,students(student_id,last_name,first_name)")
      .order("created_at", { ascending: false });
    if (filterStudentId) {
      query = query.eq("student_id", filterStudentId);
    }
    const { data } = await query;
    setDocuments((data ?? []) as unknown as StudentDocument[]);
    setLoading(false);
  }, [filterStudentId]);

  useEffect(() => {
    async function detectAdmin() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        setIsAdmin(false);
        return;
      }

      const byAuth = await supabase
        .from("staff")
        .select("role")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (byAuth.data) {
        setIsAdmin((byAuth.data as { role?: string }).role === "admin");
        return;
      }

      if (user.email) {
        const byEmail = await supabase
          .from("staff")
          .select("role")
          .eq("email", user.email)
          .maybeSingle();
        setIsAdmin((byEmail.data as { role?: string } | null)?.role === "admin");
        return;
      }

      setIsAdmin(false);
    }

    detectAdmin();
  }, [supabase]);

  useEffect(() => {
    supabase
      .from("students")
      .select("student_id,last_name,first_name")
      .order("last_name_kana", { ascending: true, nullsFirst: false })
      .then(({ data }) => setStudents((data ?? []) as StudentOption[]));
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  async function handleDelete(doc: StudentDocument) {
    if (!confirm(`「${doc.file_name}」を削除しますか？`)) return;
    await supabase.storage.from(BUCKET).remove([doc.storage_path]);
    await supabase.from("student_documents").delete().eq("document_id", doc.document_id);
    await loadDocuments();
  }

  async function handleDownload(doc: StudentDocument) {
    const { data } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(doc.storage_path, 60);
    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank");
    }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">教材</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            生徒の教材・賞状・PDFなどを管理します。
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>ファイルをアップロード</CardTitle>
          </CardHeader>
          <CardContent>
            <DocumentUpload students={students} onUploaded={loadDocuments} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>ファイル一覧</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <NativeSelect
                value={filterStudentId}
                onChange={(e) => setFilterStudentId(e.target.value)}
                className="max-w-[240px]"
              >
                <option value="">すべての生徒</option>
                {students.map((s) => (
                  <option key={s.student_id} value={s.student_id}>
                    {s.last_name} {s.first_name}
                  </option>
                ))}
              </NativeSelect>
            </div>

            {loading ? (
              <p className="text-sm text-muted-foreground">読み込み中...</p>
            ) : documents.length > 0 ? (
              <div className="divide-y">
                {documents.map((doc) => {
                  const student = doc.students as StudentOption | null;
                  return (
                    <div key={doc.document_id} className="flex items-start justify-between gap-4 py-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {doc.tag && (
                            <span
                              className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${TAG_COLORS[doc.tag] ?? "bg-muted text-muted-foreground"}`}
                            >
                              {doc.tag}
                            </span>
                          )}
                          <span className="font-medium text-sm truncate">{doc.file_name}</span>
                        </div>
                        {student && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {student.last_name} {student.first_name}
                          </div>
                        )}
                        {doc.notes && (
                          <div className="text-xs text-muted-foreground">{doc.notes}</div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          {new Date(doc.created_at).toLocaleDateString("ja-JP")}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button size="sm" variant="outline" onClick={() => handleDownload(doc)}>
                          開く
                        </Button>
                        {isAdmin ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDelete(doc)}
                          >
                            削除
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState>ファイルがありません。</EmptyState>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
