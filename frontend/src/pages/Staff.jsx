import CrudPage, { useOptions } from '../components/CrudPage.jsx';
import { normalizeMobile } from '../utils/digits.js';

// 5.8 STAFF — faculty master (FR-X1)
export default function Staff() {
  const { courseOptions } = useOptions();
  return (
    <CrudPage
      title="Staff"
      subtitle="Faculty/staff master — used as issued_by / approved_by reference (FR-X1)"
      path="/staff"
      pk="staff_id"
      columns={[
        { key: 'staff_id', label: 'ID' },
        { key: 'staff_name', label: 'Name' },
        { key: 'designation', label: 'Designation' },
        { key: 'email', label: 'Email' },
        { key: 'mobile', label: 'Mobile' },
        { key: 'course', label: 'Course', render: (r) => r.course?.course_name || r.course_id },
        { key: 'login_username', label: 'Login', render: (r) => r.login_username || <span className="muted">no login</span> },
      ]}
      fields={[
        { key: 'staff_name', label: 'Staff Name', required: true },
        { key: 'course_id', label: 'Course', type: 'select', required: true, options: courseOptions },
        { key: 'designation', label: 'Designation' },
        { key: 'email', label: 'Email' },
        { key: 'mobile', label: 'Mobile', type: 'tel', digits: 10, sanitize: normalizeMobile },
        // Login credentials the staff will use to sign in and update their diary.
        { key: 'login_username', label: 'Login Username' },
        { key: 'login_password', label: 'Login Password (min 8, unique — blank keeps current)', type: 'password' },
      ]}
    />
  );
}
