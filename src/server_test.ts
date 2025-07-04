import { assertEquals, assertExists } from "@std/assert";
import { InMemoryTransport } from "npm:@modelcontextprotocol/sdk/inMemory.js";
import { Client } from "npm:@modelcontextprotocol/sdk/client/index.js";
import {
  CallToolResultSchema,
  ListToolsResultSchema,
  type TextContent,
} from "npm:@modelcontextprotocol/sdk/types.js";
import { z } from "npm:zod";
import { createServer } from "./server.ts";
import complexHtml from "./test-fixtures/complex.html" with { type: "text" };
import simpleHtml from "./test-fixtures/simple.html" with { type: "text" };
import expectedComplexMd from "./test-fixtures/expected-complex.md" with {
  type: "text",
};
import expectedSimpleMd from "./test-fixtures/expected-simple.md" with {
  type: "text",
};

// Type helper for CallToolResult
type CallToolResultType = z.infer<typeof CallToolResultSchema>;

// Helper function for comparing markdown with better error messages
function assertMarkdownEquals(
  actual: string,
  expected: string,
  message?: string,
) {
  const actualTrimmed = actual.trim();
  const expectedTrimmed = expected.trim();

  if (actualTrimmed !== expectedTrimmed) {
    // Save actual output for debugging
    const debugPath = "./debug-output.md";
    Deno.writeTextFileSync(debugPath, actual);
    console.error(`\nActual markdown output saved to: ${debugPath}\n`);
  }

  assertEquals(actualTrimmed, expectedTrimmed, message);
}

// Test the exported handlers from server.ts
Deno.test("server module loads correctly", async () => {
  // Test that the server module loads without errors
  const serverModule = await import("./server.ts");
  assertExists(serverModule.server);
  // Verify server is created
  assertExists(serverModule.server.setRequestHandler);
});

Deno.test("server lists tools correctly", async () => {
  // Create linked transport pair
  const [clientTransport, serverTransport] = InMemoryTransport
    .createLinkedPair();

  // Create and connect server
  const server = createServer();
  await server.connect(serverTransport);

  // Create and connect client
  const client = new Client({
    name: "test-client",
    version: "1.0.0",
  }, {
    capabilities: {},
  });

  await client.connect(clientTransport);

  try {
    // List available tools
    const response = await client.request(
      {
        method: "tools/list",
        params: {},
      },
      ListToolsResultSchema,
    );

    const tools = response.tools;
    assertEquals(tools.length, 1);
    assertEquals(tools[0].name, "fetch-url");
    assertEquals(
      tools[0].description,
      "Fetches content from a URL and converts it to markdown",
    );
    assertExists(tools[0].inputSchema);
  } finally {
    await client.close();
    await server.close();
  }
});

