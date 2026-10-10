import * as React from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useToast } from "../../providers/ToastProvider";
import { C, F } from "../theme";
import { PrimaryBtn, ScreenHeader, T } from "../kit";
import { useT } from "../../i18n";
import { submitProductReview } from "../../services/reviews";
import { buildReviewImageName, uploadReviewImage } from "../../services/imagekit";

const LABELS = ["", "Very bad", "Bad", "Okay", "Good", "Excellent"];
const MAX_PHOTOS = 4;

/** Meesho-style "Rate product" after delivery: stars, a few words, photos. */
export default function ReviewScreen({ productId, title }: { productId: string; title?: string }) {
  const router = useRouter();
  const t = useT();
  const qc = useQueryClient();
  const { showToast } = useToast();
  const [rating, setRating] = React.useState(0);
  const [text, setText] = React.useState("");
  const [photos, setPhotos] = React.useState<{ uri: string; mimeType: string }[]>([]);
  const [saving, setSaving] = React.useState(false);

  const addPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      showToast(t("Photo access is needed to add pictures"), "info");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8, allowsMultipleSelection: true, selectionLimit: MAX_PHOTOS - photos.length });
    if (result.canceled) return;
    setPhotos((p) => [...p, ...result.assets.map((a) => ({ uri: a.uri, mimeType: a.mimeType ?? "image/jpeg" }))].slice(0, MAX_PHOTOS));
  };

  const submit = async () => {
    if (!rating) {
      showToast(t("Tap the stars to rate the product"), "info");
      return;
    }
    setSaving(true);
    try {
      const images: string[] = [];
      for (const [i, p] of photos.entries()) {
        images.push(await uploadReviewImage({ uri: p.uri, fileName: buildReviewImageName(i), mimeType: p.mimeType }));
      }
      await submitProductReview(productId, { rating, text: text.trim(), images });
      await qc.invalidateQueries({ queryKey: ["storefront", "reviews", productId] });
      showToast(t("Thanks for your review!"), "success");
      router.back();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("Could not submit your review"), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScreenHeader title="Rate product" actions={false} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          {title ? <T size={13} color={C.textSoft} numberOfLines={2}>{title}</T> : null}
          <T w="semibold" size={16} style={{ marginTop: title ? 10 : 0 }}>How was the product?</T>
          <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} onPress={() => setRating(n)} hitSlop={6} accessibilityLabel={`${n} star`}>
                <Ionicons name={n <= rating ? "star" : "star-outline"} size={34} color={n <= rating ? "#F59E0B" : C.faint} />
              </Pressable>
            ))}
          </View>
          {rating ? <T w="semibold" size={13} color={C.textSoft} style={{ marginTop: 8 }}>{LABELS[rating]}</T> : null}
        </View>

        <View style={[styles.card, { marginTop: 12 }]}>
          <T w="semibold" size={15}>Write a review (optional)</T>
          <TextInput
            value={text}
            onChangeText={setText}
            multiline
            maxLength={2000}
            placeholder={t("What did you like or dislike? How was the fit and quality?")}
            placeholderTextColor={C.faint}
            style={styles.input}
          />
          <T w="semibold" size={15} style={{ marginTop: 14 }}>Add photos (optional)</T>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
            {photos.map((p) => (
              <View key={p.uri}>
                <Image source={{ uri: p.uri }} style={styles.photo} />
                <Pressable onPress={() => setPhotos((list) => list.filter((x) => x.uri !== p.uri))} style={styles.removePhoto} hitSlop={6} accessibilityLabel="Remove photo">
                  <Feather name="x" size={12} color={C.white} />
                </Pressable>
              </View>
            ))}
            {photos.length < MAX_PHOTOS ? (
              <Pressable onPress={() => void addPhoto()} style={[styles.photo, styles.addPhoto]} accessibilityLabel="Add photo">
                <Feather name="camera" size={20} color={C.navy} />
              </Pressable>
            ) : null}
          </View>
        </View>

        <PrimaryBtn label="Submit review" loading={saving} onPress={() => void submit()} style={{ marginTop: 16 }} />
        {saving && photos.length ? (
          <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 8, gap: 6 }}>
            <ActivityIndicator size="small" color={C.brand} />
            <T size={12} color={C.muted}>Uploading photos…</T>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: 12, padding: 14 },
  input: { marginTop: 8, minHeight: 100, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 10, fontFamily: F.regular, fontSize: 14, color: C.text, textAlignVertical: "top" },
  photo: { width: 72, height: 72, borderRadius: 8 },
  addPhoto: { borderWidth: 1, borderStyle: "dashed", borderColor: C.border, alignItems: "center", justifyContent: "center", backgroundColor: C.bg },
  removePhoto: { position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: C.navy, alignItems: "center", justifyContent: "center" },
});
