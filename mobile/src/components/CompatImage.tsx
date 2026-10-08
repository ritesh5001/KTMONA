import * as React from "react";
import {
  type ImageSourcePropType,
  type ImageStyle,
  type StyleProp,
} from "react-native";
import {
  Image as ExpoImage,
  type ImageContentFit,
  type ImageContentPosition,
  type ImageSource,
} from "expo-image";
import { imageUrl } from "../lib/image-url";

type ContentFit = "cover" | "contain" | "fill" | "none" | "scale-down";

type CompatImageProps = {
  source: ImageSourcePropType | string | undefined | null;
  style?: StyleProp<ImageStyle>;
  contentFit?: ContentFit;
  contentPosition?: ImageContentPosition;
  transition?: number;
  cachePolicy?: "none" | "disk" | "memory" | "memory-disk";
  /**
   * Rendered width in dp. Supplying it lets ImageKit return a matching size
   * rather than the full-resolution original.
   */
  width?: number;
  priority?: "low" | "normal" | "high";
};

function toContentFit(contentFit?: ContentFit): ImageContentFit {
  if (!contentFit) return "cover";
  if (contentFit === "scale-down") return "contain";
  return contentFit;
}

function normalizeSource(source: CompatImageProps["source"], width?: number): ImageSource {
  if (typeof source === "string") {
    return { uri: imageUrl(source, { width }) ?? source };
  }
  if (!source) {
    return { uri: "" };
  }
  if (typeof source === "object" && "uri" in source && typeof source.uri === "string") {
    return { ...source, uri: imageUrl(source.uri, { width }) ?? source.uri } as ImageSource;
  }
  return source as ImageSource;
}

export function Image({
  source,
  style,
  contentFit,
  contentPosition,
  transition = 180,
  cachePolicy = "memory-disk",
  width,
  priority = "normal",
}: CompatImageProps) {
  const resolved = React.useMemo(
    () => normalizeSource(source, width),
    [source, width]
  );

  return (
    <ExpoImage
      source={resolved}
      style={style}
      contentFit={toContentFit(contentFit)}
      contentPosition={contentPosition}
      transition={transition}
      cachePolicy={cachePolicy}
      priority={priority}
      recyclingKey={
        typeof resolved === "object" && "uri" in resolved
          ? resolved.uri
          : undefined
      }
    />
  );
}
