"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCrudList } from "@/lib/api/admin-crud";
import { httpPost } from "@/lib/api/http";
import { UserPlus, Store, ShieldCheck, Eye, EyeOff } from "lucide-react";

type Shop = { id: string; name: string };
type Role = { id: string; name: string; code: string };

export default function AdminCreateUserPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [shopId, setShopId] = useState("");
  const [roleId, setRoleId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const shopsQ = useCrudList<Shop>("shops", { page: 1, pageSize: 200 });
  const rolesQ = useCrudList<Role>("roles", { page: 1, pageSize: 200 });

  const reset = () => {
    setFullName("");
    setEmail("");
    setPassword("");
    setShopId("");
    setRoleId("");
  };

  async function handleSubmit() {
    if (!fullName.trim() || !email.trim() || !password) {
      toast.error("Họ tên, email và mật khẩu không được để trống");
      return;
    }
    setSubmitting(true);
    try {
      const res = await httpPost<{ full_name: string; email: string }>("/v1/admin/users", {
        email: email.trim(),
        password,
        full_name: fullName.trim(),
        shop_id: shopId || null,
        role_id: roleId || null,
      });
      toast.success(`Đã tạo tài khoản cho ${res.full_name} (${res.email})`);
      reset();
    } catch (e: any) {
      toast.error(e?.error?.message ?? "Có lỗi xảy ra");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Tạo tài khoản nhân viên
          </CardTitle>
          <CardDescription>
            Tạo tài khoản đăng nhập mới cho nhân viên. Tài khoản được kích hoạt ngay, không cần xác nhận email.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 max-w-2xl">
            <div className="space-y-2 sm:col-span-2">
              <Label>Họ tên *</Label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nguyễn Văn A"
              />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nhanvien@lapstore.vn"
              />
            </div>
            <div className="space-y-2">
              <Label>Mật khẩu *</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Tối thiểu 6 ký tự"
                  className="pr-9"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Cửa hàng (không bắt buộc)</Label>
              <Select value={shopId} onValueChange={setShopId}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn cửa hàng" />
                </SelectTrigger>
                <SelectContent>
                  {(shopsQ.data?.items ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <span className="flex items-center gap-2">
                        <Store className="h-3.5 w-3.5" />
                        {s.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Vai trò (không bắt buộc)</Label>
              <Select value={roleId} onValueChange={setRoleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn vai trò" />
                </SelectTrigger>
                <SelectContent>
                  {(rolesQ.data?.items ?? []).map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      <span className="flex items-center gap-2">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        {r.name} ({r.code})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 flex gap-3 pt-2">
              <Button
                onClick={handleSubmit}
                disabled={submitting || !fullName.trim() || !email.trim() || !password}
              >
                {submitting ? "Đang tạo..." : "Tạo tài khoản"}
              </Button>
              <Button variant="outline" onClick={reset}>
                Làm lại
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
