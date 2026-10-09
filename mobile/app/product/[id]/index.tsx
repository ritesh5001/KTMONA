import * as React from "react";
import { useLocalSearchParams } from "expo-router";
import ProductScreen from "../../../src/ui/screens/ProductScreen";

export default function ProductRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ProductScreen key={String(id)} id={String(id ?? "")} />;
}
