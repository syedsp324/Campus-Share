import Link from "next/link";
import { io } from "next/cache";
import { listResourceResult } from "@/lib/api";
import { ResourceCard } from "@/components/ResourceCard";
import { EmptyState } from "@/components/Feedback";
import { Suspense } from "react";
import type { ResourceCategory } from "@/src/types/resource";
const CATS: ResourceCategory[] = ["LAB", "MAKERSPACE_TOOL", "CAMERA", "COMPUTER", "ROOM", "TEST_DEVICE"];
export default function Resources({ searchParams }: { searchParams: Promise<{ q?: string; category?: ResourceCategory }> }) {
  return <Suspense fallback={<div className="loading-panel">Finding resources for your campus…</div>}><ResourceListing searchParams={searchParams} /></Suspense>;
}

async function ResourceListing({ searchParams }: { searchParams: Promise<{ q?: string; category?: ResourceCategory }> }) {
  // Supabase Auth may read the current time while initializing its server client.
  // Keep that request-specific work outside the prerendered shell.
  await io();
  const { q, category } = await searchParams;
  const result = await listResourceResult({ query: q, category: CATS.includes(category as ResourceCategory) ? category : undefined });
  const items = result.ok ? result.data : [];
  const categoryIcons: Record<ResourceCategory, string> = { LAB: "⌬", MAKERSPACE_TOOL: "⚒", CAMERA: "◉", COMPUTER: "⌘", ROOM: "▤", TEST_DEVICE: "◈" };
  return (<>
    <div className="page-stack">
      <section className="explore-hero">
        <div className="explore-copy">
          <p className="announcement-pill"><span>New feature</span><span>Book on campus <b aria-hidden="true">→</b></span></p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">The new way to book a study room and equipment on campus.</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">Find a variety of rooms and equipment—from study spaces to cameras, labs, and tools—all in one place.</p>
          <form className="hero-search mt-7" role="search">
            <label className="hero-search-input"><span aria-hidden="true">⌕</span><span className="sr-only">Search resources</span><input name="q" defaultValue={q} placeholder="Find a room or resource" /></label>
            <label className="hero-search-select"><span className="sr-only">Category</span><select name="category" defaultValue={category ?? ""}><option value="">All resources</option>{CATS.map((c) => <option key={c} value={c}>{c.replaceAll("_", " ")}</option>)}</select></label>
            <button className="btn btn-teal">Search resources</button>
          </form>
          <div className="hero-metrics mt-5"><span><strong>{result.ok ? items.length : "—"}</strong> resources available</span><span className="hero-note"><span className="live-dot" /> Campus sharing made simple</span></div>
        </div>
      </section>
      <CampusPreview items={items} />
      <section className="category-section" aria-label="Browse by category">
        <div className="section-heading"><div><p className="eyebrow">START WITH A CATEGORY</p><h2 className="mt-1 text-xl font-semibold">What are you looking for?</h2></div><span className="result-count">{items.length} {items.length === 1 ? "match" : "matches"}</span></div>
        <div className="category-ribbon mt-4">{CATS.map((c) => <Link key={c} href={`/resources?category=${c}`} className={`category-tile tone-${c.toLowerCase()}`}><span className="category-tile-icon">{categoryIcons[c]}</span><span>{c.replaceAll("_", " ")}</span><span aria-hidden="true" className="category-tile-arrow">↗</span></Link>)}</div>
      </section>
      {!result.ok ? <section className="resource-error" role="alert"><span className="resource-error-icon">!</span><div><h3>We couldn’t load the resources</h3><p>{result.error.message}</p>{result.error.code === "UNAUTHENTICATED" && <Link className="resource-error-link" href="/login">Sign in to browse resources →</Link>}</div></section> : items.length ? <div id="resources" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{items.map((r) => <ResourceCard key={r.id} r={r} />)}</div> : q || category ? <section className="empty-results"><span className="empty-results-mark">⌕</span><h2>No resources match those filters</h2><p>Try another search or category to see more of the campus directory.</p><Link href="/resources" className="btn btn-teal">Clear filters</Link></section> : <EmptyState title="No active resources yet" hint="The resource directory is empty right now. If a resource was deactivated, its owner can make it available again from Manage resources." />}
      <p className="quiet-note">Shared with care · Bookings are subject to resource requirements and owner approval.</p>
    </div>
  </>);
}

function CampusPreview({ items }: { items: import("@/src/types/resource").ResourceSummary[] }) {
  const featured = items[0];
  return (
    <section className="campus-preview-shell" aria-label="Campus resource preview">
      <div className="campus-preview-topbar"><span className="preview-window-dots"><i /><i /><i /></span><span>CampusShare · Resource explorer</span><span className="preview-live"><span className="live-dot" /> Live listings</span></div>
      <div className="campus-preview-grid">
        <aside className="preview-sidebar"><div className="preview-search"><span>⌕</span> Find a resource</div><p className="preview-label">Browse campus</p><div className="preview-campus-pills"><span className="active">All resources</span><span>Rooms</span><span>Equipment</span></div><p className="preview-label mt-4">Popular categories</p><div className="preview-category-list"><span className="tone-lab"><i /> Labs</span><span className="tone-camera"><i /> Cameras</span><span className="tone-room"><i /> Study rooms</span><span className="tone-makerspace_tool"><i /> Tools</span></div><div className="preview-sidebar-count"><strong>{items.length}</strong><span>resources listed</span></div></aside>
        <div className="campus-map" role="img" aria-label="Students working with clinical lab equipment" />
      </div>
      <div className="preview-featured">{featured ? <><span className={`preview-feature-icon tone-${featured.category.toLowerCase()}`}>{featured.category === "CAMERA" ? "◉" : featured.category === "ROOM" ? "▤" : featured.category === "LAB" ? "⌬" : "◇"}</span><div className="preview-feature-copy"><span className="preview-feature-kicker">FEATURED RESOURCE</span><strong>{featured.name}</strong><small>{featured.location ?? "Campus location"} · Shared by {featured.ownerName}</small></div><Link href={`/resources/${featured.id}`} className="preview-feature-link">View details <span aria-hidden="true">→</span></Link></> : <><span className="preview-feature-icon tone-lab">⌬</span><div className="preview-feature-copy"><span className="preview-feature-kicker">RESOURCE DIRECTORY</span><strong>Explore what your campus shares</strong><small>Resources appear here when the directory is available.</small></div><Link href="/login" className="preview-feature-link">Sign in <span aria-hidden="true">→</span></Link></>}</div>
    </section>
  );
}
