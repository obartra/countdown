/// <reference types="cypress" />

describe("Admin reports dashboard", () => {
  const adminSecret = Cypress.env("ADMIN_SECRET") || "admin-e2e-secret";
  const canonicalSearch = (() => {
    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // within backend 5-year window
    const iso = future.toISOString();
    return `time=${encodeURIComponent(iso)}&title=Admin%20Dashboard%20E2E`;
  })();
  const reportReason = "Administrative smoke test report";
  const clientIpFor = (slug: string) =>
    `203.0.113.${Math.max(1, Math.min(250, slug.length + 50))}`;

  beforeEach(() => {
    // Reset local blob storage (includes rate-limit buckets) so tests do not trip limits.
    cy.exec("rm -rf .netlify/published-data /tmp/.netlify/published-data");
  });

  const waitForFunctionsProxy = (attemptsRemaining = 30): Cypress.Chainable =>
    cy
      .request({
        url: "/api/published/__e2e_ready__",
        timeout: 10_000,
        failOnStatusCode: false,
      })
      .then((response) => {
        const contentType = response.headers["content-type"] || "";
        const ready =
          response.status < 500 || contentType.includes("application/json");
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

    cy.request({
      method: "POST",
      url: "/publish",
      headers: { "x-nf-client-connection-ip": clientIpFor(slug) },
      body: { slug, password, canonicalSearch },
    })
      .its("status")
      .should("eq", 200);

    cy.request({
      method: "POST",
      url: `/api/report/${slug}`,
      headers: { "x-nf-client-connection-ip": clientIpFor(slug) },
      body: { reason: reportReason },
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
    cy.wait("@publishedList").its("response.statusCode").should("eq", 200);

    cy.contains("a", slug).should("be.visible");
    cy.contains("div", "Showing").should("contain.text", "published slug");
  });

  it("can clear reports and delete a published slug", () => {
    slug = `admin-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const password = "AdminE2EPw1!";

    waitForFunctionsProxy();

    cy.request({
      method: "POST",
      url: "/publish",
      headers: { "x-nf-client-connection-ip": clientIpFor(slug) },
      body: { slug, password, canonicalSearch },
    })
      .its("status")
      .should("eq", 200);

    cy.request({
      method: "POST",
      url: `/api/report/${slug}`,
      headers: { "x-nf-client-connection-ip": clientIpFor(slug) },
      body: { reason: reportReason },
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
    cy.wait("@reportsList").its("response.statusCode").should("eq", 200);

    cy.contains("a", slug)
      .closest("div.grid")
      .within(() => {
        cy.contains("button", "Clear reports").click();
      });

    cy.contains("button", "Confirm").click();
    cy.wait("@clearReports").its("response.statusCode").should("eq", 200);
    cy.contains("span", "Reviewed").should("be.visible");

    cy.contains("button", "Published slugs").click();
    cy.wait("@publishedList").its("response.statusCode").should("eq", 200);

    cy.contains("a", slug)
      .closest("div.grid")
      .within(() => {
        cy.contains("button", "Delete countdown").click();
      });
    cy.contains("button", "Confirm").click();
    cy.wait("@deletePublished").its("response.statusCode").should("eq", 200);
    cy.contains("a", slug).should("not.exist");
  });

  it("clears the admin secret via settings and prompts again", () => {
    cy.intercept("GET", "/admin-stats").as("stats");
    cy.visit("/admin");
    cy.get("input[type='password']").first().type(adminSecret);
    cy.contains("button", "Continue").click();
    cy.wait("@stats");
    cy.contains("button", "Clear secret").click();
    cy.contains(/admin access/i).should("be.visible");
    cy.get("input[type='password']").should("exist");
  });
});
