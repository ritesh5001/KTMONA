"use client";

import * as React from "react";
import { CategoryOptions } from "@/components/seller/CategoryOptions";
import { useRouter } from "next/navigation";
import { EarningsHint } from "@/components/seller/EarningsHint";
import Image from "next/image";
import ImageKit from "imagekit-javascript";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ColorSwatchPicker } from "@/components/color-swatch-picker";
import { normalizeHex } from "@/lib/color-swatches";
import { getCategories } from "@/services/catalog";
import { getOccasions, type Occasion } from "@/services/occasions";
import {
  addVariantToProduct,
  createSellerProduct,
  deleteSellerProduct,
  listSellerProducts,
  type CreateVariantPayload,
  updateSellerProduct,
  updateVariant,
  updateVariantStock,
} from "@/services/seller-products";
import {
  addProductMedia,
  deleteProductMedia,
  type ProductMedia,
} from "@/services/product-media";
import { compressImageForUpload } from "@/lib/image-compression";
import { useLiveFreshness } from "@/hooks/use-live-freshness";
import { useHydratedSWR } from "@/hooks/use-hydrated-swr";

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const IMAGEKIT_PUBLIC_KEY = process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY;
const IMAGEKIT_URL_ENDPOINT = process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT;
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const UPLOAD_PARALLELISM = 3;

type UploadedImage = { url: string; fileId: string; name: string };
type ColorGroup = { key: string; label: string };
type DraftVariant = {
  id: string;
  size: string;
  color: string;
  colorHex: string | null;
  sku: string;
  sellerPrice: string;
  compareAtPrice: string;
  initialStock: string;
  images: UploadedImage[];
};

function createDraftVariant(): DraftVariant {
  return {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    size: "",
    color: "",
    colorHex: null,
    sku: "",
    sellerPrice: "",
    compareAtPrice: "",
    initialStock: "",
    images: [],
  };
}

function variantCombinationKey(size: string, color?: string | null): string {
  return `${size.trim().toLowerCase()}::${(color ?? "").trim().toLowerCase()}`;
}

function normalizeColorKey(color?: string | null): string {
  const normalized = color?.trim().toLowerCase();
  return normalized && normalized.length > 0 ? normalized : "__no_color__";
}

function getDisplayColorLabel(color?: string | null): string {
  const trimmed = color?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "Default";
}

function getColorImageMapFromVariants(
  variants: Array<{ color?: string | null; images?: string[] | UploadedImage[] }>
): Record<string, string[]> {
  const next: Record<string, string[]> = {};

  for (const variant of variants) {
    if (!variant.color?.trim()) continue;
    const key = normalizeColorKey(variant.color);
    if (next[key]?.length) continue;

    const images = (variant.images ?? [])
      .map((image) => (typeof image === "string" ? image : image?.url))
      .filter((image): image is string => typeof image === "string" && image.trim().length > 0);

    if (images.length > 0) {
      next[key] = images;
    }
  }

  return next;
}

function parseVariantInput(
  input: {
    size: string;
    color: string;
    colorHex?: string | null;
    sku: string;
    sellerPrice: string;
    compareAtPrice: string;
    initialStock: string;
  },
  contextLabel: string
): Omit<CreateVariantPayload, "images"> {
  const size = input.size.trim();
  const sku = input.sku.trim();
  const color = input.color.trim();
  const colorHex = input.colorHex ?? null;
  const sellerPrice = Number(input.sellerPrice);
  const compareAtPrice = input.compareAtPrice.trim()
    ? Number(input.compareAtPrice)
    : undefined;
  const initialStock = input.initialStock.trim()
    ? Number(input.initialStock)
    : 0;

  if (!size) {
    throw new Error(`${contextLabel}: size is required.`);
  }
  if (!sku) {
    throw new Error(`${contextLabel}: SKU is required.`);
  }
  if (!Number.isFinite(sellerPrice) || sellerPrice <= 0) {
    throw new Error(`${contextLabel}: enter a valid seller price.`);
  }
  if (
    compareAtPrice !== undefined &&
    (!Number.isFinite(compareAtPrice) || compareAtPrice <= 0)
  ) {
    throw new Error(`${contextLabel}: enter a valid compare-at price.`);
  }
  if (compareAtPrice !== undefined && compareAtPrice < sellerPrice) {
    throw new Error(
      `${contextLabel}: compare-at price cannot be below the selling price.`
    );
  }
  if (!Number.isInteger(initialStock) || initialStock < 0) {
    throw new Error(`${contextLabel}: enter a valid initial stock quantity.`);
  }

  return {
    size,
    color: color || undefined,
    colorHex,
    sku,
    sellerPrice,
    compareAtPrice,
    initialStock,
  };
}

export interface SellerProductsInitialData {
  categories: Array<{ id: string; name: string; parentId?: string | null; sortOrder?: number | null }>;
  occasions: Occasion[];
  products: Array<any>;
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  const queue = [...items];
  const workers = Array.from({ length: Math.max(1, limit) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (item === undefined) return;
      const result = await worker(item);
      results.push(result);
    }
  });

  await Promise.all(workers);
  return results;
}

const getMissingImageKitConfig = () => {
  const missing: string[] = [];
  if (!IMAGEKIT_PUBLIC_KEY) missing.push("NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY");
  if (!IMAGEKIT_URL_ENDPOINT) missing.push("NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT");
  if (!API_BASE_URL) missing.push("NEXT_PUBLIC_API_BASE_URL");
  return missing;
};

const getApprovalBadge = (product: any) => {
  if (product.deletedByAdmin) {
    return {
      label: "REMOVED",
      className: "border-[#A67575]/30 text-[#7A5656] bg-[#A67575]/5",
    };
  }

  const status = String(product.status ?? "PENDING").toUpperCase();
  if (status === "APPROVED") {
    return {
      label: "APPROVED",
      className: "border-[#7B9971]/30 text-[#5A7352] bg-[#7B9971]/5",
    };
  }

  if (status === "REJECTED") {
    return {
      label: "REJECTED",
      className: "border-[#A67575]/30 text-[#7A5656] bg-[#A67575]/5",
    };
  }

  return {
    label: "PENDING",
    className: "border-[#FF8A00]/30 text-[#B84A00] bg-[#FF8A00]/5",
  };
};

