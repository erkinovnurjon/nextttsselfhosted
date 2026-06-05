"use client";

import { useEffect, useState } from "react";

// Swagger UI'ni CDN orqali yuklaymiz (paket o'rnatishsiz).
const SWAGGER_VERSION = "5.17.14";
const CSS = `https://unpkg.com/swagger-ui-dist@${SWAGGER_VERSION}/swagger-ui.css`;
const JS = `https://unpkg.com/swagger-ui-dist@${SWAGGER_VERSION}/swagger-ui-bundle.js`;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded) resolve();
      else {
        existing.addEventListener("load", () => resolve());
        existing.addEventListener("error", () => reject());
      }
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => {
      s.dataset.loaded = "1";
      resolve();
    };
    s.onerror = () => reject();
    document.body.appendChild(s);
  });
}

export default function ApiDocsPage() {
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // CSS bir marta
    if (!document.querySelector("link[data-swagger]")) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = CSS;
      link.setAttribute("data-swagger", "1");
      document.head.appendChild(link);
    }

    loadScript(JS)
      .then(() => {
        if (cancelled) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const SwaggerUIBundle = (window as any).SwaggerUIBundle;
        if (!SwaggerUIBundle) {
          setError(true);
          return;
        }
        SwaggerUIBundle({
          url: "/api/openapi",
          dom_id: "#swagger",
          presets: [SwaggerUIBundle.presets.apis],
          layout: "BaseLayout",
          deepLinking: true,
          docExpansion: "list",
          defaultModelsExpandDepth: 0,
          tryItOutEnabled: true,
          persistAuthorization: true,
        });
      })
      .catch(() => !cancelled && setError(true));

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 text-white">
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2">
              <path d="M2 10v3M6 6v11M10 3v18M14 8v7M18 5v13M22 10v3" strokeLinecap="round" />
            </svg>
          </span>
          <span className="text-sm font-semibold text-neutral-800">NextTTS API</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <a href="/api/openapi" className="text-indigo-600 hover:underline" target="_blank" rel="noreferrer">
            openapi.json
          </a>
          <a href="/" className="text-neutral-500 hover:text-neutral-800">
            ← Sayt
          </a>
        </div>
      </div>

      {error ? (
        <div className="p-8 text-center text-sm text-red-600">
          Swagger UI yuklanmadi (internet/CDN). <a className="underline" href="/api/openapi">openapi.json</a> ni to&apos;g&apos;ridan-to&apos;g&apos;ri oching.
        </div>
      ) : (
        <div id="swagger">
          <div className="p-8 text-center text-sm text-neutral-400">Yuklanmoqda…</div>
        </div>
      )}
    </div>
  );
}
