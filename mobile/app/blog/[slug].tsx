import * as React from "react";
import { useLocalSearchParams } from "expo-router";
import { BlogPostScreen } from "../../src/ui/screens/InfoScreens";

export default function BlogPostRoute() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  return <BlogPostScreen slug={String(slug ?? "")} />;
}
