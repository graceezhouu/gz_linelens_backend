---
timestamp: 'Sun Oct 19 2025 14:00:48 GMT-0400 (Eastern Daylight Time)'
parent: '[[../20251019_140048.e29a5269.md]]'
content_id: c84814e5f8d8a6a4eeb1d83ea8210cbf1cdafae43d013caed1dac15484f540b5
---

# response:

The provided `PredictionEngine` code implements some of the core logic for generating predictions but deviates significantly from the `Prediction` concept specification in structure, adherence to concept design principles, and state management.

Here's a breakdown of the mismatches and the revised code that aligns with the `Prediction` concept:

## Mismatches and Issues in the Original Code:

1. **Concept Structure Violation:**
   * **Naming:** The class is named `PredictionEngine` instead of `PredictionConcept` (following the `ConceptName + Concept` convention).
   * **Modularity/Independence:** The `PredictionEngine` manages `userReports` and `queues` directly as in-memory maps. The concept specification explicitly states: "*Prediction is not an independent data store but a service built on top of UserReport and QueueStatus. Prediction pulls from UserReport through a sync, not a redundant data store.*" This means `PredictionConcept` should *not* store or manage `UserReport` or `QueueStatus` data.
   * **Persistence:** The concept specifies using MongoDB for persistence, but the `PredictionEngine` uses in-memory `Map`s for all its state.

2. **Concept State Mismatch:**
   * The `modelID`, `modelType`, and `accuracyThreshold` fields from the concept's state are not explicitly stored or managed in the `PredictionEngine`.
   * The `predictionResult` and `lastRun` are part of an in-memory `Map<string, PredictionResult>`, which is a per-queue result, but the concept's state declaration is slightly ambiguous about whether it's a global single result or a collection. The per-queue interpretation (as in the `runPrediction(queueID: ...)` action) is more sensible and is adopted in the revised code.
   * The `PredictionResult` interface in the code includes `aiSummary`, which is not present in the concept's `predictionResult` state definition.

3. **Action Mismatches:**
   * **`runPrediction`:**
     * The `modelID: String` argument is missing from the `PredictionEngine.runPrediction` method signature.
     * The return type should be a structured `{ predictionResult: ... }` or `{ error: ... }` as per concept guidelines for actions.
   * **`getForecast`:**
     * The `PredictionEngine` has a `getPrediction` method, but not `getForecast`. The concept specifies `getForecast` as an action, implying a public API.
   * **`system cleanOldReports`:** This crucial system action is entirely missing from the `PredictionEngine`.
   * **Undefined Actions:** `createQueue`, `submitUserReport`, `interpretReport`, and `summarizeForecast` are public methods in `PredictionEngine` but are *not* defined as actions in the `Prediction` concept.
     * `createQueue` and `submitUserReport` belong to other concepts (e.g., `Queue` and `UserReport`).
     * `interpretReport` and `summarizeForecast` are internal logic for `PredictionConcept` to fulfill its purpose (generating predictions and summaries), not standalone concept actions. The `runPrediction` action already includes summary generation.

4. **Error Handling:** The `PredictionEngine` often throws `Error`s for expected conditions (e.g., queue not found), whereas the concept design guidelines suggest returning `{ error: "message" }` for such cases.

5. **Generic Parameters and IDs:** The `Prediction` concept specifies `[Location, User]` as type parameters, implying generic `ID` usage. The original code uses plain `string`s for `queueID` and `userID` (where present) and doesn't leverage the `@utils/types.ts` `ID` branding.

## Revised Code Implementation:

The following code refactors `PredictionEngine` into `PredictionConcept`, adhering to the concept design principles:

