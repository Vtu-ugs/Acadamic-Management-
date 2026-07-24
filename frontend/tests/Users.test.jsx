import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import Users from '../src/pages/Users.jsx';

// Canned user list with a non-contiguous user_id (19) — the page must show a
// running serial number, not the raw id.
const USERS = [
  { user_id: 1, username: 'admin', full_name: 'System Administrator', role: 'admin', is_active: true, last_login: null },
  { user_id: 2, username: 'admission', full_name: 'Admission Staff', role: 'admission_staff', is_active: true, last_login: null },
  { user_id: 3, username: 'staff', full_name: 'Faculty', role: 'staff', is_active: true, last_login: null, staff_name: 'Dr. Rao' },
  { user_id: 19, username: 'anita', full_name: null, role: 'staff', is_active: true, last_login: null, staff_name: 'Dr. Rao' },
];

// Mock the data hook: '/users' → USERS, '/staff' → [].
vi.mock('../src/components/useApi.js', () => ({
  useApi: (path) => ({
    data: path === '/users' ? USERS : [],
    loading: false,
    error: null,
    reload: () => {},
  }),
}));
vi.mock('../src/api.js', () => ({ api: {} }));

describe('User Management table', () => {
  it('numbers rows serially (1..n), not by raw user_id', () => {
    render(<Users />);
    const rows = screen.getAllByRole('row').slice(1); // drop the header row
    expect(rows).toHaveLength(4);

    // First cell of each row is the serial number.
    const serials = rows.map((r) => within(r).getAllByRole('cell')[0].textContent);
    expect(serials).toEqual(['1', '2', '3', '4']);

    // The raw id 19 must NOT appear as a serial number.
    expect(serials).not.toContain('19');
  });

  it('labels the first column "Sl. No."', () => {
    render(<Users />);
    expect(screen.getByText('Sl. No.')).toBeInTheDocument();
  });
});
