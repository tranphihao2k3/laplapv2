"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Plug,
  ClipboardPaste,
  RefreshCw,
  Upload,
  CheckCircle2,
  AlertCircle,
  Clock,
  Clipboard,
  Cpu,
  MemoryStick,
  HardDrive,
  Trophy,
  Loader2,
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Plus,
  Copy,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

// ── API response shapes (trust Worker A's API per MINI_TOOL_PLAN.md §5) ─────
type Ok<T> = { ok: true; data: T };
type Err = { ok: false; error: { code?: string; message: string } };

type SessionInfo = {
  sessionId: string;
  valid: boolean;
  consumed: boolean;
  expiresAt: string;
  laptopId?: string | null;
  context?: Record<string, unknown>;
  requiredFields?: string[];
};

type UploadResult = {
  uploadId: string;
  laptopId: string;
  redirectUrl: string;
  saved?: {
    specsUpdated?: boolean;
    benchmarkId?: string | null;
    testResultsSaved?: number;
  };
};

// ── Step indicator ──────────────────────────────────────────────────────────
type Step = "paste" | "upload" | "done";

function StepBubble({
  num,
  label,
  active,
  done,
}: {
  num: number;
  label: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${
          done ? "bg-green-500 text-white" : active ? "bg-zinc-900 text-white" : "bg-zinc-200 text-zinc-500"
        }`}
      >
        {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : num}
      </div>
      <span
        className={`text-xs font-medium whitespace-nowrap ${
          active ? "text-zinc-900" : done ? "text-green-600" : "text-zinc-400"
        }`}
      >
        {label}
      </span>
    </div>
  );
}

// ── Countdown timer for session expiry ─────────────────────────────────────
function useCountdown(targetIso: string | null) {
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    if (!targetIso) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [targetIso]);

  return useMemo(() => {
    if (!targetIso) return { expired: false, remainingMs: 0, label: "" };
    const target = new Date(targetIso).getTime();
    const diff = target - now;
    if (Number.isNaN(target) || diff <= 0) {
      return { expired: true, remainingMs: 0, label: "Đã hết hạn" };
    }
    const totalSec = Math.floor(diff / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const pad = (n: number) => String(n).padStart(2, "0");
    const label = h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
    return { expired: false, remainingMs: diff, label };
  }, [targetIso, now]);
}

// ── Auto-detect sid from pasted URL / clipboard ─────────────────────────────
const SID_REGEX = /[?&]sid=([a-f0-9]{32})/i;
const SID_PLAIN = /^[a-f0-9]{32}$/i;

function extractSid(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const match = trimmed.match(SID_REGEX);
  if (match) return match[1].toLowerCase();
  if (SID_PLAIN.test(trimmed)) return trimmed.toLowerCase();
  return null;
}

// ── Pretty JSON viewer ─────────────────────────────────────────────────────
function JsonPreview({ data }: { data: unknown }) {
  const text = useMemo(() => {
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  }, [data]);
  return (
    <pre className="max-h-72 overflow-auto rounded-lg border border-zinc-200 bg-zinc-950 p-3 font-mono text-[11px] leading-relaxed text-zinc-200">
      {text}
    </pre>
  );
}

// ── Section wrapper ────────────────────────────────────────────────────────
function Section({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-zinc-200 bg-white p-4 sm:p-5 ${className}`}>
      {children}
    </div>
  );
}

// ── Section header (icon + title) ──────────────────────────────────────────
function SectionHeader({
  icon: Icon,
  title,
  badge,
  tone = "zinc",
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  badge?: React.ReactNode;
  tone?: "zinc" | "violet" | "blue" | "green" | "orange";
}) {
  const tones: Record<string, string> = {
    zinc: "bg-zinc-100 text-zinc-700",
    violet: "bg-violet-100 text-violet-700",
    blue: "bg-blue-100 text-blue-700",
    green: "bg-green-100 text-green-700",
    orange: "bg-orange-100 text-orange-700",
  };
  return (
    <div className="mb-4 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${tones[tone]}`}>
          <Icon className="h-4 w-4" />
        </div>
        <h3 className="font-semibold text-zinc-900">{title}</h3>
      </div>
      {badge}
    </div>
  );
}

// ── Empty form sections (placeholder) ──────────────────────────────────────
const EMPTY_SECTIONS: { key: string; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "device",     label: "Device info", icon: Cpu },
  { key: "hardware",   label: "Hardware",    icon: MemoryStick },
  { key: "benchmark",  label: "Benchmark",   icon: Trophy },
  { key: "tests",      label: "Tests",       icon: HardDrive },
];

