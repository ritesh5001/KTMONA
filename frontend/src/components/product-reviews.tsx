"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Image as ImageIcon, X, ThumbsUp, ChevronLeft, ChevronRight, BadgeCheck, Flag, Store } from "lucide-react";
import ImageKit from "imagekit-javascript";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import {
  fetchProductReviews,
  submitProductReview,
  markReviewHelpful,
  getReviewEligibility,
  getMyHelpfulVotes,
  reportReview,
  REVIEW_REPORT_REASONS,
  type Review,
  type ReviewEligibility,
  type ReviewSummary,
} from "@/services/reviews";
import { toast } from "sonner";
import Image from "next/image";
import { compressImageForUpload } from "@/lib/image-compression";

const IMAGEKIT_PUBLIC_KEY = process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY;
const IMAGEKIT_URL_ENDPOINT = process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT;
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const MAX_REVIEW_IMAGES = 5;
const MAX_REVIEW_IMAGE_BYTES = 2 * 1024 * 1024;

interface ProductReviewsProps {
    productId: string;
}

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "highest", label: "Highest Rated" },
  { value: "lowest", label: "Lowest Rated" },
  { value: "helpful", label: "Most Helpful" },
];

export default function ProductReviews({ productId }: ProductReviewsProps) {
    const { user, token } = useAuth();
    const [reviews, setReviews] = useState<Review[]>([]);
    const [summary, setSummary] = useState<ReviewSummary | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Pagination & sort
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [sort, setSort] = useState("newest");

    // Form state
    const [rating, setRating] = useState(0);
    const [title, setTitle] = useState("");
    const [comment, setComment] = useState("");
    const [images, setImages] = useState<string[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [sellerRating, setSellerRating] = useState(0);
    const [eligibility, setEligibility] = useState<ReviewEligibility | null>(null);
    const [voted, setVoted] = useState<Set<string>>(new Set());
    const [reportingId, setReportingId] = useState<string | null>(null);
    const [reportReason, setReportReason] = useState<string>(REVIEW_REPORT_REASONS[0].value);
    const [reported, setReported] = useState<Set<string>>(new Set());

    const imagekit = useMemo(() => {
        if (!IMAGEKIT_PUBLIC_KEY || !IMAGEKIT_URL_ENDPOINT || !API_BASE_URL) {
            return null;
        }
        return new ImageKit({
            publicKey: IMAGEKIT_PUBLIC_KEY,
            urlEndpoint: IMAGEKIT_URL_ENDPOINT,
        });
    }, []);

    // `silent` reconciles in the background without dropping the list back to a
    // loading state — used after a submit has already rendered the new review.
    const loadReviews = useCallback(async (silent = false) => {
        if (!silent) setIsLoading(true);
        try {
            const data = await fetchProductReviews(productId, { page, limit: 10, sort });
            setReviews(data.reviews ?? []);
            setSummary(data.summary ?? null);
            setTotalPages(Math.max(1, data.pagination?.totalPages ?? 1));
        } catch (error) {
            console.error("Failed to load reviews", error);
        } finally {
            if (!silent) setIsLoading(false);
        }
    }, [productId, page, sort]);

    useEffect(() => {
        loadReviews();
    }, [loadReviews]);

    // Only customers who received this product can review it.
    useEffect(() => {
        if (!user || user.role !== "USER") return;
        getReviewEligibility(productId).then(setEligibility).catch(() => setEligibility(null));
    }, [productId, user]);

    // Highlight the reviews this customer already found helpful.
    const reviewIdsKey = reviews.map((r) => r.id).join(",");
    useEffect(() => {
        if (!token || !reviewIdsKey) return;
        getMyHelpfulVotes(reviewIdsKey.split(",")).then((r) => setVoted(new Set(r.reviewIds))).catch(() => undefined);
    }, [token, reviewIdsKey]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!token) {
            toast.error("Please login to submit a review");
            return;
        }

        if (rating === 0) {
            toast.error("Please select a rating");
            return;
        }

        if (comment.trim().length < 10) {
            toast.error("Please write at least 10 characters about the product");
            return;
        }

        setIsSubmitting(true);
        try {
            const { review } = await submitProductReview(
                productId,
                {
                    rating,
                    text: comment.trim(),
                    title: title.trim() || undefined,
                    images,
                    ...(sellerRating ? { sellerRating } : {}),
                },
                token
            );

            toast.success("Review submitted successfully");
            setEligibility({ canReview: false, alreadyReviewed: true, reason: "You have already reviewed this product." });
            setSellerRating(0);
            setShowForm(false);
            setRating(0);
            setTitle("");
            setComment("");
            setImages([]);

            if (page === 1 && sort === "newest") {
                // Already looking at the newest page — show the review straight
                // away and let the refetch reconcile in the background.
                setReviews((prev) => [review, ...prev]);
                setSummary((prev) =>
                    prev
                        ? {
                            ...prev,
                            totalReviews: prev.totalReviews + 1,
                            ratingDistribution: {
                                ...prev.ratingDistribution,
                                [review.rating]:
                                    (prev.ratingDistribution[review.rating] ?? 0) + 1,
                            },
                        }
                        : prev
                );
                loadReviews(true);
            } else {
                // Jump to where the new review lives; the effect refetches.
                setSort("newest");
                setPage(1);
            }
        } catch (error: any) {
            toast.error(error.message || "Failed to submit review");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleHelpful = async (reviewId: string) => {
        if (!token) {
            toast.error("Please login to mark as helpful");
            return;
        }
        try {
            const result = await markReviewHelpful(reviewId, token);
            setReviews((prev) =>
                prev.map((r) =>
                    r.id === reviewId ? { ...r, helpfulCount: result.helpfulCount } : r
                )
            );
            setVoted((prev) => {
                const next = new Set(prev);
                if (result.voted) next.add(reviewId);
                else next.delete(reviewId);
                return next;
            });
        } catch (error: any) {
            toast.error(error.message || "Failed to mark as helpful");
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const input = e.currentTarget;
        const files = Array.from(input.files ?? []);
        if (files.length === 0) return;

        if (images.length + files.length > MAX_REVIEW_IMAGES) {
            input.value = "";
            toast.error(`Maximum ${MAX_REVIEW_IMAGES} images allowed`);
            return;
        }

        const oversized = files.find((file) => file.size > MAX_REVIEW_IMAGE_BYTES);
        if (oversized) {
            input.value = "";
            toast.error(`Image ${oversized.name} exceeds 2MB limit`);
            return;
        }

        if (!imagekit) {
            input.value = "";
            toast.error("Image uploads are not configured.");
            return;
        }

        setIsUploading(true);
        try {
            const authResponse = await fetch(`${API_BASE_URL}/v1/imagekit/auth`);
            if (!authResponse.ok) {
                const authData = await authResponse.json().catch(() => null);
                toast.error(authData?.message ?? "Image upload authorization failed.");
                return;
            }

            const authData = (await authResponse.json()) as {
                signature: string;
                token: string;
                expire: number;
            };

            const uploaded = await Promise.all(
                files.map(async (file) => {
                    const compressed = await compressImageForUpload(file);
                    const result = await imagekit.upload({
                        file: compressed,
                        fileName: compressed.name,
                        folder: "/ktmona/reviews",
                        useUniqueFileName: true,
                        signature: authData.signature,
                        token: authData.token,
                        expire: authData.expire,
                    });
                    return result.url;
                })
            );

            setImages((prev) => [...prev, ...uploaded].slice(0, MAX_REVIEW_IMAGES));
        } catch (error) {
            toast.error(
                error instanceof Error ? error.message : "Image upload failed"
            );
        } finally {
            setIsUploading(false);
            input.value = "";
        }
    };

    const removeImage = (index: number) => {
        setImages(images.filter((_, i) => i !== index));
    };

    const canReview = Boolean(user && user.role === "USER" && eligibility?.canReview);

    const submitReport = async (reviewId: string) => {
        if (!token) {
            toast.error("Please login to report a review");
            return;
        }
        try {
            await reportReview(reviewId, reportReason);
            setReported((prev) => new Set(prev).add(reviewId));
            setReportingId(null);
            toast.success("Thanks — our team will look at this review.");
        } catch (error: any) {
            toast.error(error.message || "Could not report the review");
        }
    };

    // Rating distribution bar
    const RatingBar = ({ star, count, total }: { star: number; count: number; total: number }) => {
        const pct = total > 0 ? (count / total) * 100 : 0;
        return (
            <div className="flex items-center gap-2 text-xs">
                <span className="w-4 text-right text-muted-foreground">{star}</span>
                <span className="text-yellow-400">★</span>
                <div className="flex-1 h-2 bg-muted/50 rounded-full overflow-hidden">
                    <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-6 text-right text-muted-foreground">{count}</span>
            </div>
        );
    };

    return (
        <div className="space-y-8 py-10" id="reviews">
            {/* Summary */}
            {summary && summary.totalReviews > 0 && (
                <div className="flex flex-col sm:flex-row gap-8 p-6 border rounded-lg bg-card">
                    <div className="flex flex-col items-center justify-center gap-1 min-w-30">
                        <p className="text-4xl font-light">{summary.averageRating.toFixed(1)}</p>
                        <div className="flex text-yellow-400 text-lg">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <span key={i}>{i < Math.round(summary.averageRating) ? "★" : "☆"}</span>
                            ))}
                        </div>
                        <p className="text-xs text-muted-foreground">{summary.totalReviews} reviews</p>
                        {summary.verifiedReviews ? (
                            <p className="flex items-center gap-1 text-[11px] text-emerald-700">
                                <BadgeCheck className="h-3.5 w-3.5" /> {summary.verifiedReviews} verified purchases
                            </p>
                        ) : null}
                    </div>
                    {summary.seller?.rating?.count ? (
                        <div className="flex min-w-36 flex-col justify-center gap-1 border-border-soft sm:border-l sm:pl-6">
                            <p className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground"><Store className="h-3.5 w-3.5" /> Seller rating</p>
                            <p className="text-2xl font-light">{summary.seller.rating.average?.toFixed(1)} <span className="text-base text-yellow-400">★</span></p>
                            <p className="text-xs text-muted-foreground">{summary.seller.name ?? "Seller"} · {summary.seller.rating.count} ratings</p>
                        </div>
                    ) : null}
                    <div className="flex-1 space-y-1.5">
                        {[5, 4, 3, 2, 1].map((star) => (
                            <RatingBar
                                key={star}
                                star={star}
                                count={summary.ratingDistribution[star] ?? 0}
                                total={summary.totalReviews}
                            />
                        ))}
                    </div>
                </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-serif text-2xl font-light text-foreground">
                    Customer Reviews ({summary?.totalReviews ?? reviews.length})
                </h3>
                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:gap-3">
                    <select
                        value={sort}
                        onChange={(e) => { setSort(e.target.value); setPage(1); }}
                        className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm sm:w-auto sm:flex-none"
                    >
                        {SORT_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                    {canReview && !showForm && (
                        <Button onClick={() => setShowForm(true)} variant="outline" className="w-full sm:w-auto">
                            Write a Review
                        </Button>
                    )}
                </div>
            </div>

            {!user && (
                <div className="text-sm text-muted-foreground p-4 bg-muted/50 rounded-lg">
                    Please <a href="/login" className="underline text-primary">login</a> to write a review.
                </div>
            )}

            {user && user.role === "USER" && eligibility && !eligibility.canReview && (
                <div className="text-sm text-muted-foreground p-4 bg-muted/50 rounded-lg">
                    {eligibility.reason}
                </div>
            )}

            {user && user.role !== "USER" && (
                <div className="text-sm text-yellow-600 p-4 bg-yellow-50 rounded-lg">
                    Sellers and Admins cannot submit reviews.
                </div>
            )}

            {showForm && (
                <form onSubmit={handleSubmit} className="border p-6 rounded-lg space-y-6 bg-card">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Rating</label>
                        <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    type="button"
                                    onClick={() => setRating(star)}
                                    className={`text-2xl ${rating >= star ? "text-yellow-400" : "text-gray-300"}`}
                                >
                                    ★
                                </button>
                            ))}
                        </div>
                    </div>

                    {eligibility?.variantLabel ? (
                        <p className="text-xs text-muted-foreground">You bought: {eligibility.variantLabel}</p>
                    ) : null}

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Title (Optional)</label>
                        <Input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Summarize your review in a few words"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Review</label>
                        <Textarea
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            placeholder="Share your thoughts about this product..."
                            rows={4}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Photos (Optional, max {MAX_REVIEW_IMAGES})</label>
                        <div className="flex flex-wrap gap-4">
                            {images.map((img, i) => (
                                <div key={i} className="relative w-20 h-20 border rounded overflow-hidden">
                                    <Image src={img} alt="review" fill className="object-cover" />
                                    <button type="button" onClick={() => removeImage(i)} className="absolute top-0 right-0 bg-red-500 text-white p-1 rounded-bl">
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                            {images.length < MAX_REVIEW_IMAGES && (
                                <label className="w-20 h-20 flex items-center justify-center border border-dashed rounded cursor-pointer hover:bg-muted/50">
                                    <ImageIcon className="w-6 h-6 text-muted-foreground" />
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleImageUpload}
                                        disabled={isUploading}
                                        multiple
                                    />
                                </label>
                            )}
                        </div>
                        {isUploading && (
                            <p className="text-xs text-muted-foreground">Uploading photos…</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Rate the seller (Optional)</label>
                        <p className="text-xs text-muted-foreground">Packing, delivery speed and whether the item matched the listing.</p>
                        <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    type="button"
                                    onClick={() => setSellerRating(star === sellerRating ? 0 : star)}
                                    aria-label={`${star} star seller rating`}
                                    className={`text-xl ${sellerRating >= star ? "text-yellow-400" : "text-gray-300"}`}
                                >
                                    ★
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <Button type="submit" disabled={isSubmitting || isUploading}>
                            {isSubmitting ? "Submitting..." : "Submit Review"}
                        </Button>
                        <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                            Cancel
                        </Button>
                    </div>
                </form>
            )}

            <div className="space-y-6">
                {isLoading ? (
                    <p className="text-muted-foreground text-sm">Loading reviews...</p>
                ) : reviews.length === 0 ? (
                    <p className="text-muted-foreground italic">No reviews yet. Be the first to review!</p>
                ) : (
                    reviews.map((review) => (
                        <div key={review.id} className="border-b pb-6 last:border-0">
                            <div className="flex items-center gap-3 mb-3">
                                {review.user.avatar ? (
                                    <Image src={review.user.avatar} alt={review.user.fullName} width={40} height={40} className="rounded-full" />
                                ) : (
                                    <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold">
                                        {review.user.fullName?.[0] || "A"}
                                    </div>
                                )}
                                <div>
                                    <p className="text-sm font-medium">{review.user.fullName || "Anonymous"}</p>
                                    <div className="flex text-yellow-400 text-xs">
                                        {Array.from({ length: 5 }).map((_, i) => (
                                            <span key={i}>{i < review.rating ? "★" : "☆"}</span>
                                        ))}
                                    </div>
                                </div>
                                <span className="ml-auto text-xs text-muted-foreground">
                                    {new Date(review.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                                </span>
                            </div>
                            {review.verifiedPurchase || review.variantLabel ? (
                                <p className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                    {review.verifiedPurchase ? (
                                        <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                                            <BadgeCheck className="h-3.5 w-3.5" /> Verified purchase
                                        </span>
                                    ) : null}
                                    {review.variantLabel ? <span>Bought: {review.variantLabel}</span> : null}
                                </p>
                            ) : null}
                            {review.title && (
                                <p className="text-sm font-semibold text-foreground mb-1">{review.title}</p>
                            )}
                            <p className="text-sm leading-relaxed text-muted-foreground mb-3">{review.text}</p>
                            {review.images.length > 0 && (
                                <div className="flex gap-2 mb-3">
                                    {review.images.map((img, i) => (
                                        <div key={i} className="relative w-16 h-16 rounded overflow-hidden border">
                                            <Image src={img} alt="review image" fill className="object-cover" />
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div className="flex flex-wrap items-center gap-4">
                                <button
                                    type="button"
                                    onClick={() => handleHelpful(review.id)}
                                    aria-pressed={voted.has(review.id)}
                                    className={`flex items-center gap-1.5 text-xs transition-colors ${voted.has(review.id) ? "font-medium text-brand-strong" : "text-muted-foreground hover:text-foreground"}`}
                                >
                                    <ThumbsUp className="w-3.5 h-3.5" />
                                    Helpful{review.helpfulCount ? ` (${review.helpfulCount})` : ""}
                                </button>
                                {reported.has(review.id) ? (
                                    <span className="text-xs text-muted-foreground">Reported</span>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => setReportingId(reportingId === review.id ? null : review.id)}
                                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                                    >
                                        <Flag className="w-3.5 h-3.5" /> Report
                                    </button>
                                )}
                            </div>
                            {reportingId === review.id ? (
                                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-muted/40 p-3">
                                    <select
                                        aria-label="Why are you reporting this review?"
                                        value={reportReason}
                                        onChange={(e) => setReportReason(e.target.value)}
                                        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                                    >
                                        {REVIEW_REPORT_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                                    </select>
                                    <Button size="sm" onClick={() => void submitReport(review.id)}>Report review</Button>
                                    <Button size="sm" variant="ghost" onClick={() => setReportingId(null)}>Cancel</Button>
                                </div>
                            ) : null}
                        </div>
                    ))
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 pt-4">
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={page <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                        <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">
                        Page {page} of {totalPages}
                    </span>
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={page >= totalPages}
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                        Next <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                </div>
            )}
        </div>
    );
}
