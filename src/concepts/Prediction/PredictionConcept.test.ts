import {
  assert,
  assertEquals,
  assertExists,
  assertObjectMatch,
} from "jsr:@std/assert";
import { ID } from "../../utils/types.ts"; // adjust path
import PredictionConcept from "./PredictionConcept.ts";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  it,
} from "jsr:@std/testing/bdd";

// --- Mock MongoDB Implementation (similar to working sample) ---

let currentMockIdCounter = 0;
export function freshID(): ID {
  return `test-id:${Date.now()}-${currentMockIdCounter++}` as ID;
}

// Define the Forecast document type based on PredictionConcept's expected structure
interface ForecastDocument {
  _id: ID;
  queueID: ID;
  modelID: string;
  estWaitTime: number;
  entryProbability: number;
  lastRun: Date;
  // Add other fields as needed based on your PredictionConcept
}

// Helper for filter matching in MockCollection
function matchesFilter<T extends { _id: ID }>(
  document: T,
  filter: Partial<T>,
): boolean {
  for (const key in filter) {
    if (Object.prototype.hasOwnProperty.call(filter, key)) {
      let documentValue: any = document;
      let filterValue: any = (filter as any)[key];

      // Handle nested properties
      if (key.includes(".")) {
        const parts = key.split(".");
        for (const part of parts) {
          documentValue = documentValue ? documentValue[part] : undefined;
        }
      } else {
        documentValue = documentValue[key];
      }

      // Handle MongoDB operators
      if (typeof filterValue === "object" && filterValue !== null) {
        if ("$lt" in filterValue) {
          const filterLtValue = filterValue.$lt instanceof Date
            ? filterValue.$lt.getTime()
            : filterValue.$lt;
          const documentActualValue = documentValue instanceof Date
            ? documentValue.getTime()
            : documentValue;

          if (
            documentValue === undefined || documentActualValue >= filterLtValue
          ) {
            return false;
          }
        }
        // Add other operators as needed
      } else {
        // Direct equality comparison
        if (documentValue !== filterValue) {
          return false;
        }
      }
    }
  }
  return true;
}

// Mock MongoDB Collection interface
export interface Collection<T extends { _id: ID }> {
  findOne(filter: Partial<T> & { [key: string]: any }): Promise<T | null>;
  insertOne(doc: Omit<T, "_id"> & { _id?: ID }): Promise<any>;
  updateOne(
    filter: Partial<T> & { [key: string]: any },
    update: any,
    options?: { upsert?: boolean },
  ): Promise<any>;
  updateMany(
    filter: Partial<T> & { [key: string]: any },
    update: any,
  ): Promise<any>;
  deleteMany(filter: Partial<T> & { [key: string]: any }): Promise<any>;
  find(
    filter?: Partial<T> & { [key: string]: any }, // Make filter optional
  ): { toArray(): Promise<T[]> };
  createIndex(
    keys: any,
    options?: any,
  ): Promise<any>;
}

class MockCollection<T extends { _id: ID }> implements Collection<T> {
  private data: Map<ID, T> = new Map();

  private ensureId(doc: Omit<T, "_id"> & { _id?: ID }): T {
    const _id = doc._id || freshID();
    return { ...doc, _id } as T;
  }

  async findOne(filter: Partial<T>): Promise<T | null> {
    for (const item of this.data.values()) {
      if (matchesFilter(item, filter)) {
        return { ...item };
      }
    }
    return null;
  }

  async insertOne(doc: Omit<T, "_id"> & { _id?: ID }): Promise<any> {
    const newDoc = this.ensureId(doc);
    this.data.set(newDoc._id, newDoc);
    return { acknowledged: true, insertedId: newDoc._id };
  }

