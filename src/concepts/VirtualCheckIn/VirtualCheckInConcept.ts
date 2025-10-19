import { Collection, Db } from "npm:mongodb";
import { Empty, ID } from "@utils/types.ts";
import { freshID } from "@utils/database.ts";

/**
 * Concept: VirtualCheckIn
 *
 * purpose: Enable users to reserve a place in line remotely for supported events.
 */
const PREFIX = "VirtualCheckIn" + ".";

/**
 * Type parameters for objects external to this concept.
 * These are treated polymorphically and only their IDs are stored.
 */
type Queue = ID;
type User = ID;

/**
 * Status enumeration for a virtual check-in.
 */
enum CheckInStatus {
  Active = "active",
  Used = "used",
  Cancelled = "cancelled",
  Expired = "expired",
}

/**
 * State:
 * a set of VirtualCheckInRecords
 *   _id: ID (corresponds to reservationID)
 *   queueID: ID
 *   userID: ID
 *   checkInTime: Date (when the user checked in)
 *   arrivalWindow: [Date, Date] (the suggested time range for arrival)
 *   status: CheckInStatus (current state of the reservation)
 */
interface VirtualCheckInRecord {
  _id: ID; // Corresponds to reservationID
  queueID: Queue;
  userID: User;
  checkInTime: Date;
  arrivalWindow: [Date, Date];
  status: CheckInStatus;
}

export default class VirtualCheckInConcept {
  // MongoDB collection for storing virtual check-in records.
  private checkIns: Collection<VirtualCheckInRecord>;

  constructor(private readonly db: Db) {
    this.checkIns = this.db.collection(PREFIX + "checkIns");
  }

  /**
   * Action: reserveSpot (userID: User, queueID: Queue): (reservationID: ID) | (error: String)
   *
   * purpose: Allows a user to reserve a virtual spot in a queue.
   *
   * requires:
   * - `userID` and `queueID` must exist (external validation, e.g., by a sync's `where` clause).
   * - The event *must* have enabled virtual check-in (external validation).
   * - The `userID` must not have an existing 'active' reservation for the given `queueID`.
   *
   * effects:
   * - A new `VirtualCheckInRecord` is created.
   * - `_id` is a fresh `reservationID`.
   * - `checkInTime` is set to the current time.
   * - `arrivalWindow` is calculated: For simplicity, it's `[current_time, current_time + 15 minutes]`.
   *   In a more complex system, this would be dynamic based on actual queue status.
   * - `status` is set to 'active'.
   *
   * returns:
   * - On success: `{ reservationID: ID }`
   * - On failure: `{ error: string }` if preconditions are not met.
   *
   * principle: If a user checks into a queue at a desired time, they will receive an arrival window,
   * minimizing physical waiting and coordinating their arrival.
   */
  async reserveSpot(
    { userID, queueID }: { userID: User; queueID: Queue },
  ): Promise<{ reservationID: ID } | { error: string }> {
    // Precondition: User must not have an existing active reservation for this queue.
    const existingCheckIn = await this.checkIns.findOne({
      queueID: queueID,
      userID: userID,
      status: CheckInStatus.Active,
    });

    if (existingCheckIn) {
      return {
        error:
          `User ${userID} already has an active reservation for queue ${queueID}.`,
      };
    }

    const reservationID = freshID();
    const now = new Date();
    // Simplified arrival window assignment based on "current queue status"
    // In a real system, this would involve more sophisticated logic.
    const arrivalWindowStart = new Date(now.getTime());
    const arrivalWindowEnd = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes later

    const newCheckIn: VirtualCheckInRecord = {
      _id: reservationID,
      queueID,
      userID,
      checkInTime: now,
      arrivalWindow: [arrivalWindowStart, arrivalWindowEnd],
      status: CheckInStatus.Active,
    };

    await this.checkIns.insertOne(newCheckIn);

    // According to the spec, this action returns only the ReservationID.
    return { reservationID };
  }

