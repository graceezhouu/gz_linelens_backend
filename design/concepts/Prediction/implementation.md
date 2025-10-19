[@concept-design-overview](../../background/concept-design-overview.md)

[@concept-specifications](../../background/concept-specifications.md)

[@implementing-concepts](../../background/implementing-concepts.md)

# Instructions: Generate tests for PredictionConcept.ts, which will go in PredictionConcept.test.ts. Include a successful and legible test execution that corresponds to the operational principle and 3–5 test executions that explore variants, covering all the actions and some interesting cases.

# concept: Prediction [Location, User]

**Purpose** Provide users with estimated wait times and entry likelihoods for specific locations, leveraging both historical trends, real-time user-contributed data, and AI predictions.

**Principle** Combines user reports about queue status and LLM natural-language interpretation
to produce structured predictions and user-facing summaries. If users at a location submit reports about their current experience (e.g., wait time, crowd level), then the system will quickly update its forecasts for that location, combining these live inputs with historical trends, making the predictions more accurate and useful for all interested users. 

**state**

    modelID: String

    modelType: Enum('regression', 'bayesian', 'neural')

    accuracyThreshold: Number  // e.g., 0.85 

    predictionResult: {

      queueID: String

      estWaitTime: Number

      entryProbability: Number

      confidenceInterval: [Number, Number]
      
    } | Null

    lastRun: DateTime

**actions**

  **runPrediction(queueID: String, modelID: String): predictionResult**
    **requires** queueID must exist
    **effects** generates updated prediction results for wait time and entry likelihood based on historical + live inputs, generates nothing if there is insufficient information

  **getForecast(queueID: String): predictionResult**
    **requires** queueID must exist
    **effects** returns the most recently available prediction and lastRun
  
  **system cleanOldReports (): Empty**
    **requires** true // This action can always be triggered
    **effects** delete Predictions older than a certain threshold (e.g., 2 hours, 2 days)

**Notes**: 
- Prediction is not an independent data store but a service built on top of UserReport and QueueStatus.
- Prediction pulls from `UserReport` through a **sync**, not a redundant data store.

Here's the TypeScript backend implementation for the `Prediction` concept, adhering to the provided guidelines.

First, let's establish the hypothetical `aiPredictionEngine.ts` file that was mentioned but not provided. This mock engine will simulate the AI's behavior based on the concept's description.

---

### `aiPredictionEngine.ts` (Hypothetical Helper Code)

```typescript
// aiPredictionEngine.ts - Hypothetical helper code for AI predictions
// This file simulates an AI service that provides predictions.
// In a real application, this would integrate with actual machine learning
// or large language models.

import { ID } from "../utils/types.ts"; // Adjusted path to utils

/**
 * Defines the types of models supported by the AI engine.
 */
export type ModelType = 'regression' | 'bayesian' | 'neural';

/**
 * Input structure for running a prediction.
 * In a real scenario, this would gather relevant data from other sources
 * (e.g., UserReport, QueueStatus concepts).
 */
export interface PredictionInput {
  queueID: ID;
  // Additional data for the AI model could be included here, e.g.:
  // userReports: Array<{ user: ID, timestamp: Date, waitTime: number | null, crowdLevel: string | null }>;
  // historicalData: Array<{ timestamp: Date, visitorCount: number, actualWaitTime: number }>;
}

/**
 * Output structure for a successful prediction.
 */
export interface PredictionOutput {
  estWaitTime: number; // Estimated wait time in minutes
  entryProbability: number; // Probability of entry (0.0 to 1.0)
  confidenceInterval: [number, number]; // [lowerBound, upperBound] for wait time
}

/**
 * Configuration for a specific AI model instance.
 */
export interface AIModelConfig {
  modelID: string;
  modelType: ModelType;
  accuracyThreshold: number; // e.g., 0.85, a target for model performance
}

/**
 * The core AI prediction engine class.
 * Handles running predictions based on its configured model.
 */
export class AIPredictionEngine {
  public readonly config: AIModelConfig;

  constructor(modelConfig: AIModelConfig) {
    this.config = modelConfig;
    console.log(`[AIPredictionEngine] Initialized for model: ${modelConfig.modelID} (${modelConfig.modelType})`);
  }

  /**
   * Simulates running an AI prediction for a given queue.
   * This method would contain the logic to interface with an actual AI model.
   * @param input The input data for the prediction, including queueID.
   * @returns A PredictionOutput object if the prediction is successful, or null if there's insufficient data.
   */
  async runPrediction(input: PredictionInput): Promise<PredictionOutput | null> {
    console.log(`[AIPredictionEngine] Running prediction for queue: ${input.queueID} with model: ${this.config.modelID}`);
    // Simulate AI processing time
    await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 200));

    // Simulate conditions where prediction might fail due to insufficient data
    if (input.queueID === "queue:insufficient_data" as ID) {
      console.log("[AIPredictionEngine] Insufficient data for prediction for queue:", input.queueID);
      return null;
    }

    // Generate plausible dummy prediction results based on the queue ID
    let estWaitTime: number;
    let entryProbability: number;
    let confidenceInterval: [number, number];

    switch (input.queueID) {
      case "location:popular_cafe" as ID:
        estWaitTime = 25 + Math.floor(Math.random() * 10); // 25-34 min
        entryProbability = parseFloat((0.85 - Math.random() * 0.1).toFixed(2)); // 0.75-0.85
        confidenceInterval = [estWaitTime - 10, estWaitTime + 10];
        break;
      case "location:public_library" as ID:
        estWaitTime = 5 + Math.floor(Math.random() * 5); // 5-9 min
        entryProbability = parseFloat((0.99 - Math.random() * 0.02).toFixed(2)); // 0.97-0.99
        confidenceInterval = [estWaitTime - 2, estWaitTime + 3];
        break;
      default:
        estWaitTime = 15 + Math.floor(Math.random() * 15); // 15-29 min
        entryProbability = parseFloat((0.7 + Math.random() * 0.2).toFixed(2)); // 0.7-0.9
        confidenceInterval = [estWaitTime - 5, estWaitTime + 10];
        break;
    }

    // Ensure probability is within [0, 1]
    entryProbability = Math.max(0, Math.min(1, entryProbability));

    const result: PredictionOutput = {
      estWaitTime,
      entryProbability,
      confidenceInterval,
    };

    console.log(`[AIPredictionEngine] Prediction for ${input.queueID}:`, result);
    return result;
  }
}

// A default instance of the AI Prediction Engine for convenience.
// This allows the PredictionConcept to use a default engine if none is specified.
const defaultAIModelConfig: AIModelConfig = {
  modelID: "default_prediction_model_v1",
  modelType: "neural",
  accuracyThreshold: 0.90,
};

export const defaultAIPredictionEngine = new AIPredictionEngine(defaultAIModelConfig);

// Function to create custom AI engine instances if different models are needed.
export function createAIPredictionEngine(config: AIModelConfig): AIPredictionEngine {
  return new AIPredictionEngine(config);
}
```

