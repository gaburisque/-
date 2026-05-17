import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { bulkUpdateAttendanceStatus } from "@/app/actions";
import { normalizeCourseName } from "@/lib/courses";
import { formatDate, formatTime, fullName } from "@/lib/format";
import { formatGrade } from "@/lib/grades";
import { createClient } from "@/lib/supabase/server";

const ATTENDANCE_LABELS: Record<string, string> = {
  present: "出席",
  absent: "欠席",
  late: "遅刻",
  substitute: "振替"
};

const ATTENDANCE_COLORS: Record<string, string> = {
  present: "bg-green-100 text-green-800",
  absent: "bg-red-100 text-red-800",
  late: "bg-yellow-100 text-yellow-800",
  substitute: "bg-blue-100 text-blue-800"
};

export default async function AttendancePage({
  searchParams
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  const todayStr = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
  const selectedDate = params.date ?? todayStr;

  const supabase = await createClient();

  const { data: records } = await supabase
    .from("lesson_records")
    .select(
      "lesson_record_id,lesson_date,start_time,end_time,attendance_status,students(student_id,last_name,first_name,grade),courses(course_name),staff(name)"
    )
    .eq("lesson_date", selectedDate)
    .order("start_time", { ascending: true, nullsFirst: true });

  type RecordRow = {
    lesson_record_id: string;
    start_time: string | null;
    end_time: string | null;
    attendance_status: string | null;
    students: { student_id: string; last_name: string; first_name: string; grade: string | null } | null;
    courses: { course_name: string } | null;
    staff: { name: string } | null;
  };

  const rows = (records ?? []) as unknown as RecordRow[];
  const present = rows.filter((r) => r.attendance_status === "present").length;
  const absent = rows.filter((r) => r.attendance_status === "absent").length;
  const unset = rows.filter((r) => !r.attendance_status).length;

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">出席</h1>
          <p className="mt-1 text-sm text-muted-foreground">日ごとの出欠を確認・一括更新します。</p>
        </div>

        <Card>
          <CardContent className="pt-5">
            <form className="flex flex-wrap gap-2">
              <Input type="date" name="date" defaultValue={selectedDate} className="max-w-[200px]" />
              <Button type="submit">表示</Button>
            </form>
          </CardContent>
        </Card>

        {rows.length > 0 && (
          <div className="grid grid-cols-4 gap-3">
            <Card>
              <CardContent className="pt-4 text-center">
                <div className="text-2xl font-bold">{rows.length}</div>
                <div className="text-xs text-muted-foreground">授業数</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <div className="text-2xl font-bold text-green-700">{present}</div>
                <div className="text-xs text-muted-foreground">出席</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <div className="text-2xl font-bold text-red-700">{absent}</div>
                <div className="text-xs text-muted-foreground">欠席</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <div className="text-2xl font-bold text-muted-foreground">{unset}</div>
                <div className="text-xs text-muted-foreground">未設定</div>
              </CardContent>
            </Card>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>{formatDate(selectedDate)} の授業記録</CardTitle>
          </CardHeader>
          <CardContent>
            {rows.length > 0 ? (
              <form action={bulkUpdateAttendanceStatus}>
                <input type="hidden" name="date" value={selectedDate} />
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>時間</TableHead>
                        <TableHead>生徒</TableHead>
                        <TableHead>コース</TableHead>
                        <TableHead>担当</TableHead>
                        <TableHead>出欠</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((record) => (
                        <TableRow key={record.lesson_record_id}>
                          <input
                            type="hidden"
                            name="lesson_record_id"
                            value={record.lesson_record_id}
                          />
                          <TableCell className="whitespace-nowrap text-sm">
                            {formatTime(record.start_time)}
                            {record.end_time ? ` – ${formatTime(record.end_time)}` : ""}
                          </TableCell>
                          <TableCell>
                            {record.students ? fullName(record.students) : "-"}
                            <div className="text-xs text-muted-foreground">
                              {formatGrade(record.students?.grade)}
                            </div>
                          </TableCell>
                          <TableCell>{normalizeCourseName(record.courses?.course_name) || "-"}</TableCell>
                          <TableCell>{record.staff?.name ?? "-"}</TableCell>
                          <TableCell>
                            <NativeSelect
                              name="attendance_status"
                              defaultValue={record.attendance_status ?? ""}
                              className="h-8 w-[100px] text-sm"
                            >
                              <option value="">-</option>
                              <option value="present">出席</option>
                              <option value="absent">欠席</option>
                              <option value="late">遅刻</option>
                              <option value="substitute">振替</option>
                            </NativeSelect>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {rows.filter((r) => r.attendance_status).map((r) => (
                      <span
                        key={r.lesson_record_id}
                        className={`rounded px-1.5 py-0.5 font-medium ${ATTENDANCE_COLORS[r.attendance_status!] ?? "bg-muted"}`}
                      >
                        {r.students ? fullName(r.students) : "-"}：{ATTENDANCE_LABELS[r.attendance_status!] ?? r.attendance_status}
                      </span>
                    ))}
                  </div>
                  <Button type="submit" className="shrink-0">
                    一括保存
                  </Button>
                </div>
              </form>
            ) : (
              <EmptyState>この日の授業記録がありません。</EmptyState>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
