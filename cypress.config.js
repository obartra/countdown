const { defineConfig } = require("cypress");

const baseUrl = process.env.CYPRESS_BASE_URL || "http://localhost:8080";

module.exports = defineConfig({
  e2e: {
    baseUrl,
    supportFile: false,
  },
});
