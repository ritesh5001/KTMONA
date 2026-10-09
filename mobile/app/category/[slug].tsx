import * as React from "react";
import { useLocalSearchParams } from "expo-router";
import ListingScreen from "../../src/ui/screens/ListingScreen";

export default function CategoryRoute() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  return <ListingScreen slug={String(slug ?? "")} />;
}
