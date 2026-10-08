"use client";

import { CategoryOptions } from "@/components/seller/CategoryOptions";
import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Search, X } from "lucide-react";
import ImageKit from "imagekit-javascript";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RequiredMark } from "@/components/ui/label";
import { deleteProduct, getAllProducts, updateProductDetails } from "@/services/admin";
import type {
  AdminProductUpdatePayload,
  AdminProductVariantUpdatePayload,
} from "@/services/admin";
import { getCategories } from "@/services/catalog";
import { getOccasions, type Occasion } from "@/services/occasions";
import { useLiveFreshness } from "@/hooks/use-live-freshness";
import { useHydratedSWR } from "@/hooks/use-hydrated-swr";
import { toast } from "sonner";
import { compressImageForUpload } from "@/lib/image-compression";
import { normalizeHex } from "@/lib/color-swatches";
import { ColorSwatchPicker } from "@/components/color-swatch-picker";

const IMAGEKIT_PUBLIC_KEY = process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY;
const IMAGEKIT_URL_ENDPOINT = process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT;
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const UPLOAD_PARALLELISM = 3;

export interface AdminProductsInitialData {
  products: Array<any>;
  categories: Array<{ id: string; name: string }>;
  occasions: Occasion[];
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const queue = [...items];
  const results: R[] = [];

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

const getProductStatusStyle = (product: any) => {
  if (product.deletedByAdmin) {
    return "border-[#A67575]/30 text-[#7A5656] bg-[#A67575]/5";
  }
  if (String(product.status ?? "").toUpperCase() === "APPROVED") {
    return "border-[#7B9971]/30 text-[#5A7352] bg-[#7B9971]/5";
  }
  if (String(product.status ?? "").toUpperCase() === "REJECTED") {
    return "border-[#A67575]/30 text-[#7A5656] bg-[#A67575]/5";
  }
  return "border-border-soft text-muted-foreground bg-mist/30";
};

const getProductStatusLabel = (product: any) => {
  if (product.deletedByAdmin) return "DELETED";
  const status = String(product.status ?? "").toUpperCase();
  if (status === "PENDING" || status === "APPROVED" || status === "REJECTED") return status;
  if (product.isPublished) return "PUBLISHED";
  return "DRAFT";
};

const formatTimestamp = (value?: string | null) => {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

const normalizeColorKey = (color?: string | null) => {
  const normalized = color?.trim().toLowerCase();
  return normalized && normalized.length > 0 ? normalized : "__no_color__";
};

const getDisplayColorLabel = (color?: string | null) => {
  const trimmed = color?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "Default";
};

interface ColorGroupState {
  label: string;
  hex: string | null;
  images: string[];
}

const getColorImageMapFromVariants = (
  variants: Array<{ color?: string | null; colorHex?: string | null; images?: string[] }>
) => {
  const next: Record<string, ColorGroupState> = {};

  for (const variant of variants) {
    if (!variant.color?.trim()) continue;
    const key = normalizeColorKey(variant.color);
    if (next[key]) {
      // Sizes of one colour share a swatch; take the first one that has it set.
      next[key].hex = next[key].hex ?? normalizeHex(variant.colorHex);
      continue;
    }

    next[key] = {
      label: getDisplayColorLabel(variant.color),
      hex: normalizeHex(variant.colorHex),
      images: (variant.images ?? []).filter((image) => typeof image === "string" && image.trim().length > 0),
    };
  }

  return next;
};

export default function AdminProductsClient({
  initialData,
}: {
  initialData?: AdminProductsInitialData | null;
}) {
  const [products, setProducts] = React.useState<Array<any>>(
    initialData?.products ?? []
  );
  const [categories, setCategories] = React.useState<
    Array<{ id: string; name: string }>
  >(initialData?.categories ?? []);
  const [occasions, setOccasions] = React.useState<Occasion[]>(
    initialData?.occasions ?? []
  );
  const [searchQuery, setSearchQuery] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState("all");
  const [audienceFilter, setAudienceFilter] = React.useState<"all" | "MENS" | "KIDS">("all");
  const [selectedProduct, setSelectedProduct] = React.useState<any | null>(null);
  const [approvalVariantPrices, setApprovalVariantPrices] = React.useState<
    Record<string, string>
  >({});
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [bulkReason, setBulkReason] = React.useState("");
  const [showReasonModal, setShowReasonModal] = React.useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<"active" | "trash">("active");
  const [editingProduct, setEditingProduct] = React.useState<any | null>(null);
  const [editForm, setEditForm] = React.useState({
    categoryId: "",
    occasionIds: [] as string[],
    title: "",
    description: "",
    isPublished: false,
  });
  const [editImages, setEditImages] = React.useState<string[]>([]);
  const [editColorImages, setEditColorImages] = React.useState<
    Record<string, ColorGroupState>
  >({});
  const [uploadingEditImages, setUploadingEditImages] = React.useState(false);
  const [uploadingEditColorImages, setUploadingEditColorImages] = React.useState<
    Record<string, boolean>
  >({});
  const [variantEditValues, setVariantEditValues] = React.useState<
    Record<
      string,
      {
        size: string;
        sku: string;
        sellerPrice: string;
        adminListingPrice: string;
        compareAtPrice: string;
        stock: string;
        status: "PENDING" | "APPROVED" | "REJECTED";
      }
    >
  >({});
  const [isSavingEdit, setIsSavingEdit] = React.useState(false);
  const [isApproving, setIsApproving] = React.useState(false);

  const imagekit = React.useMemo(() => {
    if (!IMAGEKIT_PUBLIC_KEY || !IMAGEKIT_URL_ENDPOINT || !API_BASE_URL) {
      return null;
    }
    return new ImageKit({
      publicKey: IMAGEKIT_PUBLIC_KEY,
      urlEndpoint: IMAGEKIT_URL_ENDPOINT,
    });
  }, []);

  const fetchAdminProductsData = React.useCallback(async () => {
    const [result, categoryResult, occasionResult] = await Promise.all([
      getAllProducts(),
      getCategories(),
      getOccasions(),
    ]);

    return {
      products: result.products ?? [],
      categories: categoryResult.categories ?? [],
      occasions: occasionResult.occasions ?? [],
    } satisfies AdminProductsInitialData;
  }, []);

  const { data: hydratedData, isLoading, mutate } = useHydratedSWR<AdminProductsInitialData>({
    key: "admin-products:hydrated",
    fetcher: fetchAdminProductsData,
    fallbackData: initialData ?? undefined,
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Unable to load products"
      );
    },
  });

