/**
 * API calls for the Meesho-parity features: shops, sale events, collections,
 * Price Lock, profile editing, refund (bank/UPI) details, video-call
 * appointments, careers, investors, COD config and search suggestions.
 */

import { apiRequest } from "./api";

interface Envelope<T> {
  success: boolean;
  data: T;
}

/* ── Shops ──────────────────────────────────────────────────────────────── */

export interface StoreDetail {
  sellerId: string;
  slug: string;
  name: string;
  description: string | null;
  logo: string | null;
  city: string | null;
  state: string | null;
  onHoliday: boolean;
  memberSince: string;
  productCount: number;
  rating: { average: number | null; count: number };
}

export async function getStore(slug: string, signal?: AbortSignal) {
  const r = await apiRequest<Envelope<{ store: StoreDetail }>>(`/v1/site/stores/${encodeURIComponent(slug)}`, { method: "GET", signal });
  return r.data.store;
}

/* ── Sale events & collections ─────────────────────────────────────────── */

export interface SaleEvent {
  name: string;
  slug: string;
  description: string | null;
  bannerImage: string | null;
  startsAt: string;
  endsAt: string;
  minDiscountPercent: number | null;
  live?: boolean;
}

export async function listSaleEvents(signal?: AbortSignal) {
  const r = await apiRequest<Envelope<SaleEvent[]>>("/v1/campaigns", { method: "GET", signal });
  return r.data ?? [];
}

export async function getSaleEvent(slug: string, signal?: AbortSignal) {
  const r = await apiRequest<
    Envelope<{
      campaign: SaleEvent & { phase: string };
      products: { id: string; title: string; images: string[]; price: number | null; compareAtPrice: number | null; category?: { name: string } | null }[];
    }>
  >(`/v1/campaigns/${encodeURIComponent(slug)}`, { method: "GET", signal });
  return r.data;
}

export interface Occasion {
  id: string;
  name: string;
  slug: string;
  image?: string | null;
  description?: string | null;
}

export async function listOccasions(signal?: AbortSignal) {
  const r = await apiRequest<{ occasions: Occasion[] }>("/v1/occasions", { method: "GET", signal });
  return r.occasions ?? [];
}

/* ── Profile ────────────────────────────────────────────────────────────── */

export type Gender = "MALE" | "FEMALE" | "OTHER" | "PREFER_NOT_TO_SAY";

export interface MyProfile {
  userId: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  avatar: string | null;
  gender: Gender | null;
  dob: string | null;
}

export async function getMyFullProfile(signal?: AbortSignal) {
  const r = await apiRequest<{ profile: MyProfile }>("/v1/me", { method: "GET", signal });
  return r.profile;
}

export async function updateMyProfile(input: { fullName?: string; gender?: Gender | null; dob?: string | null }) {
  const r = await apiRequest<{ profile: MyProfile }>("/v1/me", { method: "PATCH", body: input });
  return r.profile;
}

/* ── Refund bank / UPI details (COD refunds) ───────────────────────────── */

export interface RefundDetails {
  method: "UPI" | "BANK";
  upiId: string | null;
  accountHolder: string | null;
  accountNumberMasked: string | null;
  ifsc: string | null;
  bankName: string | null;
  updatedAt: string;
}

export type RefundDetailsInput =
  | { method: "UPI"; upiId: string }
  | { method: "BANK"; accountHolder: string; accountNumber: string; ifsc: string; bankName?: string };

export async function getRefundDetails(signal?: AbortSignal) {
  const r = await apiRequest<{ refundDetails: RefundDetails | null }>("/v1/me/refund-details", { method: "GET", signal });
  return r.refundDetails;
}

export async function saveRefundDetails(input: RefundDetailsInput) {
  const r = await apiRequest<{ refundDetails: RefundDetails | null }>("/v1/me/refund-details", { method: "PUT", body: input });
  return r.refundDetails;
}

export async function deleteRefundDetails() {
  await apiRequest<{ refundDetails: null }>("/v1/me/refund-details", { method: "DELETE" });
}

/* ── Video-call appointments ────────────────────────────────────────────── */

export interface Appointment {
  id: string;
  date: string;
  time: string;
  status: "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED";
  notes?: string | null;
  /** Video call happens on WhatsApp with the seller. */
  whatsappLink?: string | null;
  joinActive?: boolean;
  callStartsSoon?: boolean;
  startsAt?: string;
  seller?: { id: string; seller_profiles?: { store_name: string } | null } | null;
  product?: { id: string; title: string } | null;
}

export async function listMyAppointments(signal?: AbortSignal) {
  const r = await apiRequest<{ appointments?: Appointment[]; data?: { appointments: Appointment[] } }>("/v1/appointments/user", { method: "GET", signal });
  return r.appointments ?? r.data?.appointments ?? [];
}

export async function bookAppointment(input: { sellerId: string; productId?: string; date: string; time: string; notes?: string }) {
  return apiRequest<unknown>("/v1/appointments/create", { method: "POST", body: input });
}

export async function cancelAppointment(appointmentId: string) {
  return apiRequest<unknown>("/v1/appointments/status", { method: "PATCH", body: { appointmentId, status: "CANCELLED" } });
}

/* ── Careers & investors ───────────────────────────────────────────────── */

export type JobType = "FULL_TIME" | "PART_TIME" | "INTERNSHIP" | "CONTRACT";

export const JOB_TYPE_LABEL: Record<JobType, string> = {
  FULL_TIME: "Full-time",
  PART_TIME: "Part-time",
  INTERNSHIP: "Internship",
  CONTRACT: "Contract",
};

export interface JobOpening {
  id: string;
  title: string;
  department: string | null;
  location: string | null;
  type: JobType;
  description: string;
  createdAt: string;
}

export async function listJobs(signal?: AbortSignal) {
  const r = await apiRequest<Envelope<{ jobs: JobOpening[] }>>("/v1/site/careers", { method: "GET", signal });
  return r.data.jobs;
}

export async function applyForJob(input: { jobId?: string | null; name: string; email: string; phone?: string | null; resumeUrl?: string | null; message?: string | null }) {
  const r = await apiRequest<Envelope<{ message: string }>>("/v1/site/careers/apply", { method: "POST", body: { ...input, source: "customer" } });
  return r.data.message;
}

export async function sendInvestorInquiry(input: { name: string; email: string; phone?: string | null; organization?: string | null; message: string }) {
  const r = await apiRequest<Envelope<{ message: string }>>("/v1/site/investors", { method: "POST", body: input });
  return r.data.message;
}

/* ── Checkout: Cash on Delivery ─────────────────────────────────────────── */

export async function getCodConfig(signal?: AbortSignal) {
  return apiRequest<{ enabled: boolean; maxOrderAmount: number }>("/v1/config/cod", { method: "GET", signal });
}
