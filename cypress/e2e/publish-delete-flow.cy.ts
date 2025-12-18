describe("Publishable slug flow", () => {
  it("publishes with password, loads via /v, and deletes the slug", () => {
    const baseUrl = (Cypress.config("baseUrl") as string).replace(/\/$/, "");
    const slug = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const password = "E2ESecret123!";
    const footerText = `E2E Footer ${Date.now()}`;

    const waitForFunctionsProxy = (attemptsRemaining = 30) => {
      return cy
        .request({
          url: "/api/published/__e2e_ready__",
          timeout: 10_000,
          failOnStatusCode: false,
        })
        .then((response) => {
          const contentType = response.headers["content-type"] || "";
          const ok = contentType.includes("application/json");
          if (ok) return;
          if (attemptsRemaining <= 0) {
            throw new Error(
              `Functions proxy not ready (last status ${response.status}, content-type "${contentType}")`,
            );
          }
          return cy
            .wait(500)
            .then(() => waitForFunctionsProxy(attemptsRemaining - 1));
        });
    };

    // The SPA can come up before the Netlify Functions server is ready.
    waitForFunctionsProxy();

    cy.visit("/edit?time=2027-01-01T00:00:00Z");
    cy.get("#footer").clear().type(footerText, { force: true });
    cy.get("#footer").should("have.value", footerText);
    cy.get("#publish-slug").clear().type(slug).should("have.value", slug);
    cy.get("#publish-password")
      .clear()
      .type(password)
      .should("have.value", password);
    cy.contains("Publish short URL").should("not.be.disabled").click();

    cy.contains("Short link")
      .should("be.visible")
      .parent()
      .within(() => {
        cy.get("input").should("have.value", `${baseUrl}/v/${slug}`);
      });

    cy.visit(`/v/${slug}`);
    cy.contains(footerText).should("be.visible");

    cy.contains("Edit").click();
    cy.location("pathname").should("eq", `/v/${slug}/edit`);
    cy.get("#owner-password").type(password);
    cy.contains("button", "Edit").click();

    cy.get("#publish-slug").should("have.value", slug);
    cy.get("#title").should("be.visible");

    const updatedFooterText = `${footerText} (updated)`;
    cy.get("#footer").clear().type(updatedFooterText, { force: true });
    cy.intercept("POST", "/publish").as("publishUpdate");
    cy.contains("Publish short URL").should("not.be.disabled").click();
    cy.wait("@publishUpdate").its("response.statusCode").should("eq", 200);

    cy.visit(`/v/${slug}`);
    cy.contains(updatedFooterText).should("be.visible");
    cy.contains("Edit").click();
    cy.location("pathname").should("eq", `/v/${slug}/edit`);
    cy.get("#owner-password").type(password);
    cy.contains("button", "Edit").click();

    cy.contains("Delete published slug").should("be.disabled");
    cy.intercept("DELETE", `/api/published/${slug}`).as("deleteSlug");
    cy.get("#delete-confirm").type(slug);
    cy.contains("Delete published slug").should("not.be.disabled").click();
    cy.wait("@deleteSlug").its("response.statusCode").should("eq", 200);

    cy.request({
      url: `/api/published/${slug}`,
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.equal(404);
    });
  });
});
