"use client";

import { useState } from "react";
import { Sparkles, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  description: string | null;
  shortDescription: string | null;
  productName: string;
  specs: Record<string, string> | null;
};

function markdownToHtml(md: string): string {
  let html = md
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    .replace(/\n\n/g, "</p><p>")
    .replace(/^(?!<[hul])/gm, "")
    .trim();
  if (!html.startsWith("<")) {
    html = "<p>" + html + "</p>";
  }
  html = html.replace(/<\/p><p><ul>/g, "<ul>").replace(/<\/ul><\/p><p>/g, "</ul><p>");
  return html;
}

function isHtml(str: string): boolean {
  return /<[a-z][\s\S]*>/i.test(str);
}

function renderDescriptionHtml(html: string): string {
  const sections = html.match(/<section[\s\S]*?<\/section>/gi);
  if (sections) {
    return sections.map((s) => {
      let section = s;
      section = section.replace(/<h3>(.*?)<\/h3>/g, (_, t) => {
        const iconMatch = t.match(/^([\u{1F000}-\u{1FFFF}])\s*/u);
        const icon = iconMatch ? iconMatch[1] : "";
        const label = iconMatch ? t.slice(icon.length).trim() : t.trim();
        return `<div class="flex items-center gap-3 mb-4"><span class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-lg">${icon}</span><h3 class="text-lg font-bold text-foreground m-0">${label}</h3></div>`;
      });
      section = section.replace(/<table>/g, '<div class="overflow-x-auto"><table class="w-full text-sm">');
      section = section.replace(/<\/table>/g, "</table></div>");
      section = section.replace(/<th>/g, '<th class="whitespace-nowrap px-4 py-2.5 text-left font-medium text-muted-foreground bg-muted/50 border-b">');
      section = section.replace(/<td>/g, '<td class="px-4 py-2.5 border-b border-border/50">');
      section = section.replace(/<ul>/g, '<ul class="space-y-2 list-disc pl-5">');
      section = section.replace(/<li>/g, '<li class="text-muted-foreground leading-relaxed">');
      section = section.replace(/<p>/g, '<p class="text-muted-foreground leading-relaxed mb-3">');
      section = section.replace(/<section>/g, '<section class="mb-8 rounded-xl border bg-card p-6 last:mb-0">');
      section = section.replace(/<\/section>/g, "</section>");
      return section;
    }).join("\n");
  }
  return html;
}

export function ProductDescription({ description, shortDescription, productName, specs }: Props) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiHtml, setAiHtml] = useState<string | null>(null);

  const displayHtml = aiHtml ?? description;

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/generate-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName,
          shortDescription: shortDescription ?? "",
          specs,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message ?? "Lỗi không xác định");
      setAiHtml(json.data.description);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi kết nối");
    } finally {
      setGenerating(false);
    }
  };

  if (displayHtml) {
    const isHtmlContent = isHtml(displayHtml);
    const rendered = isHtmlContent ? renderDescriptionHtml(displayHtml) : markdownToHtml(displayHtml);
    return (
      <div className="product-description">
        <div
          className="product-description-content [&_h3]:text-base sm:[&_h3]:text-lg [&_h3]:font-bold [&_h3]:text-foreground [&_h3]:mb-3 sm:[&_h3]:mb-4 [&_h3]:mt-6 [&_h3:first-child]:mt-0 [&_p]:text-muted-foreground [&_p]:leading-relaxed [&_p]:mb-3 [&_ul]:space-y-2 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:text-muted-foreground [&_li]:leading-relaxed [&_table]:w-full [&_table]:text-sm [&_th]:whitespace-nowrap [&_th]:px-4 [&_th]:py-2.5 [&_th]:text-left [&_th]:font-medium [&_th]:text-muted-foreground [&_th]:bg-muted/50 [&_th]:border-b [&_td]:px-4 [&_td]:py-2.5 [&_td]:border-b [&_td]:border-border/50 [&_section]:mb-6 sm:[&_section]:mb-8 [&_section]:rounded-xl [&_section]:border [&_section]:bg-card [&_section]:p-4 sm:[&_section]:p-6 [&_section:last-child]:mb-0 [&_table]:block [&_table]:overflow-x-auto"
          dangerouslySetInnerHTML={{ __html: rendered }}
        />
        {!description && aiHtml && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4 text-primary" />
            <span>Mô tả được tạo tự động bởi AI</span>
          </div>
        )}
      </div>
    );
  }

  if (shortDescription) {
    return (
      <div className="product-description">
        <p className="text-muted-foreground leading-relaxed">{shortDescription}</p>
        <GenerateButton onClick={handleGenerate} loading={generating} error={error} />
      </div>
    );
  }

  return (
    <div className="product-description">
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 px-6 py-12 text-center">
        <Sparkles className="mb-3 h-10 w-10 text-muted-foreground/40" />
        <h4 className="mb-1 font-semibold">Chưa có mô tả</h4>
        <p className="mb-5 text-sm text-muted-foreground">
          Tạo mô tả chi tiết bằng AI từ thông số kỹ thuật của sản phẩm
        </p>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {generating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Đang tạo...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Tạo mô tả bằng AI
            </>
          )}
        </button>
        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function GenerateButton({ onClick, loading, error }: { onClick: () => void; loading: boolean; error: string | null }) {
  return (
    <div className="mt-6">
      <button
        onClick={onClick}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-lg border bg-card px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Đang tạo mô tả AI...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4 text-primary" />
            Tạo mô tả chi tiết bằng AI
          </>
        )}
      </button>
      {error && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
