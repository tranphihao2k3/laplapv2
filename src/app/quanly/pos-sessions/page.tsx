"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCrudList } from "@/lib/api/admin-crud";
import { httpPost } from "@/lib/api/http";

type Session = {
  id: string;
  shop_id: string | null;
  opened_by: string | null;
  opened_at: string | null;
  closed_at: string | null;
  opening_cash: number | null;
  closing_cash: number | null;
  expected_cash: number | null;
  difference_cash: number | null;
};

type Shop = { id: string; name: string; code: string | null };

function fmtCurrency(v: number | null | undefined) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(v ?? 0);
}
function fmtDateTime(d: string | null) {
  if (!d) return "—";
  try { return new Date(d).toLocaleString("vi-VN"); } catch { return d; }
}
function getApiMsg(e: unknown) {
  return (e as { error?: { message?: string } })?.error?.message ?? "Có lỗi xảy ra";
}

export default function PosSessionsPage() {
  const qc = useQueryClient();
  const sessionQ = useCrudList<Session>("pos-sessions", { page: 1, pageSize: 100 });
  const shopQ = useCrudList<Shop>("shops", { page: 1, pageSize: 100 });

  const shopMap = useMemo(() => new Map((shopQ.data?.items ?? []).map((s) => [s.id, s])), [shopQ.data]);
  const sessions = sessionQ.data?.items ?? [];

  const openSessions = sessions.filter((s) => !s.closed_at);
  const closedSessions = sessions.filter((s) => s.closed_at);

  const [openOpen, setOpenOpen] = useState(false);
  const [shopId, setShopId] = useState("");
  const [openingCash, setOpeningCash] = useState(0);

  const openMut = useMutation({
    mutationFn: (body: { shop_id: string; opening_cash: number }) => httpPost("/v1/pos-sessions", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-crud", "pos-sessions"] });
      toast.success("Đã mở ca");
      setOpenOpen(false);
      setShopId("");
      setOpeningCash(0);
    },
    onError: (e) => toast.error(getApiMsg(e)),
  });

  const [closeId, setCloseId] = useState<string | null>(null);
  const [closingCash, setClosingCash] = useState(0);
  const closeSession = sessions.find((s) => s.id === closeId);

  const closeMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { closing_cash: number } }) =>
      httpPost(`/v1/pos-sessions/${id}/close`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-crud", "pos-sessions"] });
      toast.success("Đã đóng ca");
      setCloseId(null);
      setClosingCash(0);
    },
    onError: (e) => toast.error(getApiMsg(e)),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle>Ca làm POS</CardTitle>
            <CardDescription>
              Mỗi ca mở quỹ tiền đầu ca, đóng quỹ cuối ca để đối soát chênh lệch tiền mặt thực tế và tiền hệ thống ghi nhận.
            </CardDescription>
          </div>
          <Button onClick={() => setOpenOpen(true)} className="w-full sm:w-auto">+ Mở ca</Button>
        </CardHeader>
        <CardContent className="space-y-6">
          <section className="space-y-2">
            <h3 className="font-semibold">
              Ca đang mở <Badge className="ml-2 bg-emerald-600 hover:bg-emerald-600">{openSessions.length}</Badge>
            </h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cửa hàng</TableHead>
                  <TableHead>Mở lúc</TableHead>
                  <TableHead className="text-right">Quỹ đầu ca</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {openSessions.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Không có ca nào đang mở</TableCell></TableRow>
                ) : (
                  openSessions.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>{s.shop_id ? shopMap.get(s.shop_id)?.name ?? s.shop_id : "—"}</TableCell>
                      <TableCell>{fmtDateTime(s.opened_at)}</TableCell>
                      <TableCell className="text-right font-medium">{fmtCurrency(s.opening_cash)}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" onClick={() => {
                          setCloseId(s.id);
                          setClosingCash(s.opening_cash ?? 0);
                        }}>Đóng ca</Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </section>

          <section className="space-y-2">
            <h3 className="font-semibold">Lịch sử ca đã đóng</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cửa hàng</TableHead>
                  <TableHead>Mở</TableHead>
                  <TableHead>Đóng</TableHead>
                  <TableHead className="text-right">Quỹ đầu</TableHead>
                  <TableHead className="text-right">Quỹ cuối</TableHead>
                  <TableHead className="text-right">HT dự kiến</TableHead>
                  <TableHead className="text-right">Chênh lệch</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {closedSessions.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Chưa có ca nào đã đóng</TableCell></TableRow>
                ) : (
                  closedSessions.map((s) => {
                    const diff = s.difference_cash ?? 0;
                    return (
                      <TableRow key={s.id}>
                        <TableCell>{s.shop_id ? shopMap.get(s.shop_id)?.name ?? s.shop_id : "—"}</TableCell>
                        <TableCell>{fmtDateTime(s.opened_at)}</TableCell>
                        <TableCell>{fmtDateTime(s.closed_at)}</TableCell>
                        <TableCell className="text-right">{fmtCurrency(s.opening_cash)}</TableCell>
                        <TableCell className="text-right">{fmtCurrency(s.closing_cash)}</TableCell>
                        <TableCell className="text-right">{fmtCurrency(s.expected_cash)}</TableCell>
                        <TableCell className={`text-right font-semibold ${diff === 0 ? "text-emerald-600" : diff > 0 ? "text-blue-600" : "text-rose-600"}`}>
                          {diff > 0 ? "+" : ""}{fmtCurrency(diff)}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </section>
        </CardContent>
      </Card>

      {/* Open dialog */}
      <Dialog open={openOpen} onOpenChange={setOpenOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mở ca POS</DialogTitle>
            <DialogDescription>Nhập tiền mặt đầu ca để đối soát cuối ca.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Cửa hàng *</Label>
              <Select value={shopId} onValueChange={setShopId}>
                <SelectTrigger><SelectValue placeholder="Chọn cửa hàng" /></SelectTrigger>
                <SelectContent>
                  {(shopQ.data?.items ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Quỹ đầu ca (VND)</Label>
              <Input type="number" min={0} value={openingCash} onChange={(e) => setOpeningCash(Number(e.target.value) || 0)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenOpen(false)}>Huỷ</Button>
            <Button disabled={!shopId || openMut.isPending} onClick={() => openMut.mutate({ shop_id: shopId, opening_cash: openingCash })}>Mở ca</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close dialog */}
      <Dialog open={!!closeId} onOpenChange={(o) => { if (!o) setCloseId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Đóng ca POS</DialogTitle>
            <DialogDescription>Nhập số tiền mặt thực tế trong két để hệ thống tính chênh lệch.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm">
              <div>Cửa hàng: <strong>{closeSession?.shop_id ? shopMap.get(closeSession.shop_id)?.name : "—"}</strong></div>
              <div>Mở lúc: {fmtDateTime(closeSession?.opened_at ?? null)}</div>
              <div>Quỹ đầu ca: {fmtCurrency(closeSession?.opening_cash)}</div>
            </div>
            <div className="space-y-2">
              <Label>Tiền mặt cuối ca (đếm thực tế) *</Label>
              <Input type="number" min={0} value={closingCash} onChange={(e) => setClosingCash(Number(e.target.value) || 0)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseId(null)}>Huỷ</Button>
            <Button
              disabled={closeMut.isPending}
              onClick={() => closeId && closeMut.mutate({ id: closeId, body: { closing_cash: closingCash } })}
            >Đóng ca</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
