import { Server } from "npm:@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "npm:@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "npm:@modelcontextprotocol/sdk/types.js";
import { z } from "npm:zod";
import { convertToMarkdown } from "./markdown.ts";

export const server = new Server(
  {
    name: "fetch-markdownify",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

const FetchUrlSchema = z.object({
  url: z.string().url().describe("The URL to fetch and convert to markdown"),
});

server.setRequestHandler(ListToolsRequestSchema, () => {
  return {
    tools: [
      {
        name: "fetch-url",
        description: "Fetches content from a URL and converts it to markdown",
        inputSchema: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "The URL to fetch and convert to markdown",
            },
          },
          required: ["url"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== "fetch-url") {
    throw new Error(`Unknown tool: ${request.params.name}`);
  }

  try {
    const args = FetchUrlSchema.parse(request.params.arguments);

    // Fetch the URL
    const response = await fetch(args.url);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const contentType = response.headers.get("content-type") || "";
    const text = await response.text();

    // Convert to markdown based on content type
    let markdown: string;
    if (contentType.includes("text/html")) {
      markdown = convertToMarkdown(text, "html");
    } else if (
      contentType.includes("text/plain") || contentType.includes("text/")
    ) {
      markdown = convertToMarkdown(text, "text");
    } else {
      // For other content types, wrap in code block
      markdown = `\`\`\`\n${text}\n\`\`\``;
    }

    return {
      content: [
        {
          type: "text",
          text: markdown,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error fetching URL: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
      ],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP server 'fetch-markdownify' running on stdio");
}

if (import.meta.main) {
  main().catch((error) => {
    console.error("Server error:", error);
    Deno.exit(1);
  });
}
