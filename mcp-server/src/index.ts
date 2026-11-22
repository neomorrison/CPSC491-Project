// Starts the MCP server. The user's AI assistant (Claude Desktop, etc.) launches this
// program and talks to it over stdin/stdout.
//
// Important: stdout is the MCP channel, so nothing else may print to it.
// All our own messages go to stderr with console.error.

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.ts";
import { connect, readSettings } from "./supabase.ts";

async function main() {
  // reads mcp-server/.env if it's there. An assistant app can also pass these in itself.
  try {
    process.loadEnvFile(new URL("../.env", import.meta.url));
  } catch (_err) {
    // no .env file, that's fine
  }

  const data = await connect(readSettings(process.env));
  const server = createServer(data);
  await server.connect(new StdioServerTransport());
  console.error("fitness-monitor MCP server is running");
}

main().catch((err) => {
  console.error(String(err instanceof Error ? err.message : err));
  process.exit(1);
});
