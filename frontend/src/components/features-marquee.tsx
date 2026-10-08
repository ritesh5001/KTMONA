import {
    Truck,
    RotateCcw,
    Gem,
    ShieldCheck,
    Sparkles,
    CheckCircle,
    Package
} from "lucide-react";

const features = [
    {
        icon: Truck,
        text: "Free Shipping",
    },
    {
        icon: RotateCcw,
        text: "Easy Returns",
    },
    {
        icon: Gem,
        text: "3,000+ Styles",
    },
    {
        icon: ShieldCheck,
        text: "Genuine Quality",
    },
    {
        icon: Sparkles,
        text: "Premium Design",
    },
    {
        icon: Package,
        text: "Secure Packaging",
    },
    {
        icon: CheckCircle,
        text: "Verified Sellers",
    },
];

// Duplicate once for seamless loop while keeping DOM size low.
const allFeatures = [...features, ...features];

export function FeaturesMarquee() {
    return (
        <section className="w-full overflow-hidden border-b border-border-soft bg-background py-5 sm:py-6">
            <div className="flex w-max animate-features-scroll">
                {allFeatures.map((item, index) => {
                    const Icon = item.icon;
                    return (
                        <div
                            key={index}
                            className="mx-6 flex min-w-27.5 flex-col items-center justify-center text-center sm:mx-12 sm:min-w-30"
                        >
                            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-mist text-ink shadow-sm transition-transform duration-300 hover:scale-110 dark:bg-navy/20 dark:text-brand-strong sm:mb-3 sm:h-12 sm:w-12">
                                <Icon className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={1.5} />
                            </div>
                            <p className="whitespace-nowrap text-[13px] font-semibold text-foreground sm:text-sm">
                                {item.text}
                            </p>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
