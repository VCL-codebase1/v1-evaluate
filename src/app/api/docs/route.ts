import { NextResponse } from "next/server";

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>V11 Estimate API</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: "/api/v1/openapi.json",
        dom_id: "#swagger",
        persistAuthorization: true
      });
    </script>
  </body>
</html>`;

export function GET() {
  return new NextResponse(html, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