* **MongoDB Persistence:** Uses MongoDB `Collection`s for state management.
* **Separation of Concerns:** `PredictionConcept` no longer manages `UserReport` or `QueueStatus` data internally. Instead, the `runPrediction` action accepts this data as arguments, simulating how a synchronization (`sync`) would provide it from other concepts.
* **Concept State:** Defined explicit MongoDB document interfaces for `PredictionConfigDoc` (for global configuration) and `PredictionResultDoc` (for per-queue predictions).
* **Action Alignment:**
  * `runPrediction` now accepts `modelID` and external `UserReport`s and `QueueStatus` data. It returns structured `{ predictionResult: ... }` or `{ error: ... }`.
  * `getForecast` is implemented as specified.
  * `system cleanOldReports` is fully implemented.
  * Public methods not listed as concept actions (e.g., `createQueue`, `submitUserReport`, `summarizeForecast`, `interpretReport`) have been removed or made private helpers (`_interpretReport`).
* **Error Handling:** All expected errors now return `{ error: "message" }`.
* **ID Typing:** Uses `ID` from `@utils/types.ts` for `Location` (`QueueID`) and `User`.
* **Documentation:** Added JSDoc comments to align with concept specification sections (purpose, principle, actions, state).

```typescript
// Assuming @utils/types.ts and @utils/database.ts are available as described in the problem.
// For self-contained execution, I'm providing minimal definitions for ID, Empty, and freshID.
// In a real project, these would be imported from the @utils folder.

// Minimal @utils/types.ts
export type ID = string & { __brand: "ID" };
export type Empty = Record<PropertyKey, never>;

// Minimal @utils/database.ts (for freshID, which might not be used if queueID is _id)
export function freshID(): ID {
  return `id-${Date.now()}-${Math.floor(Math.random() * 1e9)}` as ID;
}

// Mock for MongoDB Collection and Db for demonstration if not running with actual MongoDB
// In a real project, these would be imported from "npm:mongodb"
interface Collection<T extends { _id: any }> {
  findOne(query: Partial<T>): Promise<T | null>;
  updateOne(query: Partial<T>, update: any, options?: { upsert?: boolean }): Promise<any>;
  deleteMany(query: any): Promise<{ deletedCount: number }>;
}
interface Db {
  collection<T extends { _id: any }>(name: string): Collection<T>;
}


// LLMService interface: This would typically be defined in its own file (e.g., ./llm-interface.ts)
// and a concrete implementation (like GeminiLLM) would implement it.
interface LLMService {
  executeLLM(prompt: string, maxTokens: number): Promise<string>;
}

// Mock LLMService for testing purposes, as GeminiLLM is not provided
class MockLLM implements LLMService {
  async executeLLM(prompt: string, maxTokens: number): Promise<string> {
    // console.log(`MockLLM received prompt (truncated): ${prompt.slice(0, 200)}...`);
    // Simulate interpretReport
    if (prompt.includes("estPplInLine") && prompt.includes("estimatedWaitMins")) {
      if (prompt.includes("30 people")) {
        return '{"estPplInLine": 30, "estimatedWaitMins": 15, "movementRate": "slow", "aiConfidence": 90}';
      }
      if (prompt.includes("short wait")) {
        return '{"estPplInLine": 10, "estimatedWaitMins": 5, "movementRate": "fast", "aiConfidence": 80}';
      }
      // Default interpretation
      return '{"estPplInLine": 20, "estimatedWaitMins": 10, "movementRate": "steady", "aiConfidence": 85}';
    }
    // Simulate summary/refinement
    if (prompt.includes("summarizes queue predictions")) {
      return '{"aiSummary": "The current wait is moderate, likely around 12 minutes, with a good chance of entry (75%).", "estWaitTimeMins": 12, "entryProbability": 75}';
    }
    return "{}"; // Default empty JSON for other cases
  }
}


// file: src/Prediction/PredictionConcept.ts
// import { Collection, Db } from "npm:mongodb"; // Use actual MongoDB imports if running
// import { Empty, ID } from "@utils/types.ts";
// import { freshID } from "@utils/database.ts";


// Define generic type parameters from the concept spec
type Location = ID; // Using ID for Location, which maps to queueID
type User = ID;     // Using ID for User, though not directly managed by Prediction concept

// Alias for clarity for location IDs
type QueueID = Location;

// UserReport interface (as defined in the original code, but now treated as external data)
// This interface defines the shape of user reports that *another* concept (e.g., UserReportConcept) would manage
// and provide to PredictionConcept via syncs or queries.
export interface UserReport {
  id: ID; // Assuming UserReport has its own ID
  queueID: QueueID;
  userID?: User;
  rawText: string;
  timestamp: number;
  // structured (optional): populated after LLM interpretation
  estPplInLine?: number | null;
  estimatedWaitMins?: number | null;
  movementRate?: "stopped" | "slow" | "steady" | "fast" | null;
  entryOutcome?: "entered" | "denied" | "left" | null;
  aiConfidence?: number | null;
}

// QueueStatus interface (representing data from another concept, e.g., QueueConcept)
interface QueueStatus {
  queueID: QueueID;
  historicalAvgMins?: number | null;
  historicalAvgPpl?: number | null;
}

// --- Concept State Definitions (for MongoDB) ---

/**
 * @state
 * modelID: String
 * modelType: Enum('regression', 'bayesian', 'neural')
 * accuracyThreshold: Number
 */
interface PredictionConfigDoc {
  _id: "config"; // Fixed ID for the single configuration document
  modelID: string;
  modelType: "regression" | "bayesian" | "neural";
  accuracyThreshold: number;
}

/**
 * @state
 * predictionResult: {
 *   queueID: String
 *   estWaitTime: Number
 *   entryProbability: Number
 *   confidenceInterval: [Number, Number]
 * } | Null
 * lastRun: DateTime
 *
 * NOTE: The original `PredictionEngine` also generated an `aiSummary`.
 * This has been included here as `aiSummary?: string | null` in the document structure
 * because `runPrediction` relies on it. If this is a core part of the prediction,
 * it should be explicitly added to the concept specification's state definition.
 */
interface PredictionResultDoc {
  _id: QueueID; // The queueID is the primary key for prediction results
  estWaitTime: number | null; // Estimated wait time in minutes
  entryProbability: number | null; // Probability of entry, 0-100
  confidenceInterval: [number, number] | null; // Confidence interval for wait time
  aiSummary?: string | null; // LLM-generated summary (extension to concept spec)
  lastRun: number; // Unix timestamp of when the prediction was last run
}

// Define the structured return type for actions that output prediction results
interface ActionPredictionResult {
  queueID: QueueID;
  estWaitTime: number | null;
  entryProbability: number | null;
  confidenceInterval: [number, number] | null;
  aiSummary?: string | null;
  lastRun: number;
}

/**
 * @concept Prediction [Location, User]
 * @purpose Provide users with estimated wait times and entry likelihoods for specific locations,
 * leveraging both historical trends, real-time user-contributed data, and AI predictions.
 *
 * @principle Combines user reports about queue status and LLM natural-language interpretation
 * to produce structured predictions and user-facing summaries. If users at a location submit reports
 * about their current experience (e.g., wait time, crowd level), then the system will quickly update
 * its forecasts for that location, combining these live inputs with historical trends, making the
 * predictions more accurate and useful for all interested users.
 */
export default class PredictionConcept {
  private configCollection: Collection<PredictionConfigDoc>;
  private resultsCollection: Collection<PredictionResultDoc>;
  private llm: LLMService; // LLM dependency

  constructor(db: Db, llm: LLMService) {
    this.configCollection = db.collection<PredictionConfigDoc>("Prediction.config");
    this.resultsCollection = db.collection<PredictionResultDoc>("Prediction.results");
    this.llm = llm;

    // Initialize default config if not present (could be a separate 'initializeConfig' action too)
    this.configCollection.updateOne(
      { _id: "config" },
      { $setOnInsert: {
          _id: "config",
          modelID: "default-hybrid-v1",
          modelType: "neural",
          accuracyThreshold: 0.85,
        },
      },
      { upsert: true }
    );
  }

  /**
   * @action runPrediction
   * @requires queueID must exist (meaning a `QueueStatus` for it can be retrieved from an external concept)
   * @effects generates updated prediction results for wait time and entry likelihood
   * based on historical + live inputs, generates nothing if there is insufficient information.
   *
   * @param queueID The ID of the queue (location) to generate predictions for.
   * @param modelID The specific model to use for prediction.
   * @param currentReports An array of recent user reports for the queue, provided by a `UserReport` concept.
   * @param queueStatus The historical and current status of the queue, provided by a `QueueStatus` concept.
   */
  async runPrediction(
    { queueID, modelID, currentReports, queueStatus }: {
      queueID: QueueID;
      modelID: string; // The modelID from concept spec
      currentReports: UserReport[]; // Data from UserReport concept
      queueStatus: QueueStatus; // Data from QueueStatus concept
    },
  ): Promise<{ predictionResult: ActionPredictionResult } | { error: string }> {
    // Validate required external data
    if (!queueStatus || queueStatus.queueID !== queueID) {
      return { error: `Queue ${queueID} does not exist or invalid status provided.` };
    }

    // Retrieve global prediction configuration
    const config = await this.configCollection.findOne({ _id: "config" });
    if (!config || config.modelID !== modelID) {
      return { error: `Model ID '${modelID}' not found or configured for this concept instance.` };
    }

    // --- Core prediction logic starts here, adapted from original code ---
    // Filter for reports that have structured data or raw text needing interpretation
    const reportsToProcess = currentReports.filter((r) =>
      r.estPplInLine !== undefined || r.rawText
    );

    // Heuristic baseline using historical averages from queueStatus
    const historicalEstimate = queueStatus.historicalAvgMins ?? null;
    const historicalPpl = queueStatus.historicalAvgPpl ?? null;

    // Interpret raw reports if necessary (internal LLM call)
    const interpretedReports: UserReport[] = await Promise.all(
      reportsToProcess.map(async (report) => {
        // Only interpret if the report lacks structured data but has raw text
        if (report.rawText && report.estPplInLine === undefined && report.estimatedWaitMins === undefined) {
          try {
            return await this._interpretReport(report);
          } catch (err) {
            console.warn(`Failed to interpret report ${report.id}: ${(err as Error).message}`);
            return report; // Return original report if interpretation fails
          }
        }
        return report;
      })
    );

    // Compute aggregated reported stats from interpreted reports
    let reportedPplAvg: number | null = null;
    let reportedWaitAvg: number | null = null;
    const structuredReports = interpretedReports.filter(r => r.estPplInLine !== undefined && r.estimatedWaitMins !== undefined);

    if (structuredReports.length > 0) {
      const pplVals = structuredReports.map((r) => r.estPplInLine!).filter((n) =>
        typeof n === "number" && n >= 0
      );
      const waitVals = structuredReports.map((r) => r.estimatedWaitMins!).filter((n) =>
        typeof n === "number" && n >= 0
      );
      if (pplVals.length > 0) {
        reportedPplAvg = Math.round(
          pplVals.reduce((a, b) => a + b, 0) / pplVals.length,
        );
      }
      if (waitVals.length > 0) {
        reportedWaitAvg = Math.round(
          waitVals.reduce((a, b) => a + b, 0) / waitVals.length,
        );
      }
    }

    // Prefer live reports when present
    const estWait = reportedWaitAvg ?? historicalEstimate ??
      (reportedPplAvg ? reportedPplAvg * 2 : null); // Naive factor: 2 mins per person
    // estPpl is computed but not part of final PredictionResultDoc
    const estPpl = reportedPplAvg ?? historicalPpl ?? null;

    // EntryProbability: crude heuristic
    let entryProb: number | null = null;
    if (estWait === null && estPpl === null) {
      entryProb = null;
    } else {
      if (estWait !== null) {
        entryProb = Math.max(5, 95 - estWait / 2); // Arbitrary mapping: longer waits reduce probability
      } else if (estPpl !== null) {
        entryProb = Math.max(5, 95 - estPpl * 1.5); // Arbitrary mapping: more people reduce probability
      } else {
        entryProb = 50; // Default if some info, but not wait/people
      }
    }
    // Clamp probability to 0-100
    if (typeof entryProb === "number") {
      entryProb = Math.max(0, Math.min(100, Math.round(entryProb)));
    }

    // Confidence interval: small if many reports, larger if only historical
    let ci: [number, number] | null = null;
    if (estWait !== null) {
      const base = Math.max(
        10,
        Math.round(structuredReports.length > 0 ? 20 / structuredReports.length : 30),
      );
      ci = [Math.max(0, estWait - base), estWait + base];
    }

    // Assemble preliminary prediction result document
    const newPredictionDoc: PredictionResultDoc = {
      _id: queueID,
      estWaitTime: estWait ?? null,
      entryProbability: entryProb ?? null,
      confidenceInterval: ci,
      aiSummary: null, // To be filled by LLM below
      lastRun: Date.now(),
    };

    // Use LLM to produce an AI summary and optionally refine numbers
    try {
      const summaryPrompt = this._buildSummaryPrompt(queueID, newPredictionDoc, structuredReports);
      const summaryRaw = await this.llm.executeLLM(summaryPrompt, 220);
      const jsonMatch = summaryRaw.match(/\{[\s\S]*\}/);
      let aiSummary = summaryRaw; // Default to raw summary if no JSON or parsing error

      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          // Validate and apply LLM-suggested numeric refinements
          if (typeof parsed.estWaitTimeMins === "number" || typeof parsed.entryProbability === "number") {
            const candidate = {
              estWaitTimeMins: parsed.estWaitTimeMins ?? newPredictionDoc.estWaitTime,
              entryProbability: parsed.entryProbability ?? newPredictionDoc.entryProbability,
            };
            this._runPredictionValidators(candidate); // Ensure LLM suggestions are reasonable
            newPredictionDoc.estWaitTime = candidate.estWaitTimeMins ?? newPredictionDoc.estWaitTime;
            newPredictionDoc.entryProbability = candidate.entryProbability ?? newPredictionDoc.entryProbability;
            if (parsed.confidenceIntervalMins && Array.isArray(parsed.confidenceIntervalMins)) {
              newPredictionDoc.confidenceInterval = parsed.confidenceIntervalMins as [number, number];
            }
            if (parsed.aiSummary && typeof parsed.aiSummary === "string") {
              aiSummary = parsed.aiSummary; // Use LLM's refined summary
            }
          } else if (parsed.aiSummary && typeof parsed.aiSummary === "string") {
            aiSummary = parsed.aiSummary; // Use LLM's summary even if no numeric refinements
          }
        } catch (err) {
          console.warn("LLM summary JSON parse/refinement failed, using raw text as summary:", (err as Error).message);
        }
      }
      newPredictionDoc.aiSummary = (typeof aiSummary === "string") ? aiSummary.trim() : null;
    } catch (err) {
      console.warn(
        "LLM summary/refinement failed ⚠️ ⚠️ ⚠️ :",
        (err as Error).message,
      );
    }

    // Persist the updated prediction result to MongoDB
    await this.resultsCollection.updateOne(
      { _id: queueID },
      { $set: newPredictionDoc },
      { upsert: true } // Create if not exists, update if it does
    );

    // Return the result in the specified format
    const result: ActionPredictionResult = {
      queueID: newPredictionDoc._id,
      estWaitTime: newPredictionDoc.estWaitTime,
      entryProbability: newPredictionDoc.entryProbability,
      confidenceInterval: newPredictionDoc.confidenceInterval,
      aiSummary: newPredictionDoc.aiSummary,
      lastRun: newPredictionDoc.lastRun
    };

    return { predictionResult: result };
  }

  /**
   * @action getForecast
   * @requires queueID must exist (meaning a prediction for it has been run)
   * @effects returns the most recently available prediction and lastRun
   *
   * @param queueID The ID of the queue (location) to get the forecast for.
   */
  async getForecast(
    { queueID }: { queueID: QueueID },
  ): Promise<{ predictionResult: ActionPredictionResult } | { error: string }> {
    const doc = await this.resultsCollection.findOne({ _id: queueID });

    if (!doc) {
      return { error: `No forecast found for queue ${queueID}` };
    }

    const result: ActionPredictionResult = {
      queueID: doc._id,
      estWaitTime: doc.estWaitTime,
      entryProbability: doc.entryProbability,
      confidenceInterval: doc.confidenceInterval,
      aiSummary: doc.aiSummary,
      lastRun: doc.lastRun
    };

    return { predictionResult: result };
  }

  /**
   * @action system cleanOldReports
   * @requires true
   * @effects delete Predictions older than a certain threshold (e.g., 2 hours, 2 days)
   *
   * NOTE: As per the concept specification, this action deletes `PredictionResultDoc`s,
   * not `UserReport`s (which would belong to a separate `UserReport` concept).
   * A 2-day threshold is used for deleting predictions.
   */
  async cleanOldReports(): Promise<Empty> {
    const threshold = Date.now() - (2 * 24 * 60 * 60 * 1000); // 2 days in milliseconds
    const result = await this.resultsCollection.deleteMany({
      lastRun: { $lt: threshold },
    });
    console.log(`Cleaned ${result.deletedCount} old prediction results.`);
    return {};
  }

  // --- Internal helper methods (not concept actions), prefixed with underscore ---

  /**
   * Internal helper to interpret a raw user report text using LLM.
   * This is part of `runPrediction`'s internal logic, not a public concept action.
   */
  private async _interpretReport(
    report: UserReport,
    promptVariant = 0, // Kept for flexibility, using variant 0 for direct extraction
  ): Promise<UserReport> {
    const prompt = this._buildInterpretPrompt(report.rawText, promptVariant);

    const raw = await this.llm.executeLLM(prompt, 300);

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("LLM interpretReport did not return JSON object");
    }

    let parsed: any;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (err) {
      // Attempt to clean up common JSON issues (e.g., single quotes, unquoted keys)
      const cleaned = jsonMatch[0].replace(
        /(['"])?([a-zA-Z0-9_]+)(['"])?:/g,
        '"$2":',
      ).replace(/'/g, '"');
      try {
        parsed = JSON.parse(cleaned);
      } catch (innerErr) {
        throw new Error(`Failed to parse LLM JSON after cleaning: ${innerErr}`);
      }
    }

    const validated = this._validateInterpreted(parsed);

    // Create a new UserReport object with interpreted fields
    const interpretedReport: UserReport = { ...report,
      estPplInLine: validated.estPplInLine,
      estimatedWaitMins: validated.estimatedWaitMins,
      movementRate: validated.movementRate,
      entryOutcome: validated.entryOutcome ?? null,
      aiConfidence: validated.aiConfidence ?? null,
    };

    return interpretedReport;
  }

  private _buildInterpretPrompt(rawText: string, variant = 0): string {
    const base =
      `You are an assistant that reads a short user report about a physical queue (line) and returns a JSON object describing:

