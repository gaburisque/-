export type School = {
  school_id: string;
  school_name: string;
  school_type: string | null;
};

export type Student = {
  student_id: string;
  school_id: string | null;
  address_id: string | null;
  last_name: string;
  first_name: string;
  last_name_kana: string | null;
  first_name_kana: string | null;
  grade: string | null;
  birth_date: string | null;
  gender: string | null;
  phone: string | null;
  email: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  schools?: School | Pick<School, "school_name"> | Array<School | Pick<School, "school_name">> | null;
};

export type Guardian = {
  guardian_id: string;
  student_id: string;
  address_id: string | null;
  last_name: string;
  first_name: string;
  relationship: string;
  phone: string | null;
  email: string | null;
  is_primary: boolean;
  notes: string | null;
};

export type EmergencyContact = {
  emergency_contact_id: string;
  student_id: string;
  name: string;
  relationship: string | null;
  phone: string;
  priority: number;
  notes: string | null;
};

export type Course = {
  course_id: string;
  course_name: string;
  description: string | null;
  status: string;
};

export type Tool = {
  tool_id: string;
  tool_name: string;
  description: string | null;
};

export type Enrollment = {
  enrollment_id: string;
  student_id: string;
  course_id: string;
  schedule_label: string | null;
  weekday: string | null;
  start_time: string | null;
  frequency: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  courses?: Course | Course[] | null;
  students?:
    | Pick<Student, "student_id" | "last_name" | "first_name" | "grade">
    | Array<Pick<Student, "student_id" | "last_name" | "first_name" | "grade">>
    | null;
};

export type Staff = {
  staff_id: string;
  auth_user_id: string | null;
  name: string;
  email: string | null;
  role: string;
};

export type LessonRecord = {
  lesson_record_id: string;
  student_id: string;
  course_id: string | null;
  staff_id: string | null;
  lesson_date: string;
  start_time: string | null;
  end_time: string | null;
  title: string | null;
  content: string | null;
  homework: string | null;
  memo: string | null;
  created_at: string;
  updated_at: string;
  students?: Pick<Student, "student_id" | "last_name" | "first_name" | "grade"> | null;
  courses?: Pick<Course, "course_id" | "course_name"> | null;
  staff?: Pick<Staff, "staff_id" | "name"> | null;
};
