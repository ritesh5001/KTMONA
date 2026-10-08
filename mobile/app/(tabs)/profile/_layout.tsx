import { Stack } from "expo-router";
import { colors } from "../../../src/theme/tokens";

export default function ProfileLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: "none",
      }}
    />
  );
}
