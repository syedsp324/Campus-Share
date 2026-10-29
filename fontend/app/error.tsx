"use client";
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="card text-center"><p className="font-medium">Something went wrong.</p>
      <p className="text-sm text-slate-600">Please try again. If it keeps happening, let the team know.</p>
      <button onClick={reset} className="btn mt-3">Try again</button></div>);
}
