/**
 * ConceptSyncs.ts
 *
 * Syncs implemented:
 * 1. reportToPredict - UserReport → Prediction (Keep forecasts current)
 * 2. predictToQueue - Prediction → QueueStatus (Propagate predictions)
 * 3. checkInToQueue - VirtualCheckIn → QueueStatus (Reflect virtual reservations)
 * 4. validatedReportToQueue - UserReport → QueueStatus (Reflect validated crowd data immediately)
 * 5. queueDeleteCascade - QueueStatus → Others (Maintain lifecycle coherence)
 * 6. checkInToPredict - VirtualCheckIn → Prediction (Incorporate reservation data into forecasts)
 * 7. predictToValidate - Prediction → UserReport (Improve validation accuracy)
 */

import { Db } from "mongodb";
import { Empty, ID } from "@utils/types.ts";
import UserReportConcept from "../concepts/UserReport/UserReportConcept.ts";
import PredictionConcept from "../concepts/Prediction/PredictionConcept.ts";
import QueueStatusConcept from "../concepts/QueueStatus/QueueStatusConcept.ts";
import VirtualCheckInConcept from "../concepts/VirtualCheckIn/VirtualCheckInConcept.ts";

type QueueID = ID;
type ReportID = ID;
type UserID = ID;
type ReservationID = ID;

export class ConceptSyncs {
  private userReport: UserReportConcept;
  private prediction: PredictionConcept;
  private queueStatus: QueueStatusConcept;
  private virtualCheckIn: VirtualCheckInConcept;

  constructor(db: Db) {
    this.userReport = new UserReportConcept(db);
    this.prediction = new PredictionConcept(db);
    this.queueStatus = new QueueStatusConcept(db);
    this.virtualCheckIn = new VirtualCheckInConcept(db);
  }

