import React from "react";
import {
  Image,
  type ImageContentFit,
  type ImageSource,
  type ImageStyle,
} from "expo-image";
import { imageUrl } from "../lib/image-url";

type CachedImageProps = {
  source: ImageSource | string | number;
  style?: ImageStyle | ImageStyle[];
  contentFit?: ImageContentFit;
  transition?: number;
  /**
   * Rendered width in dp. Given this, ImageKit is asked for a matching size
   * instead of the original — the single biggest saving on list screens.
   */
  width?: number;
  priority?: "low" | "normal" | "high";
};

export function CachedImage({
  source,
  style,
  contentFit = "cover",
  transition = 180,
  width,
  priority = "normal",
}: CachedImageProps) {
  const resolvedSource = React.useMemo(() => {
    if (typeof source === "string") {
      return { uri: imageUrl(source, { width }) ?? source };
    }
    if (source && typeof source === "object" && "uri" in source && typeof source.uri === "string") {
      return { ...source, uri: imageUrl(source.uri, { width }) ?? source.uri };
    }
    return source;
  }, [source, width]);

  return (
    <Image
      source={resolvedSource}
      style={style}
      contentFit={contentFit}
      transition={transition}
      cachePolicy="memory-disk"
      priority={priority}
      recyclingKey={typeof source === "string" ? source : undefined}
    />
  );
}
