import Link from "next/link";
import type { Availability, StoreProduct } from "@/lib/store/catalog";
import { productPath } from "@/lib/store/catalog";
import type { ProjectSummary } from "@/lib/store/projects";
import { AddToCartButton } from "./AddToCart";
import { Icon } from "./Icon";
import { naira } from "./format";

export function StockBadge({ a }: { a: Availability }) {
  if (a === "out") return <span className="badge badge--out">Out of stock</span>;
  if (a === "low") return <span className="badge badge--low">Low stock</span>;
  return <span className="badge badge--in">In stock</span>;
}

/** Grid links are not prefetched: the catalog's rate limit counts every page request. */
export function ProductCard({ p, role }: { p: StoreProduct; role?: string }) {
  const href = productPath(p);
  return (
    <article className="product-card" role={role}>
      <Link className="product-card__media" href={href} tabIndex={-1} aria-hidden="true" prefetch={false}>
        {p.image ? <img src={`${p.image}?w=360`} alt="" loading="lazy" width={360} height={360} /> : <Icon name="chip" className="product-card__glyph" />}
      </Link>
      <div className="product-card__body">
        <h3 className="product-card__title"><Link href={href} prefetch={false}>{p.title}</Link></h3>
        <div className="product-card__meta">
          <span className="price product-card__price">{naira(p.price)}</span>
          <StockBadge a={p.availability} />
        </div>
        <AddToCartButton productId={p.id} title={p.title} out={p.availability === "out"} />
      </div>
    </article>
  );
}

export function ProjectCard({ p, heading = "h3", showTime = false }: { p: ProjectSummary; heading?: "h2" | "h3"; showTime?: boolean }) {
  const H = heading;
  return (
    <article className="project-card">
      <div className="project-card__media photo" role="img" aria-label={p.imageUrl ? p.title : `${p.title} (photo coming soon)`}>
        {p.imageUrl ? <img className="photo__img" src={p.imageUrl} alt="" loading="lazy" /> : <Icon name="box" className="product-card__glyph" />}
      </div>
      <div className="project-card__body">
        <div className="project-card__chips"><span className="chip">{p.level}</span><span className="chip">{p.ageGroup}</span>{showTime && p.buildTime && <span className="chip">{p.buildTime}</span>}</div>
        <H className="project-card__title"><Link href={`/projects/${p.slug}`}>{p.title}</Link></H>
        <p className="project-card__text">{p.summary}</p>
        <p className="project-card__kit">
          <span>Kit from <span className="price project-card__price">{naira(p.kitPrice)}</span></span>
          <span>{p.componentCount} component{p.componentCount === 1 ? "" : "s"}</span>
        </p>
      </div>
    </article>
  );
}
