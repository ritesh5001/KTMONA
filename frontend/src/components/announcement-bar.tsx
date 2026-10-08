const announcements = [
    "Verified Sellers",
    "Secure Payments",
    "Trust Every Click",
    "Pan-India Shipping",
    "Doorstep Delivery",
    "Easy Returns",
    "Quality Checked",
];

// Duplicate for infinite loop
const allAnnouncements = [...announcements, ...announcements, ...announcements, ...announcements];

export function AnnouncementBar() {
    return (
        <div className="relative z-40 w-full overflow-hidden border-b border-border-soft bg-mist py-2 dark:bg-card">
            <div className="flex w-max animate-announcement-scroll items-center gap-8 whitespace-nowrap">
                {allAnnouncements.map((item, index) => (
                    <div key={index} className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-brand shadow-[0_0_4px_rgba(255,138,0,0.5)]" />
                        <span className="text-xs font-medium uppercase tracking-widest text-foreground/70">
                            {item}
                        </span>
                    </div>
                ))}
                {/* Duplicate again for smoothness if needed, or rely on the repeated array above */}
                {allAnnouncements.map((item, index) => (
                    <div key={`dup-${index}`} className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-brand shadow-[0_0_4px_rgba(255,138,0,0.5)]" />
                        <span className="text-xs font-medium uppercase tracking-widest text-foreground/70">
                            {item}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
