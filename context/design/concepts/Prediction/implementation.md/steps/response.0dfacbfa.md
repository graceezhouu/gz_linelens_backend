---
timestamp: 'Sun Oct 19 2025 14:21:15 GMT-0400 (Eastern Daylight Time)'
parent: '[[../20251019_142115.759a12f8.md]]'
content_id: 0dfacbfaad44670c4f2aa97c76967fc4cf5395854f72ea4bd44b24bcf754aff0
---

# response:

Here's the TypeScript implementation for the `PredictionConcept` following the provided guidelines and integrating with the `AIpredictionEngine`.

First, we need to create the mock `GeminiLLM` and the `utils` files that are referenced in the problem description, if they don't already exist.

**1. Create placeholder `GeminiLLM` (e.g., `src/gemini-llm.ts`)**

This mock will allow the `PredictionEngine` to be instantiated and its methods called without requiring an actual LLM setup.

```typescript
// src/gemini-llm.ts

export class GeminiLLM {
  async executeLLM(prompt: string, maxTokens: number): Promise<string> {
    console.log(`[GeminiLLM Mock] Executing LLM with prompt (truncated): "${prompt.slice(0, 100)}..."`);
    // Simulate LLM response based on prompt
    if (prompt.includes('Extract the numeric information') || prompt.includes('Interpret the report')) {
      // Simulate interpretation response
      if (prompt.includes('long line')) {
        return `{ "estPplInLine": 50, "estimatedWaitMins": 45, "movementRate": "slow", "aiConfidence": 80 }`;
      } else if (prompt.includes('no wait')) {
        return `{ "estPplInLine": 5, "estimatedWaitMins": 5, "movementRate": "fast", "aiConfidence": 95 }`;
      }
      return `{ "estPplInLine": 10, "estimatedWaitMins": 15, "movementRate": "steady", "aiConfidence": 70 }`;
    } else if (prompt.includes('summarizes queue predictions')) {
      // Simulate summary response
      return `{ "aiSummary": "The wait is estimated to be around 20 minutes with a moderate chance of entry.", "estWaitTimeMins": 20, "entryProbability": 70 }`;
    }
    return `{ "aiSummary": "Mock LLM response for: ${prompt.slice(0, 50)}..." }`;
  }
}
```

**2. Create placeholder `utils` types and database helpers:**

```typescript
// src/utils/types.ts

export type ID = string & { __brand: "ID" };
export type Empty = Record<PropertyKey, never>;
```

```typescript
// src/utils/database.ts

import { MongoClient, Db } from "npm:mongodb";
import { ID } from "./types.ts";

let _db: Db | null = null;
let _client: MongoClient | null = null;

export async function getDb(): Promise<[Db, MongoClient]> {
  if (_db && _client) {
    return [_db, _client];
  }

  const MONGODB_URI = Deno.env.get("MONGODB_URI") || "mongodb://localhost:27017/concept_db";
  console.log(`Connecting to MongoDB at ${MONGODB_URI}`);

  _client = new MongoClient(MONGODB_URI);
  await _client.connect();
  _db = _client.db();

  console.log("Connected to MongoDB");
  return [_db, _client];
}

export function freshID(): ID {
  // A simple unique ID generator for demonstration. In production, use UUID or similar.
  return `id-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}` as ID;
}
```

**3. The `aiPredictionEngine.ts` file (provided in the prompt):**

This file is assumed to exist as provided. I'll include it here for completeness so the entire runnable example is in one place.
*(Note: I'm skipping the large provided code block for `aiPredictionEngine.ts` here to avoid repetition. Assume it's in `src/aiPredictionEngine.ts`)*

***

**4. `PredictionConcept.ts` Implementation:**

This is the main implementation of the `Prediction` concept.

