import CrudPage, { useOptions } from '../components/CrudPage.jsx';

// 5.9 WEEKLY_DIARY (FR-X3) — submission + approval workflow
export default function Diary() {
  const { staffOptions } = useOptions();
  return (
    <CrudPage
      title="Weekly Diary"
      subtitle="Faculty weekly activity log with approval workflow (FR-X3)"
      path="/diary"
      pk="diary_id"
      columns={[
        { key: 'diary_id', label: 'ID' },
        { key: 'staff', label: 'Staff', render: (r) => r.staff?.staff_name || r.staff_id },
        { key: 'week_start_date', label: 'Week Start' },
        { key: 'duties_assigned', label: 'Duties' },
        { key: 'approval_status', label: 'Status', render: (r) => <span className={`badge ${r.approval_status}`}>{r.approval_status}</span> },
      ]}
      fields={[
        { key: 'staff_id', label: 'Staff', type: 'select', required: true, options: staffOptions },
        { key: 'week_start_date', label: 'Week Start (Monday)', type: 'date' },
        { key: 'duties_assigned', label: 'Duties Assigned', type: 'textarea' },
        { key: 'diary_entry', label: 'Diary Entry', type: 'textarea' },
        { key: 'approval_status', label: 'Approval Status', type: 'select',
          options: ['Pending', 'Approved', 'Rejected'].map((s) => ({ value: s, label: s })) },
        { key: 'approval_date', label: 'Approval Date', type: 'date' },
        { key: 'approved_by', label: 'Approved By (staff)', type: 'select', options: staffOptions },
      ]}
    />
  );
}