export default function SellerProductsClient({
  initialData,
  initialMode = null,
  focusProductId = null,
}: {
  initialData?: SellerProductsInitialData | null;
  /** "create" opens the add-product form straight away (/seller/products/new). */
  initialMode?: "create" | null;
  /** Open this product's edit form (/seller/products/manage?edit=<id>). */
  focusProductId?: string | null;
}) {
  const router = useRouter();
  const [categories, setCategories] = React.useState<
    Array<{ id: string; name: string }>
  >(initialData?.categories ?? []);
  const [occasions, setOccasions] = React.useState<Occasion[]>(
    initialData?.occasions ?? []
  );
  const [products, setProducts] = React.useState<Array<any>>(
    initialData?.products ?? []
  );
  const [form, setForm] = React.useState({
    categoryId: "",
    audience: "MENS" as "MENS" | "KIDS",
    title: "",
    description: "",
    isPublished: false,
    occasionIds: [] as string[],
  });
  const [createVariants, setCreateVariants] = React.useState<DraftVariant[]>([
    createDraftVariant(),
  ]);
  const [createColorImages, setCreateColorImages] = React.useState<
    Record<string, UploadedImage[]>
  >({});
  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [images, setImages] = React.useState<UploadedImage[]>([]);
  const [uploadingImages, setUploadingImages] = React.useState(false);
  const [variantForm, setVariantForm] = React.useState({
    size: "",
    color: "",
    colorHex: null as string | null,
    sku: "",
    sellerPrice: "",
    compareAtPrice: "",
    initialStock: "",
    images: [] as UploadedImage[],
  });
  const [activeProductId, setActiveProductId] = React.useState<string | null>(
    null
  );
  const [editingProductId, setEditingProductId] = React.useState<string | null>(
    null
  );
  const [editForm, setEditForm] = React.useState({
    categoryId: "",
    audience: "MENS" as "MENS" | "KIDS",
    title: "",
    description: "",
    isPublished: false,
    occasionIds: [] as string[],
  });
  const [stockEdits, setStockEdits] = React.useState<Record<string, string>>(
    {}
  );
  const [variantEditsOpen, setVariantEditsOpen] = React.useState<
    Record<string, boolean>
  >({});
  const [variantEdits, setVariantEdits] = React.useState<
    Record<
      string,
      {
        size: string;
        sku: string;
        sellerPrice: string;
        compareAtPrice: string;
        color: string;
        colorHex: string | null;
        images: string[];
      }
    >
  >({});
  const [uploadingVariantFormImages, setUploadingVariantFormImages] =
    React.useState(false);
  const [productColorImages, setProductColorImages] = React.useState<
    Record<string, Record<string, string[]>>
  >({});
  const [uploadingProductColorImages, setUploadingProductColorImages] = React.useState<
    Record<string, boolean>
  >({});

  // Product media state
  const [productMedia, setProductMedia] = React.useState<Record<string, ProductMedia[]>>({});
  const [uploadingMedia, setUploadingMedia] = React.useState(false);

  const updateCreateVariant = React.useCallback(
    (draftId: string, patch: Partial<DraftVariant>) => {
      setCreateVariants((prev) =>
        prev.map((variant) =>
          variant.id === draftId ? { ...variant, ...patch } : variant
        )
      );
    },
    []
  );

  const removeCreateVariant = React.useCallback((draftId: string) => {
    setCreateVariants((prev) =>
      prev.length > 1
        ? prev.filter((variant) => variant.id !== draftId)
        : prev
    );
  }, []);

  const updateVariantEditState = React.useCallback(
    (
      variantId: string,
      patch: Partial<{
        size: string;
        sku: string;
        sellerPrice: string;
        compareAtPrice: string;
        color: string;
        colorHex: string | null;
        images: string[];
      }>
    ) => {
      setVariantEdits((prev) => ({
        ...prev,
        [variantId]: {
          size: prev[variantId]?.size ?? "",
          sku: prev[variantId]?.sku ?? "",
          sellerPrice: prev[variantId]?.sellerPrice ?? "",
          compareAtPrice: prev[variantId]?.compareAtPrice ?? "",
          color: prev[variantId]?.color ?? "",
          colorHex: prev[variantId]?.colorHex ?? null,
          images: prev[variantId]?.images ?? [],
          ...patch,
        },
      }));
    },
    []
  );

  const fetchSellerProductsData = React.useCallback(async () => {
    const results = await Promise.allSettled([
      getCategories(),
      listSellerProducts(),
      getOccasions(),
    ]);

    const categoryResult = results[0];
    const productResult = results[1];
    const occasionResult = results[2];

    if (categoryResult.status === "fulfilled") {
    } else {
      toast.error(
        categoryResult.reason instanceof Error
          ? categoryResult.reason.message
          : "Unable to load categories"
      );
    }

    if (productResult.status === "fulfilled") {
    } else {
      toast.error(
        productResult.reason instanceof Error
          ? productResult.reason.message
          : "Unable to load products"
      );
    }

    if (occasionResult.status === "fulfilled") {
      return {
        categories:
          categoryResult.status === "fulfilled"
            ? categoryResult.value.categories ?? []
            : [],
        products:
          productResult.status === "fulfilled" ? productResult.value.products ?? [] : [],
        occasions: occasionResult.value.occasions ?? [],
      } satisfies SellerProductsInitialData;
    } else {
      return {
        categories:
          categoryResult.status === "fulfilled"
            ? categoryResult.value.categories ?? []
            : [],
        products:
          productResult.status === "fulfilled" ? productResult.value.products ?? [] : [],
        occasions: [],
      } satisfies SellerProductsInitialData;
    }
  }, []);

  const { data: hydratedData, isLoading, mutate } = useHydratedSWR<SellerProductsInitialData>({
    key: "seller-products:hydrated",
    fetcher: fetchSellerProductsData,
    fallbackData: initialData ?? undefined,
  });

  React.useEffect(() => {
    if (!hydratedData) return;
    setCategories(hydratedData.categories ?? []);
    setProducts(hydratedData.products ?? []);
    setOccasions(hydratedData.occasions ?? []);
  }, [hydratedData]);

  const loading = isLoading && !hydratedData;

  const imagekit = React.useMemo(() => {
    if (!IMAGEKIT_PUBLIC_KEY || !IMAGEKIT_URL_ENDPOINT || !API_BASE_URL) {
      return null;
    }
    return new ImageKit({
      publicKey: IMAGEKIT_PUBLIC_KEY,
      urlEndpoint: IMAGEKIT_URL_ENDPOINT,
    });
  }, []);

  const liveRefreshBlockRef = React.useRef<number>(0);

  useLiveFreshness({
    eventTypes: ["product.updated", "inventory.updated", "catalog.updated"],
    onEvent: () => {
      const now = Date.now();
      if (now - liveRefreshBlockRef.current < 600) return;
      liveRefreshBlockRef.current = now;
      void mutate();
    },
  });

  const handleCreateProduct = async (event: React.FormEvent) => {
    event.preventDefault();
    // Collect everything that is missing and name it, rather than stopping at the
    // first problem and making the seller resubmit to discover the next one.
    const missing: string[] = [];
    if (!form.categoryId) missing.push("Category");
    if (!form.title.trim()) missing.push("Title");
    if (images.length < 1) missing.push("At least one product image");
    if (createVariants.length < 1) missing.push("At least one variant");

    createVariants.forEach((variant, index) => {
      const label = `Variant ${index + 1}`;
      if (!variant.size.trim()) missing.push(`${label}: size`);
      if (!variant.sku.trim()) missing.push(`${label}: SKU`);
      if (!variant.sellerPrice.trim()) missing.push(`${label}: seller price`);
    });

    if (missing.length > 0) {
      toast.error(
        missing.length === 1
          ? `Still needed — ${missing[0]}`
          : `Still needed — ${missing.join(", ")}`,
        { duration: 8000 }
      );
      return;
    }

    try {
      const seenSkus = new Set<string>();
      const seenCombinations = new Set<string>();
      const variants = createVariants.map((variant, index) => {
        const parsed = parseVariantInput(
          variant,
          `Variant ${index + 1}`
        );
        const normalizedSku = parsed.sku.toLowerCase();
        if (seenSkus.has(normalizedSku)) {
          throw new Error(`Variant ${index + 1}: SKU must be unique.`);
        }
        seenSkus.add(normalizedSku);

        const combinationKey = variantCombinationKey(parsed.size, parsed.color);
        if (seenCombinations.has(combinationKey)) {
          throw new Error(
            `Variant ${index + 1}: duplicate size and color combination.`
          );
        }
        seenCombinations.add(combinationKey);

        return {
          ...parsed,
          images:
            createColorImages[normalizeColorKey(parsed.color)]?.map((image) => image.url) ??
            [],
        };
      });

      const result = await createSellerProduct({
        categoryId: form.categoryId,
        audience: form.audience,
        title: form.title.trim(),
        description: form.description || undefined,
        images: images.map((image) => image.url),
        occasionIds: form.occasionIds.length > 0 ? form.occasionIds : undefined,
        variants,
      });

      toast.success("Your product has been submitted for price and approval.");
      setForm({
        categoryId: "",
        audience: "MENS",
        title: "",
        description: "",
        isPublished: false,
        occasionIds: [],
      });
      setCreateVariants([createDraftVariant()]);
      setCreateColorImages({});
      setImages([]);
      setShowCreateModal(false);
      if (initialMode === "create") {
        router.push("/seller/products?tab=under_review");
      }

      setProducts((prev) => [
        {
          ...result.product,
          category: categories.find((c) => c.id === form.categoryId) ?? null,
        },
        ...prev,
      ]);
      router.push("/seller/products");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Create failed");
    }
  };

  const handleDelete = async (productId: string) => {
    try {
      await deleteSellerProduct(productId);
      toast.success("Product deleted.");
      setProducts((prev) => prev.filter((product) => product.id !== productId));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed");
    }
  };

  const handleAddVariant = async (productId: string) => {
    try {
      const parsed = parseVariantInput(variantForm, "Variant");
      const result = await addVariantToProduct(productId, {
        ...parsed,
        images: variantForm.images.map((image) => image.url),
      });
      toast.success("Variant added.");
      setVariantForm({
        size: "",
        color: "",
        colorHex: null,
        sku: "",
        sellerPrice: "",
        compareAtPrice: "",
        initialStock: "",
        images: [],
      });
      setActiveProductId(null);
      setProducts((prev) =>
        prev.map((product) =>
          product.id === productId
            ? {
              ...product,
              variants: [...(product.variants ?? []), result.variant],
            }
            : product
        )
      );
      await mutate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Variant failed");
    }
  };

  const handleEditProduct = (product: any) => {
    setEditingProductId(product.id);
    setEditForm({
      categoryId: product.categoryId ?? product.category?.id ?? "",
      audience: (product.audience as "MENS" | "KIDS") ?? "MENS",
      title: product.title ?? "",
      description: product.description ?? "",
      isPublished: Boolean(product.isPublished),
      occasionIds: product.occasionIds ?? [],
    });
    setProductColorImages((prev) => ({
      ...prev,
      [product.id]: getColorImageMapFromVariants(product.variants ?? []),
    }));
  };

  // Deep links: /seller/products/new opens the add form, ?edit=<id> opens
  // that product's edit form (filtered so it is the only card shown).
  const deepLinkHandled = React.useRef(false);
  React.useEffect(() => {
    if (deepLinkHandled.current) return;
    if (initialMode === "create") {
      deepLinkHandled.current = true;
      setShowCreateModal(true);
      return;
    }
    if (focusProductId) {
      const product = products.find((p: any) => p.id === focusProductId);
      if (!product) return;
      deepLinkHandled.current = true;
      setSearchQuery(product.title ?? "");
      handleEditProduct(product);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMode, focusProductId, products]);

  const handleSaveProduct = async () => {
    if (!editingProductId) return;
    try {
      const result = await updateSellerProduct(editingProductId, {
        categoryId: editForm.categoryId || undefined,
        audience: editForm.audience,
        title: editForm.title || undefined,
        description: editForm.description || undefined,
        occasionIds: editForm.occasionIds,
      });
      toast.success("Product updated.");
      setEditingProductId(null);
      setProducts((prev) =>
        prev.map((product) =>
          product.id === editingProductId
            ? {
              ...product,
              ...result.product,
              category:
                categories.find((c) => c.id === result.product.category?.id) ??
                product.category,
            }
            : product
        )
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Update failed");
    }
  };

  const handleStockChange = async (variantId: string) => {
    const nextStock = Number(stockEdits[variantId]);
    if (Number.isNaN(nextStock) || nextStock < 0) {
      toast.error("Enter a valid stock number.");
      return;
    }
    try {
      const result = await updateVariantStock(variantId, nextStock);
      toast.success("Stock updated.");
      setStockEdits((prev) => ({ ...prev, [variantId]: "" }));
      setProducts((prev) =>
        prev.map((product) => ({
          ...product,
          variants: (product.variants ?? []).map((variant: any) =>
            variant.id === variantId
              ? {
                ...variant,
                inventory: {
                  ...(variant.inventory ?? {}),
                  stock: result.inventory.stock,
                },
              }
              : variant
          ),
        }))
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Stock update failed");
    }
  };

  const handleVariantEditToggle = (variant: any) => {
    setVariantEditsOpen((prev) => ({
      ...prev,
      [variant.id]: !prev[variant.id],
    }));
    setVariantEdits((prev) => ({
      ...prev,
      [variant.id]: {
        size: prev[variant.id]?.size ?? String(variant.size ?? ""),
        sku: prev[variant.id]?.sku ?? String(variant.sku ?? ""),
        sellerPrice:
          prev[variant.id]?.sellerPrice ?? String(variant.sellerPrice ?? ""),
        compareAtPrice:
          prev[variant.id]?.compareAtPrice ??
          String(variant.compareAtPrice ?? ""),
        color: prev[variant.id]?.color ?? String(variant.color ?? ""),
        colorHex: prev[variant.id]?.colorHex ?? normalizeHex(variant.colorHex),
        images: prev[variant.id]?.images ?? [...(variant.images ?? [])],
      },
    }));
  };

  const handleVariantUpdate = async (variantId: string) => {
    const edit = variantEdits[variantId];
    if (!edit?.size.trim()) {
      toast.error("Enter a size.");
      return;
    }
    if (!edit?.sku.trim()) {
      toast.error("Enter a SKU.");
      return;
    }
    if (!edit?.sellerPrice) {
      toast.error("Enter a seller price.");
      return;
    }
    const sellerPrice = Number(edit.sellerPrice);
    const compareAt = edit.compareAtPrice
      ? Number(edit.compareAtPrice)
      : null;
    if (Number.isNaN(sellerPrice) || sellerPrice <= 0) {
      toast.error("Enter a valid seller price.");
      return;
    }
    if (compareAt !== null && Number.isNaN(compareAt)) {
      toast.error("Enter a valid compare-at price.");
      return;
    }

    try {
      const colorValue = edit.color.trim() || null;
      const ownerProduct = products.find((product: any) =>
        (product.variants ?? []).some((variant: any) => variant.id === variantId)
      );
      const colorImages =
        ownerProduct
          ? productColorImages[ownerProduct.id]?.[normalizeColorKey(colorValue)] ?? []
          : [];
      const result = await updateVariant(variantId, {
        size: edit.size.trim(),
        sku: edit.sku.trim(),
        sellerPrice,
        compareAtPrice: compareAt,
        color: colorValue,
        colorHex: edit.colorHex ?? null,
        images: colorImages,
      });
      toast.success("Variant updated.");
      setVariantEditsOpen((prev) => ({ ...prev, [variantId]: false }));
      setProducts((prev) =>
        prev.map((product) => ({
          ...product,
          variants: (product.variants ?? []).map((variant: any) =>
            variant.id === variantId
              ? {
                ...variant,
                size: result.variant.size,
                sku: result.variant.sku,
                sellerPrice: result.variant.sellerPrice,
                compareAtPrice: result.variant.compareAtPrice ?? null,
                color: result.variant.color ?? null,
                images: result.variant.images ?? [],
              }
              : variant
          ),
        }))
      );
      await mutate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Update failed");
    }
  };

  const handleUploadImages = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    if (!imagekit) {
      const missing = getMissingImageKitConfig();
      toast.error(
        missing.length
          ? `Missing env: ${missing.join(", ")}`
          : "ImageKit is not configured."
      );
      return;
    }

    const remaining = 5 - images.length;
    if (remaining <= 0) {
      toast.error("You can upload up to 5 images.");
      return;
    }

    const limitedFiles = files.slice(0, remaining);
    setUploadingImages(true);

    try {
      const authResponse = await fetch(`${API_BASE_URL}/v1/imagekit/auth`);
      if (!authResponse.ok) {
        const authData = await authResponse.json().catch(() => null);
        const authMessage =
          authData?.message ?? "ImageKit auth failed. Check backend env.";
        toast.error(authMessage);
        return;
      }

      const authData = (await authResponse.json()) as {
        signature: string;
        token: string;
        expire: number;
      };

      const uploaded = await runWithConcurrency(limitedFiles, UPLOAD_PARALLELISM, async (file) => {
        const compressedFile = await compressImageForUpload(file);
        const result = await imagekit.upload({
          file: compressedFile,
          fileName: compressedFile.name,
          folder: "/ktmona/products",
          useUniqueFileName: true,
          signature: authData.signature,
          token: authData.token,
          expire: authData.expire,
        });

        return { url: result.url, fileId: result.fileId, name: result.name };
      });

      setImages((prev) => [...prev, ...uploaded]);
      toast.success("Images uploaded.");
    } catch (error) {
      console.error("Image upload failed:", error);
      const message =
        error instanceof Error
          ? error.message
          : (error as any)?.response?.data?.message ??
          (error as any)?.response?.message ??
          (error as any)?.message ??
          "Image upload failed";
      toast.error(message);
    } finally {
      setUploadingImages(false);
      event.target.value = "";
    }
  };

  const handleRemoveImage = (fileId: string) => {
    setImages((prev) => prev.filter((image) => image.fileId !== fileId));
  };

  const handleUploadVariantFormImages = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    if (!imagekit) {
      const missing = getMissingImageKitConfig();
      toast.error(
        missing.length
          ? `Missing env: ${missing.join(", ")}`
          : "ImageKit is not configured."
      );
      return;
    }

    const remaining = 5 - variantForm.images.length;
    if (remaining <= 0) {
      toast.error("You can upload up to 5 variant images.");
      event.target.value = "";
      return;
    }

    setUploadingVariantFormImages(true);
    try {
      const authResponse = await fetch(`${API_BASE_URL}/v1/imagekit/auth`);
      if (!authResponse.ok) {
        toast.error("ImageKit auth failed.");
        return;
      }

      const authData = (await authResponse.json()) as {
        signature: string;
        token: string;
        expire: number;
      };

      const uploaded = await runWithConcurrency(
        files.slice(0, remaining),
        UPLOAD_PARALLELISM,
        async (file) => {
          const compressedFile = await compressImageForUpload(file);
          const result = await imagekit.upload({
            file: compressedFile,
            fileName: compressedFile.name,
            folder: "/ktmona/variants",
            useUniqueFileName: true,
            signature: authData.signature,
            token: authData.token,
            expire: authData.expire,
          });

          return { url: result.url, fileId: result.fileId, name: result.name };
        }
      );

      setVariantForm((prev) => ({
        ...prev,
        images: [...prev.images, ...uploaded],
      }));
      toast.success("Variant images uploaded.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Image upload failed");
    } finally {
      setUploadingVariantFormImages(false);
      event.target.value = "";
    }
  };

  const handleUploadCreateColorImages = async (
    colorLabel: string,
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(event.target.files ?? []);
    const colorKey = normalizeColorKey(colorLabel);
    if (!files.length) return;
    if (!imagekit) {
      const missing = getMissingImageKitConfig();
      toast.error(
        missing.length
          ? `Missing env: ${missing.join(", ")}`
          : "ImageKit is not configured."
      );
      return;
    }

    const existing = createColorImages[colorKey] ?? [];
    const remaining = 5 - existing.length;
    if (remaining <= 0) {
      toast.error("You can upload up to 5 color images.");
      event.target.value = "";
      return;
    }

    setUploadingVariantFormImages(true);
    try {
      const authResponse = await fetch(`${API_BASE_URL}/v1/imagekit/auth`);
      if (!authResponse.ok) {
        toast.error("ImageKit auth failed.");
        return;
      }

      const authData = (await authResponse.json()) as {
        signature: string;
        token: string;
        expire: number;
      };

      const uploaded = await runWithConcurrency(
        files.slice(0, remaining),
        UPLOAD_PARALLELISM,
        async (file) => {
          const compressedFile = await compressImageForUpload(file);
          const result = await imagekit.upload({
            file: compressedFile,
            fileName: compressedFile.name,
            folder: "/ktmona/variants",
            useUniqueFileName: true,
            signature: authData.signature,
            token: authData.token,
            expire: authData.expire,
          });

          return { url: result.url, fileId: result.fileId, name: result.name };
        }
      );

      setCreateColorImages((prev) => ({
        ...prev,
        [colorKey]: [...(prev[colorKey] ?? []), ...uploaded],
      }));
      toast.success(`Images uploaded for ${getDisplayColorLabel(colorLabel)}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Image upload failed");
    } finally {
      setUploadingVariantFormImages(false);
      event.target.value = "";
    }
  };

  const handleUploadProductColorImages = async (
    productId: string,
    colorLabel: string,
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(event.target.files ?? []);
    const colorKey = normalizeColorKey(colorLabel);
    if (!files.length) return;
    if (!imagekit) {
      const missing = getMissingImageKitConfig();
      toast.error(
        missing.length
          ? `Missing env: ${missing.join(", ")}`
          : "ImageKit is not configured."
      );
      return;
    }

    const existing = productColorImages[productId]?.[colorKey] ?? [];
    const remaining = 5 - existing.length;
    if (remaining <= 0) {
      toast.error("You can upload up to 5 color images.");
      event.target.value = "";
      return;
    }

    setUploadingProductColorImages((prev) => ({
      ...prev,
      [`${productId}:${colorKey}`]: true,
    }));
    try {
      const authResponse = await fetch(`${API_BASE_URL}/v1/imagekit/auth`);
      if (!authResponse.ok) {
        toast.error("ImageKit auth failed.");
        return;
      }

      const authData = (await authResponse.json()) as {
        signature: string;
        token: string;
        expire: number;
      };

      const uploaded = await runWithConcurrency(
        files.slice(0, remaining),
        UPLOAD_PARALLELISM,
        async (file) => {
          const compressedFile = await compressImageForUpload(file);
          const result = await imagekit.upload({
            file: compressedFile,
            fileName: compressedFile.name,
            folder: "/ktmona/variants",
            useUniqueFileName: true,
            signature: authData.signature,
            token: authData.token,
            expire: authData.expire,
          });

          return result.url;
        }
      );

      setProductColorImages((prev) => ({
        ...prev,
        [productId]: {
          ...(prev[productId] ?? {}),
          [colorKey]: [...((prev[productId] ?? {})[colorKey] ?? []), ...uploaded],
        },
      }));
      toast.success(`Images uploaded for ${getDisplayColorLabel(colorLabel)}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Image upload failed");
    } finally {
      setUploadingProductColorImages((prev) => ({
        ...prev,
        [`${productId}:${colorKey}`]: false,
      }));
      event.target.value = "";
    }
  };

  const handleSaveProductColorImages = async (product: any, colorLabel: string) => {
    const colorKey = normalizeColorKey(colorLabel);
    const colorImages = productColorImages[product.id]?.[colorKey] ?? [];
    const matchingVariants = (product.variants ?? []).filter((variant: any) => {
      const currentColor = variantEdits[variant.id]?.color ?? String(variant.color ?? "");
      return normalizeColorKey(currentColor) === colorKey;
    });

    if (matchingVariants.length === 0) {
      toast.error("Add a variant for this color first.");
      return;
    }

    try {
      await Promise.all(
        matchingVariants.map((variant: any) => {
          const edit = variantEdits[variant.id];
          const size = edit?.size ?? String(variant.size ?? "");
          const sku = edit?.sku ?? String(variant.sku ?? "");
          const sellerPrice = Number(edit?.sellerPrice ?? variant.sellerPrice ?? 0);
          const compareAtRaw = edit?.compareAtPrice ?? variant.compareAtPrice;
          const compareAtPrice =
            compareAtRaw === null || compareAtRaw === undefined || compareAtRaw === ""
              ? null
              : Number(compareAtRaw);
          const color = (edit?.color ?? String(variant.color ?? "")).trim() || null;

          return updateVariant(variant.id, {
            size,
            sku,
            sellerPrice,
            compareAtPrice,
            color,
            images: colorImages,
          });
        })
      );

      toast.success(`Saved shared images for ${getDisplayColorLabel(colorLabel)}.`);
      await mutate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save color images");
    }
  };

  const handleUploadMediaForProduct = async (
    productId: string,
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length || !imagekit) return;

    setUploadingMedia(true);
    try {
      const authResponse = await fetch(`${API_BASE_URL}/v1/imagekit/auth`);
      if (!authResponse.ok) {
        toast.error("ImageKit auth failed.");
        return;
      }

      const authData = (await authResponse.json()) as {
        signature: string;
        token: string;
        expire: number;
      };

      const uploadedMedia = await runWithConcurrency(files.slice(0, 5), UPLOAD_PARALLELISM, async (file) => {
        const compressedFile = await compressImageForUpload(file);
        const uploadResult = await imagekit.upload({
          file: compressedFile,
          fileName: compressedFile.name,
          folder: "/ktmona/products",
          useUniqueFileName: true,
          signature: authData.signature,
          token: authData.token,
          expire: authData.expire,
        });

        const mediaResult = await addProductMedia(productId, {
          type: "IMAGE",
          url: uploadResult.url,
        });

        return mediaResult.media;
      });

      setProductMedia((prev) => ({
        ...prev,
        [productId]: [...(prev[productId] ?? []), ...uploadedMedia],
      }));
      toast.success("Media uploaded.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Media upload failed");
    } finally {
      setUploadingMedia(false);
      event.target.value = "";
    }
  };

  const handleDeleteMedia = async (productId: string, mediaId: string) => {
    try {
      await deleteProductMedia(mediaId);
      setProductMedia((prev) => ({
        ...prev,
        [productId]: (prev[productId] ?? []).filter((m) => m.id !== mediaId),
      }));
      toast.success("Media deleted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed");
    }
  };

  const filteredProducts = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return products;
    return products.filter((product: any) => {
      const title = String(product.title ?? "").toLowerCase();
      const category = String(product.category?.name ?? "").toLowerCase();
      const skuMatch = (product.variants ?? []).some((variant: any) =>
        String(variant.sku ?? "").toLowerCase().includes(query)
      );
      return title.includes(query) || category.includes(query) || skuMatch;
    });
  }, [products, searchQuery]);

  const createColorGroups = React.useMemo(
    (): ColorGroup[] =>
      Array.from(
        createVariants.reduce(
          (map, variant) => {
            if (!variant.color.trim()) {
              return map;
            }
            const key = normalizeColorKey(variant.color);
            if (!map.has(key)) {
              map.set(key, {
                key,
                label: getDisplayColorLabel(variant.color),
              });
            }
            return map;
          },
          new Map<string, ColorGroup>()
        ).values()
      ),
    [createVariants]
  );

  return (
    <div className="min-h-[calc(100vh-160px)] bg-background">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
        className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-16 lg:py-20"
      >
        {/* Header */}
        <div className="space-y-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-brand-strong">
            Product Catalog
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {initialMode === "create" ? "Add a Product" : "Edit Listings"}
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Add photos, variants (size, colour), stock and your price. Every listing is reviewed by KTMONA before it goes live.
          </p>
        </div>

        {/* Action Bar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {filteredProducts.length} listings in your catalog
          </p>
          <Button onClick={() => setShowCreateModal(true)}>
            Add New Product
          </Button>
        </div>

        {/* Search */}
        <div className="border border-border-soft bg-card p-4 flex items-center gap-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search by product, category, or SKU..."
            className="border-0 bg-transparent focus-visible:ring-0 h-10"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        {/* Products Grid */}
        <section className="space-y-6">
          {loading ? (
            <div className="py-16 text-center">
              <p className="text-sm text-muted-foreground">Loading products...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="py-16 text-center border border-border-soft bg-card">
              <p className="text-sm text-muted-foreground">
                No products yet. Create your first listing.
              </p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {filteredProducts.map((product: any, index: number) => {
                const sellerColorGroups: ColorGroup[] = Array.from(
                  (product.variants ?? []).reduce(
                    (
                      map: Map<string, ColorGroup>,
                      variant: any
                    ) => {
                      const currentColor = variantEdits[variant.id]?.color ?? String(variant.color ?? "");
                      if (!currentColor.trim()) {
                        return map;
                      }
                      const key = normalizeColorKey(currentColor);
                      if (!map.has(key)) {
                        map.set(key, {
                          key,
                          label: getDisplayColorLabel(currentColor),
                        });
                      }
                      return map;
                    },
                    new Map<string, ColorGroup>()
                  ).values()
                );

                return (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05, duration: 0.4 }}
                  className={`border border-border-soft bg-card ${product.deletedByAdmin ? "opacity-60" : ""
                    }`}
                >
                  {/* Product Header */}
                  <div className="flex items-start justify-between gap-4 p-6 border-b border-border-soft">
                    <div className="space-y-1">
                      <h3 className="font-serif text-lg font-normal text-foreground">
                        {product.title}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {product.category?.name ?? "Uncategorized"}
                      </p>
                      <span
                        className={`inline-flex px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider border ${getApprovalBadge(product).className}`}
                      >
                        {getApprovalBadge(product).label}
                      </span>
                      {product.deletedByAdmin ? (
                        <p className="text-xs text-red-600/80 mt-2">
                          Removed by admin{product.deletedByAdminReason ? ` · ${product.deletedByAdminReason}` : ""}
                        </p>
                      ) : null}
                      {String(product.status ?? "PENDING").toUpperCase() === "REJECTED" &&
                        product.rejectionReason ? (
                        <p className="text-xs text-[#7A5656] mt-2">
                          Rejection reason: {product.rejectionReason}
                        </p>
                      ) : null}
                      <p className="text-xs text-muted-foreground mt-2">
                        Seller Price: {currency.format(Number(product.sellerPrice ?? 0))}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          editingProductId === product.id
                            ? setEditingProductId(null)
                            : handleEditProduct(product)
                        }
                        disabled={product.deletedByAdmin}
                      >
                        {editingProductId === product.id ? "Close" : "Edit"}
                      </Button>
                      <button
                        onClick={() => handleDelete(product.id)}
                        disabled={product.deletedByAdmin}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="p-6 space-y-6">
                    {/* Product Images */}
                    {product.images?.length ? (
                      <div className="flex gap-2">
                        {product.images.slice(0, 3).map((image: string) => (
                          <div
                            key={image}
                            className="h-16 w-16 overflow-hidden border border-border-soft"
                          >
                            <img
                              src={image}
                              alt={product.title}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {/* Edit Form */}
                    {editingProductId === product.id && (
                      <div className="space-y-4 p-4 border border-dashed border-border-soft">
                        <div className="space-y-2">
                          <Label required>Audience</Label>
                          <div className="flex gap-2">
                            {(["MENS", "KIDS"] as const).map((opt) => (
                              <button
                                key={opt}
                                type="button"
                                disabled={product.deletedByAdmin}
                                onClick={() =>
                                  setEditForm((prev) => ({ ...prev, audience: opt }))
                                }
                                className={`h-10 flex-1 border px-3 text-xs font-medium uppercase tracking-wider transition-colors ${
                                  editForm.audience === opt
                                    ? "border-brand bg-brand/10 text-foreground"
                                    : "border-border-soft bg-card text-muted-foreground hover:text-foreground"
                                } disabled:opacity-50`}
                                aria-pressed={editForm.audience === opt}
                              >
                                {opt === "MENS" ? "Mens" : "Kids"}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label required>Category</Label>
                            <select
                              className="h-12 w-full border border-border-soft bg-card px-3 text-sm text-foreground"
                              value={editForm.categoryId}
                              onChange={(event) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  categoryId: event.target.value,
                                }))
                              }
                              disabled={product.deletedByAdmin}
                            >
                              <option value="">Select category</option>
                              <CategoryOptions categories={categories} value={editForm.categoryId} />
                            </select>
                          </div>
                          <div className="space-y-2">
                            <Label required>Title</Label>
                            <Input
                              value={editForm.title}
                              onChange={(event) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  title: event.target.value,
                                }))
                              }
                              disabled={product.deletedByAdmin}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Description</Label>
                          <Input
                            value={editForm.description}
                            onChange={(event) =>
                              setEditForm((prev) => ({
                                ...prev,
                                description: event.target.value,
                              }))
                            }
                            disabled={product.deletedByAdmin}
                          />
                        </div>
                        {occasions.length > 0 && (
                          <div className="space-y-2">
                            <Label>Occasions</Label>
                            <div className="flex flex-wrap gap-2">
                              {occasions.map((occ) => {
                                const selected = editForm.occasionIds.includes(occ.id);
                                return (
                                  <button
                                    key={occ.id}
                                    type="button"
                                    disabled={product.deletedByAdmin}
                                    onClick={() =>
                                      setEditForm((prev) => ({
                                        ...prev,
                                        occasionIds: selected
                                          ? prev.occasionIds.filter((id) => id !== occ.id)
                                          : [...prev.occasionIds, occ.id],
                                      }))
                                    }
                                    className={`px-3 py-1.5 text-xs border transition-colors ${
                                      selected
                                        ? "border-brand bg-brand/10 text-brand-strong"
                                        : "border-border-soft text-muted-foreground hover:border-foreground/30"
                                    }`}
                                  >
                                    {occ.name}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Product visibility is controlled by admin approval.
                        </p>
                        <Button
                          onClick={handleSaveProduct}
                          disabled={product.deletedByAdmin}
                        >
                          Save Changes
                        </Button>

                        {sellerColorGroups.length > 0 ? (
                          <div className="mt-6 space-y-3 border-t border-border-soft pt-4">
                            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                              Color Galleries
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Images are shared across all sizes of the same color.
                            </p>
                            {sellerColorGroups.map((colorGroup) => (
                              <div
                                key={`${product.id}-${colorGroup.key}`}
                                className="space-y-2 border border-border-soft p-3"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-foreground">
                                    {colorGroup.label}
                                  </p>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleSaveProductColorImages(product, colorGroup.label)}
                                    disabled={product.deletedByAdmin}
                                  >
                                    Save Color Images
                                  </Button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {(productColorImages[product.id]?.[colorGroup.key] ?? []).map((imageUrl) => (
                                    <div
                                      key={`${colorGroup.key}-${imageUrl}`}
                                      className="relative h-14 w-14 overflow-hidden border border-border-soft group"
                                    >
                                      <img
                                        src={imageUrl}
                                        alt={`${colorGroup.label} gallery`}
                                        className="h-full w-full object-cover"
                                      />
                                      <button
                                        type="button"
                                        className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100"
                                        onClick={() =>
                                          setProductColorImages((prev) => ({
                                            ...prev,
                                            [product.id]: {
                                              ...(prev[product.id] ?? {}),
                                              [colorGroup.key]: (prev[product.id]?.[colorGroup.key] ?? []).filter(
                                                (img) => img !== imageUrl
                                              ),
                                            },
                                          }))
                                        }
                                      >
                                        <X className="h-3.5 w-3.5 text-white" />
                                      </button>
                                    </div>
                                  ))}
                                  <label className="flex h-14 w-14 cursor-pointer items-center justify-center border border-dashed border-border-soft text-muted-foreground transition-colors hover:text-foreground">
                                    {uploadingProductColorImages[`${product.id}:${colorGroup.key}`] ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <span className="text-lg">+</span>
                                    )}
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      multiple
                                      onChange={(event) =>
                                        handleUploadProductColorImages(product.id, colorGroup.label, event)
                                      }
                                      disabled={
                                        uploadingProductColorImages[`${product.id}:${colorGroup.key}`] ||
                                        product.deletedByAdmin
                                      }
                                    />
                                  </label>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : null}

                        {/* Product Media Management */}
                        <div className="mt-6 space-y-3 pt-4 border-t border-border-soft">
                          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                            Product Media
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {(productMedia[product.id] ?? []).map((media) => (
                              <div key={media.id} className="relative h-16 w-16 overflow-hidden border border-border-soft group">
                                <Image
                                  src={media.url}
                                  alt="Product media"
                                  fill
                                  sizes="64px"
                                  className="object-cover"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleDeleteMedia(product.id, media.id)}
                                  className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity"
                                  aria-label="Remove product media"
                                >
                                  <X className="h-4 w-4 text-white" />
                                </button>
                              </div>
                            ))}
                            <label className="h-16 w-16 flex items-center justify-center border border-dashed border-border-soft text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
                              {uploadingMedia ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <span className="text-xl">+</span>
                              )}
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                multiple
                                onChange={(e) => handleUploadMediaForProduct(product.id, e)}
                                disabled={uploadingMedia || product.deletedByAdmin}
                              />
                            </label>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Upload additional images via ImageKit. Hover to remove.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Variants */}
                    <div className="space-y-3">
                      <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                        Variants
                      </p>
                      {product.variants?.length ? (
                        product.variants.map((variant: any) => (
                          <div
                            key={variant.id}
                            className="border border-border-soft p-4 space-y-4"
                          >
                            <div className="flex items-center justify-between gap-4">
                              <div>
                                <p className="font-medium text-foreground">
                                  {variant.size || "Default"} · {variant.sku}
                                </p>
                                {variant.color ? (
                                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    {normalizeHex(variant.colorHex) ? (
                                      <span
                                        className="inline-block h-3 w-3 rounded-full border border-border-soft"
                                        style={{
                                          backgroundColor: normalizeHex(variant.colorHex)!,
                                        }}
                                      />
                                    ) : null}
                                    Color: {variant.color}
                                  </p>
                                ) : null}
                                <p className="text-xs text-muted-foreground">
                                  Status: {variant.status}
                                </p>
                                {variant.rejectionReason ? (
                                  <p className="text-xs text-[#7A5656]">
                                    Reason: {variant.rejectionReason}
                                  </p>
                                ) : null}
                                <p className="text-xs text-muted-foreground">
                                  Stock: {variant.inventory?.stock ?? 0}
                                  {(variant.inventory?.stock ?? 0) === 0 ? (
                                    <span className="ml-2 inline-flex px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider border border-[#A67575]/30 text-[#7A5656] bg-[#A67575]/5">
                                      Out of Stock
                                    </span>
                                  ) : (variant.inventory?.stock ?? 0) < 10 ? (
                                    <span className="ml-2 inline-flex px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider border border-amber-400/30 text-amber-700 bg-amber-50 dark:border-amber-700/30 dark:text-amber-300 dark:bg-amber-950/30">
                                      Low Stock
                                    </span>
                                  ) : null}
                                </p>
                              </div>
                              <div className="flex items-center gap-3">
                                <p className="font-serif text-lg font-light text-foreground">
                                  {currency.format(Number(variant.sellerPrice ?? 0))}
                                </p>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    if (product.deletedByAdmin) return;
                                    handleVariantEditToggle(variant);
                                  }}
                                  disabled={product.deletedByAdmin}
                                >
                                  {variantEditsOpen[variant.id] ? "Close" : "Edit"}
                                </Button>
                              </div>
                            </div>

                            {variantEditsOpen[variant.id] ? (
                              <div className="grid gap-3 sm:grid-cols-3 pt-4 border-t border-border-soft">
                                <div className="space-y-1">
                                  <Label className="text-xs" required>Size</Label>
                                  <Input
                                    value={variantEdits[variant.id]?.size ?? ""}
                                    onChange={(event) =>
                                      updateVariantEditState(variant.id, {
                                        size: event.target.value,
                                      })
                                    }
                                    placeholder="Size"
                                    disabled={product.deletedByAdmin}
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs" required>SKU</Label>
                                  <Input
                                    value={variantEdits[variant.id]?.sku ?? ""}
                                    onChange={(event) =>
                                      updateVariantEditState(variant.id, {
                                        sku: event.target.value,
                                      })
                                    }
                                    placeholder="SKU"
                                    disabled={product.deletedByAdmin}
                                  />
                                </div>
                                <div className="space-y-1 sm:col-span-3">
                                  <Label className="text-xs">Color</Label>
                                  <Input
                                    value={variantEdits[variant.id]?.color ?? ""}
                                    onChange={(event) =>
                                      updateVariantEditState(variant.id, {
                                        color: event.target.value,
                                      })
                                    }
                                    placeholder="Color (e.g. Wine, Navy Blue)"
                                    disabled={product.deletedByAdmin}
                                  />
                                </div>
                                <div className="space-y-1 sm:col-span-3">
                                  <ColorSwatchPicker
                                    colorLabel={
                                      (variantEdits[variant.id]?.color ?? "").trim() ||
                                      "this colour"
                                    }
                                    value={variantEdits[variant.id]?.colorHex ?? null}
                                    onChange={(hex) =>
                                      updateVariantEditState(variant.id, { colorHex: hex })
                                    }
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs" required>Seller Price</Label>
                                  <Input
                                    value={variantEdits[variant.id]?.sellerPrice ?? ""}
                                    onChange={(event) =>
                                      updateVariantEditState(variant.id, {
                                        sellerPrice: event.target.value,
                                      })
                                    }
                                    placeholder="Seller price"
                                    disabled={product.deletedByAdmin}
                                  />
                                  <EarningsHint price={variantEdits[variant.id]?.sellerPrice} />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Compare at</Label>
                                  <Input
                                    value={
                                      variantEdits[variant.id]?.compareAtPrice ??
                                      ""
                                    }
                                    onChange={(event) =>
                                      updateVariantEditState(variant.id, {
                                        compareAtPrice: event.target.value,
                                      })
                                    }
                                    placeholder="Compare at"
                                    disabled={product.deletedByAdmin}
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs" required>Stock</Label>
                                  <Input
                                    value={
                                      stockEdits[variant.id] ??
                                      String(variant.inventory?.stock ?? 0)
                                    }
                                    onChange={(event) =>
                                      setStockEdits((prev) => ({
                                        ...prev,
                                        [variant.id]: event.target.value,
                                      }))
                                    }
                                    placeholder="Stock"
                                    disabled={product.deletedByAdmin}
                                  />
                                </div>
                                <div className="sm:col-span-3 flex flex-wrap gap-2 pt-2">
                                  <Button
                                    size="sm"
                                    onClick={() => handleVariantUpdate(variant.id)}
                                    disabled={product.deletedByAdmin}
                                  >
                                    Save Pricing
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleStockChange(variant.id)}
                                    disabled={product.deletedByAdmin}
                                  >
                                    Update Stock
                                  </Button>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">No variants yet.</p>
                      )}
                    </div>

                    {/* Add Variant */}
                    <div className="border border-dashed border-border-soft p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                          Add Variant
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setActiveProductId((prev) =>
                              prev === product.id ? null : product.id
                            )
                          }
                          disabled={product.deletedByAdmin}
                        >
                          {activeProductId === product.id ? "Close" : "Open"}
                        </Button>
                      </div>
                      {activeProductId === product.id && (
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1">
                            <Label className="text-xs" required>Size</Label>
                            <Input
                              placeholder="Size (e.g. M, 42)"
                              value={variantForm.size}
                              onChange={(event) =>
                                setVariantForm((prev) => ({
                                  ...prev,
                                  size: event.target.value,
                                }))
                              }
                              disabled={product.deletedByAdmin}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Color name</Label>
                            <Input
                              placeholder="Color (e.g. Bottle Green)"
                              value={variantForm.color}
                              onChange={(event) =>
                                setVariantForm((prev) => ({
                                  ...prev,
                                  color: event.target.value,
                                }))
                              }
                              disabled={product.deletedByAdmin}
                            />
                          </div>
                          <div className="space-y-1 sm:col-span-2">
                            <ColorSwatchPicker
                              colorLabel={variantForm.color.trim() || "this colour"}
                              value={variantForm.colorHex}
                              onChange={(hex) =>
                                setVariantForm((prev) => ({ ...prev, colorHex: hex }))
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs" required>SKU</Label>
                            <Input
                              placeholder="SKU (e.g. KURTA-RED-M)"
                              value={variantForm.sku}
                              onChange={(event) =>
                                setVariantForm((prev) => ({
                                  ...prev,
                                  sku: event.target.value,
                                }))
                              }
                              disabled={product.deletedByAdmin}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs" required>Seller Price</Label>
                            <Input
                              type="number"
                              inputMode="decimal"
                              min="0"
                              step="0.01"
                              placeholder="Seller price"
                              value={variantForm.sellerPrice}
                              onChange={(event) =>
                                setVariantForm((prev) => ({
                                  ...prev,
                                  sellerPrice: event.target.value,
                                }))
                              }
                              disabled={product.deletedByAdmin}
                            />
                            <EarningsHint price={variantForm.sellerPrice} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Compare At</Label>
                            <Input
                              type="number"
                              inputMode="decimal"
                              min="0"
                              step="0.01"
                              placeholder="MRP / compare-at price"
                              value={variantForm.compareAtPrice}
                              onChange={(event) =>
                                setVariantForm((prev) => ({
                                  ...prev,
                                  compareAtPrice: event.target.value,
                                }))
                              }
                              disabled={product.deletedByAdmin}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Initial Stock</Label>
                            <Input
                              type="number"
                              inputMode="numeric"
                              min="0"
                              step="1"
                              placeholder="Initial stock"
                              value={variantForm.initialStock}
                              onChange={(event) =>
                                setVariantForm((prev) => ({
                                  ...prev,
                                  initialStock: event.target.value,
                                }))
                              }
                              disabled={product.deletedByAdmin}
                            />
                          </div>
                          <div className="sm:col-span-2 space-y-2">
                            <p className="text-xs text-muted-foreground">Variant Images</p>
                            <div className="flex flex-wrap gap-2">
                              {variantForm.images.map((image) => (
                                <div
                                  key={image.fileId}
                                  className="relative h-14 w-14 overflow-hidden border border-border-soft group"
                                >
                                  <img
                                    src={image.url}
                                    alt="Variant preview"
                                    className="h-full w-full object-cover"
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setVariantForm((prev) => ({
                                        ...prev,
                                        images: prev.images.filter(
                                          (entry) => entry.fileId !== image.fileId
                                        ),
                                      }))
                                    }
                                    className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100"
                                  >
                                    <X className="h-3.5 w-3.5 text-white" />
                                  </button>
                                </div>
                              ))}
                              <label className="flex h-14 w-14 cursor-pointer items-center justify-center border border-dashed border-border-soft text-muted-foreground transition-colors hover:text-foreground">
                                {uploadingVariantFormImages ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <span className="text-lg">+</span>
                                )}
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  multiple
                                  onChange={handleUploadVariantFormImages}
                                  disabled={
                                    uploadingVariantFormImages ||
                                    product.deletedByAdmin
                                  }
                                />
                              </label>
                            </div>
                          </div>
                          <Button
                            className="sm:col-span-2"
                            onClick={() => handleAddVariant(product.id)}
                            disabled={
                              product.deletedByAdmin || uploadingVariantFormImages
                            }
                          >
                            Save Variant
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
                );
              })}
            </div>
          )}
        </section>
      </motion.div>

      {/* Create Product Modal */}
      <AnimatePresence>
        {showCreateModal ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4"
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-2xl border border-border-soft bg-card p-8 shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-brand-strong">
                    New Product
                  </p>
                  <h2 className="text-xl font-semibold text-foreground">
                    Create a Listing
                  </h2>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form className="space-y-6" onSubmit={handleCreateProduct}>
                <div className="space-y-2">
                  <Label required>Audience</Label>
                  <div className="flex gap-2">
                    {(["MENS", "KIDS"] as const).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() =>
                          setForm((prev) => ({ ...prev, audience: opt }))
                        }
                        className={`h-12 flex-1 border px-4 text-sm font-medium uppercase tracking-wider transition-colors ${
                          form.audience === opt
                            ? "border-brand bg-brand/10 text-foreground"
                            : "border-border-soft bg-card text-muted-foreground hover:text-foreground"
                        }`}
                        aria-pressed={form.audience === opt}
                      >
                        {opt === "MENS" ? "Mens" : "Kids"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label required>Category</Label>
                    <select
                      className="h-12 w-full border border-border-soft bg-card px-3 text-sm text-foreground"
                      value={form.categoryId}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          categoryId: event.target.value,
                        }))
                      }
                    >
                      <option value="">Select category</option>
                      <CategoryOptions categories={categories} value={form.categoryId} />
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label required>Title</Label>
                    <Input
                      value={form.title}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, title: event.target.value }))
                      }
                      placeholder="Premium linen kurta"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    value={form.description}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        description: event.target.value,
                      }))
                    }
                    placeholder="Fabric details, fit, and highlights"
                  />
                </div>
                {occasions.length > 0 && (
                  <div className="space-y-2">
                    <Label>Occasions (optional)</Label>
                    <div className="flex flex-wrap gap-2">
                      {occasions.map((occ) => {
                        const selected = form.occasionIds.includes(occ.id);
                        return (
                          <button
                            key={occ.id}
                            type="button"
                            onClick={() =>
                              setForm((prev) => ({
                                ...prev,
                                occasionIds: selected
                                  ? prev.occasionIds.filter((id) => id !== occ.id)
                                  : [...prev.occasionIds, occ.id],
                              }))
                            }
                            className={`px-3 py-1.5 text-xs border transition-colors ${
                              selected
                                ? "border-brand bg-brand/10 text-brand-strong"
                                : "border-border-soft text-muted-foreground hover:border-foreground/30"
                            }`}
                          >
                            {occ.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                <p className="text-sm text-muted-foreground">
                  New products are submitted for admin approval before going live.
                </p>

                <div className="space-y-4 border border-border-soft p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Variants</Label>
                      <p className="text-xs text-muted-foreground">
                        Add at least one size or color variant with seller and compare-at prices.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCreateVariants((prev) => [...prev, createDraftVariant()])
                      }
                    >
                      Add Variant
                    </Button>
                  </div>

                  <div className="space-y-4">
                    {createVariants.map((variant, index) => (
                      <div
                        key={variant.id}
                        className="space-y-3 border border-dashed border-border-soft p-4"
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                            Variant {index + 1}
                          </p>
                          {createVariants.length > 1 ? (
                            <button
                              type="button"
                              onClick={() => removeCreateVariant(variant.id)}
                              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                            >
                              Remove
                            </button>
                          ) : null}
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1">
                            <Label className="text-xs" required>Size</Label>
                            <Input
                              value={variant.size}
                              onChange={(event) =>
                                updateCreateVariant(variant.id, {
                                  size: event.target.value,
                                })
                              }
                              placeholder="M, 42, XL"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Color name</Label>
                            <Input
                              value={variant.color}
                              onChange={(event) =>
                                updateCreateVariant(variant.id, {
                                  color: event.target.value,
                                })
                              }
                              placeholder="Wine, Navy Blue"
                            />
                          </div>
                          <div className="space-y-1 sm:col-span-2">
                            <ColorSwatchPicker
                              colorLabel={variant.color.trim() || "this colour"}
                              value={variant.colorHex}
                              onChange={(hex) =>
                                updateCreateVariant(variant.id, { colorHex: hex })
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs" required>SKU</Label>
                            <Input
                              value={variant.sku}
                              onChange={(event) =>
                                updateCreateVariant(variant.id, {
                                  sku: event.target.value,
                                })
                              }
                              placeholder="KURTA-NAVY-M"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Initial Stock</Label>
                            <Input
                              type="number"
                              min="0"
                              step="1"
                              value={variant.initialStock}
                              onChange={(event) =>
                                updateCreateVariant(variant.id, {
                                  initialStock: event.target.value,
                                })
                              }
                              placeholder="0"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs" required>Seller Price</Label>
                            <Input
                              type="number"
                              min="1"
                              step="0.01"
                              value={variant.sellerPrice}
                              onChange={(event) =>
                                updateCreateVariant(variant.id, {
                                  sellerPrice: event.target.value,
                                })
                              }
                              placeholder="Seller price"
                            />
                            <EarningsHint price={variant.sellerPrice} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Compare-at Price</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={variant.compareAtPrice}
                              onChange={(event) =>
                                updateCreateVariant(variant.id, {
                                  compareAtPrice: event.target.value,
                                })
                              }
                              placeholder="MRP"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4 border border-border-soft p-4">
                  <div className="space-y-1">
                    <Label>Color Galleries</Label>
                    <p className="text-xs text-muted-foreground">
                      Upload one shared image set for each color. All sizes under that color will use the same gallery.
                    </p>
                  </div>
                  {createColorGroups.length > 0 ? (
                    <div className="space-y-3">
                      {createColorGroups.map((colorGroup) => (
                        <div
                          key={colorGroup.key}
                          className="space-y-2 border border-dashed border-border-soft p-3"
                        >
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-medium uppercase tracking-[0.14em] text-foreground">
                              {colorGroup.label}
                            </p>
                            <span className="text-xs text-muted-foreground">
                              {(createColorImages[colorGroup.key] ?? []).length}/5 uploaded
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {(createColorImages[colorGroup.key] ?? []).map((image) => (
                              <div
                                key={image.fileId}
                                className="group relative overflow-hidden border border-border-soft"
                              >
                                <img
                                  src={image.url}
                                  alt={`${colorGroup.label} preview`}
                                  className="h-20 w-20 object-cover"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    setCreateColorImages((prev) => ({
                                      ...prev,
                                      [colorGroup.key]: (prev[colorGroup.key] ?? []).filter(
                                        (entry) => entry.fileId !== image.fileId
                                      ),
                                    }))
                                  }
                                  className="absolute right-2 top-2 rounded-full bg-ink/60 p-1 text-paper opacity-0 transition group-hover:opacity-100"
                                  aria-label="Remove color image"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                            <label className="flex h-20 w-20 cursor-pointer items-center justify-center border border-dashed border-border-soft text-muted-foreground transition hover:text-foreground">
                              {uploadingVariantFormImages ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <span className="text-lg">+</span>
                              )}
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                multiple
                                onChange={(event) =>
                                  handleUploadCreateColorImages(colorGroup.label, event)
                                }
                                disabled={uploadingVariantFormImages}
                              />
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Add colors in the variant rows to manage shared galleries.
                    </p>
                  )}
                </div>

                {/* Image Upload */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Product Images</Label>
                    <span className="text-xs text-muted-foreground">
                      {images.length}/5 uploaded
                    </span>
                  </div>
                  <div className="border border-dashed border-border-soft p-4">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleUploadImages}
                      className="hidden"
                      id="product-image-upload"
                    />
                    <label
                      htmlFor="product-image-upload"
                      className="flex cursor-pointer flex-col items-center gap-2 py-6 text-sm text-muted-foreground transition hover:text-foreground"
                    >
                      {uploadingImages ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Uploading images...
                        </div>
                      ) : (
                        <span>Click to upload images (1-5)</span>
                      )}
                    </label>
                    {images.length > 0 && (
                      <div className="mt-4 grid gap-3 grid-cols-3">
                        {images.map((image) => (
                          <div
                            key={image.fileId}
                            className="group relative overflow-hidden border border-border-soft"
                          >
                            <img
                              src={image.url}
                              alt={image.name}
                              className="h-20 w-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveImage(image.fileId)}
                              className="absolute right-2 top-2 rounded-full bg-ink/60 p-1 text-paper opacity-0 transition group-hover:opacity-100"
                              aria-label="Remove image"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 pt-4">
                  <Button type="submit" disabled={uploadingImages}>
                    Create Product
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowCreateModal(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
