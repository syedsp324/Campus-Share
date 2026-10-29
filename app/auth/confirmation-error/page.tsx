import Link from "next/link";

export default function ConfirmationErrorPage() {
  return (
    <section className="mx-auto max-w-xl card text-center">
      <p className="eyebrow">EMAIL CONFIRMATION</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">This confirmation link could not be used</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">It may have expired or already been used. Return to sign-up to request another link, or sign in if your account is already confirmed.</p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <Link href="/signup" className="btn">Back to sign up</Link>
        <Link href="/login" className="btn-ghost">Sign in</Link>
      </div>
    </section>
  );
}
