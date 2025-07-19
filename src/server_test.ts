import { assertEquals, assertExists } from "@std/assert";
import { InMemoryTransport } from "npm:@modelcontextprotocol/sdk/inMemory.js";
import { Client } from "npm:@modelcontextprotocol/sdk/client/index.js";
import {
  CallToolResultSchema,
  ListToolsResultSchema,
  type TextContent,
} from "npm:@modelcontextprotocol/sdk/types.js";
import type { z } from "npm:zod";
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

Deno.test("server accepts chunk_size parameter", async () => {
  const mockFetch = (_url: string | URL | Request) => {
    return Promise.resolve(
      new Response("<p>Small test content</p>", {
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

  try {
    const result = await client.callTool(
      {
        name: "fetch-url",
        arguments: {
          url: "https://example.com/test.html",
          chunk_size: 1000,
        },
      },
      CallToolResultSchema,
    ) as CallToolResultType;

    assertExists(result.content);
    const firstContent = result.content[0] as TextContent;
    assertEquals(firstContent.type, "text");
    // Should return the content normally when it fits in chunk_size
    assertEquals(firstContent.text, "Small test content");
  } finally {
    await client.close();
    await server.close();
  }
});

Deno.test("server accepts chunk_index parameter", async () => {
  const largeContent = "<p>First paragraph.</p>".repeat(50) +
    "<p>Second chunk content.</p>".repeat(50);

  const mockFetch = (_url: string | URL | Request) => {
    return Promise.resolve(
      new Response(largeContent, {
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

  try {
    const result = await client.callTool(
      {
        name: "fetch-url",
        arguments: {
          url: "https://example.com/large.html",
          chunk_size: 100, // Small chunk size to force splitting
          chunk_index: 1, // Request second chunk
        },
      },
      CallToolResultSchema,
    ) as CallToolResultType;

    assertExists(result.content);
    // Test will fail until implementation is done
  } finally {
    await client.close();
    await server.close();
  }
});

Deno.test("server accepts metadata_only parameter", async () => {
  const largeContent = "<p>Large content here.</p>".repeat(200);

  const mockFetch = (_url: string | URL | Request) => {
    return Promise.resolve(
      new Response(largeContent, {
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

  try {
    const result = await client.callTool(
      {
        name: "fetch-url",
        arguments: {
          url: "https://example.com/large.html",
          chunk_size: 100,
          metadata_only: true,
        },
      },
      CallToolResultSchema,
    ) as CallToolResultType;

    assertExists(result.content);
    const firstContent = result.content[0] as TextContent;
    assertEquals(firstContent.type, "text");

    // Should return metadata about chunks
    const metadata = JSON.parse(firstContent.text);
    assertExists(metadata.total_chunks);
    assertExists(metadata.total_tokens);
    assertExists(metadata.chunk_size);
  } finally {
    await client.close();
    await server.close();
  }
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

Deno.test("server handles large content with pagination", async () => {
  // Create large HTML content that will require multiple chunks
  const largeParagraph =
    "<p>This is a test paragraph with some content that will be repeated many times to create a large document. </p>";
  const largeHtml = `
    <!DOCTYPE html>
    <html>
    <head><title>Large Document</title></head>
    <body>
      <h1>Large Document Test</h1>
      ${largeParagraph.repeat(500)}
      <h2>Second Section</h2>
      ${largeParagraph.repeat(500)}
    </body>
    </html>
  `;

  const mockFetch = (_url: string | URL | Request) => {
    return Promise.resolve(
      new Response(largeHtml, {
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

  try {
    // First, get metadata about chunks
    const metadataResult = await client.callTool(
      {
        name: "fetch-url",
        arguments: {
          url: "https://example.com/large.html",
          chunk_size: 5000, // Small chunk size to force multiple chunks
          metadata_only: true,
        },
      },
      CallToolResultSchema,
    ) as CallToolResultType;

    assertExists(metadataResult.content);
    const metadataContent = metadataResult.content[0] as TextContent;
    const metadata = JSON.parse(metadataContent.text);

    // Verify we have multiple chunks
    assertEquals(
      metadata.total_chunks > 1,
      true,
      "Should have multiple chunks",
    );
    assertEquals(typeof metadata.total_tokens, "number");
    assertEquals(metadata.chunk_size, 5000);

    // Fetch first chunk
    const chunk0Result = await client.callTool(
      {
        name: "fetch-url",
        arguments: {
          url: "https://example.com/large.html",
          chunk_size: 5000,
          chunk_index: 0,
        },
      },
      CallToolResultSchema,
    ) as CallToolResultType;

    assertExists(chunk0Result.content);
    const chunk0Content = chunk0Result.content[0] as TextContent;
    assertEquals(chunk0Content.type, "text");

    // Should contain the title and start of content
    assertEquals(chunk0Content.text.includes("Large Document Test"), true);
    assertEquals(chunk0Content.text.includes("<!-- Chunk 1/"), true);

    // Fetch last chunk
    const lastChunkResult = await client.callTool(
      {
        name: "fetch-url",
        arguments: {
          url: "https://example.com/large.html",
          chunk_size: 5000,
          chunk_index: metadata.total_chunks - 1,
        },
      },
      CallToolResultSchema,
    ) as CallToolResultType;

    assertExists(lastChunkResult.content);
    const lastChunkContent = lastChunkResult.content[0] as TextContent;

    // Should contain chunk metadata
    assertEquals(
      lastChunkContent.text.includes(
        `<!-- Chunk ${metadata.total_chunks}/${metadata.total_chunks}`,
      ),
      true,
    );

    // Test out of range chunk index
    try {
      await client.callTool(
        {
          name: "fetch-url",
          arguments: {
            url: "https://example.com/large.html",
            chunk_size: 5000,
            chunk_index: metadata.total_chunks + 10,
          },
        },
        CallToolResultSchema,
      );
      assertEquals(
        true,
        false,
        "Should have thrown an error for out of range chunk",
      );
    } catch (error) {
      // Expected error
      assertExists(error);
    }
  } finally {
    await client.close();
    await server.close();
  }
});
