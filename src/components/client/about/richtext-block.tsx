import { cn } from "@/lib/utils";
import type { Json } from "@/types/database";
import { Reveal } from "@/components/client/home/reveal";

type RichTextData = {
  heading?: string;
  alignment?: "left" | "center";
  paragraphs: string[];
};

function parseData(raw: Json): RichTextData {
  const obj = (raw ?? {}) as Record<string, unknown>;
  return {
    heading: typeof obj.heading === "string" ? obj.heading : undefined,
    alignment: obj.alignment === "left" ? "left" : "center",
    paragraphs: Array.isArray(obj.paragraphs)
      ? obj.paragraphs.filter((p): p is string => typeof p === "string")
      : [],
  };
}

export function RichTextBlock({ data }: { data: Json }) {
  const { heading, alignment, paragraphs } = parseData(data);

  if (paragraphs.length === 0 && !heading) return null;

  const containerCls = cn(
    "container pt-12 md:pt-16",
    alignment === "center" && "text-center",
  );
  const innerMax = alignment === "center" ? "max-w-3xl mx-auto" : "max-w-3xl";

  return (
    <section className={containerCls}>
      <Reveal variant="fade-up">
        <div className={innerMax}>
          {heading ? (
            <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              {heading}
            </h2>
          ) : null}
          {paragraphs.length > 0 ? (
            <div className="mt-6 space-y-5 text-base leading-relaxed text-muted-foreground md:text-lg">
              {paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          ) : null}
        </div>
      </Reveal>
    </section>
  );
}
