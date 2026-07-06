import CrudPage from '../components/CrudPage.jsx';

// 5.6 COURSES — master programs (B.E., M.C.A., etc.)
export default function Courses() {
  return (
    <CrudPage
      title="Courses"
      subtitle="Master list of programs — add new courses with no schema change (NFR Scalability)"
      path="/courses"
      pk="course_id"
      columns={[
        { key: 'course_id', label: 'ID', render: (_row, i) => i + 1 },
        { key: 'course_name', label: 'Course Name' },
        { key: 'intake', label: 'Intake' },
        { key: 'yearly_intake', label: 'Year' },
      ]}
      fields={[
        { key: 'course_name', label: 'Course Name', required: true },
        { key: 'intake', label: 'Intake', type: 'number' },
        { key: 'yearly_intake', label: 'Yearly Intake (year)', type: 'number' },
      ]}
    />
  );
}
