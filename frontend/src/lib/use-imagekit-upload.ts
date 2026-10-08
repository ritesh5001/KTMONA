"use client";

import * as React from "react";
import ImageKit from "imagekit-javascript";
import { compressImageForUpload } from "@/lib/image-compression";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY;
const URL_ENDPOINT = process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT;
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

/**
 * Uploads an image to ImageKit (compressed first) and returns its URL.
 * Same flow as the category editor: signed auth from the API, then a direct
 * browser upload.
 */
export function useImageKitUpload(folder: string) {
  const [uploading, setUploading] = React.useState(false);
  const client = React.useMemo(
    () => (PUBLIC_KEY && URL_ENDPOINT ? new ImageKit({ publicKey: PUBLIC_KEY, urlEndpoint: URL_ENDPOINT }) : null),
    [],
  );

  const upload = React.useCallback(
    async (file: File): Promise<string> => {
      if (!client || !API_BASE_URL) throw new Error("Image uploads are not configured (ImageKit env vars missing).");
      setUploading(true);
      try {
        const auth = await fetch(`${API_BASE_URL}/v1/imagekit/auth`);
        if (!auth.ok) throw new Error("Could not start the upload. Please try again.");
        const { signature, token, expire } = (await auth.json()) as { signature: string; token: string; expire: number };
        const compressed = await compressImageForUpload(file);
        const result = await client.upload({
          file: compressed,
          fileName: compressed.name,
          folder,
          useUniqueFileName: true,
          signature,
          token,
          expire,
        });
        return result.url;
      } finally {
        setUploading(false);
      }
    },
    [client, folder],
  );

  return { upload, uploading };
}
