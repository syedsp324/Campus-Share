import Link from "next/link";
import { connection } from "next/server";
import { getCurrentUser } from "../lib/api";
import { signOutAction } from "../app/form-actions";

export async function UserNavigation() {
  await connection();
  const user = await getCurrentUser();

  return (
    <>
      {user && <Link href="/dashboard" className="nav-link">Dashboard</Link>}
      {user && <Link href="/my-bookings" className="nav-link">My bookings</Link>}
      {user && user.role !== "user" && (
        <>
          <Link href="/owner/requests" className="nav-link">Requests</Link>
          <Link href="/owner/resources" className="nav-link">Manage resources</Link>
          <Link href="/owner/active" className="nav-link">Check-in / return</Link>
        </>
      )}
      <span className="ml-auto flex items-center gap-3 text-sm">
        {user ? (
          <>
            <span className="hidden text-slate-600 sm:inline">{user.name} <span className="role-pill">{user.role}</span></span>
            <form action={signOutAction}>
              <button className="btn-ghost">Sign out</button>
            </form>
          </>
        ) : (
          <Link href="/login" className="btn">Sign in</Link>
        )}
      </span>
    </>
  );
}
