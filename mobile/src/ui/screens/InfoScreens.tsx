import * as React from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View, type TextInputProps } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { useToast } from "../../providers/ToastProvider";
import { useAuth } from "../../hooks/useAuth";
import { C, F, S } from "../theme";
import { EmptyState, PrimaryBtn, ScreenHeader, Sheet, T } from "../kit";
import { useT } from "../../i18n";
import { JOB_TYPE_LABEL, applyForJob, listJobs, sendInvestorInquiry, type JobOpening } from "../../services/extras";
import { BLOG_POSTS } from "../../data/blog";

function Input({ label, ...props }: TextInputProps & { label: string }) {
  const t = useT();
  return (
    <View style={{ marginTop: 12 }}>
      <T w="medium" size={13} color={C.textSoft}>{label}</T>
      <TextInput placeholderTextColor={C.faint} {...props} placeholder={props.placeholder ? t(props.placeholder) : undefined} style={[styles.input, props.multiline && { minHeight: 90, textAlignVertical: "top" }]} />
    </View>
  );
}

/* ── Careers ────────────────────────────────────────────────────────────── */

export function CareersScreen() {
  const q = useQuery({ queryKey: ["site", "careers"], queryFn: ({ signal }) => listJobs(signal), staleTime: 10 * 60 * 1000 });
  const [applyFor, setApplyFor] = React.useState<JobOpening | "general" | null>(null);
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const jobs = q.data ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScreenHeader title="Careers" />
      <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
        <View style={styles.hero}>
          <T w="bold" size={10} color={C.brand} style={{ letterSpacing: 2 }}>CAREERS AT KTMONA</T>
          <T w="bold" size={20} color={C.white} style={{ marginTop: 6 }}>Build the marketplace India can trust.</T>
          <T size={13} color="#D7DCEB" style={{ marginTop: 6 }}>{"We help small businesses and home sellers sell online with confidence. If you care about sellers, shoppers and getting the details right, we'd love to hear from you."}</T>
        </View>
        <T w="semibold" size={16} style={{ paddingHorizontal: S.page, marginTop: 16, marginBottom: 8 }}>Open positions</T>
        {q.isLoading ? (
          <ActivityIndicator color={C.brand} style={{ marginTop: 20 }} />
        ) : jobs.length === 0 ? (
          <View style={[styles.card, { marginHorizontal: S.page }]}>
            <T w="semibold" size={14}>No open positions right now</T>
            <T size={13} color={C.muted} style={{ marginTop: 4 }}>{"We are always happy to meet good people. Send us your CV and we'll reach out when a role fits."}</T>
          </View>
        ) : (
          jobs.map((job) => {
            const open = expanded === job.id;
            return (
              <View key={job.id} style={[styles.card, { marginHorizontal: S.page, marginBottom: 8 }]}>
                <T w="semibold" size={15}>{job.title}</T>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 4 }}>
                  {job.department ? <Meta icon="briefcase" text={job.department} /> : null}
                  {job.location ? <Meta icon="map-pin" text={job.location} /> : null}
                  <Meta icon="clock" text={JOB_TYPE_LABEL[job.type] ?? job.type} />
                </View>
                <T size={13} color={C.textSoft} numberOfLines={open ? undefined : 3} style={{ marginTop: 8 }}>{job.description}</T>
                {job.description.length > 160 ? (
                  <Pressable onPress={() => setExpanded(open ? null : job.id)} style={{ marginTop: 4 }}>
                    <T w="semibold" size={12} color={C.brandDark}>{open ? "Show less" : "Read more"}</T>
                  </Pressable>
                ) : null}
                <PrimaryBtn label="Apply now" onPress={() => setApplyFor(job)} style={{ marginTop: 12 }} />
              </View>
            );
          })
        )}
        <View style={[styles.card, { marginHorizontal: S.page, marginTop: 8, backgroundColor: C.navy }]}>
          <T w="semibold" size={14} color={C.white}>{"Don't see the right role?"}</T>
          <T size={12} color="#D7DCEB" style={{ marginTop: 2 }}>{"Send a general application and we'll keep you in mind."}</T>
          <PrimaryBtn label="Send your CV" variant="outline" onPress={() => setApplyFor("general")} style={{ marginTop: 12, backgroundColor: C.white }} />
        </View>
      </ScrollView>
      <ApplySheet target={applyFor} onClose={() => setApplyFor(null)} />
    </View>
  );
}