Deno.test("server fetches and converts HTML content", async () => {
  // Mock fetch function using imported HTML
  const mockFetch = (_url: string | URL | Request) => {
    return Promise.resolve(
      new Response(simpleHtml, {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
    );
  };

  const [clientTransport, serverTransport] = InMemoryTransport
    .createLinkedPair();
  const server = createServer({ fetchFn: mockFetch });
  await server.connect(serverTransport);

  const client = new Client({
    name: "test-client",
    version: "1.0.0",
  }, {
    capabilities: {},
  });

  await client.connect(clientTransport);

  // Call the fetch-url tool
  const result = await client.callTool(
    {
      name: "fetch-url",
      arguments: {
        url: "https://example.com",
      },
    },
    CallToolResultSchema,
  ) as CallToolResultType;

  assertExists(result.content);
  assertEquals(result.content.length > 0, true);
  const firstContent = result.content[0] as TextContent;
  assertEquals(firstContent.type, "text");

  // Compare against expected markdown
  assertMarkdownEquals(firstContent.text, expectedSimpleMd);

  await client.close();
  await server.close();
});

Deno.test("server handles plain text content", async () => {
  // Mock fetch function
  const mockFetch = (_url: string | URL | Request) => {
    return Promise.resolve(
      new Response("Plain text content\nWith multiple lines", {
        status: 200,
        headers: { "content-type": "text/plain" },
      }),
    );
  };

  const [clientTransport, serverTransport] = InMemoryTransport
    .createLinkedPair();
  const server = createServer({ fetchFn: mockFetch });
  await server.connect(serverTransport);

  const client = new Client({
    name: "test-client",
    version: "1.0.0",
  }, {
    capabilities: {},
  });

  await client.connect(clientTransport);

  const result = await client.callTool(
    {
      name: "fetch-url",
      arguments: {
        url: "https://example.com/text.txt",
      },
    },
    CallToolResultSchema,
  ) as CallToolResultType;

  assertExists(result.content);
  const firstContent = result.content[0] as TextContent;
  assertEquals(firstContent.type, "text");
  assertEquals(firstContent.text, "Plain text content\nWith multiple lines");

  await client.close();
  await server.close();
});

Deno.test("server handles HTTP errors gracefully", async () => {
  // Mock fetch function
  const mockFetch = (_url: string | URL | Request) => {
    return Promise.resolve(
      new Response("Not Found", {
        status: 404,
        statusText: "Not Found",
      }),
    );
  };

  const [clientTransport, serverTransport] = InMemoryTransport
    .createLinkedPair();
  const server = createServer({ fetchFn: mockFetch });
  await server.connect(serverTransport);

  const client = new Client({
    name: "test-client",
    version: "1.0.0",
  }, {
    capabilities: {},
  });

  await client.connect(clientTransport);

  const result = await client.callTool(
    {
      name: "fetch-url",
      arguments: {
        url: "https://example.com/404",
      },
    },
    CallToolResultSchema,
  ) as CallToolResultType;

  assertEquals(result.isError, true);
  assertExists(result.content);
  const firstContent = result.content[0] as TextContent;
  assertEquals(firstContent.type, "text");
  assertEquals(firstContent.text.includes("HTTP error"), true);
  assertEquals(firstContent.text.includes("404"), true);

  await client.close();
  await server.close();
});

Deno.test("server handles invalid URLs", async () => {
  const [clientTransport, serverTransport] = InMemoryTransport
    .createLinkedPair();
  const server = createServer();
  await server.connect(serverTransport);

  const client = new Client({
    name: "test-client",
    version: "1.0.0",
  }, {
    capabilities: {},
  });

  await client.connect(clientTransport);

  const result = await client.callTool({
    name: "fetch-url",
    arguments: {
      url: "not-a-valid-url",
    },
  }, CallToolResultSchema) as CallToolResultType;

  assertEquals(result.isError, true);
  assertExists(result.content);
  const firstContent = result.content[0] as TextContent;
  assertEquals(firstContent.type, "text");
  assertEquals(firstContent.text.includes("Error fetching URL"), true);

  await client.close();
  await server.close();
});

Deno.test("server converts complex HTML with code blocks", async () => {
  // Mock fetch function
  const mockFetch = (_url: string | URL | Request) => {
    return Promise.resolve(
      new Response(
        `
      <article>
        <h1>Code Example</h1>
        <p>Here's some JavaScript:</p>
        <pre><code class="language-javascript">
function hello() {
  console.log("Hello, world!");
}
        </code></pre>
      </article>
    `,
        {
          status: 200,
          headers: { "content-type": "text/html" },
        },
      ),
    );
  };

  const [clientTransport, serverTransport] = InMemoryTransport
    .createLinkedPair();
  const server = createServer({ fetchFn: mockFetch });
  await server.connect(serverTransport);

  const client = new Client({
    name: "test-client",
    version: "1.0.0",
  }, {
    capabilities: {},
  });

  await client.connect(clientTransport);

  const result = await client.callTool(
    {
      name: "fetch-url",
      arguments: {
        url: "https://example.com/code",
      },
    },
    CallToolResultSchema,
  ) as CallToolResultType;

  assertExists(result.content);
  assertEquals(result.content.length > 0, true);
  const firstContent = result.content[0] as TextContent;
  assertEquals(firstContent.type, "text");
  const text = firstContent.text;
  assertEquals(text.includes("# Code Example"), true);
  assertEquals(text.includes("```javascript"), true);
  assertEquals(text.includes("function hello()"), true);

  await client.close();
  await server.close();
});

Deno.test("server handles complex HTML with various elements", async () => {
  // Mock fetch function using imported HTML
  const mockFetch = (_url: string | URL | Request) => {
    return Promise.resolve(
      new Response(complexHtml, {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
    );
  };

  const [clientTransport, serverTransport] = InMemoryTransport
    .createLinkedPair();
  const server = createServer({ fetchFn: mockFetch });
  await server.connect(serverTransport);

  const client = new Client({
    name: "test-client",
    version: "1.0.0",
  }, {
    capabilities: {},
  });

  await client.connect(clientTransport);

  const result = await client.callTool(
    {
      name: "fetch-url",
      arguments: {
        url: "https://example.com/complex",
      },
    },
    CallToolResultSchema,
  ) as CallToolResultType;

  assertExists(result.content);
  assertEquals(result.content.length > 0, true);
  const firstContent = result.content[0] as TextContent;
  assertEquals(firstContent.type, "text");

  // Compare against expected markdown
  assertMarkdownEquals(firstContent.text, expectedComplexMd);

  await client.close();
  await server.close();
});
