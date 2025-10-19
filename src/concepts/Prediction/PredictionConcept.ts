// file: src/Prediction/PredictionConcept.ts

import { Collection, Db } from "npm:mongodb";
import { Empty, ID } from "../../utils/types.ts"; // Path to utils/types.ts
import { freshID } from "../../utils/database.ts"; // Path to utils/database.ts
import {
  AIModelConfig,
  AIPredictionEngine,
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
type User = ID; // Represents a user submitting reports or interested in predictions
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
    this.aiEngine = aiEngineConfig
      ? new AIPredictionEngine(aiEngineConfig)
      : defaultAIPredictionEngine;

    // Ensure _id (which is queueID) is indexed for efficient lookups.
    // This is implicit with _id, but an explicit index can be added if needed for other fields.
    this.forecasts.createIndex({ queueID: 1 }, { unique: true }).catch(
      console.error,
    );
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
  async runPrediction(
    { queueID, modelID }: { queueID: QueueID; modelID: string },
  ): Promise<StoredPredictionResult | { error: string }> {
    // Validate `modelID` against the concept's configured AI engine.
    // In a system with multiple AI engines, this could select the correct engine.
    if (modelID !== this.aiEngine.config.modelID) {
      console.warn(
        `[PredictionConcept] Mismatch: runPrediction called with modelID '${modelID}' but concept configured with '${this.aiEngine.config.modelID}'. Proceeding with configured model.`,
      );
      // Optionally, return an error:
      // return { error: `Invalid modelID '${modelID}'. This concept instance is configured to use model '${this.aiEngine.config.modelID}'.` };
    }

    console.log(
      `[PredictionConcept] Attempting to run prediction for queue: ${queueID}`,
    );

    // Prepare input for the AI engine. In a real system, this step would
    // involve collecting `UserReport` and `QueueStatus` data.
    const predictionInput: PredictionInput = { queueID };

    let rawPrediction: PredictionOutput | null;
    try {
      // Delegate the actual AI processing to the injected AI engine
      rawPrediction = await this.aiEngine.runPrediction(predictionInput);
    } catch (e: any) {
      console.error(
        `[PredictionConcept] Error from AI engine for queue ${queueID}:`,
        e,
      );
      return {
        error:
          `Failed to generate prediction due to internal AI engine error: ${e.message}`,
      };
    }

    // Handle the case where the AI engine indicates insufficient information
    if (!rawPrediction) {
      console.log(
        `[PredictionConcept] Insufficient information for prediction for queue: ${queueID}. No forecast stored.`,
      );
      return {
        error:
          `Insufficient information to generate a prediction for queue '${queueID}'.`,
      };
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
        { upsert: true }, // Create the document if it doesn't exist
      );
      console.log(
        `[PredictionConcept] Stored/updated prediction for queue: ${queueID}`,
      );
      return newPrediction.predictionResult; // Return the specific prediction result data
    } catch (e: any) {
      console.error(
        `[PredictionConcept] Failed to store prediction for queue ${queueID}:`,
        e,
      );
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
  async getForecast(
    { queueID }: { queueID: QueueID },
  ): Promise<(StoredPredictionResult & { lastRun: Date }) | { error: string }> {
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
      console.error(
        `[PredictionConcept] Failed to retrieve forecast for queue ${queueID}:`,
        e,
      );
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
      console.log(
        `[PredictionConcept] Deleted ${result.deletedCount} old predictions.`,
      );
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
