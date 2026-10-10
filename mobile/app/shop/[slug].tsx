import * as React from "react";
import { useLocalSearchParams } from "expo-router";
import { ShopScreen } from "../../src/ui/screens/CollectionScreens";

export default function ShopRoute() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  return <ShopScreen key={String(slug)} slug={String(slug ?? "")} />;
}
