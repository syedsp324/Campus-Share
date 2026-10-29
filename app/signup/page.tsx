import Link from "next/link";
import { SignupForm } from "@/components/SignupForm";

export default function SignupPage() {
  return (
    <div className="login-layout">
      <section className="login-story">
        <Link href="/resources" className="eyebrow text-indigo-200">CAMPUSSHARE</Link>
        <h1 className="mt-4 text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl">Make more of<br />your campus.</h1>
        <p className="mt-4 max-w-sm text-sm leading-6 text-indigo-100">Find shared spaces and equipment, request the time you need, and keep your campus projects moving.</p>
        <div className="login-signature"><span>✦</span><small>Shared resources<br />for campus life</small></div>
      </section>
      <SignupForm />
    </div>
  );
}
