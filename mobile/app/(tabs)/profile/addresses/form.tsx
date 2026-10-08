import * as React from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  colors,
  radius,
  spacing,
  typography,
  shadow,
} from "../../../../src/theme/tokens";
import { useAuth } from "../../../../src/hooks/useAuth";
import { useAddresses } from "../../../../src/providers/AddressProvider";
import { AnimatedPressable } from "../../../../src/components/AnimatedPressable";
import { notifySuccess, notifyError } from "../../../../src/utils/haptics";
import { BrandLoader } from "../../../../src/components/BrandLoader";
import { AppHeader } from "../../../../src/components/AppHeader";
import type {
  AddressLabel,
  CreateAddressPayload,
  UpdateAddressPayload,
} from "../../../../src/services/addresses";
import {
  AppInput as TextInput,
  AppText as Text,
  ScreenContainer as SafeAreaView,
} from "../../../../src/components";

// ---------------------------------------------------------------------------
// Label options
// ---------------------------------------------------------------------------

const LABEL_OPTIONS: AddressLabel[] = ["HOME", "OFFICE", "OTHER"];

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function AddressFormScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = Boolean(id);

  const { session, isLoading: authLoading } = useAuth();
  const token = session?.accessToken ?? null;
  const showGuestState = !authLoading && !token;
  const { addresses, addAddress, editAddress } = useAddresses();

  // Find existing address for edit mode
  const existing = React.useMemo(
    () => (id ? addresses.find((a) => a.id === id) : undefined),
    [id, addresses],
  );

  // ---- Form state ----
  const [label, setLabel] = React.useState<AddressLabel>(
    existing?.label ?? "HOME",
  );
  const [addressLine1, setAddressLine1] = React.useState(
    existing?.addressLine1 ?? "",
  );
  const [addressLine2, setAddressLine2] = React.useState(
    existing?.addressLine2 ?? "",
  );
  const [city, setCity] = React.useState(existing?.city ?? "");
  const [state, setState] = React.useState(existing?.state ?? "");
  const [pincode, setPincode] = React.useState(existing?.pincode ?? "");

  const [isSaving, setIsSaving] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const mountedRef = React.useRef(true);
  const submitLockRef = React.useRef(false);

  React.useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Pre-fill when `existing` resolves (navigated with id before data loaded)
  React.useEffect(() => {
    if (existing && isEdit) {
      setLabel(existing.label);
      setAddressLine1(existing.addressLine1);
      setAddressLine2(existing.addressLine2 ?? "");
      setCity(existing.city);
      setState(existing.state);
      setPincode(existing.pincode);
    }
  }, [existing, isEdit]);

  const handleGoBack = React.useCallback(() => {
    router.back();
  }, [router]);

  // ---- Validation ----

  const validate = React.useCallback((): boolean => {
    const next: Record<string, string> = {};

    if (!addressLine1.trim()) next.addressLine1 = "Address line 1 is required";
    if (!city.trim()) next.city = "City is required";
    if (!state.trim()) next.state = "State is required";
    if (!pincode.trim()) next.pincode = "Pincode is required";
    else if (!/^\d{6}$/.test(pincode.trim()))
      next.pincode = "Enter a valid 6-digit pincode";

    setErrors(next);
    return Object.keys(next).length === 0;
  }, [addressLine1, city, state, pincode]);

  // ---- Submit ----

  const handleSubmit = React.useCallback(async () => {
    // Synchronous double-submit guard
    if (submitLockRef.current) return;
    if (!validate()) return;

    submitLockRef.current = true;
    setIsSaving(true);

    try {
      if (isEdit && id) {
        const data: UpdateAddressPayload = {
          label,
          addressLine1: addressLine1.trim(),
          addressLine2: addressLine2.trim() || undefined,
          city: city.trim(),
          state: state.trim(),
          pincode: pincode.trim(),
        };
        const result = await editAddress(id, data);
        if (result && mountedRef.current) {
          notifySuccess();
          router.back();
        }
      } else {
        const data: CreateAddressPayload = {
          label,
          addressLine1: addressLine1.trim(),
          addressLine2: addressLine2.trim() || undefined,
          city: city.trim(),
          state: state.trim(),
          pincode: pincode.trim(),
        };
        const result = await addAddress(data);
        if (result && mountedRef.current) {
          notifySuccess();
          router.back();
        }
      }
    } catch {
      notifyError();
    } finally {
      submitLockRef.current = false;
      if (mountedRef.current) setIsSaving(false);
    }
  }, [
    isEdit,
    id,
    label,
    addressLine1,
    addressLine2,
    city,
    state,
    pincode,
    validate,
    addAddress,
    editAddress,
    router,
  ]);

  if (authLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <AppHeader
          title={isEdit ? "Edit address" : "New address"}
          subtitle="Delivery details"
          showBack
        />
        <View style={styles.emptyContainer}>
          <BrandLoader label="Loading address details" color={colors.gold} />
        </View>
      </SafeAreaView>
    );
  }

  if (showGuestState) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <AppHeader
          title={isEdit ? "Edit address" : "New address"}
          subtitle="Delivery details"
          showBack
        />
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>Address details unavailable</Text>
          <Text style={styles.emptySubtitle}>
            You can add a delivery address during checkout.
          </Text>
          <AnimatedPressable
            onPress={handleGoBack}
            style={styles.primaryButton}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Text style={styles.primaryButtonText}>Back</Text>
          </AnimatedPressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <AppHeader
        title={isEdit ? "Edit address" : "New address"}
        subtitle={isEdit ? "Update delivery details" : "Add delivery details"}
        showBack
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Card */}
          <View style={styles.card}>
            {/* Label selector */}
            <Text style={styles.fieldLabel}>Label</Text>
            <View style={styles.labelRow}>
              {LABEL_OPTIONS.map((opt) => (
                <AnimatedPressable
                  key={opt}
                  style={[
                    styles.labelChip,
                    label === opt && styles.labelChipActive,
                  ]}
                  onPress={() => setLabel(opt)}
                  disabled={isSaving}
                  accessibilityRole="button"
                  accessibilityLabel={`${opt.toLowerCase()} address label`}
                  accessibilityState={{ selected: label === opt, disabled: isSaving }}
                >
                  <Text
                    style={[
                      styles.labelChipText,
                      label === opt && styles.labelChipTextActive,
                    ]}
                  >
                    {opt}
                  </Text>
                </AnimatedPressable>
              ))}
            </View>

            {/* Address Line 1 */}
            <Text style={styles.fieldLabel}>Address Line 1 *</Text>
            <TextInput
              style={[styles.input, errors.addressLine1 && styles.inputError]}
              placeholder="House, street, area"
              placeholderTextColor={colors.brownSoft}
              value={addressLine1}
              onChangeText={setAddressLine1}
              editable={!isSaving}
            />
            {errors.addressLine1 ? (
              <Text style={styles.errorText}>{errors.addressLine1}</Text>
            ) : null}

            {/* Address Line 2 */}
            <Text style={styles.fieldLabel}>Address Line 2</Text>
            <TextInput
              style={styles.input}
              placeholder="Apartment, floor"
              placeholderTextColor={colors.brownSoft}
              value={addressLine2}
              onChangeText={setAddressLine2}
              editable={!isSaving}
            />

            {/* City */}
            <Text style={styles.fieldLabel}>City *</Text>
            <TextInput
              style={[styles.input, errors.city && styles.inputError]}
              placeholder="Mumbai"
              placeholderTextColor={colors.brownSoft}
              value={city}
              onChangeText={setCity}
              editable={!isSaving}
            />
            {errors.city ? (
              <Text style={styles.errorText}>{errors.city}</Text>
            ) : null}

            {/* State */}
            <Text style={styles.fieldLabel}>State *</Text>
            <TextInput
              style={[styles.input, errors.state && styles.inputError]}
              placeholder="Maharashtra"
              placeholderTextColor={colors.brownSoft}
              value={state}
              onChangeText={setState}
              editable={!isSaving}
            />
            {errors.state ? (
              <Text style={styles.errorText}>{errors.state}</Text>
            ) : null}

            {/* Pincode */}
            <Text style={styles.fieldLabel}>Pincode *</Text>
            <TextInput
              style={[styles.input, errors.pincode && styles.inputError]}
              placeholder="400001"
              placeholderTextColor={colors.brownSoft}
              keyboardType="number-pad"
              maxLength={6}
              value={pincode}
              onChangeText={setPincode}
              editable={!isSaving}
            />
            {errors.pincode ? (
              <Text style={styles.errorText}>{errors.pincode}</Text>
            ) : null}

            {/* Submit */}
            <AnimatedPressable
              style={[
                styles.primaryButton,
                isSaving && styles.buttonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={isSaving}
              accessibilityRole="button"
              accessibilityLabel={isEdit ? "Update address" : "Save address"}
              accessibilityState={{ disabled: isSaving, busy: isSaving }}
            >
              {isSaving ? (
                <BrandLoader size="sm" color={colors.background} />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {isEdit ? "Update address" : "Save address"}
                </Text>
              )}
            </AnimatedPressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  container: {
    paddingBottom: spacing.xxl,
  },
  card: {
    marginTop: spacing.md,
    marginHorizontal: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.warmWhite,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    ...shadow.card,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    fontFamily: typography.serif,
    fontSize: 20,
    color: colors.charcoal,
    textAlign: "center",
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    fontFamily: typography.sans,
    fontSize: 12,
    color: colors.brownSoft,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  fieldLabel: {
    fontFamily: typography.sans,
    fontSize: 11,
    color: colors.brownSoft,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  input: {
    height: 48,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: spacing.md,
    fontFamily: typography.sans,
    color: colors.charcoal,
    backgroundColor: colors.background,
  },
  inputError: {
    borderColor: colors.gold,
  },
  errorText: {
    fontFamily: typography.sans,
    fontSize: 11,
    color: colors.gold,
    marginTop: 3,
  },
  labelRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  labelChip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.background,
  },
  labelChipActive: {
    borderColor: colors.gold,
    backgroundColor: "rgba(184, 149, 108, 0.12)",
  },
  labelChipText: {
    fontFamily: typography.sansMedium,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.brownSoft,
  },
  labelChipTextActive: {
    color: colors.gold,
  },
  primaryButton: {
    marginTop: spacing.lg,
    backgroundColor: colors.gold,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center",
    minHeight: 48,
    justifyContent: "center",
  },
  primaryButtonText: {
    fontFamily: typography.sansMedium,
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: colors.background,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
