import * as React from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { C } from "../theme";
import { CategoryArt, HeaderActions, SearchBarButton, T } from "../kit";
import { useCategoryTree } from "../data";

/**
 * Meesho's Categories tab: main categories down the left, the selected one's
 * groups and leaf categories (as image circles) on the right.
 */
export default function CategoriesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { tree, isLoading } = useCategoryTree();
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const active = tree.find((m) => m.id === activeId) ?? tree[0];
  const scrollRef = React.useRef<ScrollView>(null);

  return (
    <View style={{ flex: 1, backgroundColor: C.card }}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <T w="semibold" size={17}>Categories</T>
        <HeaderActions showNotifications={false} />
      </View>
      <View style={{ paddingHorizontal: 12, paddingBottom: 10 }}>
        <SearchBarButton />
      </View>

      {isLoading ? (
        <ActivityIndicator color={C.brand} style={{ marginTop: 40 }} />
      ) : (
        <View style={{ flex: 1, flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
          {/* Left rail */}
          <ScrollView style={styles.rail} showsVerticalScrollIndicator={false}>
            {tree.map((m) => {
              const on = m.id === active?.id;
              return (
                <Pressable
                  key={m.id}
                  onPress={() => { setActiveId(m.id); scrollRef.current?.scrollTo({ y: 0, animated: false }); }}
                  style={[styles.railItem, on && styles.railItemOn]}
                  accessibilityState={{ selected: on }}
                >
                  {on ? <View style={styles.railMarker} /> : null}
                  <CategoryArt slug={m.slug} name={m.name} image={m.image} style={styles.railIcon} />
                  <T size={11} w={on ? "semibold" : "regular"} color={on ? C.navy : C.textSoft} numberOfLines={2} style={{ textAlign: "center", marginTop: 4 }}>
                    {m.name}
                  </T>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Right panel */}
          <ScrollView ref={scrollRef} style={{ flex: 1, backgroundColor: C.card }} contentContainerStyle={{ padding: 12, paddingBottom: 40 }}>
            {active ? (
              <>
                <Pressable onPress={() => router.push(`/category/${active.slug}`)} style={styles.allRow}>
                  <CategoryArt slug={active.slug} name={active.name} image={active.image} style={{ width: 44, height: 44, borderRadius: 22 }} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <T w="semibold" size={14}>All {active.name}</T>
                    <T size={11} color={C.muted}>Browse everything in this category</T>
                  </View>
                  <Feather name="chevron-right" size={18} color={C.muted} />
                </Pressable>

                {active.children.map((group) => (
                  <View key={group.id} style={{ marginTop: 18 }}>
                    <Pressable onPress={() => router.push(`/category/${group.slug}`)} style={styles.groupHead}>
                      <T w="semibold" size={14}>{group.name}</T>
                      <T w="semibold" size={11} color={C.brandDark}>View all</T>
                    </Pressable>
                    <View style={styles.grid}>
                      {group.children.map((leaf) => (
                        <Pressable key={leaf.id} onPress={() => router.push(`/category/${leaf.slug}`)} style={styles.leaf}>
                          <CategoryArt slug={leaf.slug} name={leaf.name} image={leaf.image} fallbackSlug={[group.slug, active.slug]} style={styles.leafIcon} />
                          <T size={11} color={C.text} numberOfLines={2} style={{ textAlign: "center", marginTop: 5 }}>{leaf.name}</T>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ))}
              </>
            ) : null}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 12, paddingBottom: 6, backgroundColor: C.card },
  rail: { width: 92, flexGrow: 0, backgroundColor: C.bg },
  railItem: { paddingVertical: 10, paddingHorizontal: 6, alignItems: "center" },
  railItemOn: { backgroundColor: C.card },
  railMarker: { position: "absolute", left: 0, top: 10, bottom: 10, width: 3, borderRadius: 2, backgroundColor: C.brand },
  railIcon: { width: 46, height: 46, borderRadius: 23 },
  allRow: { flexDirection: "row", alignItems: "center", padding: 10, borderRadius: 10, backgroundColor: C.bg },
  groupHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  grid: { flexDirection: "row", flexWrap: "wrap", rowGap: 14 },
  leaf: { width: "33.33%", alignItems: "center", paddingHorizontal: 4 },
  leafIcon: { width: 62, height: 62, borderRadius: 31 },
});
