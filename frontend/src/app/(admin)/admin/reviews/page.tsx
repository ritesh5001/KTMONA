"use client";

import * as React from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Eye, EyeOff, MessageSquareText, Pencil, Plus, Star, Trash2, X } from "lucide-react";
import { getAdminReviews, type AdminReview } from "@/services/admin";
import {
  adminCenter,
  type AdminReviewInput,
  type ManagedReview,
  type ReviewProductDetail,
  type ReviewProductRow,
} from "@/services/admin-center";
import {
  Badge,
  Btn,
  Empty,
  ErrorNote,
  Field,
  Loading,
  Modal,
  PageHeader,
  PageShell,
  Panel,
  SearchBox,
  Thumb,
  errorMessage,
  inputCls,
  useDebounced,
} from "@/components/seller/kit";
import { cn } from "@/lib/utils";

/** The review being edited (with its product), or a new one for a product. */
type Editing = { productId: string; review: (Partial<ManagedReview> & { id?: string }) | null } | null;

export default function AdminReviewsPage() {
  const [productId, setProductId] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<Editing>(null);
  const all = useSWR("admin-reviews-all", () => getAdminReviews());
  const detail = useSWR(productId ? ["admin-review-product", productId] : null, () => adminCenter.reviewProduct(productId!));

  const refresh = () => {
    all.mutate();
    detail.mutate();
  };

  return (
    <PageShell>
      <PageHeader
        title="Ratings & Reviews"
        description="Set the rating, review count and “people viewed” number shoppers see on a product, and add or edit its reviews."
      />

      <ProductPicker selectedId={productId} onSelect={setProductId} />

      {productId ? (
        detail.error && !detail.data ? (
          <ErrorNote message={errorMessage(detail.error)} onRetry={() => detail.mutate()} />
        ) : !detail.data ? (
          <Loading rows={4} />
        ) : (
          <ProductManager
            key={detail.data.product.id}
            data={detail.data}
            onChange={(d) => {
              detail.mutate(d, { revalidate: false });
              all.mutate();
            }}
            onClose={() => setProductId(null)}
            onAdd={() => setEditing({ productId, review: null })}
            onEdit={(r) => setEditing({ productId, review: r })}
            onRefresh={refresh}
          />
        )
      ) : null}

      <AllReviews
        reviews={all.data?.reviews ?? []}
        loading={!all.data && !all.error}
        error={all.error && !all.data ? errorMessage(all.error) : null}
        onRetry={() => all.mutate()}
        onOpenProduct={setProductId}
        onEdit={(r) =>
          setEditing({
            productId: r.product.id,
            review: { id: r.id, rating: r.rating, title: r.title ?? null, text: r.text, createdAt: r.createdAt, authorName: r.authorName ?? r.user?.fullName ?? "" },
          })
        }
        onRefresh={refresh}
      />

      <ReviewDialog
        editing={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          refresh();
        }}
      />
    </PageShell>
  );
}

function ProductPicker({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string) => void }) {
  const [search, setSearch] = React.useState("");
  const debounced = useDebounced(search);
  const { data, isLoading } = useSWR(["admin-review-products", debounced], () => adminCenter.reviewProducts(debounced));
  const products = data?.products ?? [];

  return (
    <Panel title="Choose a product">
      <div className="sm:w-96">
        <SearchBox value={search} onChange={setSearch} placeholder="Search by product name or ID" />
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {isLoading && !data ? (
          <p className="text-sm text-muted-foreground">Loading products…</p>
        ) : products.length === 0 ? (
          <p className="text-sm text-muted-foreground">No products match.</p>
        ) : (
          products.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelect(p.id)}
              className={cn(
                "flex items-center gap-3 rounded-xl border p-2.5 text-left transition hover:border-brand/50 hover:bg-mist",
                selectedId === p.id ? "border-brand bg-brand/5" : "border-border-soft"
              )}
            >
              <Thumb src={p.image} alt={p.title} />
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 text-sm font-medium">{p.title}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{figuresLabel(p)}</span>
              </span>
            </button>
          ))
        )}
      </div>
    </Panel>
  );
}

