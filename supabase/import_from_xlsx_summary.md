# XLSX Import Summary

Source: `/Users/wadaseima/Downloads/normalized_database_3nf.xlsx`

Generated: `supabase/import_from_xlsx.sql`

## Row counts

- schools: 62
- addresses: 107
- students: 105
- staff: 92
- courses: 7
- services: 10
- tools: 3549
- guardians: 188
- emergency_contacts: 52
- enrollments: 113
- lesson_records: 5953

## Not imported

- Source account password fields are intentionally skipped because passwords must not be stored or imported as plaintext.
- `source_sheet`, `source_row`, and `raw_student_name` are intentionally skipped from the production UI import.
- `lesson_staff` and `lesson_tools` are not imported because the current MVP schema does not include join tables for those relations.
- 1 lesson record without `student_id` was skipped because the MVP schema requires every lesson record to be linked to a student.
