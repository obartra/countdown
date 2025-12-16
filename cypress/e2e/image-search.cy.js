/// <reference types="cypress" />

describe("editor image search", () => {
  it("searches, selects, and loads more images", () => {
    cy.intercept("GET", "**/api/openverse/v1/images*", (req) => {
      const url = new URL(req.url);
      const page = url.searchParams.get("page") || "1";
      if (page === "2") {
        req.reply({
          results: [
            {
              id: "openverse:2222-2222-2222-2222-222222222222",
              thumbnail: "https://example.com/thumb2.svg",
              title: "Open cat 2",
              width: 300,
              height: 300,
            },
          ],
          next: null,
        });
      } else {
        req.reply({
          results: [
            {
              id: "openverse:1111-1111-1111-1111-111111111111",
              thumbnail: "https://example.com/thumb.svg",
              title: "Open cat",
              width: 400,
              height: 400,
            },
          ],
          next: "token",
        });
      }
    }).as("ovSearch");

    cy.intercept(
      "GET",
      "**/api/openverse/v1/images/1111-1111-1111-1111-111111111111",
      {
        id: "openverse:1111-1111-1111-1111-111111111111",
        url: "https://example.com/open-cat.svg",
        title: "Open cat",
        creator: "Unit test",
        foreign_landing_url: "https://example.com/source",
      },
    ).as("ovDetail");

    cy.intercept("GET", "**/v2/search*", (req) => {
      const url = new URL(req.url);
      const pos = url.searchParams.get("pos");
      if (pos === "token") {
        req.reply({
          results: [
            {
              id: "tenor-more",
              title: "Tenor more",
              media_formats: {
                nanogif: {
                  url: "https://example.com/tenor-more.gif",
                  dims: [220, 220],
                },
              },
            },
          ],
          next: null,
        });
      } else {
        req.reply({
          results: [
            {
              id: "tenor-cat",
              title: "Tenor cat",
              media_formats: {
                nanogif: {
                  url: "https://example.com/tenor.gif",
                  dims: [220, 220],
                },
              },
            },
          ],
          next: "token",
        });
      }
    }).as("tenorSearch");

    cy.intercept("GET", "**/v2/posts*", {
      results: [
        {
          id: "tenor-cat",
          title: "Tenor cat",
          media_formats: {
            nanogif: { url: "https://example.com/tenor.gif", dims: [220, 220] },
          },
        },
      ],
    }).as("tenorDetail");

    cy.visit("/?edit=1");

    cy.get("#image-search").type("cat");
    cy.wait(["@ovSearch", "@tenorSearch"]);
    cy.contains("Tenor cat").should("be.visible");

    cy.get('[data-testid="image-result-tenor:tenor-cat"]', {
      timeout: 8000,
    }).click();
    cy.wait("@tenorDetail");
    cy.get('[data-testid="selected-image-heading"]').should("be.visible");
    cy.contains("tenor:tenor-cat").should("be.visible");
    cy.location("search").should("contain", "image=tenor%3Atenor-cat");
  });
});
