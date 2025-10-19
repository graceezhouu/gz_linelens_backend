---
timestamp: 'Sat Oct 18 2025 11:40:32 GMT-0400 (Eastern Daylight Time)'
parent: '[[../20251018_114032.86e3b806.md]]'
content_id: 41ecb3df4a1b5edf636d722f6155ffb7cf71dad28844c75221ea239ae8d330c4
---

# file: src/prediction/PredictionConcept.ts

```typescript
import { Collection, Db } from "npm:mongodb";
import { Empty, ID } from "../utils/types.ts"; // Assuming @utils maps to ../utils
import { freshID } from "../utils/database.ts"; // Assuming @utils maps to ../utils

// Declare collection prefix, use concept name
const PREFIX = "Prediction" + ".";

// Generic types of this concept
type Location = ID;
type User = ID;

// Constants for prediction logic
const REPORT_EXPIRATION_MS = 2 * 60 * 60 * 1000; // 2 hours
const LIVE_REPORT_WINDOW_MS = 30 * 60 * 1000; // 30 minutes
const HISTORICAL_WEIGHT = 0.3;
const LIVE_WEIGHT = 0.7;
const DEFAULT_WAIT_TIME = 10; // minutes
const DEFAULT_ENTRY_LIKELIHOOD = 0.8; // 80%

// Mapping for crowd levels to estimated wait times (minutes)
const CROWD_LEVEL_TO_WAIT: { [key: string]: number } = {
  "Empty": 5,
  "Moderate": 15,
  "Busy": 30,
  "Packed": 60,
};

// Mapping for crowd levels to estimated entry likelihood (0.0 - 1.0)
const CROWD_LEVEL_TO_LIKELIHOOD: { [key: string]: number } = {
  "Empty": 0.95,
  "Moderate": 0.85,
  "Busy": 0.6,
  "Packed": 0.3,
};


/**
 * Stores baseline historical data for wait times and entry likelihoods
 * for specific time slots.
 */
interface HistoricalRecord {
  _id: ID; // Composite ID: `${location}-${dayOfWeek}-${hourOfDay}`
  location: Location;
  dayOfWeek: number; // 0-6 for Sunday-Saturday
  hourOfDay: number; // 0-23
  avgWaitTime: number; // in minutes
  entryLikelihood: number; // 0.0 - 1.0
}

/**
 * Stores live user-submitted reports about current conditions at locations.
 */
export interface UserReport {
  _id: ID;
  user: User;
  location: Location;
  reportedWaitTime?: number; // optional, in minutes
  reportedCrowdLevel?: string; // optional, e.g., "Empty", "Moderate", "Busy", "Packed"
  timestamp: number; // Unix timestamp in ms
}

/**
 * Stores the calculated, current predictions for each location.
 */
export interface CurrentPrediction {
  _id: Location; // Location ID serves as the primary key
  predictedWaitTime: number; // in minutes
  predictedEntryLikelihood: number; // 0.0 - 1.0
  lastUpdated: number; // Unix timestamp in ms
}

/**
 * Prediction Concept:
 * Purpose: provide users with estimated wait times and entry likelihoods for specific locations,
 * leveraging both historical trends and real-time user-contributed data.
 */
export default class PredictionConcept {
  historicalRecords: Collection<HistoricalRecord>;
  userReports: Collection<UserReport>;
  currentPredictions: Collection<CurrentPrediction>;

  constructor(private readonly db: Db) {
    this.historicalRecords = this.db.collection(PREFIX + "historicalRecords");
    this.userReports = this.db.collection(PREFIX + "userReports");
    this.currentPredictions = this.db.collection(PREFIX + "currentPredictions");
  }

  /**
   * Action: Allows a user to submit their current experience at a location.
   *
   * requires: reportedWaitTime is present OR reportedCrowdLevel is present
   * effects:
   *   create a new UserReport associating user, location, provided data, and current timestamp
   *   trigger updatePrediction for this location
   */
  async submitReport(
    { user, location, reportedWaitTime, reportedCrowdLevel }: {
      user: User;
      location: Location;
      reportedWaitTime?: number;
      reportedCrowdLevel?: string;
    },
  ): Promise<Empty | { error: string }> {
    if (reportedWaitTime === undefined && reportedCrowdLevel === undefined) {
      return {
        error: "Either reportedWaitTime or reportedCrowdLevel must be provided.",
      };
    }

    const report: UserReport = {
      _id: freshID(),
      user,
      location,
      timestamp: Date.now(),
    };
    if (reportedWaitTime !== undefined) report.reportedWaitTime = reportedWaitTime;
    if (reportedCrowdLevel !== undefined) report.reportedCrowdLevel = reportedCrowdLevel;

    await this.userReports.insertOne(report);
    await this.updatePrediction({ location }); // Trigger prediction update
    return {};
  }

  /**
   * Action: Adds or updates a piece of historical data. This is typically for admin/setup.
   *
   * requires: dayOfWeek is between 0 and 6 (inclusive), hourOfDay is between 0 and 23 (inclusive),
   *           avgWaitTime >= 0, entryLikelihood >= 0 and <= 1
   * effects:
   *   if a HistoricalRecord for location, dayOfWeek, hourOfDay exists, update its avgWaitTime and entryLikelihood
   *   else create a new HistoricalRecord
   */
  async seedHistoricalData(
    { location, dayOfWeek, hourOfDay, avgWaitTime, entryLikelihood }: {
      location: Location;
      dayOfWeek: number;
      hourOfDay: number;
      avgWaitTime: number;
      entryLikelihood: number;
    },
  ): Promise<Empty | { error: string }> {
    if (
      dayOfWeek < 0 || dayOfWeek > 6 || hourOfDay < 0 || hourOfDay > 23 ||
      avgWaitTime < 0 || entryLikelihood < 0 || entryLikelihood > 1
    ) {
      return { error: "Invalid input values for historical data." };
    }

    const historicalId = `${location}-${dayOfWeek}-${hourOfDay}` as ID;
    const existing = await this.historicalRecords.findOne({ _id: historicalId });

    if (existing) {
      await this.historicalRecords.updateOne(
        { _id: historicalId },
        { $set: { avgWaitTime, entryLikelihood } },
      );
    } else {
      await this.historicalRecords.insertOne({
        _id: historicalId,
        location,
        dayOfWeek,
        hourOfDay,
        avgWaitTime,
        entryLikelihood,
      });
    }
    return {};
  }

  /**
   * System Action: Recalculates and updates predictions for a specific location
   * based on historical and live data.
   *
   * requires: true
   * effects:
   *   retrieve relevant historical data for the location and current time slot
   *   retrieve recent (e.g., last 30 minutes) user reports for the location
   *   calculate new predictedWaitTime and predictedEntryLikelihood by combining historical data and live reports
   *   update or create the CurrentPrediction for the location with the new values and current timestamp
   */
  async updatePrediction({ location }: { location: Location }): Promise<Empty> {
    const now = Date.now();
    const date = new Date(now);
    const dayOfWeek = date.getDay(); // 0 (Sunday) to 6 (Saturday)
    const hourOfDay = date.getHours(); // 0 to 23

    // 1. Get historical data
    const historicalId = `${location}-${dayOfWeek}-${hourOfDay}` as ID;
    const historicalData = await this.historicalRecords.findOne({
      _id: historicalId,
    });
    const historicalWait = historicalData?.avgWaitTime ?? DEFAULT_WAIT_TIME;
    const historicalLikelihood = historicalData?.entryLikelihood ??
      DEFAULT_ENTRY_LIKELIHOOD;

    // 2. Get recent user reports
    const recentReports = await this.userReports.find({
      location,
      timestamp: { $gt: now - LIVE_REPORT_WINDOW_MS },
    }).toArray();

    let liveWaitTimes: number[] = [];
    let liveLikelihoods: number[] = [];

    for (const report of recentReports) {
      if (report.reportedWaitTime !== undefined) {
        liveWaitTimes.push(report.reportedWaitTime);
        // Derive likelihood from wait time: shorter wait implies higher likelihood
        liveLikelihoods.push(Math.max(0, 1 - report.reportedWaitTime / 60)); // Max 60 min wait -> 0 likelihood
      }
      if (report.reportedCrowdLevel !== undefined) {
        if (CROWD_LEVEL_TO_WAIT[report.reportedCrowdLevel] !== undefined) {
          liveWaitTimes.push(CROWD_LEVEL_TO_WAIT[report.reportedCrowdLevel]);
        }
        if (
          CROWD_LEVEL_TO_LIKELIHOOD[report.reportedCrowdLevel] !== undefined
        ) {
          liveLikelihoods.push(
            CROWD_LEVEL_TO_LIKELIHOOD[report.reportedCrowdLevel],
          );
        }
      }
    }

    let predictedWaitTime = historicalWait;
    if (liveWaitTimes.length > 0) {
      const avgLiveWait = liveWaitTimes.reduce((a, b) => a + b, 0) /
        liveWaitTimes.length;
      predictedWaitTime = (HISTORICAL_WEIGHT * historicalWait) +
        (LIVE_WEIGHT * avgLiveWait);
    }

    let predictedEntryLikelihood = historicalLikelihood;
    if (liveLikelihoods.length > 0) {
      const avgLiveLikelihood = liveLikelihoods.reduce((a, b) => a + b, 0) /
        liveLikelihoods.length;
      predictedEntryLikelihood = (HISTORICAL_WEIGHT * historicalLikelihood) +
        (LIVE_WEIGHT * avgLiveLikelihood);
    }

    // Ensure likelihood is within bounds
    predictedEntryLikelihood = Math.min(1.0, Math.max(0.0, predictedEntryLikelihood));
    predictedWaitTime = Math.max(0, predictedWaitTime); // Wait time cannot be negative

    // 3. Update or create CurrentPrediction
    await this.currentPredictions.updateOne(
      { _id: location },
      {
        $set: {
          predictedWaitTime: predictedWaitTime,
          predictedEntryLikelihood: predictedEntryLikelihood,
          lastUpdated: now,
        },
      },
      { upsert: true }, // Create if not exists
    );

    return {};
  }

  /**
   * System Action: Cleans up old user reports to maintain data relevance.
   *
   * requires: true
   * effects: delete UserReports older than a certain threshold (e.g., 2 hours)
   */
  async cleanOldReports(): Promise<Empty> {
    const now = Date.now();
    await this.userReports.deleteMany({
      timestamp: { $lt: now - REPORT_EXPIRATION_MS },
    });
    return {};
  }

  /**
   * Query: Retrieves the current prediction for a given location.
   *
   * effects: return the predictedWaitTime and predictedEntryLikelihood
   *          from CurrentPredictions for the given location, or reasonable defaults if no prediction exists.
   */
  async _getPrediction(
    { location }: { location: Location },
  ): Promise<{ predictedWaitTime: number; predictedEntryLikelihood: number }> {
    const prediction = await this.currentPredictions.findOne({ _id: location });
    return {
      predictedWaitTime: prediction?.predictedWaitTime ?? DEFAULT_WAIT_TIME,
      predictedEntryLikelihood: prediction?.predictedEntryLikelihood ??
        DEFAULT_ENTRY_LIKELIHOOD,
    };
  }

  /**
   * Query: Retrieves raw user reports for a given location (for debugging or admin purposes).
   *
   * effects: return an array of recent UserReports for the specified location.
   */
  async _getRawReports(
    { location }: { location: Location },
  ): Promise<{ reports: UserReport[] }> {
    const now = Date.now();
    const reports = await this.userReports.find({
      location,
      timestamp: { $gt: now - REPORT_EXPIRATION_MS }, // Only show recent reports
    }).sort({ timestamp: -1 }).toArray(); // Sort by most recent first
    return { reports };
  }
}
```
