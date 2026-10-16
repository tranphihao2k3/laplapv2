import { HeroSection } from "@/components/client/home/hero-section";
import { TrustBar } from "@/components/client/home/trust-bar";
import { FlashSale } from "@/components/client/home/flash-sale";
import { CategoryShowcase } from "@/components/client/home/category-showcase";
import { FeaturedProducts } from "@/components/client/home/featured-products";
import { BestSellers } from "@/components/client/home/best-sellers";
import { PriceRangeSection } from "@/components/client/home/price-range-section";
import { PromoBanners } from "@/components/client/home/promo-banners";
import { ServiceCards } from "@/components/client/home/service-cards";
import { Testimonials } from "@/components/client/home/testimonials";
import { Newsletter } from "@/components/client/home/newsletter";

/**
 * Block ordering is intentional and conversion-driven.
 *
 *  1. Hero              — primary message + entry CTA
 *  2. TrustBar          — 1-line guarantees, low visual weight
 *  3. FlashSale         — urgency FIRST so users see deals above the fold scroll
 *  4. CategoryShowcase  — primary browse-by-category entry
 *  5. FeaturedProducts  — newest laptops, main product feed
 *  6. BestSellers       — social proof via top sellers
 *  7. PriceRangeSection — budget filter (decision shortcut)
 *  8. PromoBanners      — trả góp + thu cũ đổi mới
 *  9. ServiceCards      — repair / trade-in / install — full-service ecosystem
 * 10. Testimonials      — social proof before email capture
 * 11. Newsletter        — last CTA: email capture
 *
 * Removed: AnimatedBackground (perf, visual noise on mobile), BrandStrip
 * (overlaps CategoryShowcase), NeedCollections (overlaps CategoryShowcase),
 * PCComponentsSection (PC parts belong on the PC builder page, not home),
 * StatsBar (marketing fluff, no decision value), BlogTips (blog has its
 * own /cau-hoi-thuong-gap + blog page — duplicate).
 */
export default function ClientHomePage() {
  return (
    <div className="relative bg-background">
      <HeroSection />
      <TrustBar />
      <FlashSale />
      <CategoryShowcase />
      <FeaturedProducts />
      <BestSellers />
      <PriceRangeSection />
      <PromoBanners />
      <ServiceCards />
      <Testimonials />
      <Newsletter />
    </div>
  );
}
