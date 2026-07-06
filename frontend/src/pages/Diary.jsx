import CrudPage, { useOptions } from '../components/CrudPage.jsx';
import { useAuth } from '../auth.jsx';

// 5.9 WEEKLY_DIARY (FR-X3) — submission + approval workflow.
// Staff users only ever see/edit their own entries (enforced by the backend);
// their form hides the staff picker and the approval fields.
export default function Diary() {
  const { user } = useAuth();
  const { staffOptions } = useOptions();
  const isStaff = user.role === 'staff';

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

  // Admin sees everything and can approve.
  const adminFields = [
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
      subtitle={isStaff
        ? 'Your weekly activity log — you can only add and edit your own entries'
        : 'Faculty weekly activity log with approval workflow (FR-X3)'}
      path="/diary"
      pk="diary_id"
      columns={columns}
      fields={isStaff ? staffFields : adminFields}
    />
  );
}
