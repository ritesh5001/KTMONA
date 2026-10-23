import { apiRequest } from "@/services/api";

export interface OffersConfig {
  cashback: { enabled: boolean; percent: number; maxPerOrder: number; holdDays: number; expiryDays: number; maxUsePercent: number };
  referral: { enabled: boolean; friendAmount: number; referrerAmount: number; minOrder: number; maxRewards: number };
  welcome: { enabled: boolean; amount: number; minOrder: number };
}

export function getOffersConfig() {
  return apiRequest<OffersConfig>("/v1/admin/center/offers-config", { method: "GET" });
}

export function saveOffersConfig(patch: Partial<OffersConfig>) {
  return apiRequest<OffersConfig>("/v1/admin/center/offers-config", { method: "PUT", body: patch });
}

export interface ReportedReview {
  id: string;
  product: { id: string; title: string };
  author: string;
  rating: number;
  text: string;
  images: string[];
  isHidden: boolean;
  verifiedPurchase: boolean;
  createdAt: string;
  reports: Array<{ reason: string; details: string | null; createdAt: string }>;
}

export function listReportedReviews() {
  return apiRequest<{ reviews: ReportedReview[] }>("/v1/admin/center/reviews-reported", { method: "GET" });
}

export function resolveReportedReview(id: string, action: "KEEP" | "REMOVE") {
  return apiRequest<{ ok: boolean }>(`/v1/admin/center/reviews-reported/${id}/resolve`, { method: "POST", body: { action } });
}

export interface AdminProductReport {
  id: string;
  productId: string;
  productTitle: string;
  type: string;
  details: string | null;
  status: string;
  createdAt: string;
}

export function listProductReports(status: "OPEN" | "RESOLVED" | "ALL" = "OPEN") {
  return apiRequest<{ reports: AdminProductReport[] }>(`/v1/admin/center/product-reports?status=${status}`, { method: "GET" });
}

export function resolveProductReport(id: string) {
  return apiRequest<{ report: AdminProductReport }>(`/v1/admin/center/product-reports/${id}/resolve`, { method: "POST" });
}

export interface AdminProductQuestion {
  id: string;
  productId: string;
  productTitle: string;
  question: string;
  answer: string | null;
  answeredBy: string | null;
  answeredAt: string | null;
  isHidden: boolean;
  createdAt: string;
}

export function listAdminQuestions() {
  return apiRequest<{ questions: AdminProductQuestion[] }>("/v1/admin/center/product-questions", { method: "GET" });
}

export function answerAdminQuestion(id: string, answer: string) {
  return apiRequest<{ question: AdminProductQuestion }>(`/v1/admin/center/product-questions/${id}/answer`, { method: "POST", body: { answer } });
}

export function setAdminQuestionHidden(id: string, hidden: boolean) {
  return apiRequest<{ question: AdminProductQuestion }>(`/v1/admin/center/product-questions/${id}/hidden`, { method: "POST", body: { hidden } });
}

// Seller panel
export function listSellerQuestions(all = false) {
  return apiRequest<{ questions: AdminProductQuestion[] }>(`/v1/seller/center/questions${all ? "?all=1" : ""}`, { method: "GET" });
}

export function answerSellerQuestion(id: string, answer: string) {
  return apiRequest<{ question: AdminProductQuestion }>(`/v1/seller/center/questions/${id}/answer`, { method: "POST", body: { answer } });
}
