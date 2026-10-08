import { apiRequest } from "@/services/api";

export type AppointmentStatus = "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED";

export interface Appointment {
  id: string;
  userId: string;
  sellerId: string;
  productId?: string | null;
  date: string;
  time: string;
  status: AppointmentStatus;
  whatsappNumber: string;
  whatsappLink?: string;
  startsAt?: string;
  endsAt?: string;
  joinWindowStart?: string;
  joinActive?: boolean;
  callStartsSoon?: boolean;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    email?: string | null;
    phone?: string | null;
  };
  seller?: {
    id: string;
    email?: string | null;
    phone?: string | null;
    seller_profiles?: {
      store_name?: string;
    };
  };
  product?: {
    id: string;
    title?: string;
  } | null;
}

export interface CreateAppointmentPayload {
  sellerId: string;
  productId?: string;
  date: string;
  time: string;
  notes?: string;
}

export async function createAppointment(payload: CreateAppointmentPayload) {
  return apiRequest<{ appointment: Appointment }>("/v1/appointments/create", {
    method: "POST",
    body: payload,
  });
}

export async function listUserAppointments() {
  return apiRequest<{ appointments: Appointment[] }>("/v1/appointments/user", {
    method: "GET",
  });
}

export async function listSellerAppointments() {
  return apiRequest<{ appointments: Appointment[] }>("/v1/appointments/seller", {
    method: "GET",
  });
}

export async function updateAppointmentStatus(
  appointmentId: string,
  status: AppointmentStatus,
) {
  return apiRequest<{ appointment: Appointment }>("/v1/appointments/status", {
    method: "PATCH",
    body: { appointmentId, status },
  });
}

export async function listAdminAppointments() {
  return apiRequest<{ appointments: Appointment[] }>("/v1/appointments/admin", {
    method: "GET",
  });
}

export async function adminRescheduleAppointment(payload: {
  appointmentId: string;
  date: string;
  time: string;
}) {
  return apiRequest<{ appointment: Appointment }>("/v1/appointments/admin/reschedule", {
    method: "PATCH",
    body: payload,
  });
}

export async function adminBlockSeller(sellerId: string) {
  return apiRequest<{ message: string; sellerId: string; cancelledAppointments: number }>(
    "/v1/appointments/admin/block-seller",
    {
      method: "PATCH",
      body: { sellerId },
    },
  );
}
