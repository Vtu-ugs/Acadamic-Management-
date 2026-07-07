import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard.jsx';
import Students from './pages/Students.jsx';
import UsnPending from './pages/UsnPending.jsx';
import ImportExport from './pages/ImportExport.jsx';
import Admissions from './pages/Admissions.jsx';
import Fees from './pages/Fees.jsx';
import FeeStructures from './pages/FeeStructures.jsx';
import FeeReports from './pages/FeeReports.jsx';
import StudentFeeLedger from './pages/StudentFeeLedger.jsx';
import Certificates from './pages/Certificates.jsx';
import Courses from './pages/Courses.jsx';
import Staff from './pages/Staff.jsx';
import Coordinators from './pages/Coordinators.jsx';
import Diary from './pages/Diary.jsx';
import Users from './pages/Users.jsx';
import ActivityLog from './pages/ActivityLog.jsx';
import ChangePassword from './pages/ChangePassword.jsx';
import Login from './pages/Login.jsx';
import { useAuth } from './auth.jsx';

// Every nav item, with the element it routes to.
const nav = [
  { to: '/', label: 'Dashboard', end: true, element: <Dashboard /> },
  { to: '/students', label: 'Students', element: <Students /> },
  { to: '/admissions', label: 'Admissions', element: <Admissions /> },
  { to: '/fees', label: 'Fees', element: <Fees /> },
  { to: '/fee-structure', label: 'Fee Structure', element: <FeeStructures /> },
  { to: '/fee-reports', label: 'Fee Reports', element: <FeeReports /> },
  { to: '/fee-ledger', label: 'Fee Ledger', element: <StudentFeeLedger /> },
  { to: '/certificates', label: 'Certificates', element: <Certificates /> },
  { to: '/courses', label: 'Courses', element: <Courses /> },
  { to: '/staff', label: 'Staff', element: <Staff /> },
  { to: '/coordinators', label: 'Coordinators', element: <Coordinators /> },
  { to: '/diary', label: 'Weekly Diary', element: <Diary /> },
  { to: '/usn-pending', label: 'USN Pending', element: <UsnPending /> },
  { to: '/import-export', label: 'Import / Export', element: <ImportExport /> },
  { to: '/users', label: 'User Management', element: <Users /> },
  { to: '/activity', label: 'Activity Log', element: <ActivityLog /> },
  { to: '/change-password', label: 'Change Password', element: <ChangePassword /> },
];

// Which routes each role may see. Mirrors backend middleware/auth.js MODULE_ROLES.
// `null` for admin = all routes.
const ROLE_ROUTES = {
  admin: null,
  admission_staff: [
    '/', '/students', '/admissions', '/fees', '/fee-structure',
    '/fee-reports', '/fee-ledger', '/certificates', '/courses',
    '/usn-pending', '/import-export',
  ],
  // Staff users can only work on their own weekly diary — nothing else.
  staff: ['/diary'],
};

const HOME_BY_ROLE = { admin: '/', admission_staff: '/admissions', staff: '/diary' };
const ROLE_LABEL = { admin: 'Admin', admission_staff: 'Admission Staff', staff: 'Staff' };

export default function App() {
  const { isAuthenticated, user, logout } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    // Everything funnels to the login page until signed in.
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace state={{ from: location }} />} />
      </Routes>
    );
  }

  const allowed = ROLE_ROUTES[user.role];
  const visibleNav = allowed ? nav.filter((n) => allowed.includes(n.to)) : nav;
  const home = HOME_BY_ROLE[user.role] || '/';

  return (
    <div className="layout">
      <aside className="sidebar">
        <h1>Academic Management System</h1>
        {visibleNav.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end}
            className={({ isActive }) => (isActive ? 'active' : '')}>
            {n.label}
          </NavLink>
        ))}
        <div className="user-box">
          <div className="user-name">{user.full_name || user.username}</div>
          <div className="user-role">{ROLE_LABEL[user.role] || user.role}</div>
          <button type="button" className="logout-btn" onClick={logout}>Log out</button>
        </div>
      </aside>
      <main className="content">
        <Routes>
          {visibleNav.map((n) => (
            <Route key={n.to} path={n.to} element={n.element} />
          ))}
          {/* Signed-in users hitting /login or any disallowed path go to their home. */}
          <Route path="*" element={<Navigate to={home} replace />} />
        </Routes>
      </main>
    </div>
  );
}
