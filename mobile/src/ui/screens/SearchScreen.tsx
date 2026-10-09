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

const RECENT_KEY = "ktmona:recent-searches";

/**
 * Meesho-style search: a focused search field; before typing, recent searches
 * and category shortcuts; after typing, the product grid with sort and filters.
 */
export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ q?: string }>();
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
    if (v.length >= 2) remember(v);
  };

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
            onChangeText={setText}
            onSubmitEditing={() => submit(text)}
            placeholder="Search by keyword or product name"
            placeholderTextColor={C.faint}
            autoFocus={!text}
            returnKeyType="search"
            style={styles.input}
            accessibilityLabel="Search products"
          />
          {text ? (
            <Pressable onPress={() => { setText(""); setQuery(""); }} hitSlop={8} accessibilityLabel="Clear search">
              <Feather name="x" size={17} color={C.muted} />
            </Pressable>
          ) : null}
        </View>
        <HeaderActions showNotifications={false} />
      </View>

      {query.length >= 2 ? (
        <ProductFeedList key={query} search={query} title={`Results for "${query}"`} categories={tree} />
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
});
