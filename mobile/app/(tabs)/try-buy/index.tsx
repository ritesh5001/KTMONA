import * as React from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Icon } from "../../../src/components/Icon";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Image } from "../../../src/components/CompatImage";
import { AppHeader } from "../../../src/components/AppHeader";
import {
  AppText as Text,
  ScreenContainer as SafeAreaView,
} from "../../../src/components";
import { AnimatedPressable } from "../../../src/components/AnimatedPressable";
import { BrandLoader } from "../../../src/components/BrandLoader";
import { useAuth } from "../../../src/hooks/useAuth";
import { useNetworkStatus } from "../../../src/hooks/useNetworkStatus";
import { useToast } from "../../../src/providers/ToastProvider";
import { getProductById, getProducts, type ProductItem } from "../../../src/services/products";
import {
  createVirtualTryOn,
  type TryOnResult,
} from "../../../src/services/tryOn";
import { uploadTryOnImage, type ReviewImageAsset } from "../../../src/services/imagekit";
import { isAbortError } from "../../../src/services/api";
import { colors, shadow, spacing, typography, radius } from "../../../src/theme/tokens";
import { notifySuccess } from "../../../src/utils/haptics";

const MAX_TRY_ON_IMAGE_BYTES = 8 * 1024 * 1024;
const fallbackImage =
  "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80";

function mimeTypeFromAsset(asset: ImagePicker.ImagePickerAsset): string {
  if (asset.mimeType) return asset.mimeType;
  const ext = asset.fileName?.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}

function productImage(product?: ProductItem | null): string {
  return product?.images?.find((image) => image.trim().length > 0) ?? fallbackImage;
}