  /**
   * Sync 1: reportToPredict
   * UserReport → Prediction (Keep forecasts current)
   *
   * When a user report is submitted and validated, trigger a new prediction
   * to keep forecasts current with real-time data.
   */
  async reportToPredict(params: {
    queueID: QueueID;
    reportID: ReportID;
  }): Promise<Empty | { error: string }> {
    try {
      // Get the report to verify it exists and is validated
      const report = await this.userReport._getReport({
        report: params.reportID,
      });
      if (!report) {
        return { error: `Report ${params.reportID} not found` };
      }

      if (!report.validated) {
        return { error: `Report ${params.reportID} is not yet validated` };
      }

      // Trigger a new prediction run for the queue
      const predictionResult = await this.prediction.runPrediction({
        queueID: params.queueID,
        modelID: "default", // Using default model ID
      });

      if ("error" in predictionResult) {
        return {
          error: `Failed to update prediction: ${predictionResult.error}`,
        };
      }

      console.log(
        `[Sync] Updated prediction for queue ${params.queueID} based on validated report ${params.reportID}`,
      );
      return {};
    } catch (error: unknown) {
      return {
        error: `reportToPredict sync failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }

  /**
   * Sync 2: predictToQueue
   * Prediction → QueueStatus (Propagate predictions)
   *
   * When a prediction is generated, update the QueueStatus with the new estimates.
   */
  async predictToQueue(params: {
    queueID: QueueID;
  }): Promise<Empty | { error: string }> {
    try {
      // Get the latest prediction for the queue
      const forecast = await this.prediction.getForecast({
        queueID: params.queueID,
      });
      if ("error" in forecast) {
        return { error: `Failed to get forecast: ${forecast.error}` };
      }

      // Update the queue status with prediction data
      const updateResult = await this.queueStatus.updateStatus({
        queueID: params.queueID,
        estWaitTime: Math.round(forecast.estWaitTime), // Round to nearest minute
        estPplInLine: Math.round(forecast.entryProbability * 100), // Convert probability to estimated people (simplified)
      });

      if ("error" in updateResult) {
        return {
          error: `Failed to update queue status: ${updateResult.error}`,
        };
      }

      console.log(
        `[Sync] Updated queue status for ${params.queueID} with prediction data`,
      );
      return {};
    } catch (error: unknown) {
      return {
        error: `predictToQueue sync failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }

  /**
   * Sync 3: checkInToQueue
   * VirtualCheckIn → QueueStatus (Reflect virtual reservations)
   *
   * When users make virtual check-ins, adjust queue estimates to account for
   * reserved spots and expected arrivals.
   */
  async checkInToQueue(params: {
    queueID: QueueID;
    reservationID: ReservationID;
    operation: "reserve" | "cancel" | "expire";
  }): Promise<Empty | { error: string }> {
    try {
      // Get current queue status
      const currentStatus = await this.queueStatus._viewStatus({
        queueID: params.queueID,
      });
      if ("error" in currentStatus) {
        return {
          error: `Failed to get current queue status: ${currentStatus.error}`,
        };
      }

      // Get reservation details
      const reservationResult = await this.virtualCheckIn
        ._getReservationDetails({
          reservationID: params.reservationID,
        });
      if ("error" in reservationResult) {
        return {
          error:
            `Failed to get reservation details: ${reservationResult.error}`,
        };
      }

      let adjustment = 0;
      switch (params.operation) {
        case "reserve":
          adjustment = 1; // Add one person to the virtual queue
          break;
        case "cancel":
        case "expire":
          adjustment = -1; // Remove one person from the virtual queue
          break;
      }

      // Update queue with adjusted estimates
      const newEstPplInLine = Math.max(
        0,
        (currentStatus.estPplInLine || 0) + adjustment,
      );
      const newEstWaitTime = Math.max(
        0,
        (currentStatus.estWaitTime || 0) + (adjustment * 5),
      ); // Assume 5 min per person

      const updateResult = await this.queueStatus.updateStatus({
        queueID: params.queueID,
        estPplInLine: newEstPplInLine,
        estWaitTime: newEstWaitTime,
      });

      if ("error" in updateResult) {
        return {
          error: `Failed to update queue status: ${updateResult.error}`,
        };
      }

      console.log(
        `[Sync] Updated queue ${params.queueID} for virtual check-in ${params.operation}: ${params.reservationID}`,
      );
      return {};
    } catch (error: unknown) {
      return {
        error: `checkInToQueue sync failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }

  /**
   * Sync 4: validatedReportToQueue
   * UserReport → QueueStatus (Reflect validated crowd data immediately)
   *
   * When a user report is validated, immediately update queue status with the reported data.
   */
  async validatedReportToQueue(params: {
    reportID: ReportID;
  }): Promise<Empty | { error: string }> {
    try {
      // Get the validated report
      const report = await this.userReport._getReport({
        report: params.reportID,
      });
      if (!report) {
        return { error: `Report ${params.reportID} not found` };
      }

      if (!report.validated) {
        return { error: `Report ${params.reportID} is not validated` };
      }

      // Update queue status with report data if available
      if (
        report.estimatedPeopleInLine !== undefined ||
        report.currentWaitTime !== undefined
      ) {
        const updateResult = await this.queueStatus.updateStatus({
          queueID: report.queue,
          estPplInLine: report.estimatedPeopleInLine || 0,
          estWaitTime: report.currentWaitTime || 0,
        });

        if ("error" in updateResult) {
          return {
            error: `Failed to update queue status: ${updateResult.error}`,
          };
        }

        console.log(
          `[Sync] Updated queue ${report.queue} with validated report data from ${params.reportID}`,
        );
      }

      return {};
    } catch (error: unknown) {
      return {
        error: `validatedReportToQueue sync failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }

  /**
   * Sync 5: queueDeleteCascade
   * QueueStatus → Others (Maintain lifecycle coherence)
   *
   * When a queue is deleted, clean up related data in other concepts.
   * Note: This assumes a deleteQueue method exists in QueueStatusConcept.
   */
  async queueDeleteCascade(params: {
    queueID: QueueID;
  }): Promise<Empty | { error: string }> {
    try {
      // This sync would be triggered when a queue is deleted
      // Clean up related data in other concepts

      console.log(`[Sync] Starting cascade delete for queue ${params.queueID}`);

      // Note: Since the concepts don't have explicit delete methods for related data,
      // this is a placeholder implementation. In a full system, you would:
      // 1. Delete all reports for this queue
      // 2. Delete prediction data for this queue
      // 3. Cancel/expire all virtual check-ins for this queue

      // For now, we'll just expire virtual check-ins
      await this.virtualCheckIn.expireReservations();

      console.log(
        `[Sync] Completed cascade delete for queue ${params.queueID}`,
      );
      return {};
    } catch (error: unknown) {
      return {
        error: `queueDeleteCascade sync failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }

  /**
   * Sync 6: checkInToPredict
   * VirtualCheckIn → Prediction (Incorporate reservation data into forecasts)
   *
   * When virtual check-ins are made, update predictions to account for
   * the expected arrival patterns and reserved capacity.
   */
  async checkInToPredict(params: {
    queueID: QueueID;
    reservationID: ReservationID;
  }): Promise<Empty | { error: string }> {
    try {
      // Get reservation details to understand the timing
      const reservationResult = await this.virtualCheckIn
        ._getReservationDetails({
          reservationID: params.reservationID,
        });
      if ("error" in reservationResult) {
        return {
          error:
            `Failed to get reservation details: ${reservationResult.error}`,
        };
      }

      // Trigger a new prediction that incorporates the virtual check-in data
      const predictionResult = await this.prediction.runPrediction({
        queueID: params.queueID,
        modelID: "default",
      });

      if ("error" in predictionResult) {
        return {
          error: `Failed to update prediction: ${predictionResult.error}`,
        };
      }

      console.log(
        `[Sync] Updated prediction for queue ${params.queueID} incorporating reservation ${params.reservationID}`,
      );
      return {};
    } catch (error: unknown) {
      return {
        error: `checkInToPredict sync failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }

  /**
   * Sync 7: predictToValidate
   * Prediction → UserReport (Improve validation accuracy)
   *
   * When predictions are generated, use them to help validate incoming user reports
   * by comparing report data against predicted values.
   */
  async predictToValidate(params: {
    queueID: QueueID;
    reportID: ReportID;
  }): Promise<Empty | { error: string }> {
    try {
      // Get the report to validate
      const report = await this.userReport._getReport({
        report: params.reportID,
      });
      if (!report) {
        return { error: `Report ${params.reportID} not found` };
      }

      // Get current prediction for comparison
      const forecast = await this.prediction.getForecast({
        queueID: params.queueID,
      });
      if ("error" in forecast) {
        // If no prediction exists, we can't validate, but this isn't necessarily an error
        console.log(
          `[Sync] No prediction available for validation of report ${params.reportID}`,
        );
        return {};
      }

      // Simple validation logic: if report data is within reasonable bounds of prediction, validate it
      let shouldValidate = true;

      if (report.currentWaitTime !== undefined) {
        const waitTimeDiff = Math.abs(
          report.currentWaitTime - forecast.estWaitTime,
        );
        // If reported wait time differs by more than 50% of predicted time, don't auto-validate
        if (waitTimeDiff > forecast.estWaitTime * 0.5) {
          shouldValidate = false;
        }
      }

      if (report.estimatedPeopleInLine !== undefined) {
        // Simple heuristic: if entry probability is low, people in line should be high
        const expectedPeople = Math.round((1 - forecast.entryProbability) * 20); // Simplified calculation
        const peopleDiff = Math.abs(
          report.estimatedPeopleInLine - expectedPeople,
        );
        if (peopleDiff > 10) { // More than 10 people difference
          shouldValidate = false;
        }
      }

      // Update validation status
      const validationResult = await this.userReport.setReportValidationStatus({
        report: params.reportID,
        isValid: shouldValidate,
      });

      if ("error" in validationResult) {
        return {
          error: `Failed to set validation status: ${validationResult.error}`,
        };
      }

      console.log(
        `[Sync] ${
          shouldValidate ? "Validated" : "Rejected"
        } report ${params.reportID} based on prediction for queue ${params.queueID}`,
      );
      return {};
    } catch (error: unknown) {
      return {
        error: `predictToValidate sync failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }

  /**
   * Convenience method to trigger all relevant syncs when a new report is submitted
   */
  async onReportSubmitted(params: {
    reportID: ReportID;
    queueID: QueueID;
  }): Promise<Empty | { error: string }> {
    try {
      // First validate the report using predictions
      await this.predictToValidate({
        queueID: params.queueID,
        reportID: params.reportID,
      });

      // If the report gets validated, update queue status and predictions
      const report = await this.userReport._getReport({
        report: params.reportID,
      });
      if (report?.validated) {
        await this.validatedReportToQueue({ reportID: params.reportID });
        await this.reportToPredict({
          queueID: params.queueID,
          reportID: params.reportID,
        });
      }

      return {};
    } catch (error: unknown) {
      return {
        error: `onReportSubmitted sync failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }

  /**
   * Convenience method to trigger all relevant syncs when a virtual check-in is made
   */
  async onVirtualCheckInReserved(params: {
    reservationID: ReservationID;
    queueID: QueueID;
  }): Promise<Empty | { error: string }> {
    try {
      // Update queue status to reflect the reservation
      await this.checkInToQueue({
        queueID: params.queueID,
        reservationID: params.reservationID,
        operation: "reserve",
      });

      // Update predictions to incorporate reservation data
      await this.checkInToPredict({
        queueID: params.queueID,
        reservationID: params.reservationID,
      });

      // Propagate updated predictions back to queue status
      await this.predictToQueue({ queueID: params.queueID });

      return {};
    } catch (error: unknown) {
      return {
        error: `onVirtualCheckInReserved sync failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }

  /**
   * Convenience method to trigger syncs when a prediction is updated
   */
  async onPredictionUpdated(params: {
    queueID: QueueID;
  }): Promise<Empty | { error: string }> {
    try {
      // Propagate prediction to queue status
      await this.predictToQueue({ queueID: params.queueID });

      return {};
    } catch (error: unknown) {
      return {
        error: `onPredictionUpdated sync failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }
}

export default ConceptSyncs;
