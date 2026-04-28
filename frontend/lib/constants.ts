// Roles
export const ROLES = {
  SUPER_ADMIN: "super_admin",
  CLINIC_OWNER: "clinic_owner",
  MANAGER: "manager",
  RECEPTIONIST: "receptionist",
  SALES_AGENT: "sales_agent",
  MARKETING_MANAGER: "marketing_manager",
  DOCTOR: "doctor",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

// Clinic types
export const CLINIC_TYPES = [
  "Dental",
  "Aesthetic/Cosmetic",
  "Dermatology",
  "Fertility",
  "Hair Transplant",
  "Physiotherapy",
  "General Practice",
  "Other",
] as const;

// Country codes for phone input
export const COUNTRY_CODES = [
  { code: "+971", country: "UAE", flag: "🇦🇪" },
  { code: "+966", country: "KSA", flag: "🇸🇦" },
  { code: "+20", country: "Egypt", flag: "🇪🇬" },
  { code: "+90", country: "Turkey", flag: "🇹🇷" },
  { code: "+974", country: "Qatar", flag: "🇶🇦" },
  { code: "+965", country: "Kuwait", flag: "🇰🇼" },
  { code: "+973", country: "Bahrain", flag: "🇧🇭" },
  { code: "+968", country: "Oman", flag: "🇴🇲" },
  { code: "+962", country: "Jordan", flag: "🇯🇴" },
  { code: "+1", country: "US", flag: "🇺🇸" },
  { code: "+44", country: "UK", flag: "🇬🇧" },
] as const;

// Lead sources
export const LEAD_SOURCES = [
  { value: "whatsapp", label: "WhatsApp", color: "green" },
  { value: "website", label: "Website", color: "blue" },
  { value: "instagram", label: "Instagram", color: "pink" },
  { value: "google_ads", label: "Google Ads", color: "amber" },
  { value: "referral", label: "Referral", color: "purple" },
  { value: "walk_in", label: "Walk-in", color: "gray" },
  { value: "phone", label: "Phone Call", color: "blue" },
] as const;

// Pipeline stages (default)
export const DEFAULT_PIPELINE_STAGES = [
  "New Lead",
  "Contacted",
  "Qualified",
  "Consultation Booked",
  "Consultation Done",
  "Treatment Proposed",
  "Treatment Accepted",
  "Payment",
  "Completed",
  "Follow-up",
] as const;

// Patient statuses
export const PATIENT_STATUSES = [
  { value: "active", label: "Active", color: "green" },
  { value: "lead", label: "Lead", color: "blue" },
  { value: "inactive", label: "Inactive", color: "gray" },
  { value: "vip", label: "VIP", color: "yellow" },
] as const;

// Subscription plans
export const SUBSCRIPTION_PLANS = [
  { value: "trial", label: "Trial", price: 0 },
  { value: "growth", label: "Growth", price: 500 },
  { value: "professional", label: "Professional", price: 1000 },
  { value: "enterprise", label: "Enterprise", price: 2000 },
] as const;
