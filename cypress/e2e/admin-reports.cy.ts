/// <reference types="cypress" />

describe("Admin reports dashboard", () => {
  const adminSecret = Cypress.env("ADMIN_SECRET") || "admin-e2e-secret";
  const canonicalSearch =
    "time=2050-01-01T00:00:00Z&title=Admin%20Dashboard%20E2E";
  const reportReason = "Administrative smoke test report";

  const waitForFunctionsProxy = (attemptsRemaining = 30): Cypress.Chainable =>
    cy
      .request({
        url: "/api/published/__e2e_ready__",
        timeout: 10_000,
        failOnStatusCode: false,
      })
      .then((response) => {
        const contentType = response.headers["content-type"] || "";
        const ready = contentType.includes("application/json");
        if (ready) {
          return response;
        }
        if (attemptsRemaining <= 0) {
          throw new Error(
            `Function proxy not ready (last status ${response.status}, content-type "${contentType}")`,
          );
        }
        return cy
          .wait(500)
          .then(() => waitForFunctionsProxy(attemptsRemaining - 1));
      });

  let slug: string | undefined;

  afterEach(() => {
    if (!slug) return;
    cy.request({
      method: "DELETE",
      url: `/api/published/${slug}`,
      headers: { "x-admin-override": adminSecret },
      failOnStatusCode: false,
    }).its("status");
    slug = undefined;
  });

  it("lets admins toggle between reported and published lists", () => {
    slug = `admin-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const password = "AdminE2EPw1!";

    waitForFunctionsProxy();

    cy.request("POST", "/publish", {
      slug,
      password,
      canonicalSearch,
    })
      .its("status")
      .should("eq", 200);

    cy.request("POST", `/v/${slug}/report`, {
      reason: reportReason,
    })
      .its("status")
      .should("eq", 200);

    cy.intercept("GET", "/api/admin/reports*").as("reportsList");
    cy.intercept("GET", "/api/admin/published*").as("publishedList");

    cy.visit("/admin/reports");
    cy.get("input[type='password']").first().type(adminSecret);
    cy.contains("button", "Continue").click();
    cy.wait("@reportsList");

    cy.contains("a", slug).should("be.visible");

    cy.contains("button", "Published slugs").click();
    cy.wait("@publishedList");

    cy.contains("a", slug).should("be.visible");
    cy.contains("div", "Showing")
      .should("contain.text", "published slug")
      .and("contain.text", "1");
  });

  it("can clear reports and delete a published slug", () => {
    slug = `admin-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const password = "AdminE2EPw1!";

    waitForFunctionsProxy();

    cy.request("POST", "/publish", {
      slug,
      password,
      canonicalSearch,
    })
      .its("status")
      .should("eq", 200);

    cy.request("POST", `/v/${slug}/report`, {
      reason: reportReason,
    })
      .its("status")
      .should("eq", 200);

    cy.intercept("GET", "/api/admin/reports*").as("reportsList");
    cy.intercept("GET", "/api/admin/published*").as("publishedList");
    cy.intercept("DELETE", `/api/admin/reports/${slug}`).as("clearReports");
    cy.intercept("DELETE", `/api/published/${slug}`).as("deletePublished");

    cy.visit("/admin/reports");
    cy.get("input[type='password']").first().type(adminSecret);
    cy.contains("button", "Continue").click();
    cy.wait("@reportsList");

    cy.contains("a", slug)
      .closest("div.grid")
      .within(() => {
        cy.contains("button", "Clear reports").click();
      });

    cy.contains("button", "Confirm").click();
    cy.wait("@clearReports").its("response.statusCode").should("eq", 200);
    cy.contains("span", "Reviewed").should("be.visible");

    cy.contains("button", "Published slugs").click();
    cy.wait("@publishedList");

    cy.contains("a", slug)
      .closest("div.grid")
      .within(() => {
        cy.contains("button", "Delete countdown").click();
      });
    cy.contains("button", "Confirm").click();
    cy.wait("@deletePublished").its("response.statusCode").should("eq", 200);
    cy.contains("a", slug).should("not.exist");
  });
});
