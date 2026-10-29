import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/api";
import { ResourceForm } from "@/components/ResourceForm";
import { EmptyState } from "@/components/Feedback";
export default async function NewResource() {
  const u = await getCurrentUser(); if (!u) redirect("/login");
  if (u.role !== "owner" && u.role !== "admin") return <EmptyState title="Resource owners and admins only" />;
  return <div className="space-y-4"><Link href="/owner/resources" className="text-sm text-indigo-700 hover:underline">← Manage resources</Link><h1 className="text-2xl font-bold">Add a resource</h1><ResourceForm /></div>;
}
