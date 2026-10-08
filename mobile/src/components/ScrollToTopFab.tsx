import React from "react";
import { Icon } from "./Icon";
import { Pressable, StyleSheet } from "react-native";
import { colors, radius } from "../theme";

type ScrollToTopFabProps = {
  visible: boolean;
  onPress: () => void;
};

export function ScrollToTopFab({ visible, onPress }: ScrollToTopFabProps) {
  if (!visible) return null;

  return (
    <Pressable onPress={onPress} style={styles.fab} hitSlop={8}>
      <Icon name="arrow-up" size={20} color={colors.white} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: 18,
    bottom: 26,
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryAccent,
    shadowColor: "#0C1B42",
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    elevation: 4,
    zIndex: 50,
  },
});