export default function TryBuyScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ productId?: string }>();
  const { session } = useAuth();
  const token = session?.accessToken ?? null;
  const { isConnected } = useNetworkStatus();
  const { showToast } = useToast();

  const [selectedProduct, setSelectedProduct] = React.useState<ProductItem | null>(null);
  const [userImageUri, setUserImageUri] = React.useState<string | null>(null);
  const [userImageAsset, setUserImageAsset] = React.useState<ReviewImageAsset | null>(null);
  const [tryOnResult, setTryOnResult] = React.useState<TryOnResult | null>(null);
  const [tryOnError, setTryOnError] = React.useState<string | null>(null);
  const [tryOnLoading, setTryOnLoading] = React.useState(false);
  const [isResultVisible, setIsResultVisible] = React.useState(false);
  const abortRef = React.useRef<AbortController | null>(null);

  const productsQuery = useQuery({
    queryKey: ["try-buy-products"],
    queryFn: () => getProducts({ page: 1, limit: 12 }),
    staleTime: 1000 * 60 * 5,
  });

  const targetProductQuery = useQuery({
    queryKey: ["product", params.productId],
    queryFn: ({ signal }) => getProductById(params.productId!, signal),
    enabled: Boolean(params.productId),
    staleTime: 1000 * 60 * 5,
  });

  const targetProduct = React.useMemo(
    () => (targetProductQuery.data?.product ?? null) as ProductItem | null,
    [targetProductQuery.data]
  );

  const products = React.useMemo(() => {
    const baseProducts = (productsQuery.data?.data ?? []) as ProductItem[];
    if (targetProduct && !baseProducts.some((p) => p.id === targetProduct.id)) {
      return [targetProduct, ...baseProducts];
    }
    return baseProducts;
  }, [productsQuery.data, targetProduct]);

  React.useEffect(() => {
    if (params.productId && targetProduct) {
      setSelectedProduct(targetProduct);
      setTryOnError(null);
      setUserImageUri(null);
      setUserImageAsset(null);
      setTryOnResult(null);
    } else if (!params.productId && !selectedProduct && products.length > 0) {
      setSelectedProduct(products[0]);
    }
  }, [products, params.productId, targetProduct, selectedProduct]);

  React.useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const handleAsset = React.useCallback((asset?: ImagePicker.ImagePickerAsset) => {
    if (!asset) return;
    if (typeof asset.fileSize === "number" && asset.fileSize > MAX_TRY_ON_IMAGE_BYTES) {
      setTryOnError("Choose an image under 8MB.");
      return;
    }

    setUserImageUri(asset.uri);
    setUserImageAsset({
      uri: asset.uri,
      fileName: asset.fileName ?? `tryon-${Date.now()}.jpg`,
      mimeType: mimeTypeFromAsset(asset),
    });
    setTryOnResult(null);
    setTryOnError(null);
  }, []);

  const capturePhoto = React.useCallback(async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission required", "Allow camera access to take a try-on photo.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.72,
    });

    if (!result.canceled) {
      handleAsset(result.assets?.[0]);
    }
  }, [handleAsset]);

  const uploadPhoto = React.useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission required", "Allow photo library access to upload a try-on photo.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.72,
      allowsMultipleSelection: false,
    });

    if (!result.canceled) {
      handleAsset(result.assets?.[0]);
    }
  }, [handleAsset]);

  const generateTryOn = React.useCallback(async () => {
    if (!token) {
      showToast("Please sign in to use Try & Buy", "info");
      router.push("/login");
      return;
    }
    if (!isConnected) {
      showToast("You're offline. Please check your connection.", "error");
      return;
    }
    if (!selectedProduct) {
      setTryOnError("Choose a product first.");
      return;
    }
    if (!userImageAsset) {
      setTryOnError("Take or upload your photo first.");
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setTryOnLoading(true);
    setTryOnError(null);

    try {
      const uploadedUserImageUrl = await uploadTryOnImage(userImageAsset);
      const result = await createVirtualTryOn({
        productId: selectedProduct.id,
        userImage: uploadedUserImageUrl,
        signal: controller.signal,
      });
      setTryOnResult(result);
      setIsResultVisible(true);
      notifySuccess();
    } catch (error) {
      if (isAbortError(error)) return;
      const message = error instanceof Error ? error.message : "Virtual try-on failed";
      setTryOnError(message);
      showToast(message, "error");
    } finally {
      setTryOnLoading(false);
    }
  }, [isConnected, router, selectedProduct, showToast, token, userImageAsset]);

  const openSelectedProduct = React.useCallback(() => {
    if (!selectedProduct) return;
    void queryClient.prefetchQuery({
      queryKey: ["product", selectedProduct.id],
      queryFn: ({ signal }) => getProductById(selectedProduct.id, signal),
      staleTime: 10 * 60 * 1000,
    });
    setIsResultVisible(false);
    router.push(`/product/${selectedProduct.id}`);
  }, [queryClient, router, selectedProduct]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <AppHeader variant="main" />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Virtual styling room</Text>
          <Text style={styles.title}>Try it first. Buy with confidence.</Text>
          <Text style={styles.copy}>
            Pick a wedding-ready piece, add your photo, and preview the look before opening the product page.
          </Text>
        </View>

        <View style={styles.stage}>
          <View style={styles.previewPair}>
            <View style={styles.previewBox}>
              {userImageUri ? (
                <Image source={{ uri: userImageUri }} style={styles.previewImage} contentFit="cover" />
              ) : (
                <View style={styles.placeholder}>
                  <Icon name="person-outline" size={30} color={colors.brownSoft} />
                  <Text style={styles.placeholderText}>Your photo</Text>
                </View>
              )}
            </View>
            <View style={styles.previewBox}>
              <Image
                source={{ uri: productImage(selectedProduct) }}
                style={styles.previewImage}
                contentFit="cover"
              />
            </View>
          </View>

          <View style={styles.photoActions}>
            <Pressable style={styles.outlineButton} onPress={capturePhoto} disabled={tryOnLoading}>
              <Icon name="camera-outline" size={18} color={colors.charcoal} />
              <Text style={styles.outlineButtonText}>Camera</Text>
            </Pressable>
            <Pressable style={styles.outlineButton} onPress={uploadPhoto} disabled={tryOnLoading}>
              <Icon name="image-outline" size={18} color={colors.charcoal} />
              <Text style={styles.outlineButtonText}>Upload</Text>
            </Pressable>
          </View>
        </View>

        {tryOnError ? <Text style={styles.errorText}>{tryOnError}</Text> : null}

        <AnimatedPressable
          style={[
            styles.primaryButton,
            (!selectedProduct || !userImageAsset || tryOnLoading) && styles.buttonDisabled,
          ]}
          onPress={generateTryOn}
          disabled={!selectedProduct || !userImageAsset || tryOnLoading}
        >
          {tryOnLoading ? (
            <BrandLoader size="sm" color={colors.background} />
          ) : (
            <Text style={styles.primaryButtonText}>Generate try-on</Text>
          )}
        </AnimatedPressable>

        {tryOnResult?.output?.[0] ? (
          <Pressable style={styles.secondaryButton} onPress={() => setIsResultVisible(true)}>
            <Text style={styles.secondaryButtonText}>View last result</Text>
          </Pressable>
        ) : null}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Choose product</Text>
          <Pressable onPress={() => router.push("/marketplace")}>
            <Text style={styles.sectionLink}>Shop all</Text>
          </Pressable>
        </View>

        {productsQuery.isLoading ? (
          <View style={styles.loadingCard}>
            <BrandLoader label="Loading products" color={colors.gold} />
          </View>
        ) : products.length === 0 ? (
          <View style={styles.loadingCard}>
            <Text style={styles.mutedText}>Products are not available right now.</Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.productRail}>
            {products.map((product) => {
              const active = selectedProduct?.id === product.id;
              return (
                <Pressable
                  key={product.id}
                  style={[styles.productCard, active && styles.productCardActive]}
                  onPress={() => {
                    setSelectedProduct(product);
                    setTryOnResult(null);
                  }}
                >
                  <Image
                    source={{ uri: productImage(product) }}
                    style={styles.productImage}
                    contentFit="cover"
                  />
                  <Text numberOfLines={2} style={styles.productTitle}>
                    {product.title}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </ScrollView>

      <Modal
        visible={isResultVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsResultVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Pressable style={styles.modalClose} onPress={() => setIsResultVisible(false)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </Pressable>
            {tryOnResult?.output?.[0] ? (
              <Image
                source={{ uri: tryOnResult.output[0] }}
                style={styles.resultImage}
                contentFit="contain"
              />
            ) : null}
            <View style={styles.modalActions}>
              <Pressable style={styles.modalBuyButton} onPress={openSelectedProduct}>
                <Text style={styles.modalBuyText}>Open product</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  hero: {
    paddingVertical: spacing.sm,
  },
  eyebrow: {
    fontFamily: typography.sans,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: colors.gold,
  },
  title: {
    marginTop: spacing.xs,
    fontFamily: typography.serif,
    fontSize: 30,
    lineHeight: 34,
    color: colors.charcoal,
  },
  copy: {
    marginTop: spacing.sm,
    fontFamily: typography.sans,
    fontSize: 13,
    lineHeight: 20,
    color: colors.brownSoft,
  },
  stage: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surfaceElevated,
    ...shadow.card,
  },
  previewPair: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  previewBox: {
    flex: 1,
    aspectRatio: 3 / 4,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.cream,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  placeholder: {
    alignItems: "center",
    gap: spacing.xs,
  },
  placeholderText: {
    fontFamily: typography.sans,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.brownSoft,
  },
  photoActions: {
    marginTop: spacing.md,
    flexDirection: "row",
    gap: spacing.sm,
  },
  outlineButton: {
    borderRadius: radius.md,
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.warmWhite,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  outlineButtonText: {
    fontFamily: typography.sansMedium,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.charcoal,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontFamily: typography.serif,
    fontSize: 22,
    color: colors.charcoal,
  },
  sectionLink: {
    fontFamily: typography.sansMedium,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.gold,
  },
  productRail: {
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  productCard: {
    borderRadius: radius.lg,
    width: 132,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surfaceElevated,
    overflow: "hidden",
    flexShrink: 0,
  },
  productCardActive: {
    borderColor: colors.gold,
    backgroundColor: colors.cream,
  },
  productImage: {
    width: "100%",
    aspectRatio: 0.75,
    backgroundColor: colors.surface,
  },
  productTitle: {
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    fontFamily: typography.sansMedium,
    fontSize: 11.5,
    lineHeight: 15,
    color: colors.charcoal,
  },
  loadingCard: {
    borderRadius: radius.lg,
    minHeight: 132,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  mutedText: {
    fontFamily: typography.sans,
    fontSize: 12,
    color: colors.brownSoft,
    textAlign: "center",
  },
  errorText: {
    fontFamily: typography.sans,
    fontSize: 12,
    color: "#B42318",
  },
  primaryButton: {
    borderRadius: radius.md,
    minHeight: 50,
    backgroundColor: colors.gold,
    borderWidth: 1,
    borderColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    fontFamily: typography.sansMedium,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.background,
  },
  secondaryButton: {
    borderRadius: radius.md,
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    fontFamily: typography.sansMedium,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.charcoal,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(20, 18, 16, 0.9)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  modalContent: {
    width: "100%",
    height: "86%",
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.background,
  },
  modalClose: {
    position: "absolute",
    top: spacing.md,
    right: spacing.md,
    zIndex: 2,
    backgroundColor: "rgba(44, 40, 37, 0.72)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  modalCloseText: {
    fontFamily: typography.sansMedium,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.background,
  },
  resultImage: {
    width: "100%",
    height: "100%",
  },
  modalActions: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
  },
  modalBuyButton: {
    borderRadius: radius.md,
    minHeight: 48,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBuyText: {
    fontFamily: typography.sansMedium,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.background,
  },
});
