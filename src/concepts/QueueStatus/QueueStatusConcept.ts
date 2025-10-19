// file: src/QueueStatus/QueueStatusConcept.ts
import { Collection, Db } from "npm:mongodb";
import { Empty, ID } from "@utils/types.ts";
// No need for freshID here, as queueID is provided and used directly as the MongoDB _id.

// Declare collection prefix, using the concept name as per rubric
const PREFIX = "QueueStatus" + ".";

// Generic ID type for queues, as specified in the concept.
type QueueID = ID;

/**
 * Type definition for a geographical coordinate, used for location.
 * This adheres to JSON-serializable types as required for action arguments.
 */
type GeoCoordinate = { latitude: number; longitude: number };

/**
 * Interface representing the structure of a queue document in the MongoDB collection.
 * This directly maps to the 'state' declaration in the concept specification.
 *
 * @state
 * A set of queues with
 *  queueID: String
 *  location: GeoCoordinate | String
 *  estWaitTime: Number | Null
 *  estPplInLine: Number | Null
 *  virtualCheckInEligible: Boolean
 *  lastUpdated: DateTime
 */
interface QueueDoc {
  _id: QueueID; // Maps to queueID, used as the primary identifier in MongoDB
  location: GeoCoordinate | string;
  estWaitTime: number | null;
  estPplInLine: number | null;
  virtualCheckInEligible: boolean;
  lastUpdated: Date; // Using Date object for DateTime
}

export default class QueueStatusConcept {
  queues: Collection<QueueDoc>;

  /**
   * @concept QueueStatus
   * @purpose Represent the current state of a line at a given event.
   * @purpose Aggregate real-time information (crowdsourced and predictive) into a single source of truth about the queue.
   * @principle After creating a queue, its status can be updated with estimated wait times and people in line,
   *            and this information can then be viewed by users. This provides a dynamic, single source of truth
   *            for queue statuses at events.
   */
  constructor(private readonly db: Db) {
    this.queues = this.db.collection(PREFIX + "queues");
  }

  /**
   * @action createQueue
   * Creates a new queue with the given ID and location.
   *
   * @param {object} args - The input arguments for the action.
   * @param {QueueID} args.queueID - The unique identifier for the queue.
   * @param {GeoCoordinate | string} args.location - The geographical coordinates or a descriptive string for the queue's location.
   * @param {number | null} [args.estWaitTime=null] - Optional initial estimated wait time in minutes.
   * @param {number | null} [args.estPplInLine=null] - Optional initial estimated number of people in line.
   * @param {boolean} [args.virtualCheckInEligible=false] - Whether virtual check-in is enabled for this queue by the organizer.
   * @returns {Promise<Empty | { error: string }>} - An empty object on success, or an object with an error message on failure.
   *
   * @requires queueID must not already exist in the system.
   * @effects A new queue document is created in the database with the provided ID and location.
   *          `estWaitTime` and `estPplInLine` are initialized to `null` or provided values.
   *          `virtualCheckInEligible` is set based on the input, defaulting to `false`.
   *          `lastUpdated` is set to the current timestamp.
   */
  async createQueue(
    {
      queueID,
      location,
      estWaitTime = null,
      estPplInLine = null,
      virtualCheckInEligible = false,
    }: {
      queueID: QueueID;
      location: GeoCoordinate | string;
      estWaitTime?: number | null;
      estPplInLine?: number | null;
      virtualCheckInEligible?: boolean;
    },
  ): Promise<Empty | { error: string }> {
    // Precondition check: queueID must not already exist in the system.
    const existingQueue = await this.queues.findOne({ _id: queueID });
    if (existingQueue) {
      return { error: `Queue with ID '${queueID}' already exists.` };
    }

    // Effect: Create a new queue document.
    const newQueue: QueueDoc = {
      _id: queueID,
      location,
      estWaitTime,
      estPplInLine,
      virtualCheckInEligible,
      lastUpdated: new Date(),
    };

    try {
      await this.queues.insertOne(newQueue);
      return {}; // Success
    } catch (e) {
      console.error(`Error creating queue ${queueID}:`, e);
      return { error: "Failed to create queue due to an unexpected error." };
    }
  }

  /**
   * @action updateStatus
   * Updates the estimated number of people in line and estimated wait time for a given queue.
   *
   * @param {object} args - The input arguments for the action.
   * @param {QueueID} args.queueID - The ID of the queue to update.
   * @param {number} args.estPplInLine - The updated estimated number of people in line.
   * @param {number} args.estWaitTime - The updated estimated wait time in minutes.
   * @returns {Promise<Empty | { error: string }>} - An empty object on success, or an object with an error message on failure.
   *
   * @requires queueID must exist in the system.
   * @effects The `estPplInLine`, `estWaitTime`, and `lastUpdated` fields for the specified queue are updated.
   *          (The "generates a best-effort..." part implies complex internal logic,
   *          but for this implementation, we directly apply the provided values.)
   */
  async updateStatus(
    { queueID, estPplInLine, estWaitTime }: {
      queueID: QueueID;
      estPplInLine: number;
      estWaitTime: number;
    },
  ): Promise<Empty | { error: string }> {
    // Precondition check: queueID must exist.
    const updateResult = await this.queues.updateOne(
      { _id: queueID },
      {
        $set: {
          estPplInLine,
          estWaitTime,
          lastUpdated: new Date(),
        },
      },
    );

    if (updateResult.matchedCount === 0) {
      return { error: `Queue with ID '${queueID}' not found.` };
    }

    return {}; // Success
  }

  /**
   * @query _viewStatus
   * Retrieves the current status information for a specified queue.
   *
   * @param {object} args - The input arguments for the query.
   * @param {QueueID} args.queueID - The ID of the queue to view.
   * @returns {Promise<{ estPplInLine: number | null; estWaitTime: number | null; lastUpdated: Date; } | { error: string }>}
   *          An object containing `estPplInLine`, `estWaitTime`, and `lastUpdated` on success,
   *          or an object with an error message if the queue is not found.
   *
   * @requires queueID must exist.
   * @effects Outputs the current `estPplInLine`, `estWaitTime`, and `lastUpdated` time for the queue.
   *          These values may be `null` if insufficient information has been provided.
   */
  async _viewStatus(
    { queueID }: { queueID: QueueID },
  ): Promise<
    {
      estPplInLine: number | null;
      estWaitTime: number | null;
      lastUpdated: Date;
    } | { error: string }
  > {
    // Precondition check: queueID must exist.
    const queue = await this.queues.findOne({ _id: queueID });

    if (!queue) {
      return { error: `Queue with ID '${queueID}' not found.` };
    }

    // Effect: Output the current information.
    return {
      estPplInLine: queue.estPplInLine,
      estWaitTime: queue.estWaitTime,
      lastUpdated: queue.lastUpdated,
    };
  }
}