* estPplInLine: integer estimate of people ahead of the reporter (or null)
* estimatedWaitMins: integer estimate of remaining minutes (or null)
* movementRate: one of "stopped","slow","steady","fast" (or null)
* entryOutcome: optional one of "entered","denied","left" (or null)
* aiConfidence: optional integer 0-100 indicating confidence in extraction

Report text: """${rawText}"""

Return ONLY a JSON object.`;
    if (variant === 0) {
      return `Extract the numeric information from the report.\n\n${base}`;
    } else if (variant === 1) {
      return `You are a careful queue analyst. Interpret the report conservatively; when in doubt prefer null. ${base}`;
    } else {
      return `Map qualitative phrases to numbers: "block" => 20 people, "crowded" => +30 people, "small" => 5 people.
${base}\`;
    }
  }

  private _buildSummaryPrompt(
    queueID: QueueID,
    pred: PredictionResultDoc,
    reports: UserReport[],
  ): string {
    const reportsShort = reports.slice(-4).map((r) => `- "${r.rawText}"`).join(
      "\n",
    );
    return `You are a helpful assistant that summarizes queue predictions for users.
Queue: ${queueID}
Baseline estWaitTimeMins: ${pred.estWaitTime ?? "unknown"}
EntryProbability: ${pred.entryProbability ?? "unknown"}
Recent reports (latest up to 4):
${reportsShort || "- none"}

