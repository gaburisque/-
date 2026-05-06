create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.schools (
  school_id uuid primary key default gen_random_uuid(),
  school_name text not null,
  school_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.addresses (
  address_id uuid primary key default gen_random_uuid(),
  postal_code text,
  prefecture text,
  city text,
  address_line1 text,
  address_line2 text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.students (
  student_id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(school_id) on delete set null,
  address_id uuid references public.addresses(address_id) on delete set null,
  last_name text not null,
  first_name text not null,
  last_name_kana text,
  first_name_kana text,
  grade text,
  birth_date date,
  gender text,
  phone text,
  email text,
  status text not null default 'active' check (status in ('active', 'inactive', 'graduated')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.staff (
  staff_id uuid primary key default gen_random_uuid(),
  auth_user_id uuid references auth.users(id) on delete set null,
  name text not null,
  email text,
  role text not null default 'staff' check (role in ('admin', 'staff')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.guardians (
  guardian_id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(student_id) on delete cascade,
  address_id uuid references public.addresses(address_id) on delete set null,
  last_name text not null,
  first_name text not null,
  relationship text not null,
  phone text,
  email text,
  is_primary boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.emergency_contacts (
  emergency_contact_id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(student_id) on delete cascade,
  name text not null,
  relationship text,
  phone text not null,
  priority integer not null default 1 check (priority > 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.courses (
  course_id uuid primary key default gen_random_uuid(),
  course_name text not null,
  description text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.enrollments (
  enrollment_id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(student_id) on delete cascade,
  course_id uuid not null references public.courses(course_id) on delete restrict,
  schedule_label text,
  weekday text,
  start_time time,
  frequency text,
  start_date date,
  end_date date,
  status text not null default 'active' check (status in ('active', 'paused', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lesson_records (
  lesson_record_id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(student_id) on delete cascade,
  course_id uuid references public.courses(course_id) on delete set null,
  staff_id uuid references public.staff(staff_id) on delete set null,
  lesson_date date not null,
  start_time time,
  end_time time,
  title text,
  content text,
  homework text,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tools (
  tool_id uuid primary key default gen_random_uuid(),
  tool_name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.services (
  service_id uuid primary key default gen_random_uuid(),
  service_name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.student_accounts (
  student_account_id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(student_id) on delete cascade,
  auth_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'inactive' check (status in ('active', 'inactive', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists students_school_id_idx on public.students(school_id);
create index if not exists students_grade_idx on public.students(grade);
create index if not exists guardians_student_id_idx on public.guardians(student_id);
create index if not exists emergency_contacts_student_id_idx on public.emergency_contacts(student_id);
create index if not exists enrollments_student_id_idx on public.enrollments(student_id);
create index if not exists enrollments_course_id_idx on public.enrollments(course_id);
create index if not exists enrollments_weekday_idx on public.enrollments(weekday);
create index if not exists enrollments_start_time_idx on public.enrollments(start_time);
create index if not exists lesson_records_student_id_idx on public.lesson_records(student_id);
create index if not exists lesson_records_lesson_date_idx on public.lesson_records(lesson_date);
create index if not exists student_accounts_student_id_idx on public.student_accounts(student_id);

do $$
declare
  table_name text;
  trigger_name text;
begin
  foreach table_name in array array[
    'schools',
    'addresses',
    'students',
    'staff',
    'guardians',
    'emergency_contacts',
    'courses',
    'enrollments',
    'lesson_records',
    'tools',
    'services',
    'student_accounts'
  ]
  loop
    trigger_name := 'set_' || table_name || '_updated_at';
    execute format('drop trigger if exists %I on public.%I', trigger_name, table_name);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      trigger_name,
      table_name,
      table_name
    );
  end loop;
end $$;

alter table public.schools enable row level security;
alter table public.addresses enable row level security;
alter table public.students enable row level security;
alter table public.staff enable row level security;
alter table public.guardians enable row level security;
alter table public.emergency_contacts enable row level security;
alter table public.courses enable row level security;
alter table public.enrollments enable row level security;
alter table public.lesson_records enable row level security;
alter table public.tools enable row level security;
alter table public.services enable row level security;
alter table public.student_accounts enable row level security;

do $$
declare
  table_name text;
  policy_name text;
begin
  foreach table_name in array array[
    'schools',
    'addresses',
    'students',
    'staff',
    'guardians',
    'emergency_contacts',
    'courses',
    'enrollments',
    'lesson_records',
    'tools',
    'services',
    'student_accounts'
  ]
  loop
    policy_name := table_name || ' authenticated access';
    execute format('drop policy if exists %I on public.%I', policy_name, table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using (true) with check (true)',
      policy_name,
      table_name
    );
  end loop;
end $$;
