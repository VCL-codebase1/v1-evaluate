import { canActOnWorkflowStep, canDecideEstimate, canManageExchangeRates, canManageUsers, canSubmitEstimate } from "../../src/lib/auth/roles";

describe("organization roles", () => {
  it("lets a representative submit and blocks them from deciding", () => {
    expect(canSubmitEstimate("Representative")).toBe(true);
    expect(canDecideEstimate("Representative")).toBe(false);
  });

  it("lets a line manager decide the first review step only", () => {
    expect(canDecideEstimate("Line Manager")).toBe(true);
    expect(canActOnWorkflowStep("Line Manager", "created")).toBe(false);
    expect(canActOnWorkflowStep("Line Manager", "line_manager")).toBe(true);
    expect(canActOnWorkflowStep("Line Manager", "sales_director")).toBe(false);
  });

  it("lets a sales director decide only the director step", () => {
    expect(canActOnWorkflowStep("Sales Director", "sales_director")).toBe(true);
    expect(canActOnWorkflowStep("Sales Director", "line_manager")).toBe(false);
    expect(canActOnWorkflowStep("Sales Director", "final")).toBe(false);
  });

  it("limits user management to the organization Super Admin", () => {
    expect(canManageUsers("Super Admin")).toBe(true);
    expect(canManageUsers("Admin")).toBe(false);
    expect(canManageUsers("Sales Director")).toBe(false);
  });

  it("lets representatives and line managers edit exchange rates", () => {
    expect(canManageExchangeRates("Representative")).toBe(true);
    expect(canManageExchangeRates("Line Manager")).toBe(true);
    expect(canManageExchangeRates("Sales Director")).toBe(true);
  });
});
