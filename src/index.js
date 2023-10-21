const fs = require("fs");
const path = require("path");
const { marked } = require("marked");
const Handlebars = require("handlebars");

// Read markdown file
const markdownContent = fs.readFileSync("./emojis.md", "utf8");

// Convert markdown to HTML using 'marked'
const htmlContent = marked(markdownContent);

// Read the HTML template
const template = fs.readFileSync(
  path.resolve(__dirname, "./template.html"),
  "utf8"
);

// Compile the template with Handlebars
const compiledTemplate = Handlebars.compile(template);

// Insert the markdown HTML into the template
const finalHtml = compiledTemplate({ content: htmlContent }).replace(
  /src\//g,
  "/"
);

// Save the final HTML to a file
fs.writeFileSync(path.resolve(__dirname, "../docs/emojis.html"), finalHtml);

console.log("HTML generated successfully!");
