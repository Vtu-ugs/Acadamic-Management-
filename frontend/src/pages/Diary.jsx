import CrudPage, { useOptions } from '../components/CrudPage.jsx';
import { useAuth } from '../auth.jsx';

// 5.9 WEEKLY_DIARY (FR-X3) — submission + approval workflow.
// Staff users only ever see/edit their own entries (enforced by the backend).

const columns = [
  { key: 'diary_id', label: 'ID' },
  { key: 'staff', label: 'Staff', render: (r) => r.staff?.staff_name || r.staff_id },
  { key: 'week_start_date', label: 'Week Start' },
  { key: 'duties_assigned', label: 'Duties' },
  { key: 'approval_status', label: 'Status', render: (r) => <span className={`badge ${r.approval_status}`}>{r.approval_status}</span> },
];

// Staff self-service fields: no staff picker, no approval controls.
const staffFields = [
  { key: 'week_start_date', label: 'Week Start (Monday)', type: 'date' },
  { key: 'duties_assigned', label: 'Duties Assigned', type: 'textarea' },
  { key: 'diary_entry', label: 'Diary Entry', type: 'textarea' },
];

export default function Diary() {
  const { user } = useAuth();
  return user.role === 'staff' ? <StaffDiary /> : <AdminDiary />;
}

// Staff view — only their own entries; doesn't load admin-only lookups.
function StaffDiary() {
  return (
    <CrudPage
      title="Weekly Diary"
      subtitle="Your weekly activity log — you can only add and edit your own entries"
      path="/diary"
      pk="diary_id"
      columns={columns}
      fields={staffFields}
    />
  );
}

// Admin view — every diary, staff picker, and the approval workflow.
function AdminDiary() {
  const { staffOptions } = useOptions();
  const fields = [
    { key: 'staff_id', label: 'Staff', type: 'select', required: true, options: staffOptions },
    ...staffFields,
    { key: 'approval_status', label: 'Approval Status', type: 'select',
      options: ['Pending', 'Approved', 'Rejected'].map((s) => ({ value: s, label: s })) },
    { key: 'approval_date', label: 'Approval Date', type: 'date' },
    { key: 'approved_by', label: 'Approved By (staff)', type: 'select', options: staffOptions },
  ];
  return (
    <CrudPage
      title="Weekly Diary"
      subtitle="Faculty weekly activity log with approval workflow (FR-X3)"
      path="/diary"
      pk="diary_id"
      columns={columns}
      fields={fields}
    />
  );
}
