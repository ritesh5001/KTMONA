import { apiRequest } from "@/services/api";

// ---------------------------------------------------------------------------
// Types — mirrors backend SerializedAddress
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

export interface AddressListResponse {
  addresses: Address[];
}

export interface AddressMutationResponse {
  address: Address;
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
// API calls
// ---------------------------------------------------------------------------

export async function getAddresses(
  token?: string | null,
): Promise<AddressListResponse> {
  return apiRequest<AddressListResponse>("/v1/addresses", {
    method: "GET",
    token,
  });
}

export async function createAddress(
  payload: CreateAddressPayload,
  token?: string | null,
): Promise<AddressMutationResponse> {
  return apiRequest<AddressMutationResponse>("/v1/addresses", {
    method: "POST",
    body: payload,
    token,
  });
}

export async function updateAddress(
  addressId: string,
  payload: UpdateAddressPayload,
  token?: string | null,
): Promise<AddressMutationResponse> {
  return apiRequest<AddressMutationResponse>(`/v1/addresses/${addressId}`, {
    method: "PUT",
    body: payload,
    token,
  });
}

export async function deleteAddress(
  addressId: string,
  token?: string | null,
): Promise<void> {
  await apiRequest<void>(`/v1/addresses/${addressId}`, {
    method: "DELETE",
    token,
  });
}

export async function setDefaultAddress(
  addressId: string,
  token?: string | null,
): Promise<AddressMutationResponse> {
  return apiRequest<AddressMutationResponse>(
    `/v1/addresses/${addressId}/default`,
    { method: "PATCH", token },
  );
}
