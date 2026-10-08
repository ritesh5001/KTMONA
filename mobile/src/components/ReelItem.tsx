import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Icon } from "./Icon";
import { VideoView, useVideoPlayer } from "expo-video";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { colors, spacing, radius } from "../theme";
import { AppText as Text } from "./AppText";
import { CachedImage } from "./CachedImage";

export type ReelFeedItem = {
  id: string;
  videoUrl: string;
  thumbnailUrl?: string | null;
  caption: string;
  username: string;
  productId: string | null;
  likeCount: number;
  productTitle?: string | null;
  aboutFallback?: string;
};

type ReelItemProps = {
  item: ReelFeedItem;
  width: number;
  height: number;
  tabBarHeight?: number;
  isActive: boolean;
  isMuted: boolean;
  shouldPreload: boolean;
  shouldKeepInMemory: boolean;
  liked: boolean;
  likeCount: number;
  onToggleMute: () => void;
  onToggleLike: (id: string) => void;
  onShare: (item: ReelFeedItem) => void;
  onPressProduct?: (id: string) => void;
};

function ReelItemBase({
  item,
  width,
  height,
  tabBarHeight = 0,
  isActive,
  isMuted,
  shouldPreload: _shouldPreload,
  shouldKeepInMemory: _shouldKeepInMemory,
  liked,
  likeCount,
  onToggleMute,
  onToggleLike,
  onShare,
  onPressProduct: _onPressProduct,
}: ReelItemProps) {
  const [isHolding, setIsHolding] = React.useState(false);
  const overlayOpacity = useSharedValue(0.24);
  const likeScale = useSharedValue(0.2);
  const likeOpacity = useSharedValue(0);
  const lastTapRef = React.useRef(0);
  const singleTapTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const player = useVideoPlayer(item.videoUrl ? { uri: item.videoUrl } : null, (videoPlayer) => {
    videoPlayer.loop = true;
    videoPlayer.muted = isMuted;
  });
  const bottomOffset = Math.max(tabBarHeight, 0);
  const actionsBottom = bottomOffset + 144;

  React.useEffect(() => {
    overlayOpacity.value = withTiming(isActive ? 0.18 : 0.28, { duration: 220 });
  }, [isActive, overlayOpacity]);

  React.useEffect(() => {
    player.muted = isMuted || !isActive;
  }, [isActive, isMuted, player]);

  React.useEffect(() => {
    if (isActive && !isHolding) {
      player.muted = isMuted;
      player.play();
      return;
    }
    player.muted = true;
    player.pause();
  }, [isActive, isHolding, isMuted, player]);

  React.useEffect(() => {
    if (!liked) return;
    likeOpacity.value = withTiming(1, { duration: 100 });
    likeScale.value = withSpring(1.12, { damping: 12, stiffness: 220, mass: 0.9 });

    const hide = setTimeout(() => {
      likeOpacity.value = withTiming(0, { duration: 200 });
      likeScale.value = withSpring(0.8, { damping: 16, stiffness: 180, mass: 0.9 });
    }, 180);

    return () => clearTimeout(hide);
  }, [liked, likeOpacity, likeScale]);

  React.useEffect(() => {
    return () => {
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
      }
      player.muted = true;
      player.pause();
    };
  }, [player]);

  const handleVideoTap = React.useCallback(() => {
    const now = Date.now();

    if (now - lastTapRef.current < 260) {
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
      lastTapRef.current = 0;
      onToggleLike(item.id);
      return;
    }

    lastTapRef.current = now;
    singleTapTimerRef.current = setTimeout(() => {
      onToggleMute();
      singleTapTimerRef.current = null;
    }, 260);
  }, [item.id, onToggleLike, onToggleMute]);

  const handleLongPress = React.useCallback(() => {
    setIsHolding(true);
  }, []);

  const handlePressOut = React.useCallback(() => {
    setIsHolding(false);
  }, []);

  const overlayAnimatedStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const likeAnimatedStyle = useAnimatedStyle(() => ({
    opacity: likeOpacity.value,
    transform: [{ scale: likeScale.value }],
  }));

  return (
    <View style={[styles.container, { width, height }]}>
      {item.thumbnailUrl ? (
        <CachedImage source={item.thumbnailUrl} style={styles.videoPoster} contentFit="cover" />
      ) : null}
      <VideoView
        player={player}
        style={styles.video}
        contentFit="cover"
        nativeControls={false}
        allowsFullscreen={false}
      />
      <Pressable
        style={StyleSheet.absoluteFillObject}
        onPress={handleVideoTap}
        onLongPress={handleLongPress}
        onPressOut={handlePressOut}
        delayLongPress={180}
      >
        <Animated.View style={[styles.overlay, overlayAnimatedStyle]} />
      </Pressable>

      <Animated.View pointerEvents="none" style={[styles.likeBurst, likeAnimatedStyle]}>
        <Icon name="heart" size={74} color="rgba(255, 255, 255, 0.95)" />
      </Animated.View>

      <View style={[styles.sideActions, { bottom: actionsBottom }]}>
        <Pressable style={styles.actionButton} onPress={() => onToggleLike(item.id)}>
          <Icon
            name={liked ? "heart" : "heart-outline"}
            size={20}
            color={liked ? colors.primaryAccent : "#FFFFFF"}
          />
          <Text style={styles.actionLabel}>{formatCount(likeCount)}</Text>
        </Pressable>

        <Pressable style={styles.actionButton} onPress={() => onShare(item)}>
          <Icon name="share-social-outline" size={20} color="#FFFFFF" />
          <Text style={styles.actionLabel}>Share</Text>
        </Pressable>

        <Pressable style={styles.actionButton} onPress={onToggleMute}>
          <Icon
            name={isMuted ? "volume-mute-outline" : "volume-high-outline"}
            size={20}
            color="#FFFFFF"
          />
        </Pressable>
      </View>
    </View>
  );
}

function formatCount(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(value >= 10000000 ? 0 : 1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}K`;
  return String(value);
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#000000",
    position: "relative",
  },
  video: {
    ...StyleSheet.absoluteFillObject,
  },
  videoPoster: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000000",
  },
  likeBurst: {
    position: "absolute",
    alignSelf: "center",
    top: "40%",
    zIndex: 4,
  },
  sideActions: {
    position: "absolute",
    right: spacing.md,
    gap: spacing.md,
    zIndex: 3,
  },
  actionButton: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    borderWidth: 1,
    borderColor: "rgba(255, 138, 0, 0.6)",
    borderRadius: radius.md,
    minWidth: 52,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    gap: 2,
  },
  actionLabel: {
    color: "#FFFFFF",
    fontSize: 10,
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
});

function areEqual(prev: ReelItemProps, next: ReelItemProps) {
  return (
    prev.item.id === next.item.id &&
    prev.width === next.width &&
    prev.height === next.height &&
    prev.isActive === next.isActive &&
    prev.isMuted === next.isMuted &&
    prev.shouldPreload === next.shouldPreload &&
    prev.shouldKeepInMemory === next.shouldKeepInMemory &&
    prev.liked === next.liked &&
    prev.likeCount === next.likeCount
  );
}

export const ReelItem = React.memo(ReelItemBase, areEqual);