function EmptyFormSections() {
  return (
    <div className="space-y-2">
      {EMPTY_SECTIONS.map((s) => {
        const Icon = s.icon;
        return (
          <div key={s.key} className="flex items-center gap-2 rounded-lg border border-dashed border-zinc-200 bg-zinc-50/60 px-3 py-2">
            <Icon className="h-3.5 w-3.5 text-zinc-400" />
            <span className="text-xs text-zinc-500">{s.label}</span>
            <span className="ml-auto text-[10px] text-zinc-400">(chưa có dữ liệu)</span>
          </div>
        );
      })}
      <p className="mt-2 text-xs text-zinc-500">
        Dán JSON từ tool bên dưới để tự động điền các mục này.
      </p>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function MiniToolConnectPage() {
  const [step, setStep] = useState<Step>("paste");

  const [pasted, setPasted] = useState("");
  const [sid, setSid] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const [creatingSession, setCreatingSession] = useState(false);
  const [createdSid, setCreatedSid] = useState<string | null>(null);

  const [jsonInput, setJsonInput] = useState("");
  const [parsedPayload, setParsedPayload] = useState<Record<string, unknown> | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const countdown = useCountdown(session?.expiresAt ?? null);

  // Auto-fill sid on mount if URL has ?sid=...
  useEffect(() => {
    if (typeof window === "undefined") return;
    const urlSid = new URLSearchParams(window.location.search).get("sid");
    if (urlSid && SID_PLAIN.test(urlSid)) {
      setPasted(urlSid.toLowerCase());
      setSid(urlSid.toLowerCase());
    }
  }, []);

  const handlePasteFromClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      const extracted = extractSid(text);
      if (extracted) {
        setPasted(text);
        setSid(extracted);
        toast.success("Đã dán session ID từ clipboard.");
      } else {
        setPasted(text);
        toast.error("Clipboard không chứa session ID hợp lệ.");
      }
    } catch {
      toast.error("Không đọc được clipboard. Hãy paste thủ công.");
    }
  }, []);

  const onPastedChange = useCallback((value: string) => {
    setPasted(value);
    const extracted = extractSid(value);
    setSid(extracted ? extracted : null);
  }, []);

  const handleCreateSession = useCallback(async () => {
    setCreatingSession(true);
    setSessionError(null);
    setCreatedSid(null);
    try {
      const res = await fetch("/api/v1/mini-tool/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          redirectAfterUpload: "/test-laptop/ranking",
        }),
      });
      const json = (await res.json()) as
        | { ok: true; data: { sessionId: string; verifyUrl: string; uploadUrl: string; webUrl: string; expiresAt: string; ttlSeconds: number } }
        | { ok: false; error: { code?: string; message: string } };
      if (!res.ok || !("ok" in json) || !json.ok) {
        const msg = (json && "error" in json && json.error?.message) || `HTTP ${res.status}`;
        throw new Error(msg);
      }
      const sidValue = json.data.sessionId;
      setCreatedSid(sidValue);
      setPasted(sidValue);
      setSid(sidValue);
      toast.success("Đã tạo session. Copy URL bên dưới rồi dán vào Mini Tool.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Không tạo được session";
      setSessionError(msg);
      toast.error("Tạo session thất bại: " + msg);
    } finally {
      setCreatingSession(false);
    }
  }, []);

  const handleCopyCreatedSid = useCallback(async () => {
    if (!createdSid) return;
    try {
      const url = `${window.location.origin}/api/v1/mini-tool/session?sid=${createdSid}`;
      await navigator.clipboard.writeText(url);
      toast.success("Đã copy URL session vào clipboard.");
    } catch {
      toast.error("Không copy được vào clipboard.");
    }
  }, [createdSid]);

  const verifySession = useCallback(async (sidToCheck: string) => {
    setConnecting(true);
    setSessionError(null);
    setSession(null);
    setUploadResult(null);
    setUploadError(null);
    try {
      const res = await fetch(
        `/api/v1/mini-tool/session?sid=${encodeURIComponent(sidToCheck)}`,
        { cache: "no-store" },
      );
      const json = (await res.json()) as Ok<SessionInfo> | Err;
      if (!res.ok || !("ok" in json) || !json.ok) {
        const msg =
          (json && "error" in json && json.error?.message) || `HTTP ${res.status}`;
        setSessionError(msg);
        toast.error("Không xác minh được session: " + msg);
        return;
      }
      const info = json.data;
      if (!info.valid) {
        setSessionError("Session không hợp lệ.");
        toast.error("Session không hợp lệ.");
        return;
      }
      if (info.consumed) {
        setSessionError("Session đã được sử dụng. Hãy tạo session mới.");
        toast.error("Session đã được sử dụng.");
        return;
      }
      setSession(info);
      toast.success("Đã kết nối session!");
      setStep("upload");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Lỗi không xác định";
      setSessionError(msg);
      toast.error("Lỗi kết nối: " + msg);
    } finally {
      setConnecting(false);
    }
  }, []);

  const handleConnect = useCallback(() => {
    const extracted = extractSid(pasted);
    if (!extracted) {
      toast.error("Vui lòng dán URL hợp lệ hoặc session ID 32 ký tự.");
      return;
    }
    setSid(extracted);
    void verifySession(extracted);
  }, [pasted, verifySession]);

  const handleRefreshSession = useCallback(() => {
    if (sid) void verifySession(sid);
  }, [sid, verifySession]);

  // Parse JSON pasted by user
  useEffect(() => {
    if (!jsonInput.trim()) {
      setParsedPayload(null);
      setParseError(null);
      return;
    }
    try {
      const parsed = JSON.parse(jsonInput);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        setParsedPayload(parsed as Record<string, unknown>);
        setParseError(null);
      } else {
        setParsedPayload(null);
        setParseError("JSON phải là object (không phải mảng hoặc primitive).");
      }
    } catch (e) {
      setParsedPayload(null);
      setParseError(e instanceof Error ? e.message : "Lỗi parse JSON");
    }
  }, [jsonInput]);

  const handleUpload = useCallback(async () => {
    if (!sid) {
      toast.error("Phiên chưa được kết nối.");
      return;
    }
    if (!parsedPayload) {
      toast.error("Vui lòng dán JSON trước khi gửi.");
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const body = {
        ...parsedPayload,
        // MVP: user paste payload + signature; server will verify.
        signature: "paste-from-tool",
      };
      const res = await fetch(
        `/api/v1/mini-tool/upload?sid=${encodeURIComponent(sid)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const json = (await res.json()) as Ok<UploadResult> | Err;
      if (!res.ok || !("ok" in json) || !json.ok) {
        const msg =
          (json && "error" in json && json.error?.message) || `HTTP ${res.status}`;
        throw new Error(msg);
      }
      setUploadResult(json.data);
      setStep("done");
      toast.success("Upload thành công!");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Lỗi không xác định";
      setUploadError(msg);
      toast.error("Upload thất bại: " + msg);
    } finally {
      setUploading(false);
    }
  }, [sid, parsedPayload]);

  const requiredFields: string[] = session?.requiredFields ?? [];

  const STEPS: { key: Step; label: string }[] = [
    { key: "paste", label: "Kết nối session" },
    { key: "upload", label: "Đẩy kết quả" },
    { key: "done", label: "Hoàn tất" },
  ];
  const stepIndex = STEPS.findIndex((s) => s.key === step);

  // ── Done screen ─────────────────────────────────────────────────────────
  if (step === "done" && uploadResult) {
    return (
      <div className="container mx-auto max-w-xl px-4 py-8 sm:py-12">
        <div className="rounded-2xl border border-green-200 bg-green-50 p-5 text-center sm:p-8">
          <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-green-500" />
          <h2 className="text-xl font-bold text-zinc-900">Upload thành công!</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Dữ liệu đã được lưu lên bảng xếp hạng
          </p>

          <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-4 text-left">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">Upload ID</p>
            <p className="mt-1 break-all font-mono text-xs text-zinc-700">{uploadResult.uploadId}</p>
            {uploadResult.saved && (
              <div className="mt-3 grid gap-1 text-xs text-zinc-600">
                {uploadResult.saved.specsUpdated !== undefined && (
                  <div>
                    Cập nhật specs:{" "}
                    <span className="font-medium text-zinc-900">
                      {uploadResult.saved.specsUpdated ? "Có" : "Không"}
                    </span>
                  </div>
                )}
                {uploadResult.saved.testResultsSaved !== undefined && (
                  <div>
                    Test results đã lưu:{" "}
                    <span className="font-medium text-zinc-900">{uploadResult.saved.testResultsSaved}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button
              onClick={() => {
                setStep("paste");
                setSession(null);
                setSid(null);
                setPasted("");
                setJsonInput("");
                setParsedPayload(null);
                setUploadResult(null);
                setUploadError(null);
              }}
              variant="outline"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Kết nối session khác
            </Button>
            <a
              href={uploadResult.redirectUrl}
              className="inline-flex items-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
            >
              <Trophy className="h-4 w-4" />
              Mở trang ranking
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ── Main render ─────────────────────────────────────────────────────────
  return (
    <div className="container mx-auto max-w-3xl px-4 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Plug className="h-5 w-5 shrink-0 text-violet-500" />
          <h2 className="text-lg font-bold text-zinc-900 sm:text-xl">Mini Tool — Kết nối</h2>
          <Badge variant="outline" className="border-violet-200 text-[10px] text-violet-700">
            Beta
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Dán session URL/ID từ Mini Tool, sau đó dán JSON kết quả để đẩy lên bảng xếp hạng.
        </p>
      </div>

      {/* Bước 0 — Tạo phiên (server-side) */}
      <Section className="mb-5 border-violet-200 bg-violet-50/30">
        <SectionHeader
          icon={Plus}
          title="Tạo phiên kết nối"
          badge={
            createdSid ? (
              <Badge variant="outline" className="border-green-200 text-[10px] text-green-700">
                SID: {createdSid.slice(0, 8)}…
              </Badge>
            ) : null
          }
          tone="violet"
        />
        <p className="text-xs text-muted-foreground">
          Bấm nút dưới để tạo mã session mới (hết hạn sau 2 giờ). Copy URL
          và dán vào Mini Tool, hoặc dùng nút trong Mini Tool để kết nối.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={handleCreateSession}
            disabled={creatingSession}
            className="gap-2"
          >
            {creatingSession ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang tạo…
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Tạo phiên kết nối
              </>
            )}
          </Button>
          {createdSid && (
            <Button
              type="button"
              variant="outline"
              onClick={handleCopyCreatedSid}
              className="gap-2"
            >
              <Copy className="h-4 w-4" />
              Copy URL session
            </Button>
          )}
        </div>
        {createdSid && (
          <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
              URL session (paste vào Mini Tool)
            </p>
            <p className="mt-1 break-all font-mono text-[11px] text-zinc-800">
              {`${typeof window !== "undefined" ? window.location.origin : ""}/api/v1/mini-tool/session?sid=${createdSid}`}
            </p>
          </div>
        )}
      </Section>

      {/* Step progress */}
      <div className="mb-6 flex items-center gap-2 overflow-x-auto">
        {STEPS.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <StepBubble
              num={i + 1}
              label={s.label}
              active={step === s.key}
              done={stepIndex > i}
            />
            {i < STEPS.length - 1 && (
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-zinc-300" />
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-5">
        {/* ── STEP 1: Paste session ─────────────────────────────────────── */}
        <Section>
          <SectionHeader
            icon={Plug}
            title="Bước 1 — Kết nối session"
            badge={
              sid ? (
                <Badge variant="outline" className="border-blue-200 text-[10px] text-blue-700">
                  SID: {sid.slice(0, 8)}…
                </Badge>
              ) : null
            }
            tone="violet"
          />

          <Label className="text-xs text-muted-foreground">
            Dán URL từ Mini Tool hoặc session ID (32 ký tự hex)
          </Label>
          <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
            <Input
              ref={inputRef}
              value={pasted}
              onChange={(e) => onPastedChange(e.target.value)}
              placeholder="https://laplapcantho.store/api/v1/mini-tool/session?sid=…  hoặc  32-char sid"
              className="flex-1 font-mono text-xs"
              autoComplete="off"
              spellCheck={false}
            />
            <Button
              type="button"
              variant="outline"
              onClick={handlePasteFromClipboard}
              className="shrink-0"
            >
              <ClipboardPaste className="mr-2 h-4 w-4" />
              Dán từ clipboard
            </Button>
          </div>

          {pasted && !sid && (
            <p className="mt-2 text-xs text-amber-600">
              Không tìm thấy session ID hợp lệ trong nội dung đã dán.
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              onClick={handleConnect}
              disabled={!sid || connecting}
              className="gap-2"
            >
              {connecting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Đang kết nối...
                </>
              ) : (
                <>
                  <Plug className="h-4 w-4" />
                  Kết nối
                </>
              )}
            </Button>
            {session && (
              <Button
                onClick={handleRefreshSession}
                variant="outline"
                disabled={connecting}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Cập nhật phiên
              </Button>
            )}
          </div>

          {sessionError && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
              <p className="text-sm text-red-700">{sessionError}</p>
            </div>
          )}

          {/* Session info card */}
          {session && (
            <div className="mt-4 space-y-3">
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-semibold text-zinc-900">Session hợp lệ</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-mono text-zinc-500">
                    <Clock className="h-3.5 w-3.5" />
                    {countdown.expired ? (
                      <span className="text-red-600">Đã hết hạn</span>
                    ) : (
                      <span>
                        Còn lại: <span className="font-semibold text-zinc-900">{countdown.label}</span>
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-3 grid gap-1 text-xs sm:grid-cols-2">
                  <div className="flex justify-between gap-2">
                    <span className="text-zinc-500">Session ID</span>
                    <span className="font-mono text-zinc-900">{session.sessionId}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-zinc-500">Hết hạn</span>
                    <span className="text-zinc-900">
                      {new Date(session.expiresAt).toLocaleString("vi-VN")}
                    </span>
                  </div>
                  {session.laptopId && (
                    <div className="flex justify-between gap-2 sm:col-span-2">
                      <span className="text-zinc-500">Đã gắn với laptop</span>
                      <span className="font-mono text-zinc-900">{session.laptopId}</span>
                    </div>
                  )}
                </div>
              </div>

              {requiredFields.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs font-semibold text-amber-900">Trường bắt buộc</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {requiredFields.map((f) => (
                      <Badge key={f} variant="outline" className="border-amber-300 text-[10px] text-amber-800">
                        {f}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Section>

        {/* ── STEP 2: Upload payload ───────────────────────────────────── */}
        <Section>
          <SectionHeader
            icon={Upload}
            title="Bước 2 — Đẩy kết quả lên web"
            badge={
              stepIndex >= 1 ? (
                <Badge variant="outline" className="border-green-200 text-[10px] text-green-700">
                  ✓ Sẵn sàng
                </Badge>
              ) : null
            }
            tone="blue"
          />

          {!session ? (
            <p className="text-sm text-muted-foreground">
              Kết nối session ở Bước 1 trước khi đẩy kết quả.
            </p>
          ) : (
            <>
              {/* Empty placeholder form */}
              <EmptyFormSections />

              <div className="mt-4 space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Dán JSON từ tool
                </Label>
                <p className="text-[11px] text-zinc-500">
                  Tool sẽ xuất ra 1 JSON payload chứa device/hardware/benchmark/tests. Dán
                  vào ô bên dưới để preview trước khi gửi.
                </p>
                <Textarea
                  rows={6}
                  value={jsonInput}
                  onChange={(e) => setJsonInput(e.target.value)}
                  placeholder='{ "payloadVersion": "mini-tool-v1", "device": { ... }, "hardware": { ... }, "benchmark": { ... }, "tests": [ ... ] }'
                  className="font-mono text-[11px]"
                />
                {parseError && (
                  <p className="flex items-center gap-1 text-xs text-red-600">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {parseError}
                  </p>
                )}
              </div>

              {parsedPayload && (
                <div className="mt-3">
                  <p className="mb-1 text-xs font-semibold text-zinc-700">Preview:</p>
                  <JsonPreview data={parsedPayload} />
                </div>
              )}

              {uploadError && (
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                  <p className="text-sm text-red-700">{uploadError}</p>
                </div>
              )}

              <div className="mt-4 flex gap-2">
                <Button
                  onClick={handleUpload}
                  disabled={!parsedPayload || uploading}
                  className="gap-2"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Đang gửi...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Gửi lên server
                    </>
                  )}
                </Button>
                <Link
                  href="/test-laptop"
                  className="inline-flex items-center gap-2 rounded-md border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Quay lại
                </Link>
              </div>
            </>
          )}
        </Section>

        {/* ── Quick help ────────────────────────────────────────────────── */}
        <Section>
          <SectionHeader icon={Clipboard} title="Hướng dẫn nhanh" tone="orange" />
          <ol className="space-y-2 text-xs text-zinc-600 list-decimal pl-4">
            <li>
              Mở Mini Tool trên máy cần test. Tool sẽ tạo ra 1 URL dạng{" "}
              <code className="font-mono bg-zinc-100 px-1 rounded">
                /api/v1/mini-tool/session?sid=…
              </code>
              .
            </li>
            <li>
              Copy URL đó, dán vào ô bên trên (hoặc bấm <strong>Dán từ clipboard</strong>).
            </li>
            <li>
              Bấm <strong>Kết nối</strong> để xác minh session còn hạn.
            </li>
            <li>
              Trong Mini Tool, sao chép JSON kết quả (device/hardware/benchmark/tests) rồi dán
              vào ô <strong>Dán JSON từ tool</strong>.
            </li>
            <li>
              Bấm <strong>Gửi lên server</strong>. Kết quả sẽ xuất hiện ngay trên bảng
              xếp hạng.
            </li>
          </ol>
        </Section>
      </div>
    </div>
  );
}
