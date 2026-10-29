import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser, getResource } from "@/lib/api";
import { ResourceForm } from "@/components/ResourceForm";
import { EmptyState } from "@/components/Feedback";
export default async function EditResource({ params }: { params: Promise<{ id: string }> }) {
  const u = await getCurrentUser(); if (!u) redirect("/login");
  if (u.role !== "owner" && u.role !== "admin") return <EmptyState title="Resource owners and admins only" />;
  const r = await getResource((await params).id); if (!r) notFound();
  return <div className="space-y-4"><Link href="/owner/resources" className="text-sm text-indigo-700 hover:underline">← Manage resources</Link><h1 className="text-2xl font-bold">Edit {r.name}</h1><ResourceForm initial={r} /></div>;
}
