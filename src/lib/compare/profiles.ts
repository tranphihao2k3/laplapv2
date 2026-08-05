/**
 * Trọng số tính điểm tổng theo nhu cầu sử dụng.
 *
 * Key phải khớp `Metric.id` trong spec-registry.ts (chỉ metric có scored: true).
 * Key của profile khớp NEED_TAG_SLUGS trong src/lib/product-collections.ts
 * (gaming | van-phong | do-hoa | mong-nhe), cộng thêm "default" cho điểm tổng chung.
 *
 * GIÁ KHÔNG có trong bất kỳ profile nào — nếu tính giá vào điểm tổng thì máy
 * rẻ-yếu sẽ thắng oan. Giá đi riêng qua chỉ số "đáng tiền" = điểm tổng / giá.
 *
 * Trọng số không cần cộng tròn 100: engine tự chia lại theo tổng trọng số
 * thực dùng của từng máy (metric thiếu dữ liệu bị loại khỏi cả tử và mẫu).
 */

export const WEIGHT_PROFILES: Record<string, Record<string, number>> = {
  // Điểm tổng chung: cân bằng, nghiêng về hiệu năng vì đa số người mua quan tâm nhất.
  default: {
    cpu: 28,
    gpu: 20,
    ram: 14,
    storage: 8,
    display: 10,
    resolution: 4,
    refreshHz: 4,
    battery: 7,
    weight: 5,
  },

  // Gaming: GPU là vua, tần số quét quan trọng hơn độ phân giải, pin/trọng lượng gần như bỏ.
  gaming: {
    cpu: 25,
    gpu: 40,
    ram: 12,
    storage: 5,
    display: 6,
    resolution: 2,
    refreshHz: 8,
    battery: 1,
    weight: 1,
  },

  // Văn phòng / học tập: CPU + RAM + pin. GPU rời gần như vô nghĩa.
  "van-phong": {
    cpu: 30,
    gpu: 5,
    ram: 15,
    storage: 8,
    display: 10,
    resolution: 4,
    refreshHz: 2,
    battery: 16,
    weight: 10,
  },

  // Đồ hoạ / dựng phim: CPU nhiều nhân + RAM + chất lượng màn (màu chuẩn) + độ phân giải.
  "do-hoa": {
    cpu: 28,
    gpu: 24,
    ram: 16,
    storage: 8,
    display: 14,
    resolution: 8,
    refreshHz: 2,
    battery: 0,
    weight: 0,
  },

  // Mỏng nhẹ / di động: trọng lượng + pin là ưu tiên số một.
  "mong-nhe": {
    cpu: 18,
    gpu: 4,
    ram: 10,
    storage: 6,
    display: 8,
    resolution: 3,
    refreshHz: 1,
    battery: 25,
    weight: 25,
  },
};
