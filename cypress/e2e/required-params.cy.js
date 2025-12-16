describe("required parameter editor", () => {
  const editor = () => cy.contains("Customize your countdown");
  const countdown = () => cy.get("#countdown");

  it("shows editor when time/date are missing", () => {
    cy.visit("/");
    cy.contains(/loading editor/i).should("be.visible");
    editor().should("be.visible");
    cy.contains("Time").should("be.visible");
    countdown().should("not.exist");
  });

  it("starts countdown when time is provided", () => {
    cy.visit("/?time=2030-01-01T00:00:00Z&title=Hello");
    editor().should("not.exist");
    countdown().should("be.visible");
    cy.contains("Hello");
  });

  it("accepts date alias", () => {
    cy.visit("/?date=2030-01-01T00:00:00Z");
    editor().should("not.exist");
    countdown().should("be.visible");
  });

  it("shows complete view when time is in the past", () => {
    const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    cy.visit(`/?time=${encodeURIComponent(past)}`);
    cy.get("#complete-container").should("be.visible");
    editor().should("not.exist");
    countdown().should("not.be.visible");
  });

  it("infers text color when only background color is provided", () => {
    cy.visit("/?time=2030-01-01T00:00:00Z&bgcolor=ffffff");
    cy.get("body").should("have.css", "background-color", "rgb(255, 255, 255)");
    cy.get("body").should("have.css", "color", "rgb(0, 0, 0)");
  });
});
