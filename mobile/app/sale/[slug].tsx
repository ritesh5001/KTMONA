import * as React from "react";
import { useLocalSearchParams } from "expo-router";
import { SaleScreen } from "../../src/ui/screens/CollectionScreens";

export default function SaleRoute() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  return <SaleScreen key={String(slug)} slug={String(slug ?? "")} />;
}
