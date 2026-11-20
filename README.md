# V11 Estimate

V11 Estimate is the workspace for building RFQ cost sheets, routing them through line manager and sales director approval, and keeping the audit history of every change.

Representatives prepare a quotation. Line managers review the full estimation sheet, including manufacturer, sourcing, and the NGN totals. Sales directors complete the final approval.

## API documentation

Interactive docs: [http://localhost:3000/api/docs](http://localhost:3000/api/docs)

OpenAPI 1.1.0 document: [http://localhost:3000/api/v1/openapi.json](http://localhost:3000/api/v1/openapi.json)

Sign in from the docs with `rep1@v11.estimate`, `manager@v11.estimate`, or `director@v11.estimate`. The shared password is `Estimate123!`. Send the access token as `Authorization: Bearer`.

## PostgreSQL

Copy `.env.example` to `.env.local` and set `DATABASE_URL` to your PostgreSQL database. The API creates `workspace_state` and `api_state` on first use. Leave `DATABASE_URL` unset to run the workspace against the in-memory store.

`JWT_SECRET` signs the `/api/v1` access and refresh tokens.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in with an email that contains `manager` to open the line manager workspace.
