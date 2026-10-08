import Image from "next/image";
import Link from "next/link";

export function WeddingSectionBanner() {
  return (
    <section className="relative mt-6 w-full overflow-hidden md:mt-8">
      <div className="relative h-[70vh] w-full overflow-hidden aspect-square md:h-[80vh] md:aspect-21/8">
        <div className="absolute inset-0 hidden md:block">
          <Image
            src="/images/hero/wedding section desktop banner.jpeg"
            alt="Festive season picks on KTMONA"
            fill
            className="object-cover"
            sizes="(max-width: 767px) 0px, 100vw"
            quality={75}
          />
        </div>

        <div className="absolute inset-0 block md:hidden">
          <Image
            src="/images/hero/wedding section mobile banner.jpeg"
            alt="Festive season picks on KTMONA"
            fill
            className="object-cover"
            sizes="(max-width: 767px) 100vw, 0px"
            quality={75}
          />
        </div>

        <div className="absolute inset-0 z-10 hidden bg-linear-to-l from-black/80 via-black/45 to-transparent md:block" />
        <div className="absolute inset-0 z-10 block bg-linear-to-b from-black/55 via-black/20 to-transparent md:hidden" />
        <div className="absolute inset-0 z-10 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(0,0,0,0.25)_100%)]" />

        <div className="absolute inset-0 z-20 flex items-end justify-center px-6 pb-12 pt-[20%] text-center md:items-center md:justify-start md:px-0 md:pb-0 md:pt-0">
          <div className="mx-auto w-full max-w-7xl px-6 sm:px-10 lg:px-16">
            <div className="max-w-xl text-center md:ml-auto md:text-right opacity-100 translate-y-0 transition-opacity duration-500">
              <h2 className="font-serif text-3xl font-light leading-[1.1] tracking-tight text-white drop-shadow-[0_16px_32px_rgba(0,0,0,0.75)] sm:text-4xl md:text-5xl lg:text-6xl">
                Festive Season Picks
              </h2>

              <p className="mt-4 ml-auto max-w-md text-sm leading-relaxed text-white/80 drop-shadow-[0_12px_28px_rgba(0,0,0,0.6)] sm:mt-5 sm:text-base md:text-lg">
                Handpicked styles from verified sellers, ready for every celebration.
              </p>

              <div className="mt-7 sm:mt-9 md:flex md:justify-end">
                <Link
                  href="/marketplace"
                  className="inline-flex items-center justify-center rounded-lg border border-brand-light/50 bg-brand px-8 py-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-ink shadow-[0_8px_24px_rgba(255,138,0,0.35)] backdrop-blur-[2px] transition-all duration-300 hover:-translate-y-0.5 hover:bg-brand-dark hover:shadow-[0_12px_28px_rgba(255,138,0,0.45)] sm:px-10 sm:py-3.5"
                >
                  Explore Festive Picks
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