  React.useEffect(() => {
    if (!hydratedData) return;
    setProducts(hydratedData.products ?? []);
    setCategories(hydratedData.categories ?? []);
    setOccasions(hydratedData.occasions ?? []);
  }, [hydratedData]);

  const loading = isLoading && !hydratedData;

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

  const removeSelected = async (reason: string) => {
    if (viewMode !== "active") return;
    const trimmed = reason.trim();
    if (!trimmed) {
      toast.error("Please mention the reason for the removal of the product.");
      return;
    }

    setIsBulkDeleting(true);
    const ids = Array.from(selectedIds);
    try {
      for (const id of ids) {
        await deleteProduct(id, trimmed);
      }
      toast.success(`${ids.length} product${ids.length === 1 ? "" : "s"} removed.`);
      setSelectedIds(new Set());
      setBulkReason("");
      await mutate();
      setShowReasonModal(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to remove selected products"
      );
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const openApproveModal = (product: any) => {
    setSelectedProduct(product);
    const priceState: Record<string, string> = {};
    (product.variants ?? []).forEach((variant: any) => {
      priceState[variant.id] =
        variant.adminListingPrice != null
          ? String(variant.adminListingPrice)
          : variant.sellerPrice != null
            ? String(variant.sellerPrice)
            : product.sellerPrice != null
              ? String(product.sellerPrice)
              : "";
    });
    setApprovalVariantPrices(priceState);
  };

  const submitApproval = async () => {
    if (!selectedProduct) return;
    if (!Array.isArray(selectedProduct.variants) || selectedProduct.variants.length === 0) {
      toast.error("This product has no variants to approve.");
      return;
    }
    const variantPayloads: AdminProductVariantUpdatePayload[] = [];

    for (const variant of selectedProduct.variants ?? []) {
      const priceInput = approvalVariantPrices[variant.id] ?? "";
      const nextPrice = Number(priceInput);
      const sellerPrice = Number(variant.sellerPrice ?? selectedProduct.sellerPrice ?? 0);

      if (Number.isNaN(nextPrice) || nextPrice <= 0) {
        toast.error(`Enter a valid admin listing price for SKU ${variant.sku}.`);
        return;
      }

      if (sellerPrice > 0 && nextPrice < sellerPrice) {
        toast.error(`Admin listing price cannot be lower than seller price for SKU ${variant.sku}.`);
        return;
      }

      variantPayloads.push({
        id: variant.id,
        adminListingPrice: nextPrice,
        status: "APPROVED",
      });
    }

    setIsApproving(true);
    try {
      const { product: saved } = await updateProductDetails(selectedProduct.id, {
        variants: variantPayloads,
      });

      setProducts((prev) =>
        prev.map((product) =>
          product.id === saved.id ? { ...product, ...saved } : product
        )
      );

      toast.success("Product approved successfully.");
      setSelectedProduct(null);
      setApprovalVariantPrices({});

      // Reconcile in the background — awaiting a full list refetch kept the
      // modal open long after the approval itself had finished.
      void mutate();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to approve product"
      );
    } finally {
      setIsApproving(false);
    }
  };

  const closeApproveModal = () => {
    setSelectedProduct(null);
    setApprovalVariantPrices({});
  };

  const resetEditModalState = () => {
    setEditingProduct(null);
    setEditForm({
      categoryId: "",
      occasionIds: [],
      title: "",
      description: "",
      isPublished: false,
    });
    setEditImages([]);
    setEditColorImages({});
    setVariantEditValues({});
  };

  const openEditModal = (product: any) => {
    const categoryId = product.categoryId ?? product.category?.id ?? "";
    const existingOccasionIds = Array.isArray(product.occasionIds)
      ? product.occasionIds.filter((id: unknown): id is string => typeof id === "string" && id.length > 0)
      : [];
    setEditingProduct(product);
    setEditForm({
      categoryId,
      occasionIds: existingOccasionIds,
      title: product.title ?? "",
      description: product.description ?? "",
      isPublished: Boolean(product.isPublished),
    });
    setEditImages(
      product.images && product.images.length > 0
        ? [...product.images]
        : []
    );
    setEditColorImages(getColorImageMapFromVariants(product.variants ?? []));

    const variantState: Record<
      string,
      {
        size: string;
        sku: string;
        sellerPrice: string;
        adminListingPrice: string;
        compareAtPrice: string;
        stock: string;
        status: "PENDING" | "APPROVED" | "REJECTED";
      }
    > = {};
    (product.variants ?? []).forEach((variant: any) => {
      variantState[variant.id] = {
        size: variant.size != null ? String(variant.size) : "",
        sku: variant.sku != null ? String(variant.sku) : "",
        sellerPrice:
          variant.sellerPrice != null ? String(variant.sellerPrice) : "",
        adminListingPrice:
          variant.adminListingPrice != null
            ? String(variant.adminListingPrice)
            : "",
        compareAtPrice:
          variant.compareAtPrice != null ? String(variant.compareAtPrice) : "",
        stock:
          variant.stock != null
            ? String(variant.stock)
            : "",
        status: variant.status ?? "PENDING",
      };
    });
    setVariantEditValues(variantState);
  };

  const closeEditModal = () => {
    resetEditModalState();
  };

  const handleImageChange = (index: number, value: string) => {
    setEditImages((prev) =>
      prev.map((image, idx) => (idx === index ? value : image))
    );
  };

  const addImageField = () => {
    const currentCount = editImages.filter((url) => url.trim()).length;
    if (currentCount >= 5) return;
    setEditImages((prev) => [...prev, ""]);
  };

  const removeImageField = (index: number) => {
    setEditImages((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleVariantFieldChange = (
    variantId: string,
    field:
      | "size"
      | "sku"
      | "sellerPrice"
      | "adminListingPrice"
      | "compareAtPrice"
      | "stock"
      | "status",
    value: string
  ) => {
    setVariantEditValues((prev) => ({
      ...prev,
      [variantId]: {
        size: prev[variantId]?.size ?? "",
        sku: prev[variantId]?.sku ?? "",
        sellerPrice: prev[variantId]?.sellerPrice ?? "",
        adminListingPrice: prev[variantId]?.adminListingPrice ?? "",
        compareAtPrice: prev[variantId]?.compareAtPrice ?? "",
        stock: prev[variantId]?.stock ?? "",
        status: prev[variantId]?.status ?? "PENDING",
        [field]: value,
      },
    }));
  };

  const handleUploadEditImages = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const inputElement = event.currentTarget;
    const files = Array.from(inputElement.files ?? []);
    if (!files.length) {
      inputElement.value = "";
      return;
    }
    if (!imagekit) {
      inputElement.value = "";
      const missing = getMissingImageKitConfig();
      toast.error(
        missing.length
          ? `Missing env: ${missing.join(", ")}`
          : "ImageKit is not configured."
      );
      return;
    }

    const currentCount = editImages.filter((url) => url.trim()).length;
    const remaining = 5 - currentCount;
    if (remaining <= 0) {
      inputElement.value = "";
      toast.error("You can upload up to 5 images.");
      return;
    }

    const limitedFiles = files.slice(0, remaining);
    setUploadingEditImages(true);

    try {
      const authResponse = await fetch(`${API_BASE_URL}/v1/imagekit/auth`);
      if (!authResponse.ok) {
        const authData = await authResponse.json().catch(() => null);
        const authMessage = authData?.message ?? "ImageKit auth failed.";
        toast.error(authMessage);
        return;
      }

      const authData = (await authResponse.json()) as {
        signature: string;
        token: string;
        expire: number;
      };

      const uploadedUrls = await runWithConcurrency(
        limitedFiles,
        UPLOAD_PARALLELISM,
        async (file) => {
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

          return result.url;
        }
      );

      setEditImages((prev) => [...prev, ...uploadedUrls]);
      toast.success("Images uploaded.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : (error as any)?.response?.data?.message ??
          (error as any)?.response?.message ??
          (error as any)?.message ??
          "Image upload failed";
      toast.error(message);
    } finally {
      setUploadingEditImages(false);
      inputElement.value = "";
    }
  };

  const handleUploadEditColorImages = async (
    colorKey: string,
    colorLabel: string,
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const inputElement = event.currentTarget;
    const files = Array.from(inputElement.files ?? []);
    if (!files.length) {
      inputElement.value = "";
      return;
    }
    if (!imagekit) {
      inputElement.value = "";
      const missing = getMissingImageKitConfig();
      toast.error(
        missing.length
          ? `Missing env: ${missing.join(", ")}`
          : "ImageKit is not configured."
      );
      return;
    }

    const currentCount = editColorImages[colorKey]?.images?.length ?? 0;
    const remaining = 5 - currentCount;
    if (remaining <= 0) {
      inputElement.value = "";
      toast.error("You can upload up to 5 images.");
      return;
    }

    setUploadingEditColorImages((prev) => ({ ...prev, [colorKey]: true }));
    try {
      const authResponse = await fetch(`${API_BASE_URL}/v1/imagekit/auth`);
      if (!authResponse.ok) {
        const authData = await authResponse.json().catch(() => null);
        const authMessage = authData?.message ?? "ImageKit auth failed.";
        toast.error(authMessage);
        return;
      }

      const authData = (await authResponse.json()) as {
        signature: string;
        token: string;
        expire: number;
      };

      const uploadedUrls = await runWithConcurrency(
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

      setEditColorImages((prev) => ({
        ...prev,
        [colorKey]: {
          label: colorLabel,
          hex: prev[colorKey]?.hex ?? null,
          images: [...(prev[colorKey]?.images ?? []), ...uploadedUrls],
        },
      }));
      toast.success(`Images uploaded for ${colorLabel}.`);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : (error as any)?.response?.data?.message ??
          (error as any)?.response?.message ??
          (error as any)?.message ??
          "Image upload failed";
      toast.error(message);
    } finally {
      setUploadingEditColorImages((prev) => ({ ...prev, [colorKey]: false }));
      inputElement.value = "";
    }
  };

  const handleSaveEdit = async () => {
    if (!editingProduct) return;

    const sanitizedImages = editImages
      .map((url) => url.trim())
      .filter(Boolean);
    // Marked required in the form, so enforce it here — previously a listing could
    // be saved with an empty title or no category.
    if (!editForm.title.trim()) {
      toast.error("Title is required.");
      return;
    }
    if (!editForm.categoryId) {
      toast.error("Please select a category.");
      return;
    }

    if (sanitizedImages.length === 0) {
      toast.error("Add at least one product image.");
      return;
    }
    if (sanitizedImages.length > 5) {
      toast.error("You can upload up to 5 images.");
      return;
    }

    const payload: AdminProductUpdatePayload = {
      categoryId: editForm.categoryId || undefined,
      title: editForm.title || undefined,
      description: editForm.description || undefined,
      images: sanitizedImages,
      isPublished: editForm.isPublished,
      occasionIds: editForm.occasionIds,
    };

    const variantPayloads: AdminProductVariantUpdatePayload[] = [];
    for (const [variantId, fields] of Object.entries(variantEditValues)) {
      const sourceVariant = (editingProduct.variants ?? []).find(
        (variant: any) => variant.id === variantId
      );
      const entry: AdminProductVariantUpdatePayload = { id: variantId };
      let touched = false;

      if (fields.size.trim()) {
        entry.size = fields.size.trim();
        touched = true;
      }

      if (fields.sku.trim()) {
        entry.sku = fields.sku.trim();
        touched = true;
      }

      if (fields.sellerPrice.trim()) {
        const sellerPriceValue = Number(fields.sellerPrice);
        if (Number.isNaN(sellerPriceValue) || sellerPriceValue <= 0) {
          toast.error("Enter a valid seller price.");
          return;
        }
        entry.sellerPrice = sellerPriceValue;
        touched = true;
      }

      if (fields.adminListingPrice.trim()) {
        const adminPriceValue = Number(fields.adminListingPrice);
        // Zero is rejected server-side; leaving the field blank is how a listing
        // price gets cleared.
        if (Number.isNaN(adminPriceValue) || adminPriceValue <= 0) {
          toast.error(
            "Enter an admin listing price above 0, or leave it blank to clear it."
          );
          return;
        }
        entry.adminListingPrice = adminPriceValue;
        touched = true;
      } else {
        entry.adminListingPrice = null;
        touched = true;
      }

      if (fields.compareAtPrice.trim()) {
        const compareValue = Number(fields.compareAtPrice);
        if (Number.isNaN(compareValue) || compareValue < 0) {
          toast.error("Enter a valid compare-at price.");
          return;
        }
        entry.compareAtPrice = compareValue;
        touched = true;
      }

      // Same rules the server enforces — checked here so a bad number names the
      // variant it belongs to instead of failing the whole save on a round trip.
      const sku = fields.sku.trim() || sourceVariant?.sku || "this variant";
      const sellerPrice =
        entry.sellerPrice ?? Number(sourceVariant?.sellerPrice ?? 0);

      if (entry.adminListingPrice != null && entry.adminListingPrice < sellerPrice) {
        toast.error(
          `Admin price for ${sku} cannot be below its seller price of ${sellerPrice}.`
        );
        return;
      }

      const effectivePrice = entry.adminListingPrice ?? sellerPrice;
      const storedCompareAt =
        sourceVariant?.compareAtPrice == null
          ? null
          : Number(sourceVariant.compareAtPrice);
      const storedEffectivePrice =
        sourceVariant?.adminListingPrice == null
          ? Number(sourceVariant?.sellerPrice ?? 0)
          : Number(sourceVariant.adminListingPrice);
      // Mirrors the server: only judged when this edit actually moves one of the
      // two numbers, so an already-inconsistent variant stays editable.
      const priceRelationChanged =
        (entry.compareAtPrice ?? null) !== storedCompareAt ||
        effectivePrice !== storedEffectivePrice;

      if (
        priceRelationChanged &&
        entry.compareAtPrice != null &&
        entry.compareAtPrice < effectivePrice
      ) {
        toast.error(
          `Compare-at price for ${sku} cannot be below its selling price of ${effectivePrice}.`
        );
        return;
      }

      if (fields.stock.trim()) {
        const stockValue = Number(fields.stock);
        if (
          Number.isNaN(stockValue) ||
          !Number.isInteger(stockValue) ||
          stockValue < 0
        ) {
          toast.error("Enter a valid stock quantity.");
          return;
        }
        entry.stock = stockValue;
        touched = true;
      }

      entry.status = fields.status;
      touched = true;

      const colorKey = normalizeColorKey(sourceVariant?.color ?? null);
      entry.images = editColorImages[colorKey]?.images ?? [];
      // The swatch is picked once per colour and applies to all of its sizes.
      entry.colorHex = editColorImages[colorKey]?.hex ?? null;
      touched = true;

      if (touched) {
        variantPayloads.push(entry);
      }
    }

    if (variantPayloads.length > 0) {
      payload.variants = variantPayloads;
    }

    setIsSavingEdit(true);
    try {
      const { product: saved } = await updateProductDetails(editingProduct.id, payload);

      // Paint the saved row from the response so the table updates without waiting
      // on the background refetch below.
      setProducts((prev) =>
        prev.map((product) =>
          product.id === saved.id ? { ...product, ...saved } : product
        )
      );

      toast.success(`"${editingProduct.title}" saved.`, {
        description: "Your changes are live.",
        duration: 5000,
      });
      resetEditModalState();

      // Refresh the list in the background. Awaiting it kept the spinner running
      // through a full re-fetch of a list the save had just invalidated, so the
      // admin sat watching a "saving" state long after the save had finished.
      void mutate();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to save product",
        { duration: 8000 }
      );
    } finally {
      setIsSavingEdit(false);
    }
  };

  const filteredProducts = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return products.filter((product) => {
      const matchesCategory =
        categoryFilter === "all" || product.categoryId === categoryFilter;

      const matchesAudience =
        audienceFilter === "all" || product.audience === audienceFilter;

      if (!query) {
        return matchesCategory && matchesAudience;
      }

      const haystack = [
        product.title,
        product.sellerEmail,
        product.categoryName,
        product.sellerId,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesCategory && matchesAudience && haystack.includes(query);
    });
  }, [products, searchQuery, categoryFilter, audienceFilter]);

  const visibleProducts = React.useMemo(
    () =>
      filteredProducts.filter((product) =>
        viewMode === "trash" ? product.deletedByAdmin : !product.deletedByAdmin
      ),
    [filteredProducts, viewMode]
  );

  React.useEffect(() => {
    setSelectedIds(new Set());
    setBulkReason("");
    setShowReasonModal(false);
  }, [viewMode]);

  const toggleSelection = (id: string) => {
    if (viewMode !== "active") return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const allSelected =
    viewMode === "active" &&
    visibleProducts.length > 0 &&
    visibleProducts.every((product) => selectedIds.has(product.id));

  const handleSelectAll = () => {
    if (viewMode !== "active") return;
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visibleProducts.map((product) => product.id)));
    }
  };

  const hasSelection = selectedIds.size > 0;

  const openRemovalModal = (ids: string[]) => {
    if (viewMode !== "active" || ids.length === 0) return;
    setSelectedIds(new Set(ids));
    setBulkReason("");
    setShowReasonModal(true);
  };

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
            Catalog Control
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Product Management
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Sellers can publish instantly. Use admin controls to remove listings if needed.
          </p>
        </div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="border border-border-soft bg-card p-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
        >
          <div className="flex items-center gap-3 flex-1 max-w-md">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by title, seller, or category..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="border-0 bg-transparent focus-visible:ring-0 h-10"
            />
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Audience
              </label>
              <select
                className="h-10 border border-border-soft bg-card px-4 text-sm text-foreground transition focus:border-brand/50"
                value={audienceFilter}
                onChange={(event) =>
                  setAudienceFilter(event.target.value as "all" | "MENS" | "KIDS")
                }
              >
                <option value="all">All</option>
                <option value="MENS">Mens</option>
                <option value="KIDS">Kids</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Category
              </label>
              <select
                className="h-10 border border-border-soft bg-card px-4 text-sm text-foreground transition focus:border-brand/50"
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
              >
                <option value="all">All categories</option>
                <CategoryOptions categories={categories} value={categoryFilter === "all" ? undefined : categoryFilter} />
              </select>
            </div>
          </div>
        </motion.div>

        {/* Products Table */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="border border-border-soft bg-card"
        >
          <div className="border-b border-border-soft p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground mb-1">
                  Catalog
                </p>
                <p className="font-serif text-lg font-light text-foreground">
                  {viewMode === "trash" ? "Trash" : "All Products"}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant={viewMode === "active" ? "outline" : "ghost"}
                    onClick={() => setViewMode("active")}
                    className="h-9"
                  >
                    Active Products
                  </Button>
                  <Button
                    size="sm"
                    variant={viewMode === "trash" ? "outline" : "ghost"}
                    onClick={() => setViewMode("trash")}
                    className="h-9"
                  >
                    Trash
                  </Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                {visibleProducts.length} {viewMode === "trash" ? "trashed listings" : "listings"}
              </p>
            </div>
          </div>

          <div className="border-b border-border-soft px-6 py-4">
            {viewMode === "active" ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={handleSelectAll}
                      disabled={visibleProducts.length === 0}
                      className="h-4 w-4 rounded border border-border-soft bg-card"
                    />
                    <span>Select All</span>
                  </label>
                  <span className="text-[11px] text-muted-foreground">
                    {selectedIds.size} selected
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!hasSelection}
                  onClick={() => hasSelection && openRemovalModal(Array.from(selectedIds))}
                  className="h-9"
                >
                  Remove Selected
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Trash is read-only. Switch back to Active Products to manage listings.
              </p>
            )}
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-8 text-center">
                <p className="text-sm text-muted-foreground">Loading products...</p>
              </div>
            ) : visibleProducts.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  {viewMode === "trash" ? "No items have been sent to the trash yet." : "No products found."}
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border-soft">
                    {viewMode === "active" ? (
                      <th className="p-6 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                        <span>Select</span>
                      </th>
                    ) : null}
                    <th className="p-6 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      Title
                    </th>
                    <th className="p-6 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      Seller
                    </th>
                    <th className="p-6 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      Category
                    </th>
                    <th className="p-6 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      Status
                    </th>
                    <th className="p-6 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-soft">
                  {visibleProducts.map((product, index) => (
                    <motion.tr
                      key={product.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.2 + index * 0.02, duration: 0.3 }}
                      className="hover:bg-mist/30 dark:hover:bg-navy/10 transition-colors duration-200"
                    >
                      {viewMode === "active" ? (
                        <td className="p-6">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(product.id)}
                            onChange={() => toggleSelection(product.id)}
                            className="h-4 w-4"
                          />
                          <span className="sr-only">Select {product.title}</span>
                        </td>
                      ) : null}
                      <td className="p-6 font-medium text-foreground">
                        {product.title}
                      </td>
                      <td className="p-6 text-muted-foreground">
                        {product.sellerEmail ?? product.sellerId?.slice(0, 8)}
                      </td>
                      <td className="p-6 text-muted-foreground">
                        <div className="flex flex-col gap-1">
                          <span>
                            {product.categoryName ?? product.categoryId?.slice(0, 6)}
                          </span>
                          <span className="self-start px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider border border-border-soft text-foreground">
                            {product.audience === "KIDS" ? "Kids" : "Mens"}
                          </span>
                        </div>
                      </td>
                      <td className="p-6">
                        <div className="flex flex-col gap-1">
                          <span
                            className={`px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider border ${getProductStatusStyle(product)}`}
                          >
                            {getProductStatusLabel(product)}
                          </span>
                          {viewMode === "trash" ? (
                            <>
                              <p className="text-[11px] text-muted-foreground">
                                {product.deletedByAdminReason ?? "Removed by admin"}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                {formatTimestamp(product.deletedByAdminAt)}
                              </p>
                            </>
                          ) : null}
                        </div>
                      </td>
                      <td className="p-6">
                        {viewMode === "trash" ? (
                          <p className="text-sm text-muted-foreground">
                            This listing was removed by admin.
                          </p>
                        ) : (
                          <div className="flex flex-col gap-2 min-w-40">
                            {String(product.status ?? "").toUpperCase() === "PENDING" && !product.deletedByAdmin ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openApproveModal(product)}
                                className="h-9"
                              >
                                Approve
                              </Button>
                            ) : null}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openEditModal(product)}
                              disabled={product.deletedByAdmin}
                              className="h-9 text-muted-foreground hover:text-foreground"
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openRemovalModal([product.id])}
                              disabled={product.deletedByAdmin}
                              className="h-9 text-muted-foreground hover:text-[#7A5656] hover:border-[#A67575]/40"
                            >
                              {product.deletedByAdmin ? "Deleted" : "Remove"}
                            </Button>
                          </div>
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </motion.div>
      </motion.div>

      <AnimatePresence>
        {selectedProduct ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4"
            onClick={closeApproveModal}
          >
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
              onClick={(event) => event.stopPropagation()}
              className="w-full max-w-lg border border-border-soft bg-card p-6 space-y-5"
            >
              <div className="space-y-1">
                <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-brand-strong">
                  Approval
                </p>
                <h2 className="text-xl font-semibold text-foreground">
                  {selectedProduct.title}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Seller price: {Number(selectedProduct.sellerPrice ?? 0) || "—"}
                </p>
              </div>

              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Admin listing price per variant
                </p>
                <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
                  {(selectedProduct.variants ?? []).map((variant: any) => (
                    <div
                      key={variant.id}
                      className="space-y-2 rounded border border-border-soft p-3"
                    >
                      <p className="text-xs text-muted-foreground">
                        {variant.color ? `${variant.color} · ` : ""}
                        {variant.size ?? "Default"} · {variant.sku}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Seller price: {Number(variant.sellerPrice ?? 0) || "—"}
                      </p>
                      <Input
                        type="number"
                        min="1"
                        step="0.01"
                        value={approvalVariantPrices[variant.id] ?? ""}
                        onChange={(event) =>
                          setApprovalVariantPrices((prev) => ({
                            ...prev,
                            [variant.id]: event.target.value,
                          }))
                        }
                        placeholder="Enter admin listing price"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button size="sm" onClick={submitApproval} disabled={isApproving}>
                  {isApproving ? "Approving…" : "Approve & Set Variant Prices"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={closeApproveModal}
                  disabled={isApproving}
                >
                  Close
                </Button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {showReasonModal ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4"
            onClick={() => setShowReasonModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
              onClick={(event) => event.stopPropagation()}
              className="w-full max-w-lg border border-border-soft bg-card p-6 space-y-5"
            >
              <div className="space-y-1">
                <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-brand-strong">
                  Removal Reason
                </p>
                <h2 className="text-xl font-semibold text-foreground">
                  {selectedIds.size} product{selectedIds.size === 1 ? "" : "s"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Provide a clear justification so the seller knows why their listing was removed.
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Reason
                </p>
                <Input
                  placeholder="Why are you removing these listings?"
                  value={bulkReason}
                  onChange={(event) => setBulkReason(event.target.value)}
                  className="h-10"
                  disabled={isBulkDeleting}
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  size="sm"
                  onClick={() => removeSelected(bulkReason)}
                  disabled={isBulkDeleting}
                >
                  {isBulkDeleting ? "Removing…" : "Remove Product(s)"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowReasonModal(false)}
                  disabled={isBulkDeleting}
                >
                  Cancel
                </Button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {editingProduct ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/50 p-3 sm:p-4"
            onClick={closeEditModal}
          >
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
              onClick={(event) => event.stopPropagation()}
              className="my-3 max-h-[calc(100vh-1.5rem)] w-full max-w-3xl overflow-y-auto border border-border-soft bg-card p-6 shadow-xl sm:my-4 sm:max-h-[calc(100vh-2rem)]"
            >
              <div className="space-y-1">
                <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-brand-strong">
                  Edit Listing
                </p>
                <h2 className="text-xl font-semibold text-foreground">
                  {editingProduct.title}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Seller: {editingProduct.sellerEmail ?? editingProduct.sellerId}
                </p>
              </div>

              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-1">
                  <label className="flex flex-col gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                    <span>Category<RequiredMark /></span>
                    <select
                      value={editForm.categoryId}
                      onChange={(event) =>
                        setEditForm((prev) => ({
                          ...prev,
                          categoryId: event.target.value,
                        }))
                      }
                      className="border border-border-soft bg-card px-3 py-2 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-brand/40"
                    >
                      <option value="">Select category</option>
                      <CategoryOptions categories={categories} value={editForm.categoryId} />
                    </select>
                  </label>
                </div>

                <div className="space-y-2">
                  <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                    Occasions
                  </p>
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                    {occasions.map((occasion) => {
                      const checked = editForm.occasionIds.includes(occasion.id);
                      return (
                        <label
                          key={occasion.id}
                          className="flex items-center gap-2 rounded border border-border-soft px-3 py-2 text-xs text-foreground"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) => {
                              setEditForm((prev) => {
                                if (event.target.checked) {
                                  return {
                                    ...prev,
                                    occasionIds: [...prev.occasionIds, occasion.id],
                                  };
                                }
                                return {
                                  ...prev,
                                  occasionIds: prev.occasionIds.filter((id) => id !== occasion.id),
                                };
                              });
                            }}
                          />
                          <span>{occasion.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <label className="flex flex-col gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  <span>Title<RequiredMark /></span>
                  <Input
                    value={editForm.title}
                    onChange={(event) =>
                      setEditForm((prev) => ({
                        ...prev,
                        title: event.target.value,
                      }))
                    }
                  />
                </label>

                <label className="flex flex-col gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  Description
                  <textarea
                    value={editForm.description}
                    onChange={(event) =>
                      setEditForm((prev) => ({
                        ...prev,
                        description: event.target.value,
                      }))
                    }
                    className="min-h-30 rounded border border-border-soft bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                  />
                </label>

                <div className="flex items-center gap-3 text-sm">
                  <input
                    id="editPublished"
                    type="checkbox"
                    checked={editForm.isPublished}
                    onChange={(event) =>
                      setEditForm((prev) => ({
                        ...prev,
                        isPublished: event.target.checked,
                      }))
                    }
                  />
                  <label htmlFor="editPublished" className="text-muted-foreground">
                    Published
                  </label>
                </div>

                <div className="space-y-3">
                  <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                    Images
                  </p>
                  <div className="space-y-2">
                    {editImages.map((image, index) => {
                      const trimmed = image.trim();
                      return (
                        <div key={index} className="space-y-1">
                          {trimmed ? (
                            <img
                              src={trimmed}
                              alt={`Product image ${index + 1}`}
                              className="h-24 w-full rounded border border-border-soft object-cover"
                            />
                          ) : null}
                          <div className="flex items-center gap-2">
                            <Input
                              value={image}
                              placeholder="Image URL"
                              onChange={(event) =>
                                handleImageChange(index, event.target.value)
                              }
                              className="flex-1"
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeImageField(index)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border-soft px-3 py-2 text-sm text-muted-foreground transition hover:border-foreground hover:text-foreground">
                      Upload images
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="sr-only"
                        onChange={handleUploadEditImages}
                      />
                    </label>
                    {editImages.filter((url) => url.trim()).length < 5 ? (
                      <Button size="sm" variant="outline" onClick={addImageField}>
                        Add image
                      </Button>
                    ) : null}
                  </div>
                  {uploadingEditImages && (
                    <p className="text-xs text-muted-foreground">Uploading images…</p>
                  )}
                </div>

                {Object.keys(editColorImages).length > 0 ? (
                  <div className="space-y-3">
                    <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      Color Galleries
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Each color uses one shared gallery across all its sizes.
                    </p>
                    <div className="space-y-3">
                      {Object.entries(editColorImages).map(([colorKey, colorGroup]) => (
                        <div
                          key={colorKey}
                          className="space-y-2 rounded border border-border-soft p-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              {colorGroup.hex ? (
                                <span
                                  className="h-4 w-4 rounded-full border border-border-soft"
                                  style={{ backgroundColor: colorGroup.hex }}
                                />
                              ) : null}
                              <p className="text-xs font-medium uppercase tracking-[0.14em] text-foreground">
                                {colorGroup.label}
                              </p>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {colorGroup.images.length}/5 uploaded
                            </span>
                          </div>

                          <ColorSwatchPicker
                            colorLabel={colorGroup.label}
                            value={colorGroup.hex}
                            onChange={(hex) =>
                              setEditColorImages((prev) => ({
                                ...prev,
                                [colorKey]: { ...prev[colorKey], hex },
                              }))
                            }
                          />
                          <div className="flex flex-wrap gap-2">
                            {colorGroup.images.map((imageUrl) => (
                              <div
                                key={`${colorKey}-${imageUrl}`}
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
                                    setEditColorImages((prev) => ({
                                      ...prev,
                                      [colorKey]: {
                                        ...prev[colorKey],
                                        images: (prev[colorKey]?.images ?? []).filter(
                                          (image) => image !== imageUrl
                                        ),
                                      },
                                    }))
                                  }
                                >
                                  <X className="h-3.5 w-3.5 text-white" />
                                </button>
                              </div>
                            ))}
                            <label className="flex h-14 w-14 cursor-pointer items-center justify-center border border-dashed border-border-soft text-muted-foreground transition hover:text-foreground">
                              {uploadingEditColorImages[colorKey] ? (
                                <span className="text-xs">...</span>
                              ) : (
                                <span className="text-lg">+</span>
                              )}
                              <input
                                type="file"
                                accept="image/*"
                                multiple
                                className="hidden"
                                onChange={(event) =>
                                  handleUploadEditColorImages(
                                    colorKey,
                                    colorGroup.label,
                                    event
                                  )
                                }
                                disabled={uploadingEditColorImages[colorKey]}
                              />
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {(editingProduct.variants ?? []).length > 0 ? (
                  <div className="space-y-3">
                    <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      Variants
                    </p>
                    <div className="space-y-3">
                      {editingProduct.variants.map((variant: any) => (
                        <div
                          key={variant.id}
                          className="rounded border border-border-soft p-3"
                        >
                          <p className="text-sm font-medium text-foreground">
                            {variant.size ?? "Default"} · {variant.sku}
                          </p>
                          <div className="mt-3 grid gap-3 md:grid-cols-3">
                            <label className="flex flex-col gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                              <span>Size<RequiredMark /></span>
                              <Input
                                value={
                                  variantEditValues[variant.id]?.size ??
                                  (variant.size != null ? String(variant.size) : "")
                                }
                                onChange={(event) =>
                                  handleVariantFieldChange(
                                    variant.id,
                                    "size",
                                    event.target.value
                                  )
                                }
                              />
                            </label>
                            <label className="flex flex-col gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                              <span>SKU<RequiredMark /></span>
                              <Input
                                value={
                                  variantEditValues[variant.id]?.sku ??
                                  (variant.sku != null ? String(variant.sku) : "")
                                }
                                onChange={(event) =>
                                  handleVariantFieldChange(
                                    variant.id,
                                    "sku",
                                    event.target.value
                                  )
                                }
                              />
                            </label>
                            <label className="flex flex-col gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                              Status
                              <select
                                value={
                                  variantEditValues[variant.id]?.status ??
                                  (variant.status ?? "PENDING")
                                }
                                onChange={(event) =>
                                  handleVariantFieldChange(
                                    variant.id,
                                    "status",
                                    event.target.value
                                  )
                                }
                                className="border border-border-soft bg-card px-3 py-2 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-brand/40"
                              >
                                <option value="PENDING">Pending</option>
                                <option value="APPROVED">Approved</option>
                                <option value="REJECTED">Rejected</option>
                              </select>
                            </label>
                            <label className="flex flex-col gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                              <span>Seller Price<RequiredMark /></span>
                              <Input
                                type="number"
                                min="1"
                                step="0.01"
                                value={
                                  variantEditValues[variant.id]?.sellerPrice ??
                                  (variant.sellerPrice != null
                                    ? String(variant.sellerPrice)
                                    : "")
                                }
                                onChange={(event) =>
                                  handleVariantFieldChange(
                                    variant.id,
                                    "sellerPrice",
                                    event.target.value
                                  )
                                }
                              />
                            </label>
                            <label className="flex flex-col gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                              <span>Admin Price<RequiredMark /></span>
                              <Input
                                type="number"
                                min="1"
                                step="0.01"
                                value={
                                  variantEditValues[variant.id]?.adminListingPrice ??
                                  (variant.adminListingPrice != null
                                    ? String(variant.adminListingPrice)
                                    : "")
                                }
                                onChange={(event) =>
                                  handleVariantFieldChange(
                                    variant.id,
                                    "adminListingPrice",
                                    event.target.value
                                  )
                                }
                              />
                            </label>
                            <label className="flex flex-col gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                              Compare at
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={
                                  variantEditValues[variant.id]?.compareAtPrice ??
                                  (variant.compareAtPrice != null
                                    ? String(variant.compareAtPrice)
                                    : "")
                                }
                                onChange={(event) =>
                                  handleVariantFieldChange(
                                    variant.id,
                                    "compareAtPrice",
                                    event.target.value
                                  )
                                }
                              />
                            </label>
                            <label className="flex flex-col gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                              <span>Stock<RequiredMark /></span>
                              <Input
                                type="number"
                                min="0"
                                step="1"
                                value={
                                  variantEditValues[variant.id]?.stock ??
                                  (variant.stock != null ? String(variant.stock) : "")
                                }
                                onChange={(event) =>
                                  handleVariantFieldChange(
                                    variant.id,
                                    "stock",
                                    event.target.value
                                  )
                                }
                              />
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-3">
                <Button
                  size="sm"
                  onClick={handleSaveEdit}
                  disabled={isSavingEdit}
                >
                  {isSavingEdit ? "Saving…" : "Save changes"}
                </Button>
                <Button size="sm" variant="ghost" onClick={closeEditModal}>
                  Cancel
                </Button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
