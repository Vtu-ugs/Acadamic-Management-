import CrudPage, { useOptions } from '../components/CrudPage.jsx';

// 5.7 ACADEMIC_COORDINATOR (FR-X2)
export default function Coordinators() {
  const { courseOptions, staffOptions } = useOptions();
  return (
    <CrudPage
      title="Academic Coordinators"
      subtitle="Assign a staff member as coordinator for a course/year (FR-X2)"
      path="/coordinators"
      pk="co_id"
      columns={[
        { key: 'co_id', label: 'ID' },
        { key: 'course', label: 'Course', render: (r) => r.course?.course_name || r.course_id },
        { key: 'staff', label: 'Coordinator', render: (r) => r.staff?.staff_name || r.staff_id },
        { key: 'year', label: 'Year' },
      ]}
      fields={[
        { key: 'course_id', label: 'Course', type: 'select', required: true, options: courseOptions },
        { key: 'staff_id', label: 'Coordinator (staff)', type: 'select', required: true, options: staffOptions },
        { key: 'year', label: 'Year', type: 'number', required: true },
      ]}
    />
  );
}
