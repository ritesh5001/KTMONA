import { Platform } from "react-native";

import { API_BASE_URL, apiRequest } from "./api";

interface ImageKitAuthResponse {
  token: string;
  expire: number;
  signature: string;
}

interface UploadedImage {
  url: string;
}

const IMAGEKIT_UPLOAD_URL = "https://upload.imagekit.io/api/v1/files/upload";
const IMAGEKIT_PUBLIC_KEY = process.env.EXPO_PUBLIC_IMAGEKIT_PUBLIC_KEY;

export interface ReviewImageAsset {
  uri: string;
  fileName: string;
  mimeType: string;
}

async function appendImageFile(formData: FormData, asset: ReviewImageAsset): Promise<void> {
  if (Platform.OS === "web") {
    const imageResponse = await fetch(asset.uri);
    if (!imageResponse.ok) {
      throw new Error("Failed to read selected image");
    }
    const blob = await imageResponse.blob();
    formData.append("file", blob, asset.fileName);
    return;
  }

  formData.append("file", {
    uri: asset.uri,
    name: asset.fileName,
    type: asset.mimeType,
  } as unknown as Blob);
}

async function uploadImageAsset(asset: ReviewImageAsset, folder: string): Promise<string> {
  if (!IMAGEKIT_PUBLIC_KEY) {
    throw new Error("Image upload is unavailable. Missing EXPO_PUBLIC_IMAGEKIT_PUBLIC_KEY.");
  }

  const auth = await apiRequest<ImageKitAuthResponse>("/v1/imagekit/auth", {
    method: "GET",
    _skipDedup: true,
  });

  const formData = new FormData();
  await appendImageFile(formData, asset);
  formData.append("fileName", asset.fileName);
  formData.append("publicKey", IMAGEKIT_PUBLIC_KEY);
  formData.append("signature", auth.signature);
  formData.append("expire", String(auth.expire));
  formData.append("token", auth.token);
  formData.append("folder", folder);
  formData.append("useUniqueFileName", "true");

  const response = await fetch(IMAGEKIT_UPLOAD_URL, {
    method: "POST",
    body: formData,
  });

  const data = (await response.json().catch(() => null)) as UploadedImage | null;
  if (!response.ok || !data?.url) {
    throw new Error("Failed to upload review image");
  }

  return data.url;
}

export async function uploadReviewImage(asset: ReviewImageAsset): Promise<string> {
  return uploadImageAsset(asset, "/ktmona/reviews");
}

export async function uploadTryOnImage(asset: ReviewImageAsset): Promise<string> {
  return uploadImageAsset(asset, "/ktmona/tryon");
}

export async function uploadAvatarImage(asset: ReviewImageAsset): Promise<string> {
  return uploadImageAsset(asset, "/ktmona/avatars");
}

export function buildAvatarImageName(): string {
  return `avatar-${Date.now()}.jpg`;
}

export function buildReviewImageName(index: number): string {
  return `review-${Date.now()}-${index}.jpg`;
}

export function toAbsoluteUploadUri(uri: string): string {
  if (uri.startsWith("http://") || uri.startsWith("https://") || uri.startsWith("file://")) {
    return uri;
  }
  return `${API_BASE_URL}${uri.startsWith("/") ? uri : `/${uri}`}`;
}