  /**
   * Action: cancelSpot (reservationID: ID): Empty | (error: String)
   *
   * purpose: Allows a user to cancel their existing virtual check-in.
   *
   * requires:
   * - A `reservationID` must exist.
   * - The reservation must have an 'active' status.
   *
   * effects:
   * - The `status` of the specified reservation is updated to 'cancelled'.
   *
   * returns:
   * - On success: `Empty`
   * - On failure: `{ error: string }` if preconditions are not met.
   */
  async cancelSpot(
    { reservationID }: { reservationID: ID },
  ): Promise<Empty | { error: string }> {
    const checkIn = await this.checkIns.findOne({ _id: reservationID });

    if (!checkIn) {
      return { error: `Reservation with ID ${reservationID} not found.` };
    }
    // Precondition: reservation must exist and be active
    if (checkIn.status !== CheckInStatus.Active) {
      return {
        error:
          `Reservation ${reservationID} is not active; current status is ${checkIn.status}.`,
      };
    }

    await this.checkIns.updateOne(
      { _id: reservationID },
      { $set: { status: CheckInStatus.Cancelled } },
    );

    return {};
  }

  /**
   * System Action: expireReservations (): Empty
   *
   * purpose: Automatically marks active reservations as 'expired' if their arrival window has passed.
   * This action is essential for fulfilling the principle's condition about reservation expiry.
   *
   * requires:
   * - The current time is after `arrivalWindow[1]` (the end of the arrival window) for an active reservation.
   *
   * effects:
   * - All 'active' reservations whose `arrivalWindow[1]` is in the past are updated to 'expired'.
   *
   * returns:
   * - Always `Empty`.
   *
   * principle: If they do not arrive within their window, their reservation will expire.
   */
  async expireReservations(): Promise<Empty> {
    const now = new Date();
    await this.checkIns.updateMany(
      {
        status: CheckInStatus.Active,
        "arrivalWindow.1": { $lt: now }, // Check if the end of the arrival window is before now
      },
      { $set: { status: CheckInStatus.Expired } },
    );
    return {};
  }

  /**
   * Query: _getReservationDetails (reservationID: ID): (reservation: VirtualCheckInRecord) | (error: String)
   *
   * purpose: Retrieves the full details of a specific virtual check-in reservation.
   *
   * requires:
   * - A `reservationID` must exist.
   *
   * effects:
   * - Returns the matching `VirtualCheckInRecord`.
   *
   * returns:
   * - On success: `{ reservation: VirtualCheckInRecord }`
   * - On failure: `{ error: string }` if no reservation is found.
   */
  async _getReservationDetails(
    { reservationID }: { reservationID: ID },
  ): Promise<{ reservation?: VirtualCheckInRecord; error?: string }> {
    const reservation = await this.checkIns.findOne({ _id: reservationID });
    if (!reservation) {
      return { error: `Reservation with ID ${reservationID} not found.` };
    }
    return { reservation };
  }

  /**
   * Query: _getUserActiveReservation (userID: User, queueID: Queue): (reservation: VirtualCheckInRecord) | (error: String)
   *
   * purpose: Retrieves the active virtual check-in reservation for a specific user in a given queue.
   * This allows users or staff to quickly see if a user has an active reservation.
   *
   * requires:
   * - A `userID` and `queueID` must exist.
   *
   * effects:
   * - Returns the matching active `VirtualCheckInRecord` if one exists.
   *
   * returns:
   * - On success: `{ reservation: VirtualCheckInRecord }`
   * - On failure: `{ error: string }` if no active reservation is found.
   */
  async _getUserActiveReservation(
    { userID, queueID }: { userID: User; queueID: Queue },
  ): Promise<{ reservation?: VirtualCheckInRecord; error?: string }> {
    const reservation = await this.checkIns.findOne({
      userID: userID,
      queueID: queueID,
      status: CheckInStatus.Active,
    });
    if (!reservation) {
      return {
        error:
          `No active reservation found for user ${userID} in queue ${queueID}.`,
      };
    }
    return { reservation };
  }
}
