import { Reveal } from "@/components/global/reveal";
import { sellerFeaturedTestimonial, sellerTestimonials, type SellerTestimonial } from "@/lib/sell";
import { cn } from "@/lib/utils";

const initials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("");

function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

function TestimonialCard({ quote, name, detail }: SellerTestimonial) {
  return (
    <figure className="grid gap-6 rounded-2xl border bg-card p-5 shadow-sm">
      <blockquote className="text-sm leading-6">{quote}</blockquote>
      <figcaption className="flex items-center gap-3">
        <Avatar name={name} />
        <span className="grid leading-tight">
          <span className="text-sm font-medium">{name}</span>
          <span className="text-xs text-muted-foreground">{detail}</span>
        </span>
      </figcaption>
    </figure>
  );
}

function ScrollingColumn({
  items,
  reverse,
  duration,
  className,
}: {
  items: SellerTestimonial[];
  reverse?: boolean;
  duration: number;
  className?: string;
}) {
  return (
    <div className={className}>
      <div
        style={{ animationDuration: `${duration}s` }}
        className={cn(
          "animate-[marquee-y_linear_infinite] group-hover/wall:paused motion-reduce:animate-none",
          reverse && "shimmer-reverse",
        )}
      >
        {[0, 1].map((copy) => (
          <ul key={copy} aria-hidden={copy === 1 ? true : undefined} className="grid gap-4 pb-4">
            {items.map((item) => (
              <li key={item.id}>
                <TestimonialCard {...item} />
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}

export function TestimonialWall() {
  const first = sellerTestimonials.filter((_, index) => index % 2 === 0);
  const second = sellerTestimonials.filter((_, index) => index % 2 === 1);

  return (
    <div className="mx-auto grid w-full max-w-6xl items-center gap-14 px-4 py-24 sm:px-6 lg:grid-cols-[1fr_1.3fr] lg:gap-10">
      <Reveal className="grid content-center gap-10">
        <div className="grid gap-4">
          <h2
            id="temoignages"
            className="text-3xl font-bold tracking-tight text-balance sm:text-4xl"
          >
            La confiance des vendeurs de Goma
          </h2>
          <p className="max-w-md leading-7 text-muted-foreground">
            Des commerçants de la ville racontent ce que la boutique en ligne a changé pour eux.
          </p>
        </div>

        <figure className="grid max-w-md gap-5">
          <span aria-hidden className="text-6xl leading-none font-bold text-muted-foreground/40">
            “
          </span>
          <blockquote className="-mt-8 text-sm leading-6">
            {sellerFeaturedTestimonial.quote}
          </blockquote>
          <figcaption className="flex items-center gap-3">
            <Avatar name={sellerFeaturedTestimonial.name} />
            <span className="grid leading-tight">
              <span className="text-sm font-medium">{sellerFeaturedTestimonial.name}</span>
              <span className="text-xs text-muted-foreground">
                {sellerFeaturedTestimonial.detail}
              </span>
            </span>
          </figcaption>
        </figure>
      </Reveal>

      <Reveal delay={150}>
        <div
          style={{
            backgroundImage:
              "radial-gradient(color-mix(in oklab, var(--foreground) 25%, transparent) 1px, transparent 1px)",
            backgroundSize: "6px 6px",
          }}
          className="group/wall relative mask-[linear-gradient(to_bottom,transparent,black_14%,black_86%,transparent)]"
        >
          <div className="grid h-128 grid-cols-1 gap-4 overflow-hidden px-3 sm:grid-cols-2">
            <ScrollingColumn items={first} duration={55} />
            <ScrollingColumn items={second} duration={65} reverse className="hidden sm:block" />
          </div>
        </div>
      </Reveal>
    </div>
  );
}
