import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { MantineProvider, createTheme } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import '@mantine/notifications/styles.css';
import '@mantine/core/styles.css';
import '../node_modules/@mantine/charts/styles.css';
import Auth from './pages/Authentication';
import HomePage from './pages/HomePage';
import StudentDashboard from './pages/StudentDashboard';
import TeacherDashboard from './pages/TeacherDashboard';
import DashboardLayout from './components/DashboardLayout';
import IDEPage from './pages/IDEPage';
import TeacherClassesPage from './pages/TeacherClassesPage';
import StudentClassesPage from './pages/StudentClassesPage';
import TeacherClassPage from './pages/TeacherClassPage';
import StudentClassPage from './pages/StudentClassPage';
import TeacherAssignmentPage from './pages/TeacherAssignmentPage';
import StudentAssignmentPage from './pages/StudentAssignmentPage';
import JoinPage from './pages/JoinPage';
import TeacherExamPage from './pages/TeacherExamPage';
import StudentExamPage from './pages/StudentExamPage';
import TeacherExamMonitor from './pages/TeacherExamMonitor';
import './App.css';
import { useAuth } from './contexts/AuthContext';

const theme = createTheme({
  primaryColor: 'violet',
  colors: {
    violet: [
      '#f3e9ff',
      '#e0c9ff',
      '#c89fff',
      '#b075ff',
      '#9851ff',
      '#7b5bf5',
      '#6647d9',
      '#5134bd',
      '#3c21a1',
      '#280e85',
    ],
  },
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
  headings: {
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
    fontWeight: '700',
  },
  defaultRadius: 'md',
});

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRole?: 'STUDENT' | 'TEACHER';
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRole }) => {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  if (allowedRole && user?.role !== allowedRole) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

function App() {
  return (
    <MantineProvider theme={theme}>
      <Notifications position="bottom-right" limit={5} />
      <Router>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/auth" element={<Auth />} />

          <Route
            path="/student/exams/:examId"
            element={
              <ProtectedRoute allowedRole="STUDENT">
                <StudentExamPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/student"
            element={
              <ProtectedRoute allowedRole="STUDENT">
                <DashboardLayout userRole="STUDENT" scrollable />
              </ProtectedRoute>
            }
          >
            <Route path="dashboard" element={<StudentDashboard />} />
            <Route path="classes" element={<StudentClassesPage />} />
            <Route path="classes/:classId" element={<StudentClassPage />} />
            <Route path="assignments/:assignmentId" element={<StudentAssignmentPage />} />
          </Route>

          <Route
            path="/student"
            element={
              <ProtectedRoute allowedRole="STUDENT">
                <DashboardLayout userRole="STUDENT" />
              </ProtectedRoute>
            }
          >
            <Route path="ide" element={<IDEPage />} />
          </Route>
          <Route
            path="/teacher"
            element={
              <ProtectedRoute allowedRole="TEACHER">
                <DashboardLayout userRole="TEACHER" scrollable />
              </ProtectedRoute>
            }
          >
            <Route path="dashboard" element={<TeacherDashboard />} />
            <Route path="classes" element={<TeacherClassesPage />} />
            <Route path="classes/:classId" element={<TeacherClassPage />} />
            <Route path="assignments/:assignmentId" element={<TeacherAssignmentPage />} />
            <Route path="exams/:examId" element={<TeacherExamPage />} />
          </Route>

          <Route
            path="/teacher"
            element={
              <ProtectedRoute allowedRole="TEACHER">
                <DashboardLayout userRole="TEACHER" />
              </ProtectedRoute>
            }
          >
            <Route path="ide" element={<IDEPage />} />
          </Route>

          <Route
            path="/teacher/exams/:examId/monitor"
            element={
              <ProtectedRoute allowedRole="TEACHER">
                <TeacherExamMonitor />
              </ProtectedRoute>
            }
          />
          <Route path="/join/:shareCode" element={<JoinPage />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </MantineProvider>
  );
}

export default App;
