import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SITE_URL } from "@/lib/site-config";
import { BLOG_POSTS } from "../posts";

type Props = {
    params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params;
    const post = BLOG_POSTS.find((p) => p.slug === slug);

    if (!post) return {};

    const url = `${SITE_URL}/blog/${slug}`;

    // Extract keywords from title roughly
    const defaultKeywords = "KTMONA blog, online shopping tips, style guides, seller tips india";
    const dynamicKeywords = post.title.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(" ").filter(w => w.length > 3).join(", ");

    return {
        title: `${post.title} | KTMONA Journal`,
        description: post.description,
        keywords: `${defaultKeywords}, ${dynamicKeywords}`,
        alternates: { canonical: url },
        openGraph: {
            title: post.title,
            description: post.description,
            url,
            type: "article",
            publishedTime: post.date,
            authors: [post.author],
            images: [
                {
                    url: post.image || "/og.png",
                    alt: post.title,
                },
            ],
        },
        twitter: {
            card: "summary_large_image",
            title: post.title,
            description: post.description,
            images: [post.image || "/og.png"],
        },
    };
}

export default async function BlogPostPage({ params }: Props) {
    const { slug } = await params;
    const post = BLOG_POSTS.find((p) => p.slug === slug);

    if (!post) {
        notFound();
    }

    /* ── Article JSON-LD ── */
    const articleJsonLd = {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: post.title,
        description: post.description,
        image: `${SITE_URL}${post.image || '/og.png'}`,
        datePublished: new Date(post.date).toISOString(),
        author: {
            "@type": "Person",
            name: post.author,
        },
        publisher: {
            "@type": "Organization",
            name: "KTMONA",
            logo: {
                "@type": "ImageObject",
                url: `${SITE_URL}/logo.png`,
            },
        },
    };

    /* ── Breadcrumb JSON-LD ── */
    const breadcrumbJsonLd = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
            { "@type": "ListItem", position: 2, name: "Journal", item: `${SITE_URL}/blog` },
            { "@type": "ListItem", position: 3, name: post.title, item: `${SITE_URL}/blog/${slug}` },
        ],
    };

    return (
        <article className="bg-background min-h-screen pb-24">
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

            {/* Blog Header */}
            <header className="border-b border-border-soft bg-mist/30 dark:bg-card/30 pt-32 pb-16 px-6">
                <div className="mx-auto max-w-3xl text-center">
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-brand-strong mb-6">
                        KTMONA Journal • {new Date(post.date).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                    </p>
                    <h1 className="font-serif text-4xl font-light tracking-tight text-foreground sm:text-5xl lg:text-6xl mb-6 leading-tight">
                        {post.title}
                    </h1>
                    <p className="text-sm uppercase tracking-wider text-muted-foreground">
                        By {post.author}
                    </p>
                </div>
            </header>

            {/* Blog Content */}
            <div className="mx-auto max-w-3xl px-6 py-16">
                <div
                    className="prose prose-stone dark:prose-invert max-w-none prose-headings:font-serif prose-headings:font-light prose-h2:text-3xl prose-h2:mt-12 prose-headings:text-foreground prose-p:text-muted-foreground prose-p:leading-relaxed prose-p:text-[17px] prose-a:text-brand-strong hover:prose-a:text-brand-strong/80 transition-colors"
                    dangerouslySetInnerHTML={{ __html: post.content }}
                />

                <div className="mt-16 pt-8 border-t border-border-soft flex items-center justify-between">
                    <Link
                        href="/blog"
                        className="text-xs font-medium uppercase tracking-[0.15em] text-ink dark:text-paper hover:text-brand-strong transition-colors"
                    >
                        ← Back to Journal
                    </Link>
                    <div className="flex gap-4">
                        <Link href="/marketplace" className="text-xs tracking-wider text-muted-foreground hover:text-brand-strong underline underline-offset-4">
                            Shop the Marketplace
                        </Link>
                        <Link href="/categories" className="text-xs tracking-wider text-muted-foreground hover:text-brand-strong underline underline-offset-4">
                            All Categories
                        </Link>
                    </div>
                </div>
            </div>
        </article>
    );
}