```typescript
// src/Prediction/PredictionConcept.ts

import { Collection, Db } from "npm:mongodb";
import { ID, Empty } from "@utils/types.ts";
// No need for freshID here as _id will be the queueID (Location)
// import { freshID } from "@utils/database.ts";

import { PredictionEngine, PredictionResult as EnginePredictionResult, UserReport } from "../aiPredictionEngine.ts";
import { GeminiLLM } from "../gemini-llm.ts"; // Import the mock LLM

// Declare collection prefix, use concept name
const PREFIX = "Prediction" + ".";

// Generic types of this concept
type Location = ID;
type User = ID; // Not directly used in concept state, but specified as generic parameter

// Define possible model types as per concept spec
type ModelType = 'regression' | 'bayesian' | 'neural';

/**
 * @interface PredictionDoc
 * Represents the persistent state of a prediction for a specific location (queue).
 * This maps directly to a document in the MongoDB 'predictions' collection.
 */
interface PredictionDoc {
  _id: Location; // The Location/queueID acts as the primary key
  modelID: string;
  modelType: ModelType;
  accuracyThreshold: number;
  predictionResult: {
    queueID: Location; // Redundant but explicit as per concept spec
    estWaitTime: number | null; // in minutes (0 to N)
    entryProbability: number | null; // 0.0 to 1.0 (normalized from engine's 0-100)
    confidenceInterval: [number, number] | null; // in minutes
    aiSummary?: string | null;
  } | null;
  lastRun: number | null; // Unix timestamp
}

/**
 * @concept Prediction [Location, User]
 * @purpose Provide users with estimated wait times and entry likelihoods for specific locations,
 * leveraging both historical trends, real-time user-contributed data, and AI predictions.
 *
 * @principle Combines user reports about queue status and LLM natural-language interpretation
 * to produce structured predictions and user-facing summaries. If users at a location submit
 * reports about their current experience (e.g., wait time, crowd level), then the system will
 * quickly update its forecasts for that location, combining these live inputs with historical
 * trends, making the predictions more accurate and useful for all interested users.
 */
export default class PredictionConcept {
  private predictions: Collection<PredictionDoc>;
  private predictionEngine: PredictionEngine;

  // Default configuration for the prediction model
  // In a real system, these might come from a configuration service or be fetched dynamically
  private readonly defaultModelID: string;
  private readonly defaultModelType: ModelType;
  private readonly defaultAccuracyThreshold: number;

  constructor(
    private readonly db: Db,
    llm: GeminiLLM, // The LLM instance is passed in
    config?: {
      modelID?: string;
      modelType?: ModelType;
      accuracyThreshold?: number;
    },
  ) {
    this.predictions = this.db.collection(PREFIX + "predictions");
    this.predictionEngine = new PredictionEngine(llm); // Initialize the AI prediction engine

    this.defaultModelID = config?.modelID || "default-prediction-model-v1";
    this.defaultModelType = config?.modelType || "regression";
    this.defaultAccuracyThreshold = config?.accuracyThreshold || 0.85;

    // Ensure index on _id for fast lookups by Location/queueID
    this.predictions.createIndex({ _id: 1 }, { unique: true });

    // Optional: Add a TTL index to automatically clean old predictions if lastRun is present
    // However, the spec includes a manual cleanOldReports action, so we'll stick to that.
    // this.predictions.createIndex({ "lastRun": 1 }, { expireAfterSeconds: ... });
  }

  /**
   * @action runPrediction
   * @requires queueID must exist (meaning it's known to the underlying prediction engine).
   * @effects Generates updated prediction results for wait time and entry likelihood based on historical + live inputs.
   *          Generates nothing if there is insufficient information.
   * @param {object} args - The action arguments.
   * @param {Location} args.queueID - The ID of the queue (location) for which to run the prediction.
   * @param {string} [args.modelID] - Optional model ID to use for this prediction run,
   *                                  defaults to the concept's configured model ID.
   * @returns {object} An object containing the updated predictionResult or an error.
   */
  async runPrediction(args: { queueID: Location; modelID?: string }): Promise<
    { predictionResult: PredictionDoc["predictionResult"] } | { error: string }
  > {
    const { queueID, modelID = this.defaultModelID } = args;

    // Ensure the queue exists in the in-memory prediction engine for it to accumulate reports
    // In a real system, a 'Queue' concept would manage queue creation, and syncs would call
    // predictionEngine.createQueue. For this implementation, we ensure it exists on demand.
    // The prediction engine's createQueue is idempotent, so calling it multiple times is fine.
    this.predictionEngine.createQueue(queueID); // Also initializes userReports for this queue

    let enginePrediction: EnginePredictionResult;
    try {
      enginePrediction = await this.predictionEngine.runPrediction(queueID);
    } catch (err) {
      console.error(`Error running AI prediction for queue ${queueID}:`, err);
      return { error: `Failed to generate prediction: ${(err as Error).message}` };
    }

    // Convert engine's result to concept's spec format
    const conceptPredictionResult: PredictionDoc["predictionResult"] = {
      queueID: enginePrediction.queueID as Location, // Cast back to Location ID type
      estWaitTime: enginePrediction.estWaitTimeMins,
      // Normalize entryProbability from 0-100 to 0.0-1.0
      entryProbability: typeof enginePrediction.entryProbability === 'number'
        ? enginePrediction.entryProbability / 100
        : null,
      confidenceInterval: enginePrediction.confidenceIntervalMins,
      aiSummary: enginePrediction.aiSummary,
    };

    const newPredictionDoc: PredictionDoc = {
      _id: queueID,
      modelID: modelID,
      modelType: this.defaultModelType, // Using default from concept config for now
      accuracyThreshold: this.defaultAccuracyThreshold, // Using default from concept config for now
      predictionResult: conceptPredictionResult,
      lastRun: Date.now(),
    };

    try {
      // Upsert the prediction document for this queueID
      await this.predictions.updateOne(
        { _id: queueID },
        { $set: newPredictionDoc },
        { upsert: true },
      );
      return { predictionResult: conceptPredictionResult };
    } catch (err) {
      console.error(`Error saving prediction for queue ${queueID}:`, err);
      return { error: `Failed to save prediction: ${(err as Error).message}` };
    }
  }

  /**
   * @action getForecast
   * @requires queueID must exist (meaning a prediction for it has been run and stored).
   * @effects Returns the most recently available prediction and lastRun for a given queueID.
   * @param {object} args - The action arguments.
   * @param {Location} args.queueID - The ID of the queue (location) to get the forecast for.
   * @returns {object} An object containing the predictionResult and lastRun, or an error.
   */
  async getForecast(args: { queueID: Location }): Promise<
    { predictionResult: PredictionDoc["predictionResult"]; lastRun: number | null } | { error: string }
  > {
    const { queueID } = args;

    try {
      const doc = await this.predictions.findOne({ _id: queueID });

      if (!doc) {
        return { error: `No forecast found for queueID: ${queueID}` };
      }

      // Return null for lastRun if not present in doc, though it should be after runPrediction
      return {
        predictionResult: doc.predictionResult,
        lastRun: doc.lastRun || null,
      };
    } catch (err) {
      console.error(`Error retrieving forecast for queue ${queueID}:`, err);
      return { error: `Failed to retrieve forecast: ${(err as Error).message}` };
    }
  }

  /**
   * @system cleanOldReports
   * @requires true (This action can always be triggered).
   * @effects Deletes Predictions older than a certain threshold (e.g., 2 days).
   * @param {Empty} _args - Empty arguments.
   * @returns {Empty} An empty object on success, or an error object.
   */
  async cleanOldReports(_args: Empty): Promise<Empty | { error: string }> {
    // Define the threshold for "old". For example, 2 days (48 hours) in milliseconds.
    const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
    const thresholdTime = Date.now() - TWO_DAYS_MS;

    try {
      const result = await this.predictions.deleteMany({
        lastRun: { $lt: thresholdTime },
      });
      console.log(`Cleaned ${result.deletedCount} old predictions.`);
      return {};
    } catch (err) {
      console.error("Error cleaning old predictions:", err);
      return { error: `Failed to clean old predictions: ${(err as Error).message}` };
    }
  }

  // --- Methods for external syncs to interact with the underlying AIpredictionEngine ---
  // These are not "actions" of the Prediction concept itself, but internal methods
  // that would be called by syncs from other concepts (e.g., a UserReportConcept)

  /**
   * Allows external concepts (via syncs) to submit user reports to the internal PredictionEngine.
   * This is crucial as Prediction Concept does not store raw reports in its own state.
   * @param {object} args - The report details.
   * @param {Location} args.queueID - The ID of the queue/location.
   * @param {string} args.rawText - The raw text of the user report.
   * @param {User} [args.userID] - Optional user ID.
   * @returns {object} The ID of the submitted report or an error.
   */
  async submitUserReportToEngine(args: {
    queueID: Location;
    rawText: string;
    userID?: User;
  }): Promise<{ reportId: string } | { error: string }> {
    const { queueID, rawText, userID } = args;
    try {
      // Ensure the queue exists in the prediction engine before submitting a report
      this.predictionEngine.createQueue(queueID);
      const reportId = this.predictionEngine.submitUserReport(queueID, rawText, userID);
      return { reportId };
    } catch (err) {
      console.error(`Error submitting user report to engine for queue ${queueID}:`, err);
      return { error: `Failed to submit report: ${(err as Error).message}` };
    }
  }

  /**
   * Allows external concepts (via syncs) to trigger interpretation of a specific report.
   * After interpretation, `runPrediction` should be called to update the forecast.
   * @param {object} args - The report details.
   * @param {string} args.reportId - The ID of the user report to interpret.
   * @returns {object} The interpreted UserReport or an error.
   */
  async interpretUserReportWithEngine(args: { reportId: string }): Promise<
    { interpretedReport: UserReport } | { error: string }
  > {
    const { reportId } = args;
    try {
      const interpretedReport = await this.predictionEngine.interpretReport(reportId);
      return { interpretedReport };
    } catch (err) {
      console.error(`Error interpreting user report ${reportId}:`, err);
      return { error: `Failed to interpret report: ${(err as Error).message}` };
    }
  }

  // --- Query for the Prediction Engine's raw reports (for internal debugging/testing) ---
  // This is not part of the concept's official query interface, but useful for understanding engine state.
  _getEngineReports(queueID: Location): UserReport[] {
    return this.predictionEngine.getReports(queueID);
  }
}
```