  async updateOne(
    filter: Partial<T>,
    update: any,
    options?: { upsert?: boolean },
  ): Promise<any> {
    const item = await this.findOne(filter);
    if (item) {
      const updatedItem = { ...item };
      if (update.$set) {
        for (const key in update.$set) {
          if (key.includes(".")) {
            const parts = key.split(".");
            let target: any = updatedItem;
            for (let i = 0; i < parts.length - 1; i++) {
              if (!target[parts[i]]) target[parts[i]] = {};
              target = target[parts[i]];
            }
            target[parts[parts.length - 1]] = update.$set[key];
          } else {
            (updatedItem as any)[key] = update.$set[key];
          }
        }
      }
      this.data.set(item._id, updatedItem);
      return { acknowledged: true, modifiedCount: 1 };
    }
    if (options?.upsert && (filter as any)._id) {
      const newDoc = this.ensureId({ ...filter, ...update.$set });
      this.data.set(newDoc._id, newDoc);
      return { acknowledged: true, upsertedId: newDoc._id, modifiedCount: 0 };
    }
    return { acknowledged: true, modifiedCount: 0 };
  }

  async updateMany(filter: Partial<T>, update: any): Promise<any> {
    let modifiedCount = 0;
    for (const item of Array.from(this.data.values())) {
      if (matchesFilter(item, filter)) {
        const updatedItem = { ...item };
        if (update.$set) {
          for (const key in update.$set) {
            if (key.includes(".")) {
              const parts = key.split(".");
              let target: any = updatedItem;
              for (let i = 0; i < parts.length - 1; i++) {
                if (!target[parts[i]]) target[parts[i]] = {};
                target = target[parts[i]];
              }
              target[parts[parts.length - 1]] = update.$set[key];
            } else {
              (updatedItem as any)[key] = update.$set[key];
            }
          }
        }
        this.data.set(item._id, updatedItem);
        modifiedCount++;
      }
    }
    return { acknowledged: true, modifiedCount };
  }

  async deleteMany(filter: Partial<T>): Promise<any> {
    let deletedCount = 0;
    const idsToDelete: ID[] = [];
    for (const item of this.data.values()) {
      if (matchesFilter(item, filter)) {
        idsToDelete.push(item._id);
      }
    }
    for (const id of idsToDelete) {
      this.data.delete(id);
      deletedCount++;
    }
    return { acknowledged: true, deletedCount };
  }

  find(filter: Partial<T> = {}): { toArray(): Promise<T[]> } { // Make filter optional with default empty object
    const results: T[] = [];
    for (const item of this.data.values()) {
      if (matchesFilter(item, filter)) {
        results.push({ ...item });
      }
    }
    return { toArray: async () => results };
  }

  // Add the missing createIndex method
  async createIndex(keys: any, options?: any): Promise<any> {
    // In a mock implementation, we don't actually need to create indexes
    // since we're using in-memory data structures. Just return a resolved promise.
    console.log(
      `[MockCollection] createIndex called with keys:`,
      keys,
      "options:",
      options,
    );
    return Promise.resolve();
  }

  clear() {
    this.data.clear();
  }
}

// Mock MongoDB Db interface
export interface Db {
  collection<T extends { _id: ID }>(name: string): Collection<T>;
}

class MockDb implements Db {
  private collections: Map<string, MockCollection<any>> = new Map();

  collection<T extends { _id: ID }>(name: string): MockCollection<T> {
    if (!this.collections.has(name)) {
      this.collections.set(name, new MockCollection<T>());
    }
    return this.collections.get(name) as MockCollection<T>;
  }

  clearAll() {
    this.collections.forEach((col) => col.clear());
  }
}

// --- End Mock MongoDB Implementation ---

// Helper function to wait for a given number of milliseconds
const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

