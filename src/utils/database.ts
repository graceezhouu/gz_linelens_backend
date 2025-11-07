// Try to load the `.env` file as environment variables (if it exists)
try {
  await import("jsr:@std/dotenv/load");
  console.log("📄 .env file loaded successfully");
} catch (_error) {
  console.log("📄 No .env file found (using system environment variables)");
}

import { Db, MongoClient } from "npm:mongodb";
import { ID } from "@utils/types.ts";
import { generate } from "jsr:@std/uuid/unstable-v7";

async function initMongoClient() {
  // Debug: Log all available environment variables (without values for security)
  console.log("🔍 Checking for MongoDB environment variables...");
  const envVars = ["MONGODB_URL", "MONGODB_URI", "DATABASE_URL", "MONGO_URL"];
  for (const envVar of envVars) {
    const value = Deno.env.get(envVar);
    console.log(`  ${envVar}: ${value ? "✅ SET" : "❌ NOT SET"}`);
  }

  // Try multiple environment variable names for compatibility
  const DB_CONN = Deno.env.get("MONGODB_URL") ||
    Deno.env.get("MONGODB_URI") ||
    Deno.env.get("DATABASE_URL") ||
    Deno.env.get("MONGO_URL");

  if (DB_CONN === undefined) {
    // Show current working directory and available env vars for debugging
    console.error("❌ No MongoDB connection string found!");
    console.error("📂 Current working directory:", Deno.cwd());
    console.error(
      "🌍 Available environment variables:",
      Object.keys(Deno.env.toObject()).filter((key) =>
        key.includes("MONGO") || key.includes("DATABASE") || key.includes("DB")
      ),
    );

    // Provide helpful error message with common environment variable names
    throw new Error(
      "Could not find MongoDB connection string. Please set one of these environment variables:\n" +
        "- MONGODB_URL (recommended)\n" +
        "- MONGODB_URI\n" +
        "- DATABASE_URL\n" +
        "- MONGO_URL\n\n" +
        "For deployment platforms, set this in your platform's environment variables section.\n" +
        "Example: MONGODB_URL=mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority",
    );
  }

  // Mask password in logs for security
  const maskedUrl = DB_CONN.replace(/:([^:@]+)@/, ":***@");
  console.log(`🔗 Connecting to MongoDB: ${maskedUrl}`);

  console.log("🔗 Connecting to MongoDB...");
  const client = new MongoClient(DB_CONN);
  try {
    await client.connect();
    console.log("✅ MongoDB connected successfully");
  } catch (e) {
    console.error("❌ MongoDB connection failed:", e);
    throw new Error("MongoDB connection failed: " + e);
  }
  return client;
}

async function init() {
  const client = await initMongoClient();

  // Try multiple database name environment variables, with fallback
  const DB_NAME = Deno.env.get("DB_NAME") ||
    Deno.env.get("DATABASE_NAME") ||
    Deno.env.get("MONGO_DB_NAME") ||
    "linelens"; // Default database name

  console.log(`📊 Using database: ${DB_NAME}`);
  return [client, DB_NAME] as [MongoClient, string];
}

async function dropAllCollections(db: Db): Promise<void> {
  try {
    // Get all collection names
    const collections = await db.listCollections().toArray();

    // Drop each collection
    for (const collection of collections) {
      await db.collection(collection.name).drop();
    }
  } catch (error) {
    console.error("Error dropping collections:", error);
    throw error;
  }
}

/**
 * MongoDB database configured by .env
 * @returns {[Db, MongoClient]} initialized database and client
 */
export async function getDb() {
  const [client, DB_NAME] = await init();
  return [client.db(DB_NAME), client] as [Db, MongoClient];
}

/**
 * Test database initialization
 * @returns {[Db, MongoClient]} initialized test database and client
 */
export async function testDb() {
  const [client, DB_NAME] = await init();
  const test_DB_NAME = `test-${DB_NAME}`;
  const test_Db = client.db(test_DB_NAME);
  await dropAllCollections(test_Db);
  return [test_Db, client] as [Db, MongoClient];
}

/**
 * Creates a fresh ID.
 * @returns {ID} UUID v7 generic ID.
 */
export function freshID() {
  return generate() as ID;
}