***

**Example Usage (for testing the concept):**

To run this, you would typically have a `main.ts` or `test.ts` file. Ensure your `.env` has `MONGODB_URI`.

```typescript
// test.ts (or main.ts)
import { getDb } from "./src/utils/database.ts";
import { GeminiLLM } from "./src/gemini-llm.ts";
import PredictionConcept from "./src/Prediction/PredictionConcept.ts";
import { ID, Empty } from "./src/utils/types.ts";

async function runTest() {
  const [db, client] = await getDb();
  const llm = new GeminiLLM();
  const predictionConcept = new PredictionConcept(db, llm, {
    modelID: "smart-queue-v2",
    modelType: "neural",
    accuracyThreshold: 0.90,
  });

  const locationA: Location = "location:CafeX" as ID;
  const locationB: Location = "location:MuseumY" as ID;
  const userAlice: User = "user:Alice" as ID;
  const userBob: User = "user:Bob" as ID;

  console.log("\n--- Starting Prediction Concept Test ---");

  // 1. Submit some user reports via the internal engine method (simulating a sync)
  console.log("\nSubmitting user reports for CafeX:");
  await predictionConcept.submitUserReportToEngine({
    queueID: locationA,
    rawText: "Long line at CafeX, probably 30 mins wait. Slow!",
    userID: userAlice,
  });
  await predictionConcept.submitUserReportToEngine({
    queueID: locationA,
    rawText: "Queue is moving steadily, maybe 15 people ahead.",
    userID: userBob,
  });

  console.log("\nSubmitting user reports for MuseumY:");
  await predictionConcept.submitUserReportToEngine({
    queueID: locationB,
    rawText: "No wait at MuseumY, walked right in!",
    userID: userAlice,
  });

  // Verify reports were added to the engine
  const cafeXReports = predictionConcept._getEngineReports(locationA);
  console.log(`CafeX engine reports (${cafeXReports.length}):`, cafeXReports.map(r => r.rawText));

  // 2. Run prediction for locationA
  console.log("\n--- Running prediction for CafeX ---");
  const runPredictionResultA = await predictionConcept.runPrediction({ queueID: locationA });
  if ("error" in runPredictionResultA) {
    console.error("Error running prediction for CafeX:", runPredictionResultA.error);
  } else {
    console.log("CafeX Prediction Result (from runPrediction):", runPredictionResultA.predictionResult);
  }

  // 3. Get forecast for locationA
  console.log("\n--- Getting forecast for CafeX ---");
  const forecastA = await predictionConcept.getForecast({ queueID: locationA });
  if ("error" in forecastA) {
    console.error("Error getting forecast for CafeX:", forecastA.error);
  } else {
    console.log("CafeX Forecast (from getForecast):", forecastA.predictionResult);
    console.log("CafeX Last Run:", new Date(forecastA.lastRun!).toLocaleString());
  }

  // 4. Run prediction for locationB (no prior explicit interpretation for its reports, engine handles it)
  console.log("\n--- Running prediction for MuseumY ---");
  const runPredictionResultB = await predictionConcept.runPrediction({ queueID: locationB });
  if ("error" in runPredictionResultB) {
    console.error("Error running prediction for MuseumY:", runPredictionResultB.error);
  } else {
    console.log("MuseumY Prediction Result (from runPrediction):", runPredictionResultB.predictionResult);
  }

  // 5. Get forecast for locationB
  console.log("\n--- Getting forecast for MuseumY ---");
  const forecastB = await predictionConcept.getForecast({ queueID: locationB });
  if ("error" in forecastB) {
    console.error("Error getting forecast for MuseumY:", forecastB.error);
  } else {
    console.log("MuseumY Forecast (from getForecast):", forecastB.predictionResult);
  }

  // 6. Test `cleanOldReports` (will likely not delete anything unless run much later)
  console.log("\n--- Cleaning old reports ---");
  const cleanResult = await predictionConcept.cleanOldReports({});
  if ("error" in cleanResult) {
    console.error("Error cleaning reports:", cleanResult.error);
  } else {
    console.log("Old reports cleaning initiated.");
  }

  // Example of interpreting a specific report (would be triggered by a sync)
  console.log("\n--- Interpreting a specific report for CafeX (simulated sync) ---");
  if (cafeXReports.length > 0) {
    const reportToInterpret = cafeXReports[0];
    const interpretResult = await predictionConcept.interpretUserReportWithEngine({ reportId: reportToInterpret.id });
    if ("error" in interpretResult) {
      console.error("Error interpreting report:", interpretResult.error);
    } else {
      console.log("Interpreted Report:", interpretResult.interpretedReport);
      // After interpretation, run prediction again to incorporate new structured data
      await predictionConcept.runPrediction({ queueID: locationA });
      const updatedForecastA = await predictionConcept.getForecast({ queueID: locationA });
      console.log("Updated CafeX Forecast after interpretation:", updatedForecastA.predictionResult);
    }
  }

  console.log("\n--- Concept Test Complete ---");

  await client.close();
}

runTest().catch(console.error);
```

**To run this locally:**

1. Save the files:
   * `src/gemini-llm.ts`
   * `src/utils/types.ts`
   * `src/utils/database.ts`
   * `src/aiPredictionEngine.ts` (the large code block from your prompt)
   * `src/Prediction/PredictionConcept.ts`
   * `test.ts` (the example usage)
2. Install Deno if you haven't already.
3. Create a `.env` file in your project root with `MONGODB_URI=mongodb://localhost:27017/concept_db` (or your MongoDB connection string).
4. Run the test file from your project root:
   `deno run --allow-net --allow-env --allow-read --allow-write test.ts`

This setup provides a fully functional `PredictionConcept` adhering to the specified design principles, utilizing the `AIpredictionEngine` and demonstrating interaction via simulated "sync" methods.
