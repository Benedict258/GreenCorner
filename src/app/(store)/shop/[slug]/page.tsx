import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { ProductCard, ProjectCard, StockBadge } from "@/components/store/Cards";
import { ProductBuy } from "@/components/store/AddToCart";
import { Gallery } from "@/components/store/Gallery";
import { Icon } from "@/components/store/Icon";
import { naira } from "@/components/store/format";
import { getProduct, idFromSlug, productPath, relatedProducts } from "@/lib/store/catalog";
import { projectsUsing } from "@/lib/store/projects";
import { descriptionSummary } from "@/lib/sanitize";

type Props = { params: Promise<{ slug: string }> };

async function load(slug: string) {
  const id = idFromSlug(slug);
  return id ? getProduct(id) : null;
}

export async function generateMetadata({ params }: Props) {
  const p = await load((await params).slug);
  if (!p) return { title: "Product not found" };
  return {
    title: p.title,
    description: descriptionSummary(p.description) || `${p.title}: ${naira(p.price)} at Waste2Light Store, delivered in Minna.`,
    alternates: { canonical: productPath(p) },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const p = await load(slug);
  if (!p) notFound();
  if (slug !== `${p.id}-${p.slug}`) permanentRedirect(productPath(p));
  const [projects, related] = await Promise.all([projectsUsing(p.ref).catch(() => []), relatedProducts(p).catch(() => [])]);
  const out = p.availability === "out";

  return (
    <div className="container">
      <nav className="crumbs" aria-label="Breadcrumb">
        <ol>
          <li><Link href="/shop">Shop</Link></li>
          <li><Link href={`/shop?category=${encodeURIComponent(p.category)}`}>{p.category}</Link></li>
          <li aria-current="page">{p.title}</li>
        </ol>
      </nav>
      <div className="pdp">
        <Gallery images={p.images} title={p.title} />
        <div className="buy">
          <h1 className="buy__title">{p.title}</h1>
          <div className="buy__price-row"><span className="price buy__price">{naira(p.price)}</span><StockBadge a={p.availability} /></div>
          <ProductBuy productId={p.id} price={naira(p.price)} out={out} />
          <ul className="trust">
            <li><Icon name="truck" />Delivery or pickup in Minna</li>
            <li><Icon name="lock" />Secure payment by Paystack</li>
            <li><Icon name="phone" /><a href="https://wa.me/2348078787646">Questions? WhatsApp us</a></li>
          </ul>
        </div>
      </div>
      {p.description && (
        <section className="desc" aria-label="Description">
          <div>
            <h2>About this product</h2>
            <div className="prose-desc" dangerouslySetInnerHTML={{ __html: p.description }} />
          </div>
        </section>
      )}
      {projects.length > 0 && (
        <section className="band" aria-labelledby="used-title">
          <h2 className="band__title" id="used-title">Used in these projects</h2>
          <div className="grid-4 projects">{projects.map((pr) => <ProjectCard key={pr.id} p={pr} />)}</div>
        </section>
      )}
      {related.length > 0 && (
        <section className="band" aria-labelledby="also-title">
          <h2 className="band__title" id="also-title">You may also need</h2>
          <div className="grid-4">{related.map((r) => <ProductCard key={r.id} p={r} />)}</div>
        </section>
      )}
      <div className="product-page-end" />
    </div>
  );
}
