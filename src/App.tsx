import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { InstallPrompt } from './components/InstallPrompt'
import { OfflineBanner } from './components/OfflineBanner'
import { ProtectedRoute, PublicOnly } from './components/ProtectedRoute'
import { listenNativeLaunchPath, consumeNativeLaunchPath } from './lib/backgroundMonitor'
import { LoginPage } from './pages/LoginPage'
import { ParentRegisterPage } from './pages/ParentRegisterPage'
import { SetupAdminPage } from './pages/SetupAdminPage'
import { ParentLayout } from './pages/parent/ParentLayout'
import { ParentHomePage } from './pages/parent/ParentHomePage'
import { ParentChildrenPage } from './pages/parent/ParentChildrenPage'
import { ParentRequestsPage } from './pages/parent/ParentRequestsPage'
import { ClassDashboardPage } from './pages/class/ClassDashboardPage'
import { ClassDisplayPage } from './pages/display/ClassDisplayPage'
import { LobbyDisplayPage } from './pages/display/LobbyDisplayPage'
import { AdminLayout } from './pages/admin/AdminLayout'
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage'
import { AdminRequestsPage } from './pages/admin/AdminRequestsPage'
import { AdminStudentsPage } from './pages/admin/AdminStudentsPage'
import { AdminParentsPage } from './pages/admin/AdminParentsPage'
import { AdminClassesPage } from './pages/admin/AdminClassesPage'
import { AdminStaffPage } from './pages/admin/AdminStaffPage'
import { AdminImportPage } from './pages/admin/AdminImportPage'
import { AdminGuidePage } from './pages/admin/AdminGuidePage'
import { AdminWhatsAppPage } from './pages/admin/AdminWhatsAppPage'

function NativeLaunchListener() {
  const navigate = useNavigate()
  useEffect(() => {
    const stop = listenNativeLaunchPath((path) => navigate(path))
    void consumeNativeLaunchPath().then((path) => {
      if (path) navigate(path)
    })
    return stop
  }, [navigate])
  return null
}

export default function App() {
  return (
    <>
      <NativeLaunchListener />
      <OfflineBanner />
      <Routes>
        <Route
          path="/login"
          element={
            <PublicOnly>
              <LoginPage />
            </PublicOnly>
          }
        />
        <Route
          path="/register"
          element={
            <PublicOnly>
              <ParentRegisterPage />
            </PublicOnly>
          }
        />
        <Route path="/setup" element={<SetupAdminPage />} />

        <Route
          path="/parent"
          element={
            <ProtectedRoute roles={['PARENT']}>
              <ParentLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<ParentHomePage />} />
          <Route path="children" element={<ParentChildrenPage />} />
          <Route path="requests" element={<ParentRequestsPage />} />
        </Route>

        <Route
          path="/class"
          element={
            <ProtectedRoute roles={['CLASS_STAFF']}>
              <ClassDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/display/class"
          element={
            <ProtectedRoute roles={['CLASS_STAFF']}>
              <ClassDisplayPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/display/lobby"
          element={
            <ProtectedRoute roles={['ADMIN']}>
              <LobbyDisplayPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <ProtectedRoute roles={['ADMIN']}>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminDashboardPage />} />
          <Route path="requests" element={<AdminRequestsPage />} />
          <Route path="students" element={<AdminStudentsPage />} />
          <Route path="parents" element={<AdminParentsPage />} />
          <Route path="classes" element={<AdminClassesPage />} />
          <Route path="staff" element={<AdminStaffPage />} />
          <Route path="import" element={<AdminImportPage />} />
          <Route path="guide" element={<AdminGuidePage />} />
          <Route path="whatsapp" element={<AdminWhatsAppPage />} />
        </Route>

        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
      <InstallPrompt />
    </>
  )
}
