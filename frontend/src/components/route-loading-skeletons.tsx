function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-sm bg-border-soft/80 dark:bg-border/70 ${className}`}
    />
  );
}

export function ProductGridRouteSkeleton({
  title = "Loading collection",
}: {
  title?: string;
}) {
  return (
    <div className="min-h-[calc(100vh-160px)] bg-background">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="mb-10 space-y-4">
          <SkeletonBlock className="h-3 w-32" />
          <SkeletonBlock className="h-10 w-full max-w-md" />
          <span className="sr-only">{title}</span>
        </div>
        <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="space-y-3 border border-border-soft bg-card p-3">
              <SkeletonBlock className="aspect-3/4 w-full" />
              <SkeletonBlock className="h-3 w-20" />
              <SkeletonBlock className="h-5 w-full" />
              <SkeletonBlock className="h-8 w-28" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ProductDetailRouteSkeleton() {
  return (
    <div className="min-h-[calc(100vh-160px)] bg-background">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:py-20">
        <SkeletonBlock className="aspect-4/5 w-full" />
        <div className="space-y-5">
          <SkeletonBlock className="h-3 w-28" />
          <SkeletonBlock className="h-12 w-4/5" />
          <SkeletonBlock className="h-6 w-36" />
          <SkeletonBlock className="h-24 w-full" />
          <SkeletonBlock className="h-12 w-full" />
          <SkeletonBlock className="h-12 w-full" />
        </div>
      </div>
    </div>
  );
}

export function DashboardRouteSkeleton({ title = "Loading dashboard" }: { title?: string }) {
  return (
    <div className="min-h-[calc(100vh-160px)] bg-background">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-16">
        <span className="sr-only">{title}</span>
        <div className="space-y-4">
          <SkeletonBlock className="h-3 w-36" />
          <SkeletonBlock className="h-12 w-full max-w-md" />
        </div>
        <section className="grid gap-px bg-border-soft sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="bg-card p-6">
              <SkeletonBlock className="mb-4 h-3 w-24" />
              <SkeletonBlock className="h-8 w-20" />
            </div>
          ))}
        </section>
        <section className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <SkeletonBlock className="h-80 w-full" />
          <SkeletonBlock className="h-80 w-full" />
        </section>
      </div>
    </div>
  );
}