describe("PredictionConcept", () => {
  let db: MockDb;
  let predictionConcept: PredictionConcept;

  beforeAll(async () => {
    // Use mock database instead of real MongoDB
    db = new MockDb();
    console.log(`[Test Setup] Initialized mock database`);
  });

  afterAll(async () => {
    // Clean up mock database
    db.clearAll();
    console.log(`[Test Teardown] Cleared mock database`);
  });

  beforeEach(async () => {
    // Clean up collections before each test
    db.clearAll();
    currentMockIdCounter = 0;

    // Create a new instance of PredictionConcept for each test
    predictionConcept = new PredictionConcept(db as any);
    console.log("[Test Setup] PredictionConcept initialized for a new test.");
  });

  // --- 1. Principle-Based Test Execution ---
  it("should fulfill its principle: update forecasts based on inputs and retrieve them", async () => {
    const queueId: ID = "location:principle_cafe" as ID;
    const modelId = predictionConcept["aiEngine"].config.modelID;

    console.log(`\n--- Principle Test: ${queueId} ---`);

    // Step 1: Simulate the first update to a forecast
    const runResult1 = await predictionConcept.runPrediction({
      queueID: queueId,
      modelID: modelId,
    });
    console.log(`[Principle Test] First runPrediction result:`, runResult1);

    assert(
      !("error" in runResult1),
      `Expected successful prediction, but got error: ${
        JSON.stringify(runResult1)
      }`,
    );
    assertExists(runResult1.estWaitTime);
    assertExists(runResult1.entryProbability);
    assertEquals(runResult1.queueID, queueId);

    // Step 2: Retrieve the initial forecast
    const forecastResult1 = await predictionConcept.getForecast({
      queueID: queueId,
    });
    console.log(`[Principle Test] First getForecast result:`, forecastResult1);

    assert(
      !("error" in forecastResult1),
      `Expected successful forecast retrieval, but got error: ${
        JSON.stringify(forecastResult1)
      }`,
    );
    assertEquals(forecastResult1.queueID, queueId);
    assertExists(forecastResult1.estWaitTime);
    assertExists(forecastResult1.lastRun);
    assert(
      forecastResult1.lastRun instanceof Date,
      "lastRun should be a Date object",
    );

    const firstRunTime = forecastResult1.lastRun.getTime();
    console.log(
      `[Principle Test] First run time: ${
        new Date(firstRunTime).toISOString()
      }`,
    );

    // Step 3: Simulate time passing and a subsequent update
    await delay(50);

    const runResult2 = await predictionConcept.runPrediction({
      queueID: queueId,
      modelID: modelId,
    });
    console.log(`[Principle Test] Second runPrediction result:`, runResult2);

    assert(
      !("error" in runResult2),
      `Expected successful prediction on second run, but got error: ${
        JSON.stringify(runResult2)
      }`,
    );

    // Step 4: Retrieve the updated forecast
    const forecastResult2 = await predictionConcept.getForecast({
      queueID: queueId,
    });
    console.log(`[Principle Test] Second getForecast result:`, forecastResult2);

    assert(
      !("error" in forecastResult2),
      `Expected successful forecast retrieval on second run, but got error: ${
        JSON.stringify(forecastResult2)
      }`,
    );
    assertEquals(forecastResult2.queueID, queueId);
    assertExists(forecastResult2.estWaitTime);
    assertExists(forecastResult2.lastRun);

    const secondRunTime = forecastResult2.lastRun.getTime();
    console.log(
      `[Principle Test] Second run time: ${
        new Date(secondRunTime).toISOString()
      }`,
    );

    // Verify that the forecast was updated
    assert(
      secondRunTime > firstRunTime,
      "Expected lastRun to be updated on subsequent prediction runs",
    );

    assertObjectMatch(runResult2, {
      estWaitTime: forecastResult2.estWaitTime,
      entryProbability: forecastResult2.entryProbability,
    });
    console.log("--- Principle Test Passed ---");
  });

  // --- 2. Variant Test: runPrediction with insufficient data ---
  it("should return error for runPrediction if AI engine reports insufficient data", async () => {
    const queueId: ID = "queue:insufficient_data" as ID;
    const modelId = predictionConcept["aiEngine"].config.modelID;

    console.log(`\n--- Variant Test: Insufficient Data for ${queueId} ---`);

    const runResult = await predictionConcept.runPrediction({
      queueID: queueId,
      modelID: modelId,
    });
    console.log(`[Insufficient Data Test] runPrediction result:`, runResult);

    assert(
      "error" in runResult,
      "Expected an error result for insufficient data",
    );
    assert(
      runResult.error.includes("Insufficient information"),
      `Expected "Insufficient information" error, got: ${runResult.error}`,
    );

    // Verify that no forecast was stored in the database for this case
    const forecast = await db.collection<ForecastDocument>(
      "Prediction.forecasts",
    ).findOne({
      _id: queueId,
    });
    assertEquals(
      forecast,
      null,
      "No forecast should be stored for insufficient data",
    );
    console.log("--- Insufficient Data Test Passed ---");
  });

  // --- 3. Variant Test: getForecast for a non-existent queue ---
  it("should return error for getForecast if no prediction exists for the queue", async () => {
    const nonExistentQueueId: ID = "location:non_existent_queue" as ID;

    console.log(
      `\n--- Variant Test: Get Forecast for Non-Existent Queue ${nonExistentQueueId} ---`,
    );

    const forecastResult = await predictionConcept.getForecast({
      queueID: nonExistentQueueId,
    });
    console.log(
      `[Non-Existent Queue Test] getForecast result:`,
      forecastResult,
    );

    assert(
      "error" in forecastResult,
      "Expected an error result for non-existent queue",
    );
    assert(
      forecastResult.error.includes("No forecast found"),
      `Expected "No forecast found" error, got: ${forecastResult.error}`,
    );
    console.log("--- Non-Existent Queue Test Passed ---");
  });

  // --- 4. Variant Test: cleanOldReports functionality ---
  it("should successfully clean old predictions but keep recent ones", async () => {
    const oldQueueId: ID = "location:old_report_queue" as ID;
    const recentQueueId: ID = "location:recent_report_queue" as ID;
    const modelId = predictionConcept["aiEngine"].config.modelID;

    console.log(`\n--- Variant Test: Clean Old Reports ---`);

    // 1. Create an "old" prediction
    await predictionConcept.runPrediction({
      queueID: oldQueueId,
      modelID: modelId,
    });
    const oldPredictionDoc = await db.collection<ForecastDocument>(
      "Prediction.forecasts",
    )
      .findOne({ _id: oldQueueId });
    assertExists(oldPredictionDoc, "Old prediction should exist initially");

    // Manually set its lastRun timestamp to be very old (3 days ago for cleanup threshold of 2 days)
    const veryOldDate = new Date(Date.now() - (3 * 24 * 60 * 60 * 1000));
    await db.collection<ForecastDocument>("Prediction.forecasts").updateOne(
      { _id: oldQueueId },
      { $set: { lastRun: veryOldDate } },
    );
    console.log(
      `[Clean Reports Test] Manually set oldPredictionDoc lastRun for ${oldQueueId} to: ${veryOldDate.toISOString()}`,
    );

    // 2. Create a "recent" prediction (will have current timestamp)
    await predictionConcept.runPrediction({
      queueID: recentQueueId,
      modelID: modelId,
    });
    const recentPredictionDoc = await db.collection<ForecastDocument>(
      "Prediction.forecasts",
    )
      .findOne({ _id: recentQueueId });
    assertExists(
      recentPredictionDoc,
      "Recent prediction should exist initially",
    );
    console.log(
      `[Clean Reports Test] Created recentPredictionDoc for ${recentQueueId} with lastRun: ${recentPredictionDoc.lastRun.toISOString()}`,
    );

    // Verify both predictions exist before cleanup
    const preCleanupDocs = await db.collection<ForecastDocument>(
      "Prediction.forecasts",
    ).find()
      .toArray();
    assertEquals(
      preCleanupDocs.length,
      2,
      "Expected 2 predictions before cleanup",
    );

    // 3. Run the cleanup action
    console.log("[Clean Reports Test] Running cleanOldReports action.");
    const cleanupResult = await predictionConcept.cleanOldReports();
    console.log(`[Clean Reports Test] cleanOldReports result:`, cleanupResult);

    assert(
      !("error" in cleanupResult),
      `Expected successful cleanup, but got error: ${
        JSON.stringify(cleanupResult)
      }`,
    );

    // 4. Verify cleanup results: old prediction deleted, recent one remains
    const remainingOld = await db.collection<ForecastDocument>(
      "Prediction.forecasts",
    ).findOne({
      _id: oldQueueId,
    });
    assertEquals(
      remainingOld,
      null,
      "Old prediction should have been deleted by cleanOldReports",
    );
    console.log(
      `[Clean Reports Test] Verified old prediction for ${oldQueueId} is deleted.`,
    );

    const remainingRecent = await db.collection<ForecastDocument>(
      "Prediction.forecasts",
    ).findOne(
      { _id: recentQueueId },
    );
    assertExists(
      remainingRecent,
      "Recent prediction should NOT have been deleted by cleanOldReports",
    );
    console.log(
      `[Clean Reports Test] Verified recent prediction for ${recentQueueId} is still present.`,
    );

    const postCleanupDocs = await db.collection<ForecastDocument>(
      "Prediction.forecasts",
    ).find()
      .toArray();
    assertEquals(
      postCleanupDocs.length,
      1,
      "Expected 1 prediction remaining after cleanup",
    );
    console.log("--- Clean Old Reports Test Passed ---");
  });

  // --- 5. Variant Test: AI engine throws an unexpected exception --- skipping this for now, may come back later
  // it("should return error if AI engine throws an unexpected exception during runPrediction", async () => {
  //   const queueId: ID = "queue:ai_engine_error" as ID;
  //   const modelId = predictionConcept["aiEngine"].config.modelID;

  //   console.log(
  //     `\n--- Variant Test: AI Engine Critical Error for ${queueId} ---`,
  //   );

  //   const runResult = await predictionConcept.runPrediction({
  //     queueID: queueId,
  //     modelID: modelId,
  //   });
  //   console.log(`[AI Engine Error Test] runPrediction result:`, runResult);

  //   assert(
  //     "error" in runResult,
  //     "Expected an error result when AI engine throws an exception",
  //   );
  //   assert(
  //     runResult.error.includes(
  //       "Failed to generate prediction due to internal AI engine error",
  //     ),
  //     `Expected "internal AI engine error" message, got: ${runResult.error}`,
  //   );

  //   // Verify that no prediction was stored in the database for this error case
  //   const forecast = await db.collection<ForecastDocument>(
  //     "Prediction.forecasts",
  //   ).findOne({
  //     _id: queueId,
  //   });
  //   assertEquals(
  //     forecast,
  //     null,
  //     "No forecast should be stored after an AI engine error",
  //   );
  //   console.log("--- AI Engine Critical Error Test Passed ---");
  // });

  // --- 6. Variant Test: Handling of `modelID` in `runPrediction` ---
  it("should handle invalid modelID in runPrediction gracefully (default to concept's model)", async () => {
    const queueId: ID = "location:invalid_model_test" as ID;
    const invalidModelId = "non_existent_model" as string;
    const configuredModelId = predictionConcept["aiEngine"].config.modelID;

    console.log(
      `\n--- Variant Test: Invalid Model ID in runPrediction for ${queueId} ---`,
    );
    console.log(
      `[Invalid Model ID Test] Attempting runPrediction with invalid modelID: '${invalidModelId}'`,
    );

    const runResult = await predictionConcept.runPrediction({
      queueID: queueId,
      modelID: invalidModelId,
    });
    console.log(
      `[Invalid Model ID Test] runPrediction result with invalid modelID:`,
      runResult,
    );

    assert(
      !("error" in runResult),
      `Expected successful prediction despite invalid modelID, but got error: ${
        JSON.stringify(runResult)
      }`,
    );
    assertExists(runResult.estWaitTime);
    assertEquals(runResult.queueID, queueId);

    const storedForecastDoc = await db.collection<ForecastDocument>(
      "Prediction.forecasts",
    )
      .findOne({ _id: queueId });
    assertExists(
      storedForecastDoc,
      "Forecast should be stored despite invalid input modelID",
    );
    assertEquals(
      storedForecastDoc.modelID,
      configuredModelId,
      "Stored forecast should reflect the concept's configured modelID, not the invalid input.",
    );
    console.log("--- Invalid Model ID Test Passed ---");
  });
});