Return a JSON object containing optionally:
{
"estWaitTimeMins": number | null,
"entryProbability": number | null,
"confidenceIntervalMins": [number, number] | null,
"aiSummary": string
}
Be concise. Return ONLY the JSON object.\`;
  }

  private _validateInterpreted(parsed: any): {
    estPplInLine: number | null;
    estimatedWaitMins: number | null;
    movementRate: "stopped" | "slow" | "steady" | "fast" | null;
    entryOutcome?: "entered" | "denied" | "left" | null;
    aiConfidence?: number | null;
  } {
    const out: any = {
      estPplInLine: null,
      estimatedWaitMins: null,
      movementRate: null,
      entryOutcome: null,
      aiConfidence: null,
    };

    if (parsed.estPplInLine !== undefined && parsed.estPplInLine !== null) {
      const asNum = Number(parsed.estPplInLine);
      if (!Number.isFinite(asNum) || asNum < 0) {
        throw new Error("Validation error: estPplInLine invalid (must be a non-negative number)");
      }
      out.estPplInLine = Math.round(asNum);
    }

    if (
      parsed.estimatedWaitMins !== undefined &&
      parsed.estimatedWaitMins !== null
    ) {
      const asNum = Number(parsed.estimatedWaitMins);
      if (!Number.isFinite(asNum) || asNum < 0) {
        throw new Error("Validation error: estimatedWaitMins invalid (must be a non-negative number)");
      }
      out.estimatedWaitMins = Math.round(asNum);
    }

    if (parsed.movementRate) {
      const v = String(parsed.movementRate).toLowerCase();
      if (["stopped", "slow", "steady", "fast"].includes(v)) {
        out.movementRate = v as any;
      } else throw new Error("Validation error: movementRate invalid (must be 'stopped', 'slow', 'steady', or 'fast')");
    }

    if (parsed.entryOutcome) {
      const v = String(parsed.entryOutcome).toLowerCase();
      if (["entered", "denied", "left"].includes(v)) {
        out.entryOutcome = v as any;
      } else throw new Error("Validation error: entryOutcome invalid (must be 'entered', 'denied', or 'left')");
    }

    if (parsed.aiConfidence !== undefined && parsed.aiConfidence !== null) {
      const asNum = Number(parsed.aiConfidence);
      if (!Number.isFinite(asNum) || asNum < 0 || asNum > 100) {
        throw new Error("Validation error: aiConfidence invalid (must be a number between 0 and 100)");
      }
      out.aiConfidence = Math.round(asNum);
    }

    return out;
  }

  private _runPredictionValidators(
    candidate: { estWaitTimeMins?: any; entryProbability?: any },
  ) {
    if (
      candidate.estWaitTimeMins !== undefined &&
      candidate.estWaitTimeMins !== null
    ) {
      if (typeof candidate.estWaitTimeMins !== "number") {
        throw new Error("Prediction validator: estWaitTimeMins not numeric");
      }
      if (
        !Number.isFinite(candidate.estWaitTimeMins) ||
        candidate.estWaitTimeMins < 0 || candidate.estWaitTimeMins > 24 * 60 // Max 24 hours
      ) throw new Error("Prediction validator: estWaitTimeMins out of range (0-1440)");
    }
    if (
      candidate.entryProbability !== undefined &&
      candidate.entryProbability !== null
    ) {
      if (typeof candidate.entryProbability !== "number") {
        throw new Error("Prediction validator: entryProbability not numeric");
      }
      if (
        !Number.isFinite(candidate.entryProbability) ||
        candidate.entryProbability < 0 || candidate.entryProbability > 100
      ) throw new Error("Prediction validator: entryProbability out of range (0-100)");
    }
  }

  // --- Internal Query methods (for direct state inspection, primarily for testing) ---
  public async _getPredictionInternal(queueID: QueueID): Promise<PredictionResultDoc | undefined> {
    return this.resultsCollection.findOne({ _id: queueID });
  }

  public async _getPredictionConfigInternal(): Promise<PredictionConfigDoc | undefined> {
    return this.configCollection.findOne({ _id: "config" });
  }
}
```
