const sharedQuery = [
  "time=2035-01-01T00:00:00Z",
  "bgcolor=%230b1021",
  "color=%23f2f5ff",
].join("&");

describe("editor preview visibility", () => {
  it("shows the mini preview overlay on mobile until the preview scrolls into view", () => {
    cy.viewport("iphone-6");
    cy.visit(`/edit?${sharedQuery}`);

    cy.get('[data-testid="mini-preview"]').should("exist");
    cy.get('[data-testid="full-preview-card"]').scrollIntoView();
    cy.get('[data-testid="mini-preview"]').should("not.exist");
    cy.scrollTo("top", { ensureScrollable: false });
    cy.get('[data-testid="mini-preview"]').should("exist");
  });

  it("keeps the preview card sticky on desktop and never renders the mini overlay", () => {
    cy.viewport(1280, 720);
    cy.visit(`/edit?${sharedQuery}`);

    cy.get('[data-testid="full-preview-card"]').should(
      "have.css",
      "position",
      "sticky",
    );
    cy.get('[data-testid="mini-preview"]').should("not.exist");
  });
});
