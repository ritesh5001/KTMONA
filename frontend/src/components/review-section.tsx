"use client";

import React from "react";

const reviews = [
    {
        text: "I was skeptical about buying Co-ords online, but the fabric quality blew me away. It's breathable, not see-through, and fits my curves perfectly.",
        author: "Simran K.",
        meta: "Pune | Co-ord Set",
        initials: "SK",
    },
    {
        text: "Finally found a brand that understands Indian body types! The maxi dress length was just right for my height (5'3\"). Will order again.",
        author: "Priya M.",
        meta: "Delhi | Floral Maxi",
        initials: "PM",
    },
    {
        text: "Wore the Luntra linen kurta to work and got so many compliments. It looks professional yet feels so comfortable for a 9-5 day.",
        author: "Ananya D.",
        meta: "Bangalore | Office Wear",
        initials: "AD",
    },
    {
        text: "Delivery was super fast (2 days!), and the packaging was eco-friendly. The color of the top is exactly as shown on the website.",
        author: "Zoya R.",
        meta: "Mumbai | Casual Top",
        initials: "ZR",
    },
];

// Keep duplicated nodes minimal to lower DOM weight.
const allReviews = [...reviews, ...reviews];

export function ReviewSection() {
    return (
        <section className="relative border-t border-border-soft bg-background py-24 overflow-hidden">
            <div className="container mx-auto px-6 mb-12 text-center">
                <span className="block text-xs font-medium uppercase tracking-[0.3em] text-brand-strong mb-4">
                    Real Stories
                </span>
                <h3 className="font-serif text-3xl font-light text-foreground sm:text-4xl">
                    People who love KTMONA
                </h3>
            </div>

            <div className="relative w-full overflow-hidden">
                {/* Gradient Masks */}
                <div className="absolute left-0 top-0 z-10 h-full w-20 bg-linear-to-r from-background to-transparent" />
                <div className="absolute right-0 top-0 z-10 h-full w-20 bg-linear-to-l from-background to-transparent" />

                {/* Marquee Track */}
                <div
                    className="flex w-max animate-scroll gap-6 py-4 hover:paused"
                >
                    {allReviews.map((review, index) => (
                        <div
                            key={index}
                            className="flex w-75 flex-col justify-between rounded-xl border border-border-soft bg-card p-6 shadow-sm transition-transform duration-300 hover:-translate-y-1 hover:shadow-md sm:w-87.5"
                        >
                            <div>
                                <div className="mb-4 text-lg text-brand-strong">★★★★★</div>
                                <p className="mb-6 text-sm italic leading-relaxed text-muted-foreground">
                                    &ldquo;{review.text}&rdquo;
                                </p>
                            </div>

                            <div className="flex items-center gap-3 border-t border-border-soft pt-4">
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                                    {review.initials}
                                </div>
                                <div>
                                    <strong className="block text-sm font-medium text-foreground">
                                        {review.author}
                                    </strong>
                                    <span className="text-xs text-muted-foreground">
                                        {review.meta}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <style jsx>{`
        @keyframes scroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        .animate-scroll {
          animation: scroll 40s linear infinite;
        }
                @media (prefers-reduced-motion: reduce) {
                    .animate-scroll {
                        animation: none;
                        transform: translateX(0);
                    }
                }
      `}</style>
        </section>
    );
}
