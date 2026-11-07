"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PlayCircle, Store, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUser } from "@/hooks/use-user";
import { useMyShops } from "@/lib/api/admin-crud";
import { usePosSession } from "@/hooks/use-pos-session";

type Props = {
  /** shopId hiện đang chọn ở POS */
  shopId: string;
  /** render content của POS */
  children: React.ReactNode;
};

/**
 * Gate: bắt buộc có ca POS trước khi thao tác.
 *
 * Chế độ quyền admin (/quanly): tự mở ca với quỹ 0đ nếu chưa có ca —
 * để máy admin để khách thanh toán không cần bấm "Mở ca" thủ công.
 * Dialog chỉ hiện khi auto-open thất bại (hoặc user muốn nhập quỹ đầu ca).
 */
export function PosSessionGate({ shopId, children }: Props) {
  const user = useUser();
  const shops = useMyShops();
  const { findOpenSession, openSession, isLoadingList } = usePosSession();
  const [openingCash, setOpeningCash] = useState<number>(0);
  const [selectedShop, setSelectedShop] = useState<string>("");
  const [openDialog, setOpenDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [autoTried, setAutoTried] = useState(false);
  const autoBusy = useRef(false);
  const lastAutoShop = useRef<string>("");

  const shopOptions = useMemo(
    () => (shops.data ?? []).map((s) => ({ id: s.id, name: s.name })),
    [shops.data],
  );

  const openForShop = shopId ? findOpenSession(shopId) : null;

  // Admin: tự mở ca quỹ 0đ — 1 lần / shop khi chưa có ca.
  useEffect(() => {
    if (!shopId || openForShop || isLoadingList || autoBusy.current) return;
    if (lastAutoShop.current === shopId && autoTried) return;

    lastAutoShop.current = shopId;
    autoBusy.current = true;
    setAutoTried(true);
    void (async () => {
      try {
        const result = await openSession({
          shop_id: shopId,
          opening_cash: 0,
        });
        if (result) {
          toast.success("Đã tự mở ca POS (quỹ đầu ca 0đ)", {
            description: "Chế độ admin — máy sẵn sàng thanh toán.",
          });
          setOpenDialog(false);
        } else {
          setSelectedShop(shopId);
          setOpenDialog(true);
        }
      } finally {
        autoBusy.current = false;
      }
    })();
  }, [shopId, openForShop, isLoadingList, autoTried, openSession]);

  useEffect(() => {
    if (openForShop) {
      setOpenDialog(false);
      return;
    }
    // Chỉ hiện dialog sau khi đã thử auto-open mà vẫn chưa có ca
    if (autoTried && !openForShop && shopId && !autoBusy.current) {
      setSelectedShop(shopId);
      setOpenDialog(true);
    }
  }, [shopId, openForShop, autoTried]);

  if (!shopId) {
    return (
      <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-3 p-6 text-center">
        <Store className="h-10 w-10 text-muted-foreground" />
        <div>
          <p className="font-medium">Chọn cửa hàng trước</p>
          <p className="text-sm text-muted-foreground">
            POS yêu cầu chọn cửa hàng để mở ca làm việc.
          </p>
        </div>
      </div>
    );
  }

  if (!openForShop) {
    if (!autoTried || autoBusy.current || submitting) {
      return (
        <div className="flex h-full min-h-[40vh] flex-col items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
          <Zap className="h-6 w-6 animate-pulse text-emerald-500" />
          Đang mở ca POS…
        </div>
      );
    }

    return (
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PlayCircle className="h-5 w-5 text-emerald-500" />
              Mở ca POS
            </DialogTitle>
            <DialogDescription>
              Tự mở ca chưa thành công. Nhập quỹ đầu ca rồi thử lại — hoặc để 0đ
              nếu chỉ dùng máy admin thanh toán nhanh.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>Cửa hàng</Label>
              <Select
                value={selectedShop || shopId}
                onValueChange={setSelectedShop}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn cửa hàng" />
                </SelectTrigger>
                <SelectContent>
                  {shopOptions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Quỹ tiền mặt đầu ca (VND)</Label>
              <Input
                type="number"
                min={0}
                value={Number.isNaN(openingCash) ? 0 : openingCash}
                onChange={(e) =>
                  setOpeningCash(Number(e.target.value) || 0)
                }
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground">
                Đếm tiền trong két và nhập vào đây. Số này + tổng tiền mặt bán
                trong ca = tiền mặt kỳ vọng cuối ca.
              </p>
            </div>
            {user.data?.email && (
              <div className="rounded-md bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                Mở ca với tư cách: <strong>{user.data.email}</strong>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              disabled={submitting || !selectedShop}
              onClick={async () => {
                setSubmitting(true);
                try {
                  const result = await openSession({
                    shop_id: selectedShop || shopId,
                    opening_cash: openingCash,
                  });
                  if (result) {
                    toast.success("Đã mở ca POS");
                    setOpenDialog(false);
                  } else {
                    toast.error("Không thể mở ca (bạn đã có ca đang mở?)");
                  }
                } finally {
                  setSubmitting(false);
                }
              }}
            >
              <PlayCircle className="mr-2 h-4 w-4" />
              Mở ca
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Có session mở → render POS
  return <>{children}</>;
}
