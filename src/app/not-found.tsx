import Link from "next/link";

export default function NotFound() {
  return (
    <main className="auth-panel">
      <div className="auth-form">
        <h1 className="text-welcome">Page not found</h1>
        <p className="text-subtitle">That screen is not part of the workspace yet.</p>
        <Link href="/" className="btn btn-primary btn-xl">
          Back to V11 Estimate
        </Link>
      </div>
    </main>
  );
}
