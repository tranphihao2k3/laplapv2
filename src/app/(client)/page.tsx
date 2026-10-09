import { HeroSection } from "@/components/client/home/hero-section";
import { BrandStrip } from "@/components/client/home/brand-strip";
import { FlashSale } from "@/components/client/home/flash-sale";
import { FeaturedProducts } from "@/components/client/home/featured-products";
import { PCComponentsSection } from "@/components/client/home/pc-components-section";
import { CategoryShowcase } from "@/components/client/home/category-showcase";
import { NeedCollections } from "@/components/client/home/need-collections";
import { PriceRangeSection } from "@/components/client/home/price-range-section";
import { PromoBanners } from "@/components/client/home/promo-banners";
import { BestSellers } from "@/components/client/home/best-sellers";
import { ServiceCards } from "@/components/client/home/service-cards";
import { StatsBar } from "@/components/client/home/stats-bar";
import { Testimonials } from "@/components/client/home/testimonials";
import { BlogTips } from "@/components/client/home/blog-tips";
import { TrustBar } from "@/components/client/home/trust-bar";
import { Newsletter } from "@/components/client/home/newsletter";
import { AnimatedBackground } from "@/components/client/home/animated-background";

export default function ClientHomePage() {
  return (
    <div className="relative bg-background">
      <AnimatedBackground />
      <HeroSection />
      <TrustBar />
      <BrandStrip />
      <FlashSale />
      <FeaturedProducts />
      <PCComponentsSection />
      <CategoryShowcase />
      <NeedCollections />
      <PriceRangeSection />
      <BestSellers />
      <PromoBanners />
      <ServiceCards />
      <StatsBar />
      <Testimonials />
      <BlogTips />
      <Newsletter />
    </div>
  );
}
