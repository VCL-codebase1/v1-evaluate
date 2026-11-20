import { NextResponse } from "next/server";

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>V11 Estimate API</title>
    <style>
      :root { color-scheme: light; }
      body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif; background: #f7f7f8; color: #111827; }
      .wrap { max-width: 1100px; margin: 0 auto; padding: 24px; }
      h1 { margin: 0 0 8px; font-size: 28px; }
      p { margin: 0 0 16px; color: #374151; }
      .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; margin: 16px 0; }
      pre { margin: 0; white-space: pre-wrap; word-break: break-word; font-size: 13px; line-height: 1.45; }
      .row { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; margin: 12px 0; }
      a.btn { display: inline-block; padding: 8px 12px; border-radius: 8px; border: 1px solid #d1d5db; background: #fff; color: #111827; text-decoration: none; }
      code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
      .muted { color: #6b7280; font-size: 13px; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <h1>V11 Estimate API</h1>
      <p>OpenAPI specification is served locally. No third-party scripts are loaded by this page.</p>
      <div class="row">
        <a class="btn" href="/api/v1/openapi.json">Open /api/v1/openapi.json</a>
      </div>
      <div class="card">
        <div class="muted">Quick start</div>
        <pre>POST /api/v1/auth/login { "email": "...", "password": "..." }
Authorization: Bearer &lt;accessToken&gt;</pre>
      </div>
      <div class="card">
        <div class="muted">OpenAPI document</div>
        <pre id="spec">Loading…</pre>
      </div>
    </div>
    <script>
      fetch('/api/v1/openapi.json', { credentials: 'same-origin' })
        .then(r => r.json())
        .then(j => { document.getElementById('spec').textContent = JSON.stringify(j, null, 2); })
        .catch(() => { document.getElementById('spec').textContent = 'Failed to load specification.'; });
    </script>
  </body>
</html>`;

export function GET() {
  return new NextResponse(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
