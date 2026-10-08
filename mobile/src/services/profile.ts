import { apiRequest } from "./api";

export interface UserProfile {
  userId: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  avatar: string | null;
}

interface ProfileResponse {
  profile: UserProfile;
}

/** The signed-in user's own profile. Always scoped to the bearer token. */
export async function getMyProfile(signal?: AbortSignal): Promise<UserProfile> {
  const response = await apiRequest<ProfileResponse>("/v1/me", {
    method: "GET",
    signal,
  });
  return response.profile;
}

/**
 * Point the profile at an already-uploaded image, or pass `null` to remove it.
 *
 * The file itself goes straight to ImageKit from the device using a short-lived
 * signature; this only records where it landed. The server rejects anything not
 * hosted on our own CDN.
 */
export async function updateMyAvatar(
  avatar: string | null
): Promise<UserProfile> {
  const response = await apiRequest<ProfileResponse>("/v1/me/avatar", {
    method: "PATCH",
    body: { avatar },
  });
  return response.profile;
}
