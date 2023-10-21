const fs = require("fs");
const path = require("path");
const { marked } = require("marked");
const Handlebars = require("handlebars");

// Read markdown file
const markdownEmojis = fs.readFileSync("./emojis.md", "utf8");

// Convert markdown to HTML using 'marked'
const htmlEmojis = marked(markdownEmojis);

// Read the HTML template
const template = fs.readFileSync(
  path.resolve(__dirname, "./template.html"),
  "utf8"
);

// Compile the template with Handlebars
const compiledTemplate = Handlebars.compile(template);

// Insert the markdown HTML into the template
const finalHtml = compiledTemplate({ emojis: htmlEmojis })
  .replace(/docs\//g, "/")
  .replace(/<img src="\/emojis/g, '<img data-src="../emojis')
  .replace(/<table>/g, '<table class="table" >');

// Save the final HTML to a file
fs.writeFileSync(
  path.resolve(__dirname, "../docs/instructions/index.html"),
  finalHtml
);

console.log("HTML generated successfully!");