function Meta({ icon, text }: { icon: React.ComponentProps<typeof Feather>["name"]; text: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <Feather name={icon} size={12} color={C.muted} />
      <T size={12} color={C.muted}>{text}</T>
    </View>
  );
}

function ApplySheet({ target, onClose }: { target: JobOpening | "general" | null; onClose: () => void }) {
  const t = useT();
  const { showToast } = useToast();
  const { session } = useAuth();
  const [f, setF] = React.useState({ name: "", email: "", phone: "", resumeUrl: "", message: "" });
  const [sending, setSending] = React.useState(false);

  React.useEffect(() => {
    if (!target) return;
    const user = session?.user as { fullName?: string; email?: string | null; phone?: string | null } | undefined;
    setF({ name: user?.fullName ?? "", email: user?.email ?? "", phone: user?.phone ?? "", resumeUrl: "", message: "" });
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps

  const job = target && target !== "general" ? target : null;
  const valid = f.name.trim().length >= 2 && /\S+@\S+\.\S+/.test(f.email);

  const submit = async () => {
    if (!valid) {
      showToast(t("Enter your name and email"), "info");
      return;
    }
    setSending(true);
    try {
      const message = await applyForJob({
        jobId: job?.id ?? null,
        name: f.name.trim(),
        email: f.email.trim(),
        phone: f.phone.trim() || null,
        resumeUrl: f.resumeUrl.trim() || null,
        message: f.message.trim() || null,
      });
      showToast(message, "success");
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("Could not send your application"), "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <Sheet open={Boolean(target)} title={job ? `${t("Apply")}: ${job.title}` : "General application"} onClose={onClose}>
      <ScrollView style={{ maxHeight: 480 }} contentContainerStyle={{ paddingHorizontal: 16 }} keyboardShouldPersistTaps="handled">
        <Input label="Full name" value={f.name} onChangeText={(v) => setF((p) => ({ ...p, name: v }))} autoCapitalize="words" />
        <Input label="Email" value={f.email} onChangeText={(v) => setF((p) => ({ ...p, email: v }))} keyboardType="email-address" autoCapitalize="none" />
        <Input label="Mobile (optional)" value={f.phone} onChangeText={(v) => setF((p) => ({ ...p, phone: v }))} keyboardType="phone-pad" />
        <Input label="Link to your CV (optional)" value={f.resumeUrl} onChangeText={(v) => setF((p) => ({ ...p, resumeUrl: v }))} placeholder="Google Drive / LinkedIn link" autoCapitalize="none" keyboardType="url" />
        <Input label="Why you'd be a great fit (optional)" value={f.message} onChangeText={(v) => setF((p) => ({ ...p, message: v }))} multiline />
      </ScrollView>
      <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
        <PrimaryBtn label="Send application" loading={sending} onPress={() => void submit()} />
      </View>
    </Sheet>
  );
}

/* ── Investors ──────────────────────────────────────────────────────────── */

const PILLARS: { icon: React.ComponentProps<typeof Feather>["name"]; title: string; text: string }[] = [
  { icon: "shopping-bag", title: "Multi-vendor marketplace", text: "Independent sellers, resellers and home businesses across India list their products on one platform." },
  { icon: "check-circle", title: "Verified at every step", text: "Every seller is approved by our team and every product passes catalog QC before it goes live." },
  { icon: "lock", title: "KTMONA Price Lock", text: "Sellers commit to their lowest market price, giving shoppers a clear reason to buy on KTMONA." },
  { icon: "truck", title: "End-to-end commerce", text: "Secure payments, tracked shipping, easy returns and seller payouts handled on the platform." },
];

export function InvestorsScreen() {
  const t = useT();
  const { showToast } = useToast();
  const [f, setF] = React.useState({ name: "", email: "", phone: "", organization: "", message: "" });
  const [sending, setSending] = React.useState(false);
  const [sent, setSent] = React.useState<string | null>(null);

  const submit = async () => {
    if (f.name.trim().length < 2 || !/\S+@\S+\.\S+/.test(f.email) || f.message.trim().length < 10) {
      showToast(t("Enter your name, email and a short message"), "info");
      return;
    }
    setSending(true);
    try {
      setSent(
        await sendInvestorInquiry({
          name: f.name.trim(),
          email: f.email.trim(),
          phone: f.phone.trim() || null,
          organization: f.organization.trim() || null,
          message: f.message.trim(),
        })
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("Could not send your enquiry"), "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScreenHeader title="Investors" />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <T w="bold" size={10} color={C.brand} style={{ letterSpacing: 2 }}>INVESTOR RELATIONS</T>
          <T w="bold" size={20} color={C.white} style={{ marginTop: 6 }}>Invest in a marketplace built on trust.</T>
          <T size={13} color="#D7DCEB" style={{ marginTop: 6 }}>KTMONA gives every seller in India a simple, transparent way to sell online, and every customer a marketplace they can trust with each click.</T>
        </View>
        <View style={{ padding: S.page, gap: 8 }}>
          {PILLARS.map((p) => (
            <View key={p.title} style={[styles.card, { flexDirection: "row", gap: 12 }]}>
              <Feather name={p.icon} size={20} color={C.brandDark} />
              <View style={{ flex: 1 }}>
                <T w="semibold" size={14}>{p.title}</T>
                <T size={12} color={C.muted} style={{ marginTop: 2 }}>{p.text}</T>
              </View>
            </View>
          ))}
        </View>
        <View style={[styles.card, { marginHorizontal: S.page }]}>
          <T w="semibold" size={15}>Send an enquiry</T>
          {sent ? (
            <View style={{ marginTop: 10 }}>
              <T w="semibold" size={14} color={C.green}>Enquiry sent</T>
              <T size={13} color={C.textSoft} style={{ marginTop: 4 }}>{sent}</T>
            </View>
          ) : (
            <>
              <Input label="Full name" value={f.name} onChangeText={(v) => setF((p) => ({ ...p, name: v }))} autoCapitalize="words" />
              <Input label="Email" value={f.email} onChangeText={(v) => setF((p) => ({ ...p, email: v }))} keyboardType="email-address" autoCapitalize="none" />
              <Input label="Mobile (optional)" value={f.phone} onChangeText={(v) => setF((p) => ({ ...p, phone: v }))} keyboardType="phone-pad" />
              <Input label="Fund / organisation (optional)" value={f.organization} onChangeText={(v) => setF((p) => ({ ...p, organization: v }))} />
              <Input label="Message" value={f.message} onChangeText={(v) => setF((p) => ({ ...p, message: v }))} multiline />
              <PrimaryBtn label="Send enquiry" loading={sending} onPress={() => void submit()} style={{ marginTop: 14 }} />
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

/* ── Blog ───────────────────────────────────────────────────────────────── */

export function BlogListScreen() {
  const router = useRouter();
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScreenHeader title="KTMONA Blog" />
      <ScrollView contentContainerStyle={{ padding: S.page, gap: 8 }}>
        {BLOG_POSTS.length === 0 ? <EmptyState title="No posts yet" /> : null}
        {BLOG_POSTS.map((p) => (
          <Pressable key={p.slug} onPress={() => router.push(`/blog/${p.slug}` as never)} style={styles.card}>
            <T size={11} color={C.muted}>{new Date(p.date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })} · {p.author}</T>
            <T w="semibold" size={16} style={{ marginTop: 4 }}>{p.title}</T>
            <T size={13} color={C.textSoft} style={{ marginTop: 4 }}>{p.description}</T>
            <T w="semibold" size={12} color={C.brandDark} style={{ marginTop: 8 }}>Read article</T>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

export function BlogPostScreen({ slug }: { slug: string }) {
  const post = BLOG_POSTS.find((p) => p.slug === slug);
  if (!post) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <ScreenHeader title="Blog" />
        <EmptyState title="Article not found" />
      </View>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: C.card }}>
      <ScreenHeader title="KTMONA Blog" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <T size={11} color={C.muted}>{new Date(post.date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })} · {post.author}</T>
        <T w="bold" size={22} style={{ marginTop: 6 }}>{post.title}</T>
        {post.blocks.map((b, i) =>
          b.type === "h2" ? (
            <T key={i} w="semibold" size={17} style={{ marginTop: 18 }}>{b.text}</T>
          ) : (
            <T key={i} size={14} color={C.textSoft} style={{ marginTop: 10, lineHeight: 22 }}>{b.text}</T>
          )
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: C.navy, padding: 16 },
  card: { backgroundColor: C.card, borderRadius: 12, padding: 14 },
  input: { marginTop: 6, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontFamily: F.regular, fontSize: 14, color: C.text, backgroundColor: C.card },
});
