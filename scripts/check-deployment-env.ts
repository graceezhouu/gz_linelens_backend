#!/usr/bin/env -S deno run --allow-env --allow-read

/**
 * Deployment Environment Checker
 * Run this script to debug environment variable issues in deployment
 */

console.log("🔍 LineLens Deployment Environment Checker");
console.log("=".repeat(50));

// Check current working directory
console.log("📂 Current working directory:", Deno.cwd());

// Check if .env file exists
try {
  const envFile = await Deno.readTextFile(".env");
  console.log("📄 .env file found (length:", envFile.length, "characters)");
} catch (_error) {
  console.log("📄 .env file not found (this is normal in deployment)");
}

// Check for MongoDB environment variables
console.log("\n🗄️  MongoDB Environment Variables:");
const mongoVars = ["MONGODB_URL", "MONGODB_URI", "DATABASE_URL", "MONGO_URL"];
let foundMongo = false;

for (const envVar of mongoVars) {
  const value = Deno.env.get(envVar);
  if (value) {
    console.log(`✅ ${envVar}: SET (${value.length} characters)`);
    // Show masked version for security
    const masked = value.replace(/:([^:@]+)@/, ":***@");
    console.log(`   Preview: ${masked.substring(0, 60)}...`);
    foundMongo = true;
  } else {
    console.log(`❌ ${envVar}: NOT SET`);
  }
}

// Check for other important environment variables
console.log("\n🔧 Other Environment Variables:");
const otherVars = ["NODE_ENV", "PORT", "DB_NAME", "SYSTEM_EMAIL"];
for (const envVar of otherVars) {
  const value = Deno.env.get(envVar);
  console.log(`${value ? "✅" : "❌"} ${envVar}: ${value || "NOT SET"}`);
}

// Show all environment variables that contain database-related keywords
console.log("\n🌍 All Database-Related Environment Variables:");
const allEnvVars = Deno.env.toObject();
const dbRelated = Object.keys(allEnvVars).filter((key) =>
  key.toLowerCase().includes("mongo") ||
  key.toLowerCase().includes("database") ||
  key.toLowerCase().includes("db")
);

if (dbRelated.length > 0) {
  for (const key of dbRelated) {
    console.log(`  ${key}: ${allEnvVars[key] ? "SET" : "NOT SET"}`);
  }
} else {
  console.log("  No database-related environment variables found");
}

// Summary
console.log("\n📋 Summary:");
if (foundMongo) {
  console.log("✅ MongoDB connection string found - deployment should work!");
} else {
  console.log("❌ MongoDB connection string NOT found - deployment will fail!");
  console.log(
    "\n🔧 To fix this, set one of these environment variables in your deployment platform:",
  );
  console.log(
    "   MONGODB_URL=mongodb+srv://username:password@cluster.mongodb.net/database",
  );
}

console.log("\n🚀 If all looks good, your deployment should work!");
