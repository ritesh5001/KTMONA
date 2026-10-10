import * as React from "react";
import { useLocalSearchParams } from "expo-router";
import { CollectionScreen } from "../../src/ui/screens/CollectionScreens";

export default function CollectionRoute() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  return <CollectionScreen key={String(slug)} slug={String(slug ?? "")} />;
}
