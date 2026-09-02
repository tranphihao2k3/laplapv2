"use client";

import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, GripVertical, Save } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { httpGet, httpPatch, httpPost } from "@/lib/api/http";
import type { Paginated } from "@/lib/api/response";

// ====== Types =====
type Setting = {
  id: string;
  organization_id: string | null;
  shop_id: string | null;
  group_name: string | null;
  key: string | null;
  value: unknown;
};

type ContactChannel = {
  icon: string;
  label: string;
  value: string;
  link?: string;
  type: "phone" | "zalo" | "email" | "messenger" | "telegram" | "other";
};

type OpeningHours = {
  weekday?: string;
  saturday?: string;
  sunday?: string;
  holidays?: string;
  weekend?: string;
};

type SocialLinks = {
  facebook?: string;
  zalo?: string;
  website?: string;
  tiktok?: string;
  youtube?: string;
  instagram?: string;
};

function getApiErrorMsg(e: unknown) {
  const err = e as { error?: { message?: string } };
  return err?.error?.message ?? "Có lỗi xảy ra";
}

// ====== Component =====
export function ContactSettings() {
  const qc = useQueryClient();

  const settingsQ = useQuery({
    queryKey: ["settings-contact"],
    queryFn: () =>
      httpGet<Paginated<Setting>>("/v1/settings", {
        page: 1,
        pageSize: 100,
        group_name: "contact",
      }),
  });

  const items = settingsQ.data?.items ?? [];

  const contactChannelsSetting = useMemo(() => {
    return items.find((s) => s.key === "contact_channels") ?? null;
  }, [items]);

  const openingHoursSetting = useMemo(() => {
    return items.find((s) => s.key === "opening_hours") ?? null;
  }, [items]);

  const socialLinksSetting = useMemo(() => {
    return items.find((s) => s.key === "social_links") ?? null;
  }, [items]);

  // Parse current values
  const [channels, setChannels] = useState<ContactChannel[]>(() => {
    const raw = contactChannelsSetting?.value;
    if (Array.isArray(raw)) return raw as ContactChannel[];
    return [];
  });

  const [hours, setHours] = useState<OpeningHours>(() => {
    const raw = openingHoursSetting?.value;
    if (raw && typeof raw === "object") return raw as OpeningHours;
    return {};
  });

  const [socials, setSocials] = useState<SocialLinks>(() => {
    const raw = socialLinksSetting?.value;
    if (raw && typeof raw === "object") return raw as SocialLinks;
    return {};
  });

  // Update local state when server data loads
  useMemo(() => {
    const raw = contactChannelsSetting?.value;
    if (Array.isArray(raw) && JSON.stringify(raw) !== JSON.stringify(channels)) {
      setChannels(raw as ContactChannel[]);
    }
  }, [contactChannelsSetting?.value]);

  useMemo(() => {
    const raw = openingHoursSetting?.value;
    if (raw && typeof raw === "object" && JSON.stringify(raw) !== JSON.stringify(hours)) {
      setHours(raw as OpeningHours);
    }
  }, [openingHoursSetting?.value]);

  useMemo(() => {
    const raw = socialLinksSetting?.value;
    if (raw && typeof raw === "object" && JSON.stringify(raw) !== JSON.stringify(socials)) {
      setSocials(raw as SocialLinks);
    }
  }, [socialLinksSetting?.value]);

  const upsert = useMutation({
    mutationFn: async (input: { key: string; value: unknown }) => {
      const payload: Record<string, unknown> = {
        value: input.value,
        group_name: "contact",
      };
      const existing = items.find((s) => s.key === input.key);
      if (existing) {
        return httpPatch<Setting>(`/v1/settings/${existing.id}`, payload);
      }
      return httpPost<Setting>("/v1/settings", {
        key: input.key,
        value: input.value,
        group_name: "contact",
        ...payload,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings-contact"] });
      toast.success("Đã lưu cấu hình liên hệ");
    },
    onError: (e) => toast.error(getApiErrorMsg(e)),
  });

  const handleSaveChannels = useCallback(() => {
    upsert.mutate({ key: "contact_channels", value: channels });
  }, [channels, upsert]);

  const handleSaveHours = useCallback(() => {
    upsert.mutate({ key: "opening_hours", value: hours });
  }, [hours, upsert]);

  const handleSaveSocials = useCallback(() => {
    upsert.mutate({ key: "social_links", value: socials });
  }, [socials, upsert]);

  const addChannel = useCallback(() => {
    setChannels((prev) => [
      ...prev,
      { icon: "phone", label: "Kênh mới", value: "", type: "phone" },
    ]);
  }, []);

  const updateChannel = useCallback(
    (index: number, updates: Partial<ContactChannel>) => {
      setChannels((prev) =>
        prev.map((ch, i) => (i === index ? { ...ch, ...updates } : ch))
      );
    },
    []
  );

  const removeChannel = useCallback((index: number) => {
    setChannels((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const iconOptions = [
    { value: "phone", label: "📞 Phone" },
    { value: "headphones", label: "🎧 Headphones" },
    { value: "message-circle", label: "💬 Message Circle" },
    { value: "mail", label: "✉️ Mail" },
    { value: "map-pin", label: "📍 Map Pin" },
  ];

  const typeOptions = [
    { value: "phone", label: "Điện thoại" },
    { value: "zalo", label: "Zalo" },
    { value: "email", label: "Email" },
    { value: "messenger", label: "Messenger" },
    { value: "telegram", label: "Telegram" },
    { value: "other", label: "Khác" },
  ];

  return (
    <div className="space-y-6">
      {/* Contact Channels */}
      <Card>
        <CardHeader>
          <CardTitle>Kênh liên hệ</CardTitle>
          <CardDescription>
            Các kênh liên hệ hiển thị trên trang Liên hệ (Hotline, Zalo, Email, v.v.)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {channels.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Chưa có kênh liên hệ nào. Nhấn &quot;Thêm kênh&quot; để tạo mới.
              </p>
            ) : (
              channels.map((ch, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2 rounded-lg border p-3"
                >
                  <GripVertical className="mt-2 h-4 w-4 shrink-0 cursor-grab text-muted-foreground" />
                  <div className="grid flex-1 gap-2 sm:grid-cols-5">
                    <div>
                      <Label className="text-xs">Icon</Label>
                      <Select
                        value={ch.icon}
                        onValueChange={(v) => updateChannel(idx, { icon: v })}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {iconOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Loại</Label>
                      <Select
                        value={ch.type}
                        onValueChange={(v) =>
                          updateChannel(idx, {
                            type: v as ContactChannel["type"],
                          })
                        }
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {typeOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="sm:col-span-2">
                      <Label className="text-xs">Nhãn</Label>
                      <Input
                        className="h-8 text-xs"
                        value={ch.label}
                        onChange={(e) =>
                          updateChannel(idx, { label: e.target.value })
                        }
                        placeholder="Hotline bán hàng"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Giá trị</Label>
                      <Input
                        className="h-8 text-xs"
                        value={ch.value}
                        onChange={(e) =>
                          updateChannel(idx, { value: e.target.value })
                        }
                        placeholder="1900 1234"
                      />
                    </div>
                    <div className="sm:col-span-5">
                      <Label className="text-xs">Link (tùy chọn)</Label>
                      <Input
                        className="h-8 text-xs"
                        value={ch.link ?? ""}
                        onChange={(e) =>
                          updateChannel(idx, {
                            link: e.target.value || undefined,
                          })
                        }
                        placeholder="https://zalo.me/0901234567"
                      />
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="mt-5 h-8 w-8 shrink-0"
                    onClick={() => removeChannel(idx)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))
            )}
          </div>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="outline" onClick={addChannel}>
              <Plus className="mr-1 h-4 w-4" /> Thêm kênh
            </Button>
            {channels.length > 0 && (
              <Button
                size="sm"
                onClick={handleSaveChannels}
                disabled={upsert.isPending}
              >
                <Save className="mr-1 h-4 w-4" /> Lưu kênh liên hệ
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Opening Hours */}
      <Card>
        <CardHeader>
          <CardTitle>Giờ mở cửa</CardTitle>
          <CardDescription>
            Thời gian mở cửa hiển thị trên trang Liên hệ
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Thứ 2 - Thứ 6</Label>
              <Input
                value={hours.weekday ?? ""}
                onChange={(e) =>
                  setHours((prev) => ({ ...prev, weekday: e.target.value }))
                }
                placeholder="8:00 - 21:00"
              />
            </div>
            <div className="space-y-2">
              <Label>Thứ 7</Label>
              <Input
                value={hours.saturday ?? ""}
                onChange={(e) =>
                  setHours((prev) => ({ ...prev, saturday: e.target.value }))
                }
                placeholder="8:00 - 22:00"
              />
            </div>
            <div className="space-y-2">
              <Label>Chủ nhật</Label>
              <Input
                value={hours.sunday ?? ""}
                onChange={(e) =>
                  setHours((prev) => ({ ...prev, sunday: e.target.value }))
                }
                placeholder="9:00 - 20:00"
              />
            </div>
            <div className="space-y-2">
              <Label>Ngày lễ</Label>
              <Input
                value={hours.holidays ?? ""}
                onChange={(e) =>
                  setHours((prev) => ({ ...prev, holidays: e.target.value }))
                }
                placeholder="9:00 - 18:00"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button
              size="sm"
              onClick={handleSaveHours}
              disabled={upsert.isPending}
            >
              <Save className="mr-1 h-4 w-4" /> Lưu giờ mở cửa
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Social Links */}
      <Card>
        <CardHeader>
          <CardTitle>Liên kết mạng xã hội</CardTitle>
          <CardDescription>
            Các liên kết mạng xã hội hiển thị trên trang Liên hệ
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Facebook</Label>
              <Input
                value={socials.facebook ?? ""}
                onChange={(e) =>
                  setSocials((prev) => ({
                    ...prev,
                    facebook: e.target.value || undefined,
                  }))
                }
                placeholder="https://facebook.com/yourpage"
              />
            </div>
            <div className="space-y-2">
              <Label>Zalo</Label>
              <Input
                value={socials.zalo ?? ""}
                onChange={(e) =>
                  setSocials((prev) => ({
                    ...prev,
                    zalo: e.target.value || undefined,
                  }))
                }
                placeholder="https://zalo.me/yourpage"
              />
            </div>
            <div className="space-y-2">
              <Label>Website</Label>
              <Input
                value={socials.website ?? ""}
                onChange={(e) =>
                  setSocials((prev) => ({
                    ...prev,
                    website: e.target.value || undefined,
                  }))
                }
                placeholder="https://yourwebsite.com"
              />
            </div>
            <div className="space-y-2">
              <Label>TikTok</Label>
              <Input
                value={socials.tiktok ?? ""}
                onChange={(e) =>
                  setSocials((prev) => ({
                    ...prev,
                    tiktok: e.target.value || undefined,
                  }))
                }
                placeholder="https://tiktok.com/@yourpage"
              />
            </div>
            <div className="space-y-2">
              <Label>YouTube</Label>
              <Input
                value={socials.youtube ?? ""}
                onChange={(e) =>
                  setSocials((prev) => ({
                    ...prev,
                    youtube: e.target.value || undefined,
                  }))
                }
                placeholder="https://youtube.com/@yourchannel"
              />
            </div>
            <div className="space-y-2">
              <Label>Instagram</Label>
              <Input
                value={socials.instagram ?? ""}
                onChange={(e) =>
                  setSocials((prev) => ({
                    ...prev,
                    instagram: e.target.value || undefined,
                  }))
                }
                placeholder="https://instagram.com/yourpage"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button
              size="sm"
              onClick={handleSaveSocials}
              disabled={upsert.isPending}
            >
              <Save className="mr-1 h-4 w-4" /> Lưu liên kết mạng xã hội
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
