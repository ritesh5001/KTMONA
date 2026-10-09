"use client";

import * as React from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { siteApi, type SiteLinks } from "@/services/platform";
import { Btn, ErrorNote, Field, Loading, PageHeader, PageShell, Panel, errorMessage, inputCls } from "@/components/seller/kit";

const FIELDS: { key: keyof SiteLinks; label: string; hint: string; placeholder: string }[] = [
  {
    key: "playStoreUrl",
    label: "Google Play Store link",
    hint: "Leave empty until the app is published: the Download App buttons then show “Coming soon”.",
    placeholder: "https://play.google.com/store/apps/details?id=com.ktmona.app",
  },
  { key: "appStoreUrl", label: "Apple App Store link", hint: "Leave empty if there is no iPhone app yet.", placeholder: "https://apps.apple.com/…" },
  { key: "facebookUrl", label: "Facebook page", hint: "Shown under “Follow Us” in the website footer.", placeholder: "https://www.facebook.com/…" },
  { key: "instagramUrl", label: "Instagram profile", hint: "Shown under “Follow Us” in the website footer.", placeholder: "https://www.instagram.com/ktmona" },
  { key: "youtubeUrl", label: "YouTube channel", hint: "Leave empty to hide YouTube until the channel exists.", placeholder: "https://www.youtube.com/@ktmona" },
];

export default function SiteLinksPage() {
  const { data, error, isLoading, mutate } = useSWR("admin-site-links", siteApi.admin.links);
  const [f, setF] = React.useState<Record<keyof SiteLinks, string>>({
    playStoreUrl: "",
    appStoreUrl: "",
    facebookUrl: "",
    instagramUrl: "",
    youtubeUrl: "",
  });
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!data) return;
    setF({
      playStoreUrl: data.playStoreUrl ?? "",
      appStoreUrl: data.appStoreUrl ?? "",
      facebookUrl: data.facebookUrl ?? "",
      instagramUrl: data.instagramUrl ?? "",
      youtubeUrl: data.youtubeUrl ?? "",
    });
  }, [data]);

  const save = async () => {
    setSaving(true);
    try {
      await mutate(siteApi.admin.saveLinks(f), { revalidate: false });
      toast.success("Links saved. The website shows them within a few minutes.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageShell>
      <PageHeader
        title="App & Social Links"
        description="Where the website's Download App buttons, the app pop-up and the Follow Us icons point to."
        actions={<Btn variant="brand" loading={saving} disabled={!data} onClick={save}>Save links</Btn>}
      />
      {error && !data ? (
        <ErrorNote message={errorMessage(error)} onRetry={() => mutate()} />
      ) : isLoading && !data ? (
        <Loading />
      ) : (
        <Panel>
          <div className="grid gap-5 md:grid-cols-2">
            {FIELDS.map((field) => (
              <Field key={field.key} label={field.label} hint={field.hint}>
                <input
                  className={inputCls}
                  type="url"
                  value={f[field.key]}
                  placeholder={field.placeholder}
                  onChange={(e) => setF((p) => ({ ...p, [field.key]: e.target.value }))}
                />
              </Field>
            ))}
          </div>
        </Panel>
      )}
    </PageShell>
  );
}