---

### `PredictionConcept.ts` Implementation

```typescript
// file: src/Prediction/PredictionConcept.ts

import { Collection, Db } from "npm:mongodb";
import { Empty, ID } from "../../utils/types.ts"; // Path to utils/types.ts
import { freshID } from "../../utils/database.ts"; // Path to utils/database.ts
import {
  AIPredictionEngine,
  AIModelConfig,
  defaultAIPredictionEngine,
  ModelType,
  PredictionInput,
  PredictionOutput,
} from "./aiPredictionEngine.ts"; // Assuming aiPredictionEngine.ts is in the same directory

/**
 * @concept Prediction [Location, User]
 * @purpose Provide users with estimated wait times and entry likelihoods for specific locations,
 * leveraging both historical trends, real-time user-contributed data, and AI predictions.
 */

// Generic types from the concept signature
type Location = ID; // Represents a specific physical location or queue target
type User = ID;     // Represents a user submitting reports or interested in predictions
type QueueID = Location; // From the concept description, QueueID refers to a location.

/**
 * @state modelID: String
 * @state modelType: Enum('regression', 'bayesian', 'neural')
 * @state accuracyThreshold: Number  // e.g., 0.85
 * These are effectively configuration parameters for the AI model used by this concept instance.
 */
interface ConceptModelConfig {
  modelID: string;
  modelType: ModelType;
  accuracyThreshold: number;
}

/**
 * @state predictionResult: {
 *   queueID: String
 *   estWaitTime: Number
 *   entryProbability: Number
 *   confidenceInterval: [Number, Number]
 * } | Null
 * This interface defines the structured result of a prediction for a specific queue.
 */
interface StoredPredictionResult extends PredictionOutput {
  queueID: QueueID; // The ID of the queue this prediction is for
}

/**
 * This interface defines the structure of a document stored in the `Prediction.forecasts`
 * MongoDB collection. Each document represents the latest prediction for a specific queue.
 */
interface PredictionDocument extends ConceptModelConfig { // Inherits model config used for this prediction
  _id: QueueID; // The unique identifier for the document, using the queueID
  queueID: QueueID; // Redundant but useful for queries and clarity
  predictionResult: StoredPredictionResult;
  lastRun: Date; // Timestamp when this prediction was last generated
}

// Declare MongoDB collection prefix using the concept's name
const COLLECTION_PREFIX = "Prediction" + ".";

export default class PredictionConcept {
  private forecasts: Collection<PredictionDocument>;
  private aiEngine: AIPredictionEngine; // The internal AI prediction engine instance

  /**
   * @principle Combines user reports about queue status and LLM natural-language interpretation
   * to produce structured predictions and user-facing summaries. If users at a location submit
   * reports about their current experience (e.g., wait time, crowd level), then the system will
   * quickly update its forecasts for that location, combining these live inputs with historical
   * trends, making the predictions more accurate and useful for all interested users.
   *
   * Initializes the PredictionConcept with a MongoDB database connection
   * and an optional configuration for the AI prediction engine.
   * @param db The MongoDB database instance.
   * @param aiEngineConfig Optional configuration for the AI engine. If not provided,
   *                       a default engine will be used.
   */
  constructor(private readonly db: Db, aiEngineConfig?: AIModelConfig) {
    this.forecasts = this.db.collection(COLLECTION_PREFIX + "forecasts");

    // Initialize the AI engine. If a specific config is provided, use it.
    // Otherwise, use the globally defined default engine from aiPredictionEngine.ts.
    this.aiEngine = aiEngineConfig ? new AIPredictionEngine(aiEngineConfig) : defaultAIPredictionEngine;

    // Ensure _id (which is queueID) is indexed for efficient lookups.
    // This is implicit with _id, but an explicit index can be added if needed for other fields.
    this.forecasts.createIndex({ queueID: 1 }, { unique: true }).catch(console.error);
  }

  // --- Actions ---

  /**
   * @action runPrediction(queueID: String, modelID: String): predictionResult
   * @requires queueID must exist (meaning it's a valid location for which predictions are desired).
   *           (This concept assumes `queueID` validity is handled externally or by the AI engine).
   * @effects generates updated prediction results for wait time and entry likelihood based on
   *          historical + live inputs, generates nothing if there is insufficient information.
   *
   * @param {object} args - The arguments for the action.
   * @param {QueueID} args.queueID - The ID of the queue (location) to run the prediction for.
   * @param {string} args.modelID - The ID of the model to use for this prediction run.
   *                                 This should ideally match the concept's configured `modelID`.
   * @returns {Promise<StoredPredictionResult | { error: string }>} The updated prediction result
   *          on success, or an error object if the prediction cannot be generated or stored.
   */
  async runPrediction({ queueID, modelID }: { queueID: QueueID; modelID: string }): Promise<StoredPredictionResult | { error: string }> {
    // Validate `modelID` against the concept's configured AI engine.
    // In a system with multiple AI engines, this could select the correct engine.
    if (modelID !== this.aiEngine.config.modelID) {
      console.warn(`[PredictionConcept] Mismatch: runPrediction called with modelID '${modelID}' but concept configured with '${this.aiEngine.config.modelID}'. Proceeding with configured model.`);
      // Optionally, return an error:
      // return { error: `Invalid modelID '${modelID}'. This concept instance is configured to use model '${this.aiEngine.config.modelID}'.` };
    }

    console.log(`[PredictionConcept] Attempting to run prediction for queue: ${queueID}`);

    // Prepare input for the AI engine. In a real system, this step would
    // involve collecting `UserReport` and `QueueStatus` data.
    const predictionInput: PredictionInput = { queueID };

    let rawPrediction: PredictionOutput | null;
    try {
      // Delegate the actual AI processing to the injected AI engine
      rawPrediction = await this.aiEngine.runPrediction(predictionInput);
    } catch (e: any) {
      console.error(`[PredictionConcept] Error from AI engine for queue ${queueID}:`, e);
      return { error: `Failed to generate prediction due to internal AI engine error: ${e.message}` };
    }

    // Handle the case where the AI engine indicates insufficient information
    if (!rawPrediction) {
      console.log(`[PredictionConcept] Insufficient information for prediction for queue: ${queueID}. No forecast stored.`);
      return { error: `Insufficient information to generate a prediction for queue '${queueID}'.` };
    }

    // Construct the new prediction document to be stored
    const newPrediction: PredictionDocument = {
      _id: queueID, // Use queueID as the document's primary key
      queueID: queueID,
      modelID: this.aiEngine.config.modelID,
      modelType: this.aiEngine.config.modelType,
      accuracyThreshold: this.aiEngine.config.accuracyThreshold,
      predictionResult: {
        queueID: queueID, // Include queueID in the nested result as well
        ...rawPrediction,
      },
      lastRun: new Date(), // Set the timestamp for this prediction run
    };

    // Store or update the prediction in the database
    try {
      await this.forecasts.updateOne(
        { _id: queueID }, // Find by queueID
        { $set: newPrediction }, // Replace existing document or insert new one
        { upsert: true } // Create the document if it doesn't exist
      );
      console.log(`[PredictionConcept] Stored/updated prediction for queue: ${queueID}`);
      return newPrediction.predictionResult; // Return the specific prediction result data
    } catch (e: any) {
      console.error(`[PredictionConcept] Failed to store prediction for queue ${queueID}:`, e);
      return { error: `Failed to store prediction: ${e.message}` };
    }
  }

  /**
   * @action getForecast(queueID: String): predictionResult
   * @requires queueID must exist (meaning a prediction for it has been run and stored).
   * @effects returns the most recently available prediction and lastRun.
   *
   * @param {object} args - The arguments for the action.
   * @param {QueueID} args.queueID - The ID of the queue (location) to retrieve the forecast for.
   * @returns {Promise<StoredPredictionResult & { lastRun: Date } | { error: string }>}
   *          The prediction result including its `lastRun` timestamp, or an error object if not found.
   */
  async getForecast({ queueID }: { queueID: QueueID }): Promise<(StoredPredictionResult & { lastRun: Date }) | { error: string }> {
    console.log(`[PredictionConcept] Getting forecast for queue: ${queueID}`);
    try {
      const doc = await this.forecasts.findOne({ _id: queueID });

      if (!doc) {
        return { error: `No forecast found for queue '${queueID}'.` };
      }

      // Return the nested predictionResult along with the lastRun timestamp
      return {
        ...doc.predictionResult,
        lastRun: doc.lastRun,
      };
    } catch (e: any) {
      console.error(`[PredictionConcept] Failed to retrieve forecast for queue ${queueID}:`, e);
      return { error: `Failed to retrieve forecast: ${e.message}` };
    }
  }

  /**
   * @action system cleanOldReports (): Empty
   * @requires true // This action can always be triggered autonomously by the system.
   * @effects delete Predictions (forecasts) older than a certain threshold (e.g., 2 hours, 2 days).
   *          For this implementation, the threshold is set to 2 days.
   *
   * @returns {Promise<Empty | { error: string }>} An empty object on successful cleanup,
   *          or an error object if the operation fails.
   */
  async cleanOldReports(): Promise<Empty | { error: string }> {
    console.log(`[PredictionConcept] Initiating cleanup of old predictions.`);
    // Define the cleanup threshold (e.g., 2 days)
    const CLEANUP_THRESHOLD_MS = 2 * 24 * 60 * 60 * 1000; // 2 days in milliseconds
    const expiryDate = new Date(Date.now() - CLEANUP_THRESHOLD_MS);

    try {
      const result = await this.forecasts.deleteMany({
        lastRun: { $lt: expiryDate }, // Delete documents where lastRun is older than expiryDate
      });
      console.log(`[PredictionConcept] Deleted ${result.deletedCount} old predictions.`);
      return {}; // Return an empty object to signify success
    } catch (e: any) {
      console.error("[PredictionConcept] Error cleaning old reports:", e);
      return { error: `Failed to clean old reports: ${e.message}` };
    }
  }

  // --- Queries ---
  // Queries are often implicit for direct state access. No explicit custom queries
  // were defined in the concept specification, so none are implemented here.
  // Example of implicit query: A client could directly query the 'Prediction.forecasts'
  // collection using MongoDB drivers or an ORM for more complex needs not covered by actions.
}
```


