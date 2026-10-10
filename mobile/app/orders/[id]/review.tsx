import * as React from "react";
import { useLocalSearchParams } from "expo-router";
import ReviewScreen from "../../../src/ui/screens/ReviewScreen";

export default function OrderReviewRoute() {
  const { productId, title } = useLocalSearchParams<{ productId: string; title?: string }>();
  return <ReviewScreen productId={String(productId ?? "")} title={title ? String(title) : undefined} />;
}
