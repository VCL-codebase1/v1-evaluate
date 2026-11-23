describe("login", () => {
  it("shows organization signup", () => {
    cy.visit("/login");
    cy.contains("Welcome back");
    cy.contains("Create an organization");
  });
});
