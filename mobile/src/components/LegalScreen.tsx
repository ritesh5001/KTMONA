import * as React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Linking } from "react-native";
import { AppHeader } from "./AppHeader";
import { colors, radius, spacing, typography, shadow } from "../theme/tokens";
import { ScreenContainer as SafeAreaView } from "./ScreenContainer";

export interface LegalSection {
  title: string;
  body: string;
}

interface LegalScreenProps {
  title: string;
  subtitle?: string;
  intro: string;
  sections: LegalSection[];
  updatedAt: string;
  websiteUrl?: string;
}

export function LegalScreen({
  title,
  subtitle = "KTMONA",
  intro,
  sections,
  updatedAt,
  websiteUrl = "https://www.ktmona.com",
}: LegalScreenProps) {
  const handleExternalLink = React.useCallback((url: string) => {
    Linking.openURL(url);
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <AppHeader title={title} subtitle={subtitle} showBack />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.copy}>{intro}</Text>

          {sections.map((section) => (
            <View key={section.title} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text style={styles.copy}>{section.body}</Text>
            </View>
          ))}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Learn more</Text>
            <Pressable
              style={styles.linkButton}
              onPress={() => handleExternalLink(websiteUrl)}
            >
              <Text style={styles.linkText}>www.ktmona.com</Text>
            </Pressable>
          </View>

          <Text style={styles.updated}>Last updated: {updatedAt}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  card: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    backgroundColor: colors.warmWhite,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    ...shadow.card,
  },
  title: {
    fontFamily: typography.serif,
    fontSize: 24,
    color: colors.charcoal,
  },
  copy: {
    marginTop: spacing.sm,
    fontFamily: typography.sans,
    fontSize: 13,
    lineHeight: 20,
    color: colors.brownSoft,
  },
  section: {
    marginTop: spacing.md,
  },
  sectionTitle: {
    fontFamily: typography.sansMedium,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.charcoal,
  },
  linkButton: {
    marginTop: spacing.sm,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    backgroundColor: colors.warmWhite,
  },
  linkText: {
    fontFamily: typography.sansMedium,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.charcoal,
  },
  updated: {
    marginTop: spacing.lg,
    fontFamily: typography.sans,
    fontSize: 11,
    color: colors.brownSoft,
  },
});