# response:

Here's the test suite for your `PredictionConcept.ts` implementation, following the provided instructions.

First, ensure your `aiPredictionEngine.ts` (hypothetical helper code) is in the same directory as `PredictionConcept.ts` and includes the modifications for simulating errors as discussed in the thought process.

***

### `aiPredictionEngine.ts` (Updated for testing)

```typescript
// aiPredictionEngine.ts - Hypothetical helper code for AI predictions
// This file simulates an AI service that provides predictions.
// In a real application, this would integrate with actual machine learning
// or large language models.

import { ID } from "../../utils/types.ts"; // Adjusted path to utils

/**
 * Defines the types of models supported by the AI engine.
 */
export type ModelType = 'regression' | 'bayesian' | 'neural';

/**
 * Input structure for running a prediction.
 * In a real scenario, this would gather relevant data from other sources
 * (e.g., UserReport, QueueStatus concepts).
 */
export interface PredictionInput {
  queueID: ID;
  // Additional data for the AI model could be included here, e.g.:
  // userReports: Array<{ user: ID, timestamp: Date, waitTime: number | null, crowdLevel: string | null }>;
  // historicalData: Array<{ timestamp: Date, visitorCount: number, actualWaitTime: number }>;
}

/**
 * Output structure for a successful prediction.
 */
export interface PredictionOutput {
  estWaitTime: number; // Estimated wait time in minutes
  entryProbability: number; // Probability of entry (0.0 to 1.0)
  confidenceInterval: [number, number]; // [lowerBound, upperBound] for wait time
}

/**
 * Configuration for a specific AI model instance.
 */
export interface AIModelConfig {
  modelID: string;
  modelType: ModelType;
  accuracyThreshold: number; // e.g., 0.85, a target for model performance
}

/**
 * The core AI prediction engine class.
 * Handles running predictions based on its configured model.
 */
export class AIPredictionEngine {
  public readonly config: AIModelConfig;

  constructor(modelConfig: AIModelConfig) {
    this.config = modelConfig;
    // console.log(`[AIPredictionEngine] Initialized for model: ${modelConfig.modelID} (${modelConfig.modelType})`);
  }

  /**
   * Simulates running an AI prediction for a given queue.
   * This method would contain the logic to interface with an actual AI model.
   * @param input The input data for the prediction, including queueID.
   * @returns A PredictionOutput object if the prediction is successful, or null if there's insufficient data.
   */
  async runPrediction(input: PredictionInput): Promise<PredictionOutput | null> {
    // console.log(`[AIPredictionEngine] Running prediction for queue: ${input.queueID} with model: ${this.config.modelID}`);
    // Simulate AI processing time
    await new Promise(resolve => setTimeout(resolve, 30 + Math.random() * 20)); // Reduced delay for faster tests

    // Simulate AI engine throwing an unexpected error
    if (input.queueID === "queue:ai_engine_error" as ID) {
      console.error("[AIPredictionEngine] Simulating an unexpected AI engine error for queue:", input.queueID);
      throw new Error("Simulated AI model crash during prediction.");
    }

    // Simulate conditions where prediction might fail due to insufficient data
    if (input.queueID === "queue:insufficient_data" as ID) {
      // console.log("[AIPredictionEngine] Insufficient data for prediction for queue:", input.queueID);
      return null;
    }

    // Generate plausible dummy prediction results based on the queue ID
    let estWaitTime: number;
    let entryProbability: number;
    let confidenceInterval: [number, number];

    switch (input.queueID) {
      case "location:popular_cafe" as ID:
      case "location:principle_cafe" as ID: // Added for principle test
        estWaitTime = 25 + Math.floor(Math.random() * 10); // 25-34 min
        entryProbability = parseFloat((0.85 - Math.random() * 0.1).toFixed(2)); // 0.75-0.85
        confidenceInterval = [estWaitTime - 10, estWaitTime + 10];
        break;
      case "location:public_library" as ID:
        estWaitTime = 5 + Math.floor(Math.random() * 5); // 5-9 min
        entryProbability = parseFloat((0.99 - Math.random() * 0.02).toFixed(2)); // 0.97-0.99
        confidenceInterval = [estWaitTime - 2, estWaitTime + 3];
        break;
      default:
        estWaitTime = 15 + Math.floor(Math.random() * 15); // 15-29 min
        entryProbability = parseFloat((0.7 + Math.random() * 0.2).toFixed(2)); // 0.7-0.9
        confidenceInterval = [estWaitTime - 5, estWaitTime + 10];
        break;
    }

    // Ensure probability is within [0, 1]
    entryProbability = Math.max(0, Math.min(1, entryProbability));

    const result: PredictionOutput = {
      estWaitTime,
      entryProbability,
      confidenceInterval,
    };

    // console.log(`[AIPredictionEngine] Prediction for ${input.queueID}:`, result);
    return result;
  }
}

// A default instance of the AI Prediction Engine for convenience.
// This allows the PredictionConcept to use a default engine if none is specified.
const defaultAIModelConfig: AIModelConfig = {
  modelID: "default_prediction_model_v1",
  modelType: "neural",
  accuracyThreshold: 0.90,
};

export const defaultAIPredictionEngine = new AIPredictionEngine(defaultAIModelConfig);

// Function to create custom AI engine instances if different models are needed.
export function createAIPredictionEngine(config: AIModelConfig): AIPredictionEngine {
  return new AIPredictionEngine(config);
}
```

