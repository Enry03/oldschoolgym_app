export type Role = 'admin' | 'trainer' | 'reception' | 'client'
export type BookingStatus = 'booked' | 'waitlist' | 'cancelled' | 'attended' | 'no_show'
export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'other'

export interface Profile {
  id: string
  role: Role
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  birth_date: string | null
  gender: string | null
  avatar_url: string | null
  trainer_id: string | null
  qr_token: string
  consent_privacy: boolean
  consent_marketing: boolean
  consent_photos: boolean
  consent_at: string | null
  referral_code: string | null
  referred_by: string | null
  is_active: boolean
  created_at: string
}

export interface GymSettings {
  id: number
  name: string
  tagline: string | null
  address: string | null
  phone: string | null
  whatsapp: string | null
  email: string | null
  instagram: string | null
  opening_hours: { day: number; label: string; open: string | null; close: string | null }[]
  cancel_hours: number
  max_capacity: number
  inactivity_days: number
  block_without_certificate: boolean
}

export interface Plan {
  id: string
  name: string
  description: string | null
  kind: 'time' | 'entries'
  duration_days: number | null
  entries: number | null
  price_cents: number
  highlight: boolean
  features: string[]
  is_active: boolean
  sort: number
}

export interface Membership {
  id: string
  user_id: string
  plan_id: string | null
  plan_name: string
  start_date: string
  end_date: string | null
  entries_left: number | null
  status: 'active' | 'suspended' | 'expired' | 'cancelled'
  suspended_from: string | null
  suspended_to: string | null
  price_cents: number
  discount_code: string | null
  notes: string | null
  created_at: string
}

export interface Payment {
  id: string
  user_id: string
  membership_id: string | null
  description: string
  amount_cents: number
  method: PaymentMethod
  status: 'paid' | 'pending'
  due_date: string | null
  paid_at: string | null
  receipt_number: number
  created_at: string
}

export interface Certificate {
  id: string
  user_id: string
  kind: string
  issued_on: string | null
  expires_on: string
  file_path: string | null
  verified: boolean
}

export interface Course {
  id: string
  name: string
  description: string | null
  color: string
  level: string | null
  duration_min: number
  capacity: number
  trainer_id: string | null
  image_url: string | null
  is_active: boolean
}

export interface SessionRow {
  id: string
  course_id: string | null
  kind: 'course' | 'event' | 'open' | 'personal'
  title: string
  description: string | null
  starts_at: string
  ends_at: string
  capacity: number
  room: string | null
  is_cancelled: boolean
  trainer_id: string | null
  trainer_name: string | null
  color: string
  booked_count: number
  waitlist_count: number
  my_status: BookingStatus | null
}

export interface Exercise {
  id: string
  name: string
  muscle_group: string
  equipment: string | null
  description: string | null
  video_url: string | null
  image_url: string | null
}

export interface WorkoutPlan {
  id: string
  user_id: string | null
  title: string
  goal: string | null
  notes: string | null
  is_template: boolean
  is_active: boolean
  starts_on: string | null
  ends_on: string | null
  created_by: string | null
  created_at: string
  workout_plan_items?: WorkoutItem[]
}

export interface WorkoutItem {
  id: string
  plan_id: string
  day_label: string
  exercise_id: string | null
  exercise_name: string
  sets: number
  reps: string
  rest_sec: number | null
  load_note: string | null
  notes: string | null
  sort: number
}

export interface WorkoutLog {
  id: string
  user_id: string
  plan_item_id: string | null
  exercise_name: string
  performed_on: string
  set_number: number
  weight_kg: number | null
  reps: number | null
  note: string | null
}

export interface Measurement {
  id: string
  user_id: string
  measured_on: string
  weight_kg: number | null
  height_cm: number | null
  body_fat_pct: number | null
  muscle_mass_kg: number | null
  chest_cm: number | null
  waist_cm: number | null
  hips_cm: number | null
  arm_cm: number | null
  thigh_cm: number | null
  notes: string | null
}

export interface Goal {
  id: string
  user_id: string
  title: string
  target_value: number | null
  unit: string | null
  due_on: string | null
  is_done: boolean
}

export interface Announcement {
  id: string
  title: string
  body: string
  category: string
  image_url: string | null
  is_pinned: boolean
  audience: 'all' | 'clients' | 'staff'
  published_at: string
}

export interface Notification {
  id: string
  user_id: string
  title: string
  body: string | null
  link: string | null
  kind: string
  read_at: string | null
  created_at: string
}

export interface Message {
  id: string
  sender_id: string
  recipient_id: string
  body: string
  read_at: string | null
  created_at: string
}

export interface StaffMember {
  id: string
  first_name: string
  last_name: string
  role: Role
  avatar_url: string | null
}

export interface Lead {
  id: string
  full_name: string
  phone: string | null
  email: string | null
  source: string | null
  status: 'new' | 'contacted' | 'trial' | 'converted' | 'lost'
  trial_date: string | null
  notes: string | null
  created_at: string
}

export interface Product {
  id: string
  name: string
  category: string
  price_cents: number
  stock: number
  is_active: boolean
}
