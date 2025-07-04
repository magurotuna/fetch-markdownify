import TurndownService from "npm:turndown";
import type { Node } from "npm:@types/turndown";
import { gfm } from "npm:turndown-plugin-gfm";

export function convertToMarkdown(
  content: string,
  contentType: "html" | "text",
): string {
  if (contentType === "text") {
    // For plain text, just return as-is with proper escaping
    return content;
  }

  // For HTML, use Turndown to convert to Markdown
  const turndownService = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    emDelimiter: "_",
    strongDelimiter: "**",
    linkStyle: "inlined",
  });

  // Use GFM plugin for better GitHub Flavored Markdown support
  turndownService.use(gfm);

  // Add custom rules for better conversion
  turndownService.addRule("preserveCodeBlocks", {
    filter: ["pre"],
    replacement: (content: string, node: Node) => {
      const element = node as Element;
      const codeElement = element.querySelector("code");
      if (codeElement) {
        const language = codeElement.className.match(/language-(\w+)/)?.[1] ||
          "";
        const code = codeElement.textContent || "";
        return `\n\`\`\`${language}\n${code}\n\`\`\`\n`;
      }
      return `\n\`\`\`\n${content}\n\`\`\`\n`;
    },
  });

  // Convert HTML to Markdown
  try {
    return turndownService.turndown(content);
  } catch (error) {
    // If conversion fails, return the original content in a code block
    console.error("Markdown conversion error:", error);
    return `\`\`\`html\n${content}\n\`\`\``;
  }
}
