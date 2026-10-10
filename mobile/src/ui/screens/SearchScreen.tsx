import * as React from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import { C, F, S } from "../theme";
import { CategoryArt, HeaderActions, T } from "../kit";
import { ProductFeedList } from "../ProductFeedList";
import { useCategoryTree } from "../data";
import { useQuery } from "@tanstack/react-query";
import { getSuggestions, getTrending } from "../../services/search";
import { useVoiceSearch } from "../../hooks/useVoiceSearch";
import { useLanguage } from "../../i18n";
import { useToast } from "../../providers/ToastProvider";

const RECENT_KEY = "ktmona:recent-searches";

/**
 * Meesho-style search: a focused search field; before typing, recent searches
 * and category shortcuts; after typing, the product grid with sort and filters.
 */
export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ q?: string; voice?: string }>();
  const { lang, t } = useLanguage();
  const { showToast } = useToast();
  const [focused, setFocused] = React.useState(!params.q);
  const { tree } = useCategoryTree();
  const [text, setText] = React.useState(typeof params.q === "string" ? params.q : "");
  const [query, setQuery] = React.useState(text.trim());
  const [recent, setRecent] = React.useState<string[]>([]);

  React.useEffect(() => {
    AsyncStorage.getItem(RECENT_KEY).then((v) => { if (v) setRecent(JSON.parse(v)); }).catch(() => undefined);
  }, []);

  // Search as the shopper types (debounced).
  React.useEffect(() => {
    const t = setTimeout(() => setQuery(text.trim()), 350);
    return () => clearTimeout(t);
  }, [text]);

  const remember = (q: string) => {
    const next = [q, ...recent.filter((r) => r.toLowerCase() !== q.toLowerCase())].slice(0, 8);
    setRecent(next);
    void AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next)).catch(() => undefined);
  };
  const submit = (q: string) => {
    const v = q.trim();
    setText(v);
    setQuery(v);
    setFocused(false);
    if (v.length >= 2) remember(v);
  };

  /* Voice search: words appear as they are heard, then the search runs. */
  const voice = useVoiceSearch({
    lang,
    onPartial: (v) => setText(v),
    onFinal: (v) => submit(v),
    onError: (m) => showToast(m, "info"),
  });
  React.useEffect(() => {
    if (params.voice === "1") void voice.start();
    // Only when opened from a mic button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Suggestions while typing; trending searches before typing. */
  const suggestQ = useQuery({
    queryKey: ["search", "suggest", query],
    queryFn: ({ signal }) => getSuggestions(query, 6, signal),
    enabled: focused && query.length >= 2,
    staleTime: 60 * 1000,
  });
  const trendingQ = useQuery({
    queryKey: ["search", "trending"],
    queryFn: ({ signal }) => getTrending(10, signal),
    staleTime: 30 * 60 * 1000,
  });
  const suggestions = focused && query.length >= 2 ? suggestQ.data ?? [] : [];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/home"))} hitSlop={10} accessibilityLabel="Back">
          <Feather name="arrow-left" size={22} color={C.text} />
        </Pressable>
        <View style={styles.inputWrap}>
          <Feather name="search" size={17} color={C.muted} />
          <TextInput
            value={text}
            onChangeText={(v) => { setText(v); setFocused(true); }}
            onFocus={() => setFocused(true)}
            onSubmitEditing={() => submit(text)}
            placeholder={voice.listening ? t("Listening…") : t("Search by keyword or product name")}
            placeholderTextColor={C.faint}
            autoFocus={!text}
            returnKeyType="search"
            style={styles.input}
            accessibilityLabel="Search products"
          />
          {text ? (
            <Pressable onPress={() => { setText(""); setQuery(""); setFocused(true); }} hitSlop={8} accessibilityLabel="Clear search">
              <Feather name="x" size={17} color={C.muted} />
            </Pressable>
          ) : null}
          {voice.available ? (
            <Pressable
              onPress={() => (voice.listening ? voice.stop() : void voice.start())}
              hitSlop={8}
              accessibilityLabel={voice.listening ? "Stop voice search" : "Search by voice"}
              style={[styles.mic, voice.listening && { backgroundColor: C.brand }]}
            >
              <Feather name="mic" size={16} color={voice.listening ? C.navy : C.brandDark} />
            </Pressable>
          ) : null}
        </View>
        <HeaderActions showNotifications={false} />
      </View>

      {voice.listening ? (
        <View style={styles.listening}>
          <View style={styles.listeningMic}><Feather name="mic" size={28} color={C.navy} /></View>
          <T w="semibold" size={16} style={{ marginTop: 12 }}>Listening…</T>
          <T size={13} color={C.muted} style={{ marginTop: 4 }}>{text || t("Say a product name, e.g. “cotton kurti”")}</T>
        </View>
      ) : null}

      {suggestions.length ? (
        <View style={styles.suggestions}>
          {suggestions.map((sg) => (
            <Pressable key={sg.id} onPress={() => router.push(`/product/${sg.id}`)} style={styles.suggestionRow}>
              <Feather name="search" size={14} color={C.faint} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <T size={13} numberOfLines={1}>{sg.title}</T>
                {sg.category ? <T size={11} color={C.muted} numberOfLines={1}>{t("in")} {sg.category}</T> : null}
              </View>
              <Feather name="arrow-up-left" size={14} color={C.faint} />
            </Pressable>
          ))}
          <Pressable onPress={() => submit(text)} style={styles.suggestionRow}>
            <Feather name="list" size={14} color={C.brandDark} />
            <T w="semibold" size={13} color={C.brandDark} style={{ marginLeft: 10 }}>{t("See all results for")} “{query}”</T>
          </Pressable>
        </View>
      ) : null}

      {query.length >= 2 ? (
        <ProductFeedList key={query} search={query} title={`${t("Results for")} "${query}"`} categories={tree} />
      ) : (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
          {recent.length ? (
            <View style={styles.block}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <T w="semibold" size={15}>Recent Searches</T>
                <Pressable onPress={() => { setRecent([]); void AsyncStorage.removeItem(RECENT_KEY); }} hitSlop={8}>
                  <T w="semibold" size={12} color={C.brandDark}>Clear</T>
                </Pressable>
              </View>
              <View style={styles.chips}>
                {recent.map((r) => (
                  <Pressable key={r} onPress={() => submit(r)} style={styles.chip}>
                    <Feather name="clock" size={13} color={C.muted} />
                    <T size={13} style={{ marginLeft: 6 }}>{r}</T>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          {trendingQ.data?.length ? (
            <View style={styles.block}>
              <T w="semibold" size={15}>Trending Searches</T>
              <View style={styles.chips}>
                {trendingQ.data.map((r) => (
                  <Pressable key={r} onPress={() => submit(r)} style={styles.chip}>
                    <Feather name="trending-up" size={13} color={C.brandDark} />
                    <T size={13} style={{ marginLeft: 6 }}>{r}</T>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          <View style={styles.block}>
            <T w="semibold" size={15}>Shop by Category</T>
            <View style={styles.grid}>
              {tree.map((c) => (
                <Pressable key={c.id} onPress={() => router.push(`/category/${c.slug}`)} style={styles.cat}>
                  <CategoryArt slug={c.slug} name={c.name} image={c.image} style={styles.catIcon} />
                  <T size={11} numberOfLines={2} style={{ textAlign: "center", marginTop: 5 }}>{c.name}</T>
                </Pressable>
              ))}
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: S.page, paddingBottom: 8, backgroundColor: C.card, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: C.border },
  inputWrap: { flex: 1, flexDirection: "row", alignItems: "center", height: 40, borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 10, backgroundColor: C.card },
  input: { flex: 1, marginLeft: 8, fontFamily: F.regular, fontSize: 14, color: C.text, paddingVertical: 0 },
  block: { backgroundColor: C.card, padding: 14, marginTop: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  chip: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: C.border, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  grid: { flexDirection: "row", flexWrap: "wrap", rowGap: 14, marginTop: 12 },
  cat: { width: "25%", alignItems: "center", paddingHorizontal: 4 },
  catIcon: { width: 60, height: 60, borderRadius: 30 },
  mic: { marginLeft: 8, width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: C.brandSoft },
  listening: { alignItems: "center", paddingVertical: 28, backgroundColor: C.card, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: C.border },
  listeningMic: { width: 72, height: 72, borderRadius: 36, backgroundColor: C.brand, alignItems: "center", justifyContent: "center" },
  suggestions: { backgroundColor: C.card, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: C.border },
  suggestionRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 11, borderTopWidth: StyleSheet.hairlineWidth, borderColor: C.divider },
});
