import Seo from "../components/Seo";
import MangoTrendingSection from "../components/MangoTrendingSection";

export default function MangoRolesPage() {
  return (
    <div className="cd-page" style={{ maxWidth: 1200, margin: "0 auto", padding: "1.5rem" }}>
      <Seo
        title="MANGO & Trending Roles Radar · HireSight"
        description="Explore exclusive trending opportunities from Meta, Apple, Netflix, Google, OpenAI, Cloudflare, Stripe, and leading labs with instant AI Match Simulator."
      />
      <MangoTrendingSection
        title="🔥 MANGO & Trending Roles Radar"
        subtitle="Curated high-demand engineering, AI, and systems opportunities from Meta, Apple, Netflix, Google, OpenAI, Cloudflare, Stripe, Anthropic & Amazon. Test your CV match instantly with Workers AI."
      />
    </div>
  );
}