function figuresLabel(p: ReviewProductRow) {
  if (p.displayRating == null && p.displayReviewCount == null && p.displayViewCount == null) return "Automatic figures";
  return [
    p.displayRating != null ? `★ ${p.displayRating.toFixed(1)}` : null,
    p.displayReviewCount != null ? `${p.displayReviewCount} reviews` : null,
    p.displayViewCount != null ? `${p.displayViewCount} views` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function ProductManager({
  data,
  onChange,
  onClose,
  onAdd,
  onEdit,
  onRefresh,
}: {
  data: ReviewProductDetail;
  onChange: (d: ReviewProductDetail) => void;
  onClose: () => void;
  onAdd: () => void;
  onEdit: (r: ManagedReview) => void;
  onRefresh: () => void;
}) {
  const { product, actual, reviews } = data;
  const str = (n: number | null) => (n == null ? "" : String(n));
  const [rating, setRating] = React.useState(str(product.displayRating));
  const [count, setCount] = React.useState(str(product.displayReviewCount));
  const [views, setViews] = React.useState(str(product.displayViewCount));
  const [saving, setSaving] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  // The editor opens below the product list: bring it into view.
  React.useEffect(() => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const num = (v: string) => (v.trim() === "" ? null : Number(v));
  const ratingN = num(rating);
  const ratingError = ratingN != null && (Number.isNaN(ratingN) || ratingN < 1 || ratingN > 5) ? "Enter a rating from 1 to 5" : null;
  const countN = num(count);
  const viewsN = num(views);
  const intError = (n: number | null) => (n != null && (!Number.isInteger(n) || n < 0) ? "Enter a whole number" : null);

  const save = async (body: { displayRating: number | null; displayReviewCount: number | null; displayViewCount: number | null }) => {
    setSaving(true);
    try {
      const res = await adminCenter.setSocialProof(product.id, body);
      onChange(res);
      setRating(str(res.product.displayRating));
      setCount(str(res.product.displayReviewCount));
      setViews(str(res.product.displayViewCount));
      toast.success("Saved. Shoppers see the new figures within a few minutes.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div ref={ref} className="scroll-mt-20">
    <Panel
      title={
        <span className="flex items-center gap-3">
          <Thumb src={product.image} alt={product.title} />
          <span className="line-clamp-1">{product.title}</span>
        </span>
      }
      action={
        <Btn size="sm" variant="ghost" onClick={onClose} aria-label="Close product">
          <X className="h-4 w-4" />
        </Btn>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_1fr]">
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold">Figures shown to shoppers</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Leave a box empty for automatic: real reviews ({actual.reviewCount ? `★ ${actual.rating?.toFixed(1)} from ${actual.reviewCount}` : "none yet"}), otherwise a default.
            </p>
          </div>
          <Field label="Rating (1–5)" error={ratingError}>
            <input type="number" min={1} max={5} step={0.1} className={inputCls} value={rating} onChange={(e) => setRating(e.target.value)} placeholder="Automatic" />
          </Field>
          <Field label="Number of reviews" error={intError(countN)}>
            <input type="number" min={0} step={1} className={inputCls} value={count} onChange={(e) => setCount(e.target.value)} placeholder="Automatic" />
          </Field>
          <Field label="People viewed recently" error={intError(viewsN)}>
            <input type="number" min={0} step={1} className={inputCls} value={views} onChange={(e) => setViews(e.target.value)} placeholder="Automatic" />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Btn
              variant="brand"
              loading={saving}
              disabled={!!ratingError || !!intError(countN) || !!intError(viewsN)}
              onClick={() => save({ displayRating: ratingN, displayReviewCount: countN, displayViewCount: viewsN })}
            >
              Save figures
            </Btn>
            <Btn variant="outline" disabled={saving} onClick={() => save({ displayRating: null, displayReviewCount: null, displayViewCount: null })}>
              Reset to automatic
            </Btn>
          </div>
        </div>

        <div className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold">Reviews ({reviews.length})</p>
            <Btn size="sm" variant="brand" onClick={onAdd}>
              <Plus className="h-4 w-4" /> Add review
            </Btn>
          </div>
          {reviews.length === 0 ? (
            <Empty icon={MessageSquareText} title="No reviews yet" text="Add one with any reviewer name, rating and date." />
          ) : (
            <ul className="space-y-3">
              {reviews.map((r) => (
                <ReviewItem
                  key={r.id}
                  review={{ id: r.id, rating: r.rating, title: r.title, text: r.text, createdAt: r.createdAt, isHidden: r.isHidden, name: r.authorName, sub: r.addedByAdmin ? "Added by admin" : r.customerEmail ?? "Customer" }}
                  onEdit={() => onEdit(r)}
                  onRefresh={onRefresh}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </Panel>
    </div>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-amber-500" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cn("h-3.5 w-3.5", i <= value ? "fill-current" : "text-border-strong")} />
      ))}
    </span>
  );
}

function ReviewItem({
  review,
  product,
  onOpenProduct,
  onEdit,
  onRefresh,
}: {
  review: { id: string; rating: number; title: string | null; text: string; createdAt: string; isHidden: boolean; name: string; sub: string };
  product?: { id: string; title: string };
  onOpenProduct?: (id: string) => void;
  onEdit: () => void;
  onRefresh: () => void;
}) {
  const [busy, setBusy] = React.useState(false);
  const run = async (fn: () => Promise<unknown>, message: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(message);
      onRefresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className={cn("rounded-xl border border-border-soft p-4", review.isHidden && "opacity-60")}>
      {product ? (
        <button type="button" onClick={() => onOpenProduct?.(product.id)} className="mb-2 line-clamp-1 text-left text-sm font-semibold text-brand-strong hover:underline">
          {product.title}
        </button>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Stars value={review.rating} />
        <span className="text-sm font-medium">{review.name}</span>
        <span className="text-xs text-muted-foreground">· {review.sub} · {new Date(review.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
        {review.isHidden ? <Badge tone="gray">Hidden</Badge> : null}
      </div>
      {review.title ? <p className="mt-2 text-sm font-semibold">{review.title}</p> : null}
      <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{review.text}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Btn size="sm" variant="outline" disabled={busy} onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" /> Edit
        </Btn>
        <Btn size="sm" variant="outline" disabled={busy} onClick={() => run(() => adminCenter.setReviewHidden(review.id, !review.isHidden), review.isHidden ? "Review shown" : "Review hidden")}>
          {review.isHidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />} {review.isHidden ? "Show" : "Hide"}
        </Btn>
        <Btn
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => {
            if (window.confirm("Delete this review permanently?")) void run(() => adminCenter.deleteReview(review.id), "Review deleted");
          }}
        >
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </Btn>
      </div>
    </li>
  );
}

function AllReviews({
  reviews,
  loading,
  error,
  onRetry,
  onOpenProduct,
  onEdit,
  onRefresh,
}: {
  reviews: AdminReview[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onOpenProduct: (id: string) => void;
  onEdit: (r: AdminReview) => void;
  onRefresh: () => void;
}) {
  const [query, setQuery] = React.useState("");
  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return reviews;
    return reviews.filter((r) =>
      [r.product?.title, r.user?.email, r.authorName, r.user?.fullName, r.title, r.text, String(r.rating)].filter(Boolean).join(" ").toLowerCase().includes(needle)
    );
  }, [reviews, query]);

  return (
    <Panel title="All reviews" action={<div className="w-56 sm:w-72"><SearchBox value={query} onChange={setQuery} placeholder="Search reviews" /></div>}>
      {error ? (
        <ErrorNote message={error} onRetry={onRetry} />
      ) : loading ? (
        <Loading rows={4} />
      ) : filtered.length === 0 ? (
        <Empty icon={MessageSquareText} title="No reviews found" />
      ) : (
        <ul className="space-y-3">
          {filtered.map((r) => (
            <ReviewItem
              key={r.id}
              product={r.product}
              onOpenProduct={onOpenProduct}
              review={{
                id: r.id,
                rating: r.rating,
                title: r.title ?? null,
                text: r.text,
                createdAt: r.createdAt,
                isHidden: !!r.isHidden,
                name: r.authorName ?? r.user?.fullName ?? "Anonymous",
                sub: r.authorName ? "Added by admin" : r.user?.email ?? "Customer",
              }}
              onEdit={() => onEdit(r)}
              onRefresh={onRefresh}
            />
          ))}
        </ul>
      )}
    </Panel>
  );
}

function ReviewDialog({ editing, onClose, onSaved }: { editing: Editing; onClose: () => void; onSaved: () => void }) {
  const isNew = !editing?.review?.id;
  const [form, setForm] = React.useState({ authorName: "", rating: 5, title: "", text: "", date: "" });
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!editing) return;
    const r = editing.review;
    setForm({
      authorName: r?.authorName ?? "",
      rating: r?.rating ?? 5,
      title: r?.title ?? "",
      text: r?.text ?? "",
      date: (r?.createdAt ? new Date(r.createdAt) : new Date()).toISOString().slice(0, 10),
    });
  }, [editing]);

  const valid = form.authorName.trim() && form.text.trim() && form.rating >= 1 && form.rating <= 5;

  const save = async () => {
    if (!editing || !valid) return;
    setSaving(true);
    // Keep the time of day when only the date is unchanged; otherwise midday.
    const original = editing.review?.createdAt ? new Date(editing.review.createdAt) : null;
    const createdAt =
      original && original.toISOString().slice(0, 10) === form.date ? original.toISOString() : new Date(`${form.date}T12:00:00`).toISOString();
    const body: AdminReviewInput = {
      authorName: form.authorName.trim(),
      rating: form.rating,
      title: form.title.trim() || null,
      text: form.text.trim(),
      createdAt,
    };
    try {
      if (isNew) await adminCenter.createReview({ ...body, productId: editing.productId });
      else await adminCenter.updateReview(editing.review!.id!, body);
      toast.success(isNew ? "Review added" : "Review updated");
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={!!editing}
      onClose={onClose}
      title={isNew ? "Add review" : "Edit review"}
      footer={
        <>
          <Btn variant="outline" onClick={onClose}>Cancel</Btn>
          <Btn variant="brand" loading={saving} disabled={!valid} onClick={save}>{isNew ? "Add review" : "Save changes"}</Btn>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Reviewer name">
          <input className={inputCls} value={form.authorName} onChange={(e) => setForm({ ...form, authorName: e.target.value })} placeholder="e.g. Priya S." maxLength={80} />
        </Field>
        <Field label="Rating">
          <div className="flex gap-1" role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((i) => (
              <button key={i} type="button" role="radio" aria-checked={form.rating === i} aria-label={`${i} star${i > 1 ? "s" : ""}`} onClick={() => setForm({ ...form, rating: i })} className="p-1">
                <Star className={cn("h-7 w-7 text-amber-500", i <= form.rating ? "fill-current" : "text-border-strong")} />
              </button>
            ))}
          </div>
        </Field>
        <Field label="Title (optional)">
          <input className={inputCls} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={150} />
        </Field>
        <Field label="Review">
          <textarea className={cn(inputCls, "min-h-28 py-2")} value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} maxLength={3000} />
        </Field>
        <Field label="Review date">
          <input type="date" className={inputCls} value={form.date} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}