***

### `PredictionConcept.test.ts` (Test Suite)

```typescript
// file: src/Prediction/PredictionConcept.test.ts

import {
  assert,
  assertEquals,
  assertExists,
  assertObjectMatch,
} from "https://deno.land/std@0.207.0/assert/mod.ts";
import { MongoClient, Db } from "npm:mongodb";
import { ID } from "../../utils/types.ts"; // Adjust path as necessary (e.g., ../../utils/types.ts)
import PredictionConcept from "./PredictionConcept.ts"; // Adjust path as necessary (e.g., ./PredictionConcept.ts)
import { AIPredictionEngine, AIModelConfig } from "./aiPredictionEngine.ts"; // Assuming co-location

// Helper function to wait for a given number of milliseconds
const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

describe("PredictionConcept", () => {
  let db: Db;
  let client: MongoClient;
  let predictionConcept: PredictionConcept;

  // Use a specific test database to ensure isolation
  const TEST_DB_NAME = "concept-design-test-prediction";
  const MONGODB_URI = Deno.env.get("MONGODB_URI") || "mongodb://localhost:27017";

  beforeAll(async () => {
    // Connect to MongoDB client and select a test database
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    db = client.db(TEST_DB_NAME);
    console.log(`[Test Setup] Connected to test database: ${TEST_DB_NAME}`);
  });

  afterAll(async () => {
    // Drop the test database to ensure a clean state for future test runs
    await db.dropDatabase();
    await client.close();
    console.log(`[Test Teardown] Disconnected from test database. Dropped ${TEST_DB_NAME}`);
  });

  beforeEach(async () => {
    // Clean up collections before each test to prevent interference
    await db.collection("Prediction.forecasts").deleteMany({});

    // Create a new instance of PredictionConcept for each test
    // This uses the default AI engine configuration from aiPredictionEngine.ts
    predictionConcept = new PredictionConcept(db);
    console.log("[Test Setup] PredictionConcept initialized for a new test.");
  });

  // --- 1. Principle-Based Test Execution ---
  // The operational principle states: "If users at a location submit reports about queue status
  // and LLM natural-language interpretation... then the system will quickly update its forecasts
  // for that location, combining these live inputs with historical trends, making the predictions
  // more accurate and useful for all interested users."
  // This test simulates the outcome of such inputs by calling `runPrediction` and verifies
  // that forecasts are updated and retrievable.
  Deno.test("should fulfill its principle: update forecasts based on inputs and retrieve them", async () => {
    const queueId: ID = "location:principle_cafe" as ID;
    const modelId = predictionConcept["aiEngine"].config.modelID; // Get the model ID from the concept's engine

    console.log(`\n--- Principle Test: ${queueId} ---`);

    // Step 1: Simulate the first update to a forecast
    const runResult1 = await predictionConcept.runPrediction({
      queueID: queueId,
      modelID: modelId,
    });
    console.log(`[Principle Test] First runPrediction result:`, runResult1);

    assert(!("error" in runResult1), `Expected successful prediction, but got error: ${JSON.stringify(runResult1)}`);
    assertExists(runResult1.estWaitTime);
    assertExists(runResult1.entryProbability);
    assertEquals(runResult1.queueID, queueId);

    // Step 2: Retrieve the initial forecast
    const forecastResult1 = await predictionConcept.getForecast({ queueID: queueId });
    console.log(`[Principle Test] First getForecast result:`, forecastResult1);

    assert(!("error" in forecastResult1), `Expected successful forecast retrieval, but got error: ${JSON.stringify(forecastResult1)}`);
    assertEquals(forecastResult1.queueID, queueId);
    assertExists(forecastResult1.estWaitTime);
    assertExists(forecastResult1.lastRun);
    assert(forecastResult1.lastRun instanceof Date, "lastRun should be a Date object");

    const firstRunTime = forecastResult1.lastRun.getTime();
    console.log(`[Principle Test] First run time: ${new Date(firstRunTime).toISOString()}`);

    // Step 3: Simulate time passing and a subsequent update
    await delay(50); // Small delay to ensure lastRun timestamps are distinct

    const runResult2 = await predictionConcept.runPrediction({
      queueID: queueId,
      modelID: modelId,
    });
    console.log(`[Principle Test] Second runPrediction result:`, runResult2);

    assert(!("error" in runResult2), `Expected successful prediction on second run, but got error: ${JSON.stringify(runResult2)}`);

    // Step 4: Retrieve the updated forecast
    const forecastResult2 = await predictionConcept.getForecast({ queueID: queueId });
    console.log(`[Principle Test] Second getForecast result:`, forecastResult2);

    assert(!("error" in forecastResult2), `Expected successful forecast retrieval on second run, but got error: ${JSON.stringify(forecastResult2)}`);
    assertEquals(forecastResult2.queueID, queueId);
    assertExists(forecastResult2.estWaitTime);
    assertExists(forecastResult2.lastRun);

    const secondRunTime = forecastResult2.lastRun.getTime();
    console.log(`[Principle Test] Second run time: ${new Date(secondRunTime).toISOString()}`);

    // Verify that the forecast was updated, specifically checking that `lastRun` is more recent
    assert(secondRunTime > firstRunTime, "Expected lastRun to be updated on subsequent prediction runs");
    // Also, verify the core prediction data matches (allowing for slight variations from mock AI)
    assertObjectMatch(runResult2, {
      estWaitTime: forecastResult2.estWaitTime,
      entryProbability: forecastResult2.entryProbability,
    });
    console.log("--- Principle Test Passed ---");
  });

  // --- 2. Variant Test: runPrediction with insufficient data ---
  // Covers the effect: "generates nothing if there is insufficient information".
  Deno.test("should return error for runPrediction if AI engine reports insufficient data", async () => {
    const queueId: ID = "queue:insufficient_data" as ID; // Special ID for insufficient data simulation
    const modelId = predictionConcept["aiEngine"].config.modelID;

    console.log(`\n--- Variant Test: Insufficient Data for ${queueId} ---`);

    const runResult = await predictionConcept.runPrediction({
      queueID: queueId,
      modelID: modelId,
    });
    console.log(`[Insufficient Data Test] runPrediction result:`, runResult);

    assert("error" in runResult, "Expected an error result for insufficient data");
    assert(runResult.error.includes("Insufficient information"), `Expected "Insufficient information" error, got: ${runResult.error}`);

    // Verify that no forecast was stored in the database for this case
    const forecast = await db.collection("Prediction.forecasts").findOne({ _id: queueId });
    assertEquals(forecast, null, "No forecast should be stored for insufficient data");
    console.log("--- Insufficient Data Test Passed ---");
  });

  // --- 3. Variant Test: getForecast for a non-existent queue ---
  // Covers retrieving a forecast that has never been run or stored.
  Deno.test("should return error for getForecast if no prediction exists for the queue", async () => {
    const nonExistentQueueId: ID = "location:non_existent_queue" as ID;

    console.log(`\n--- Variant Test: Get Forecast for Non-Existent Queue ${nonExistentQueueId} ---`);

    const forecastResult = await predictionConcept.getForecast({ queueID: nonExistentQueueId });
    console.log(`[Non-Existent Queue Test] getForecast result:`, forecastResult);

    assert("error" in forecastResult, "Expected an error result for non-existent queue");
    assert(forecastResult.error.includes("No forecast found"), `Expected "No forecast found" error, got: ${forecastResult.error}`);
    console.log("--- Non-Existent Queue Test Passed ---");
  });

  // --- 4. Variant Test: cleanOldReports functionality ---
  // Covers the system action `cleanOldReports` to ensure it deletes old predictions but preserves recent ones.
  Deno.test("should successfully clean old predictions but keep recent ones", async () => {
    const oldQueueId: ID = "location:old_report_queue" as ID;
    const recentQueueId: ID = "location:recent_report_queue" as ID;
    const modelId = predictionConcept["aiEngine"].config.modelID;

    console.log(`\n--- Variant Test: Clean Old Reports ---`);

    // 1. Create an "old" prediction
    await predictionConcept.runPrediction({ queueID: oldQueueId, modelID: modelId });
    const oldPredictionDoc = await db.collection("Prediction.forecasts").findOne({ _id: oldQueueId });
    assertExists(oldPredictionDoc, "Old prediction should exist initially");

    // Manually set its lastRun timestamp to be very old (3 days ago for cleanup threshold of 2 days)
    const veryOldDate = new Date(Date.now() - (3 * 24 * 60 * 60 * 1000));
    await db.collection("Prediction.forecasts").updateOne(
      { _id: oldQueueId },
      { $set: { lastRun: veryOldDate } }
    );
    console.log(`[Clean Reports Test] Manually set oldPredictionDoc lastRun for ${oldQueueId} to: ${veryOldDate.toISOString()}`);


    // 2. Create a "recent" prediction (will have current timestamp)
    await predictionConcept.runPrediction({ queueID: recentQueueId, modelID: modelId });
    const recentPredictionDoc = await db.collection("Prediction.forecasts").findOne({ _id: recentQueueId });
    assertExists(recentPredictionDoc, "Recent prediction should exist initially");
    console.log(`[Clean Reports Test] Created recentPredictionDoc for ${recentQueueId} with lastRun: ${recentPredictionDoc?.lastRun.toISOString()}`);

    // Verify both predictions exist before cleanup
    const preCleanupDocs = await db.collection("Prediction.forecasts").find().toArray();
    assertEquals(preCleanupDocs.length, 2, "Expected 2 predictions before cleanup");

    // 3. Run the cleanup action
    console.log("[Clean Reports Test] Running cleanOldReports action.");
    const cleanupResult = await predictionConcept.cleanOldReports();
    console.log(`[Clean Reports Test] cleanOldReports result:`, cleanupResult);

    assert(!("error" in cleanupResult), `Expected successful cleanup, but got error: ${JSON.stringify(cleanupResult)}`);

    // 4. Verify cleanup results: old prediction deleted, recent one remains
    const remainingOld = await db.collection("Prediction.forecasts").findOne({ _id: oldQueueId });
    assertEquals(remainingOld, null, "Old prediction should have been deleted by cleanOldReports");
    console.log(`[Clean Reports Test] Verified old prediction for ${oldQueueId} is deleted.`);

    const remainingRecent = await db.collection("Prediction.forecasts").findOne({ _id: recentQueueId });
    assertExists(remainingRecent, "Recent prediction should NOT have been deleted by cleanOldReports");
    console.log(`[Clean Reports Test] Verified recent prediction for ${recentQueueId} is still present.`);

    const postCleanupDocs = await db.collection("Prediction.forecasts").find().toArray();
    assertEquals(postCleanupDocs.length, 1, "Expected 1 prediction remaining after cleanup");
    console.log("--- Clean Old Reports Test Passed ---");
  });

  // --- 5. Variant Test: AI engine throws an unexpected exception ---
  // Covers error handling within `runPrediction` when the AI engine fails critically.
  Deno.test("should return error if AI engine throws an unexpected exception during runPrediction", async () => {
    const queueId: ID = "queue:ai_engine_error" as ID; // Special ID for simulating AI engine error
    const modelId = predictionConcept["aiEngine"].config.modelID;

    console.log(`\n--- Variant Test: AI Engine Critical Error for ${queueId} ---`);

    // Call runPrediction, expecting it to catch the simulated AI engine error
    const runResult = await predictionConcept.runPrediction({
      queueID: queueId,
      modelID: modelId,
    });
    console.log(`[AI Engine Error Test] runPrediction result:`, runResult);

    assert("error" in runResult, "Expected an error result when AI engine throws an exception");
    assert(runResult.error.includes("Failed to generate prediction due to internal AI engine error"),
      `Expected "internal AI engine error" message, got: ${runResult.error}`);

    // Verify that no prediction was stored in the database for this error case
    const forecast = await db.collection("Prediction.forecasts").findOne({ _id: queueId });
    assertEquals(forecast, null, "No forecast should be stored after an AI engine error");
    console.log("--- AI Engine Critical Error Test Passed ---");
  });

  // --- 6. Variant Test: Handling of `modelID` in `runPrediction` ---
  // Explores the behavior when `runPrediction` is called with a `modelID` that differs from the concept's configured engine.
  Deno.test("should handle invalid modelID in runPrediction gracefully (default to concept's model)", async () => {
    const queueId: ID = "location:invalid_model_test" as ID;
    const invalidModelId = "non_existent_model" as string;
    const configuredModelId = predictionConcept["aiEngine"].config.modelID;

    console.log(`\n--- Variant Test: Invalid Model ID in runPrediction for ${queueId} ---`);
    console.log(`[Invalid Model ID Test] Attempting runPrediction with invalid modelID: '${invalidModelId}'`);

    // The concept's `runPrediction` logs a warning but proceeds with its *configured* engine.
    const runResult = await predictionConcept.runPrediction({
      queueID: queueId,
      modelID: invalidModelId,
    });
    console.log(`[Invalid Model ID Test] runPrediction result with invalid modelID:`, runResult);

    assert(!("error" in runResult), `Expected successful prediction despite invalid modelID, but got error: ${JSON.stringify(runResult)}`);
    assertExists(runResult.estWaitTime);
    assertEquals(runResult.queueID, queueId);

    // Verify the stored prediction actually used the concept's *configured* modelID, not the invalid one passed in.
    const storedForecastDoc = await db.collection("Prediction.forecasts").findOne({ _id: queueId });
    assertExists(storedForecastDoc, "Forecast should be stored despite invalid input modelID");
    assertEquals(storedForecastDoc?.modelID, configuredModelId, "Stored forecast should reflect the concept's configured modelID, not the invalid input.");
    console.log("--- Invalid Model ID Test Passed ---");
  });
});
```

***

### To Run These Tests:

1.  **Save the files**:
    *   `PredictionConcept.ts` and `aiPredictionEngine.ts` (the updated version) in a directory like `src/Prediction/`.
    *   `PredictionConcept.test.ts` in the same `src/Prediction/` directory.
    *   Ensure your `utils/types.ts` and `utils/database.ts` files exist at the paths specified in the imports (e.g., `../../utils/`).
2.  **Set up MongoDB**: Ensure a MongoDB instance is running, usually on `mongodb://localhost:27017`. You can optionally set `MONGODB_URI` in a `.env` file if it's different.
3.  **Run Deno tests**: Navigate to your project's root directory in your terminal and execute:
    ```bash
    deno test src/Prediction/PredictionConcept.test.ts --allow-net --allow-env --allow-read --allow-run=npm
    ```
    *   `--allow-net`: For MongoDB connection.
    *   `--allow-env`: To read `.env` variables like `MONGODB_URI`.
    *   `--allow-read`: Potentially for Deno itself or file operations.
    *   `--allow-run=npm`: For `npm:mongodb` module installation/access.

The tests will connect to a dedicated test database (`concept-design-test-prediction`), run the assertions, and then drop the test database, ensuring a clean slate for each execution.