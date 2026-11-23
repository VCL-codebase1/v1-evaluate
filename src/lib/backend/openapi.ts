export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "V11 Estimate API",
    version: "1.1.0",
    description:
      "Bearer-token API for estimate workflows, version 1.1.0. Authenticate with POST /api/v1/auth/login using provisioned user credentials and send the access token as Authorization: Bearer <token>. This API is separate from the web workspace. Sheet lines may include the manager estimation fields itemNumber, manufacturer, model, partNumber, specification, unit, supplier, sourcing (Local or Foreign), delivery, warehouse, and markup. Foreign sourcing charges are not applied to locally sourced items.",
  },
  servers: [{ url: "/" }],
  tags: [
    { name: "Auth" },
    { name: "Estimates" },
    { name: "Approvals" },
    { name: "Audit" },
    { name: "Reference" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
    schemas: {
      Error: {
        type: "object",
        properties: { error: { type: "string" } },
      },
      User: {
        type: "object",
        properties: {
          id: { type: "string" },
          email: { type: "string" },
          name: { type: "string" },
          role: { type: "string", enum: ["Representative", "Line Manager", "Sales Director"] },
        },
      },
      Line: {
        type: "object",
        required: ["item", "source", "currency", "qty", "base", "freight", "msc"],
        properties: {
          id: { type: "string" },
          item: { type: "string" },
          source: { type: "string", enum: ["Local", "Air", "Sea"] },
          currency: { type: "string", enum: ["NGN", "USD", "EUR", "GBP"] },
          qty: { type: "string" },
          base: { type: "string" },
          freight: { type: "string" },
          msc: { type: "string" },
          itemNumber: { type: "string" },
          manufacturer: { type: "string" },
          model: { type: "string" },
          partNumber: { type: "string" },
          specification: { type: "string" },
          unit: { type: "string" },
          supplier: { type: "string" },
          sourcing: { type: "string", enum: ["Local", "Foreign"] },
          delivery: { type: "string" },
          warehouse: { type: "string" },
          markup: { type: "string" },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    "/api/v1/auth/login": {
      post: {
        tags: ["Auth"],
        security: [],
        summary: "Issue an access token and a refresh token",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: { email: { type: "string" }, password: { type: "string" } },
              },
            },
          },
        },
        responses: {
          "200": { description: "Tokens and the signed-in user" },
          "401": { description: "Unknown email or password", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/api/v1/auth/refresh": {
      post: {
        tags: ["Auth"],
        security: [],
        summary: "Rotate a refresh token",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", required: ["refreshToken"], properties: { refreshToken: { type: "string" } } },
            },
          },
        },
        responses: { "200": { description: "New token pair" }, "401": { description: "Refresh token rejected" } },
      },
    },
    "/api/v1/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Revoke the current refresh token",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", required: ["refreshToken"], properties: { refreshToken: { type: "string" } } },
            },
          },
        },
        responses: { "204": { description: "Revoked" } },
      },
    },
    "/api/v1/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Current user from the access token",
        responses: { "200": { description: "User" }, "401": { description: "Missing or expired token" } },
      },
    },
    "/api/v1/estimates": {
      get: { tags: ["Estimates"], summary: "Quotation queue", responses: { "200": { description: "Estimates" } } },
      post: {
        tags: ["Estimates"],
        summary: "Create an RFQ estimate",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["title", "clientName"],
                properties: {
                  title: { type: "string" },
                  clientName: { type: "string" },
                  description: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "201": { description: "Created" }, "400": { description: "Missing title or client" } },
      },
    },
    "/api/v1/estimates/{id}": {
      get: {
        tags: ["Estimates"],
        summary: "Estimate header",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Estimate" }, "404": { description: "Not found" } },
      },
    },
    "/api/v1/estimates/{id}/sheet": {
      get: {
        tags: ["Estimates"],
        summary: "Cost breakdown and workflow position",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Sheet, totals, and workflow" }, "404": { description: "Not found" } },
      },
      put: {
        tags: ["Estimates"],
        summary: "Replace sheet lines while the estimate is still editable",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["lines"],
                properties: { lines: { type: "array", items: { $ref: "#/components/schemas/Line" } } },
              },
            },
          },
        },
        responses: { "200": { description: "Saved sheet" }, "409": { description: "Locked" } },
      },
    },
    "/api/v1/estimates/{id}/submit": {
      post: {
        tags: ["Approvals"],
        summary: "Submit the estimate for line manager review",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Submitted" }, "400": { description: "No items" }, "409": { description: "Already submitted" } },
      },
    },
    "/api/v1/estimates/{id}/decision": {
      post: {
        tags: ["Approvals"],
        summary: "Advance or return the estimate. Line Manager approves the first step. Sales Director approves the rest through Finally Approved.",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["decision"],
                properties: { decision: { type: "string", enum: ["approved", "returned"] } },
              },
            },
          },
        },
        responses: { "200": { description: "Updated workflow" }, "403": { description: "Wrong role" }, "409": { description: "Not in review" } },
      },
    },
    "/api/v1/approvals": {
      get: {
        tags: ["Approvals"],
        summary: "Estimates currently in the approval queue",
        responses: { "200": { description: "Queue" } },
      },
    },
    "/api/v1/audit": {
      get: {
        tags: ["Audit"],
        summary: "History rows",
        parameters: [{ name: "estimateId", in: "query", schema: { type: "string" } }],
        responses: { "200": { description: "Events" } },
      },
    },
    "/api/v1/exchange-rates": {
      get: { tags: ["Reference"], summary: "Rates applied to foreign totals", responses: { "200": { description: "Rates" } } },
      put: {
        tags: ["Reference"],
        summary: "Update USD, EUR, or GBP rates and floatation. Sales Director or an organization administrator.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { USD: { type: "number" }, EUR: { type: "number" }, GBP: { type: "number" } },
              },
            },
          },
        },
        responses: { "200": { description: "Saved rates" } },
      },
    },
    "/api/v1/clients": {
      get: { tags: ["Reference"], summary: "Clients derived from estimates", responses: { "200": { description: "Clients" } } },
    },
    "/api/v1/directory": {
      get: {
        tags: ["Directory"],
        summary: "Saved clients or suppliers",
        parameters: [{ name: "kind", in: "query", required: true, schema: { type: "string", enum: ["client", "supplier"] } }],
        responses: { "200": { description: "Records" } },
      },
      post: {
        tags: ["Directory"],
        summary: "Add one record or import rows",
        requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
        responses: { "201": { description: "Saved" } },
      },
    },
    "/api/v1/pricing-rules": {
      get: { tags: ["Pricing"], summary: "Organization pricing percentages", responses: { "200": { description: "Rules" } } },
      put: {
        tags: ["Pricing"],
        summary: "Save pricing rules. Sales Director or an organization administrator.",
        responses: { "200": { description: "Saved rules" } },
      },
    },
    "/api/v1/quotations/{id}": {
      get: { tags: ["Quotations"], summary: "Quotation terms and issued copies", responses: { "200": { description: "Quotation" } } },
      put: { tags: ["Quotations"], summary: "Save terms or append an issued copy", responses: { "200": { description: "Saved quotation" } } },
    },
    "/api/v1/reports": {
      get: { tags: ["Reference"], summary: "Finally approved quotations", responses: { "200": { description: "Reports" } } },
    },
    "/api/v1/dashboard": {
      get: { tags: ["Reference"], summary: "Estimate counts", responses: { "200": { description: "Counts" } } },
    },
  },
} as const;
