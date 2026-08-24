"use client";

import { useEffect, useMemo, useState } from "react";
import { PlayCircle, Store } from "lucide-react";
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
 * Gate: bắt buộc mở ca POS trước khi thao tác.
 * - Có ca mở cho shop đang chọn → render children
 * - Chưa có ca mở → show dialog mở ca (số tiền đầu ca mặc định = 0)
 */
export function PosSessionGate({ shopId, children }: Props) {
  const user = useUser();
  const shops = useMyShops();
  const { findOpenSession, openSession, current } = usePosSession();
  const [openingCash, setOpeningCash] = useState<number>(0);
  const [selectedShop, setSelectedShop] = useState<string>("");
  const [openDialog, setOpenDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const shopOptions = useMemo(
    () => (shops.data ?? []).map((s) => ({ id: s.id, name: s.name })),
    [shops.data],
  );

  const openForShop = shopId ? findOpenSession(shopId) : null;

  useEffect(() => {
    // Nếu chưa có session mở → mở dialog ngay
    if (!openForShop && shopId) {
      setSelectedShop(shopId);
      setOpenDialog(true);
    } else {
      setOpenDialog(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId, openForShop?.id]);

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
    // dialog sẽ hiện — render null children để tránh tương tác nhầm
    return (
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PlayCircle className="h-5 w-5 text-emerald-500" />
              Mở ca POS
            </DialogTitle>
            <DialogDescription>
              Nhập tiền mặt đầu ca để hệ thống đối soát cuối ca.
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
