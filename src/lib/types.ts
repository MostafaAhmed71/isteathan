export type UserRole = 'PARENT' | 'CLASS_STAFF' | 'ADMIN'

export type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'

export interface Profile {
  id: string
  full_name: string
  role: UserRole
  national_id: string | null
  username: string | null
  phone: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface SchoolClass {
  id: string
  grade: number
  section: string
  name: string
  staff_profile_id: string | null
  is_active: boolean
  created_at: string
}

export interface Student {
  id: string
  national_id: string
  full_name: string
  grade: number
  class_id: string
  guardian_id: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  classes?: SchoolClass | null
}

export interface PermissionRequest {
  id: string
  student_id: string
  guardian_id: string
  class_id: string
  reason: string
  status: RequestStatus
  rejection_reason: string | null
  created_at: string
  decided_at: string | null
  decided_by: string | null
  updated_at: string
  students?: Student | null
  profiles?: Pick<Profile, 'id' | 'full_name' | 'phone' | 'national_id'> | null
  classes?: SchoolClass | null
}

export const GRADE_LABELS: Record<number, string> = {
  1: 'الأول',
  2: 'الثاني',
  3: 'الثالث',
  4: 'الرابع',
  5: 'الخامس',
  6: 'السادس',
}

export const STATUS_LABELS: Record<RequestStatus, string> = {
  PENDING: 'قيد الانتظار',
  APPROVED: 'تمت الموافقة',
  REJECTED: 'تم الرفض',
  CANCELLED: 'ملغي',
}

export const SECTIONS = ['أ', 'ب', 'ج', 'د'] as const

export function classLabel(grade: number, section: string): string {
  return `الصف ${GRADE_LABELS[grade] ?? grade} — ${section}`
}

export function formatDateTime(value: string): string {
  try {
    return new Intl.DateTimeFormat('ar-SA', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value))
  } catch {
    return value
  }
}

/** Map login identifier to Supabase Auth email (legacy helpers) */
export function authEmailForParent(nationalId: string): string {
  return `${nationalId.trim()}@parent.isteathan.local`
}

export function authEmailForStaff(username: string): string {
  return `${username.trim().toLowerCase()}@staff.isteathan.local`
}

export function authEmailForAdmin(username: string): string {
  return `${username.trim().toLowerCase()}@admin.isteathan.local`
}

export function homePathForRole(role: UserRole): string {
  switch (role) {
    case 'PARENT':
      return '/parent'
    case 'CLASS_STAFF':
      return '/class'
    case 'ADMIN':
      return '/admin'
  }
}
