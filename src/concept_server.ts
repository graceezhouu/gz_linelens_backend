import { Hono } from "jsr:@hono/hono";
import { cors } from "jsr:@hono/hono/cors";
import { getDb } from "@utils/database.ts";
import { walk } from "jsr:@std/fs";
import { parseArgs } from "jsr:@std/cli/parse-args";
import { toFileUrl } from "jsr:@std/path/to-file-url";
import { emailService } from "@utils/emailService.ts";

// Parse command-line arguments for port and base URL
const flags = parseArgs(Deno.args, {
  string: ["port", "baseUrl"],
  default: {
    port: "8000",
    baseUrl: "/api",
  },
});

// Use environment PORT if available (required for Render deployment)
const PORT = parseInt(Deno.env.get("PORT") || flags.port, 10);
const BASE_URL = flags.baseUrl;
const CONCEPTS_DIR = "src/concepts";

/**
 * Main server function to initialize DB, load concepts, and start the server.
 */
async function main() {
  const [db] = await getDb();
  const app = new Hono();

  // Add CORS middleware
  app.use(
    "*",
    cors({
      origin: [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "https://linelens.onrender.com", // Frontend deployment URL
      ],
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
      credentials: true,
    }),
  );

  app.get("/", (c) => c.text("Concept Server is running."));

  // Health check endpoint for debugging
  app.get("/health", async (c) => {
    try {
      // Test database connection and get some stats
      const collections = await db.listCollections().toArray();
      const queueCollection = db.collection("QueueStatus.queues");
      const queueCount = await queueCollection.countDocuments({});
      const sampleQueues = await queueCollection.find({}).limit(3).toArray();

      return c.json({
        status: "healthy",
        database: {
          connected: true,
          name: db.databaseName,
          collections: collections.map((col) => col.name),
          queueCount,
          sampleQueues: sampleQueues.map((q) => ({
            queueID: q._id,
            location: q.location,
            lastUpdated: q.lastUpdated,
          })),
        },
        environment: {
          NODE_ENV: Deno.env.get("NODE_ENV"),
          PORT: Deno.env.get("PORT"),
          MONGODB_URL: Deno.env.get("MONGODB_URL") ? "SET" : "NOT SET",
          MONGODB_URI: Deno.env.get("MONGODB_URI") ? "SET" : "NOT SET",
          DATABASE_URL: Deno.env.get("DATABASE_URL") ? "SET" : "NOT SET",
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const err = error as Error;
      return c.json({
        status: "error",
        error: err.message || String(error),
        stack: err.stack,
        timestamp: new Date().toISOString(),
      }, 500);
    }
  });

  // --- Dynamic Concept Loading and Routing ---
  console.log(`Scanning for concepts in ./${CONCEPTS_DIR}...`);

  for await (
    const entry of walk(CONCEPTS_DIR, {
      maxDepth: 1,
      includeDirs: true,
      includeFiles: false,
    })
  ) {
    if (entry.path === CONCEPTS_DIR) continue; // Skip the root directory

    const conceptName = entry.name;
    const conceptFilePath = `${entry.path}/${conceptName}Concept.ts`;

    try {
      const modulePath = toFileUrl(Deno.realPathSync(conceptFilePath)).href;
      const module = await import(modulePath);
      const ConceptClass = module.default;

      if (
        typeof ConceptClass !== "function" ||
        !ConceptClass.name.endsWith("Concept")
      ) {
        console.warn(
          `! No valid concept class found in ${conceptFilePath}. Skipping.`,
        );
        continue;
      }

      const instance = new ConceptClass(db);
      const conceptApiName = conceptName;
      console.log(
        `- Registering concept: ${conceptName} at ${BASE_URL}/${conceptApiName}`,
      );

      const methodNames = Object.getOwnPropertyNames(
        Object.getPrototypeOf(instance),
      )
        .filter((name) =>
          name !== "constructor" && typeof instance[name] === "function"
        );

      for (const methodName of methodNames) {
        const actionName = methodName;
        const route = `${BASE_URL}/${conceptApiName}/${actionName}`;

        app.post(route, async (c) => {
          try {
            const body = await c.req.json().catch(() => ({})); // Handle empty body
            const result = await instance[methodName](body);
            return c.json(result);
          } catch (e) {
            console.error(`Error in ${conceptName}.${methodName}:`, e);
            return c.json({ error: "An internal server error occurred." }, 500);
          }
        });
        console.log(`  - Endpoint: POST ${route}`);
      }
    } catch (e) {
      console.error(
        `! Error loading concept from ${conceptFilePath}:`,
        e,
      );
    }
  }

  // Log email service status
  const emailStatus = emailService.getEmailServiceStatus();
  console.log(`\n📧 Email Service Status:`);
  console.log(`  - Mode: ${emailStatus.mode}`);
  console.log(`  - System Email: ${emailStatus.systemEmail}`);
  console.log(
    `  - SendGrid Configured: ${
      emailStatus.sendGridConfigured ? "✅ Yes" : "❌ No"
    }`,
  );
  console.log(
    `  - Will Send Real Emails: ${
      emailStatus.willSendRealEmails ? "✅ Yes" : "❌ No (Console only)"
    }`,
  );

  console.log(`\nServer listening on http://localhost:${PORT}`);

  // For deployment, bind to 0.0.0.0 to accept external connections
  const hostname = Deno.env.get("NODE_ENV") === "production"
    ? "0.0.0.0"
    : "localhost";
  Deno.serve({ port: PORT, hostname }, app.fetch);
}

// Run the server
main();
