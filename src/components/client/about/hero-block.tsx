import { Heart } from "lucide-react";
import type { Json } from "@/types/database";
import { Reveal } from "@/components/client/home/reveal";

type HeroData = {
  badge?: string;
  title: string;
  subtitle?: string;
  description?: string;
  theme?: "dark" | "light";
};

function parseData(raw: Json): HeroData {
  const obj = (raw ?? {}) as Record<string, unknown>;
  return {
    badge: typeof obj.badge === "string" ? obj.badge : undefined,
    title: typeof obj.title === "string" ? obj.title : "",
    subtitle: typeof obj.subtitle === "string" ? obj.subtitle : undefined,
    description: typeof obj.description === "string" ? obj.description : undefined,
    theme: obj.theme === "light" ? "light" : "dark",
  };
}

export function HeroBlock({ data }: { data: Json }) {
  const { badge, title, subtitle, description, theme } = parseData(data);
  const isDark = theme !== "light";

  if (isDark) {
    return (
      <section className="container pt-6 md:pt-10">
        <Reveal variant="clip-up">
          <div className="relative overflow-hidden rounded-[2.5rem] border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-8 py-16 text-center shadow-sm dark:border-slate-800 md:px-16 md:py-28">
            <div
              className="absolute inset-0 opacity-[0.03] pointer-events-none"
              style={{
                backgroundImage:
                  "linear-gradient(to right,#fff 1px,transparent 1px),linear-gradient(to bottom,#fff 1px,transparent 1px)",
                backgroundSize: "48px 48px",
              }}
            />
            <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-blue-500/20 blur-[100px]" />
            <div className="pointer-events-none absolute -bottom-20 -right-20 h-72 w-72 rounded-full bg-slate-500/30 blur-[100px]" />

            <div className="relative z-10 mx-auto max-w-3xl">
              {badge ? (
                <Reveal variant="fade-up" delay={200}>
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-300 backdrop-blur-md">
                    <Heart className="h-3.5 w-3.5 text-rose-400" /> {badge}
                  </span>
                </Reveal>
              ) : null}
              <Reveal variant="slide-split" delay={300}>
                <h1 className="mt-6 text-4xl font-extrabold leading-[1.1] tracking-tight text-white md:text-6xl lg:text-7xl">
                  {title}
                  {subtitle ? (
                    <>
                      <br />
                      <span className="text-slate-400">{subtitle}</span>
                    </>
                  ) : null}
                </h1>
              </Reveal>
              {description ? (
                <Reveal variant="fade-up" delay={400}>
                  <p className="mx-auto mt-6 max-w-2xl text-base font-medium leading-relaxed text-slate-300 md:text-lg">
                    {description}
                  </p>
                </Reveal>
              ) : null}
            </div>
          </div>
        </Reveal>
      </section>
    );
  }

  // Light theme — dùng cho trang nền sáng
  return (
    <section className="container pt-6 md:pt-10">
      <div className="rounded-2xl border bg-card px-8 py-16 text-center md:px-16 md:py-20">
        {badge ? (
          <span className="inline-flex items-center gap-2 rounded-full border bg-muted px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {badge}
          </span>
        ) : null}
        <h1 className="mt-6 text-4xl font-extrabold leading-tight tracking-tight text-foreground md:text-6xl">
          {title}
          {subtitle ? (
            <span className="block text-muted-foreground">{subtitle}</span>
          ) : null}
        </h1>
        {description ? (
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
            {description}
          </p>
        ) : null}
      </div>
    </section>
  );
}
