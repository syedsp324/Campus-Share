import Link from "next/link";

export default function ConfirmationErrorPage() {
  return (
    <section className="mx-auto max-w-xl card text-center">
      <p className="eyebrow">EMAIL CONFIRMATION</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">This confirmation link could not be used</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">It may have expired or already been used. If your account is already confirmed, return to sign in.</p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <Link href="/login" className="btn">Sign in</Link>
      </div>
    </section>
  );
}
