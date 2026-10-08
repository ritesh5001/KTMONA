import { apiRequest } from "./api";

// ---------------------------------------------------------------------------
// Types — aligned with backend `user_addresses` Prisma model
// ---------------------------------------------------------------------------

export type AddressLabel = "HOME" | "OFFICE" | "OTHER";

export interface Address {
  id: string;
  userId: string;
  label: AddressLabel;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAddressPayload {
  label?: AddressLabel;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  isDefault?: boolean;
}

export interface UpdateAddressPayload {
  label?: AddressLabel;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  pincode?: string;
}

// ---------------------------------------------------------------------------
// Response envelopes
// ---------------------------------------------------------------------------

interface AddressesResponse {
  addresses: Address[];
}

interface AddressMutationResponse {
  message: string;
  address: Address;
}

interface AddressDeleteResponse {
  message: string;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

export async function getAddresses(
  signal?: AbortSignal,
): Promise<Address[]> {
  const res = await apiRequest<AddressesResponse>("/v1/addresses", {
    method: "GET",
    signal,
  });
  return res.addresses ?? [];
}

export async function createAddress(
  data: CreateAddressPayload,
  signal?: AbortSignal,
): Promise<Address> {
  const res = await apiRequest<AddressMutationResponse>("/v1/addresses", {
    method: "POST",
    body: data,
    signal,
  });
  return res.address;
}

export async function updateAddress(
  id: string,
  data: UpdateAddressPayload,
  signal?: AbortSignal,
): Promise<Address> {
  const res = await apiRequest<AddressMutationResponse>(
    `/v1/addresses/${id}`,
    {
      method: "PUT",
      body: data,
      signal,
    },
  );
  return res.address;
}

export async function deleteAddress(
  id: string,
  signal?: AbortSignal,
): Promise<void> {
  await apiRequest<AddressDeleteResponse>(`/v1/addresses/${id}`, {
    method: "DELETE",
    signal,
  });
}

export async function setDefaultAddress(
  id: string,
  signal?: AbortSignal,
): Promise<Address> {
  const res = await apiRequest<AddressMutationResponse>(
    `/v1/addresses/${id}/default`,
    {
      method: "PATCH",
      signal,
    },
  );
  return res.address;
}
