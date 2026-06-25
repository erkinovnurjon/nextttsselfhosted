"use client";

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
      {message}
    </div>
  );
}
