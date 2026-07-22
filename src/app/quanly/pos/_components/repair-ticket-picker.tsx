"use client";

import { useMemo, useState } from "react";
import { Search, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useCrudList } from "@/lib/api/admin-crud";
import { formatVND } from "./types";

export type RepairTicket = {
  id: string;
  device_name: string | null;
  serial_number: string | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  status: string | null;
  customer_id: string | null;
};

type RepairTicketPickerProps = {
  onPick: (ticket: RepairTicket) => void;
};

export function RepairTicketPicker({ onPick }: RepairTicketPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const ticketsQuery = useCrudList<RepairTicket>("repair-tickets", {
    page: 1,
    pageSize: 100,
  });

  const tickets = useMemo(() => {
    const all = ticketsQuery.data?.items ?? [];
    return all.filter((t) => t.status === "done" && (!search ||
      (t.device_name?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
      (t.serial_number?.toLowerCase().includes(search.toLowerCase()) ?? false)
    ));
  }, [ticketsQuery.data, search]);

  const handleSelect = (ticket: RepairTicket) => {
    onPick(ticket);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-2">
          <Wrench className="h-4 w-4" /> Sửa chữa
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Chọn máy sửa đã hoàn thành</DialogTitle>
          <DialogDescription>
            Chọn phiếu sửa có trạng thái "Đã sửa xong" để thêm phí sửa vào hóa đơn
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm thiết bị / serial..."
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="max-h-80 overflow-y-auto space-y-2">
            {tickets.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-4">
                {search ? "Không tìm thấy" : "Chưa có máy sửa hoàn thành"}
              </p>
            ) : (
              tickets.map((t) => (
                <div
                  key={t.id}
                  className="p-3 rounded border cursor-pointer hover:bg-muted"
                  onClick={() => handleSelect(t)}
                >
                  <div className="font-medium">{t.device_name || "Máy sửa"}</div>
                  <div className="text-xs text-muted-foreground">
                    SN: {t.serial_number || "—"} · {formatVND(t.actual_cost || t.estimated_cost || 0)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}