import { randomUUID } from "node:crypto";
import { sql } from "@/lib/db/client";
import { createEstimate, decideSheet, getEstimate, getSheet, saveSheet, submitSheet } from "@/lib/db";

const org = randomUUID();
const owner = randomUUID();
const email = `${owner}@example.test`;

beforeAll(async () => {
  if (!process.env.TEST_DATABASE_URL) throw new Error("Set TEST_DATABASE_URL to a migrated test database.");
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  await sql()`insert into organizations (id, name, slug) values (${org}, 'Test organization', ${org})`;
  await sql()`insert into users (id, organization_id, email, name, role)
              values (${owner}, ${org}, ${email}, 'Test user', 'Representative')`;
});

afterAll(async () => {
  if (process.env.TEST_DATABASE_URL) {
    await sql()`delete from organizations where id = ${org}`;
    await sql().end();
  }
});

it("serializes submissions and decisions and rolls back a decision when its audit write fails", async () => {
  const { id, ownerUserId } = await createEstimate({
    title: "Test RFQ", organizationId: org, originator: "Test user", ownerUserId: owner,
  });
  expect(ownerUserId).toBe(owner);
  await saveSheet(id, org, [{ item: "Pump", qty: "2", base: "10", currency: "NGN" }]);
  const submissions = await Promise.all([submitSheet(id, org, email), submitSheet(id, org, email)]);
  expect(submissions.filter(result => "sheet" in result)).toHaveLength(1);
  expect(await getEstimate(id, org)).toMatchObject({ submittedBy: email, workflowStep: "line_manager" });
  expect(await getSheet(id, org)).toMatchObject({ submittedBy: email });
  const submitted = await sql()`select actor from audit_events where estimate_id = ${id} and action = 'sheet.submitted'`;
  expect(submitted.map(event => event.actor)).toEqual([email]);

  // Postgres text cannot contain NUL. The decision's audit insert is the first write using the actor.
  await expect(decideSheet(id, org, "returned", "invalid\0actor", "Line Manager")).rejects.toThrow();
  expect(await getEstimate(id, org)).toMatchObject({ reviewStage: "in_review", workflowStep: "line_manager" });
  expect(await getSheet(id, org)).toMatchObject({ reviewStage: "in_review" });

  const decisions = await Promise.all([
    decideSheet(id, org, "approved", "Manager", "Line Manager"),
    decideSheet(id, org, "approved", "Manager", "Line Manager"),
  ]);
  expect(decisions.filter(result => "sheet" in result)).toHaveLength(1);
  await decideSheet(id, org, "approved", "Director", "Sales Director");
  expect(await getEstimate(id, org)).toMatchObject({ reviewStage: "approved", workflowStep: "final" });
  expect(await getSheet(id, org)).toMatchObject({ reviewStage: "approved" });
});
