---
timestamp: 'Sun Oct 19 2025 10:20:12 GMT-0400 (Eastern Daylight Time)'
parent: '[[../20251019_102012.363da294.md]]'
content_id: dbaa523bea2d4a7c3604f75e5853f92f3a1cc615c963e69542f4a0685c6c273d
---

# file: src/VirtualCheckIn/VirtualCheckInConcept.ts

```typescript
// Mock utility types and functions for standalone example
// In a real project, these would be imported from @utils/types.ts and @utils/database.ts

export type ID = string & { readonly __brand: unique symbol };
export type Empty = Record<PropertyKey, never>;

export function freshID(): ID {
  return `id:${Date.now()}-${Math.random().toString(36).substring(2, 9)}` as ID;
}

// Minimal MongoDB types for the example
// In a real project, these would be from 'npm:mongodb'
export interface Collection<T extends { _id: ID }> {
  // Mock methods for demonstration
  findOne(filter: Partial<T>): Promise<T | null>;
  insertOne(doc: Omit<T, '_id'> & { _id?: ID }): Promise<any>;
  updateOne(
    filter: Partial<T>,
    update: any, // Use any for simplicity in mock
    options?: { upsert?: boolean }
  ): Promise<any>;
  updateMany(
    filter: Partial<T>,
    update: any, // Use any for simplicity in mock
  ): Promise<any>;
  deleteMany(filter: Partial<T>): Promise<any>;
  find(filter: Partial<T>): { toArray(): Promise<T[]> };
}

export interface Db {
  collection<T extends { _id: ID }>(name: string): Collection<T>;
}

// End of mock utilities

// Standard imports from the actual project would be:
// import { Collection, Db } from "npm:mongodb";
// import { Empty, ID } from "@utils/types.ts";
// import { freshID } from "@utils/database.ts";


/**
 * Declare collection prefix, use concept name
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
  Active = 'active',
  Used = 'used',
  Cancelled = 'cancelled',
  Expired = 'expired',
}

/**
 * State:
 * a set of VirtualCheckInRecords
 *   reservationID: ID
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
   * Action: checkIn (queueID: Queue, userID: User, desiredArrivalTime?: Date): (reservationID: ID, arrivalWindow: [Date, Date]) | (error: String)
   *
   * purpose: Allows a user to reserve a virtual spot in a queue.
   *
   * requires:
   * - A valid `queueID` and `userID` must be provided.
   * - The `userID` must not have an existing 'active' reservation for the given `queueID`.
   *
   * effects:
   * - A new `VirtualCheckInRecord` is created.
   * - `_id` is a fresh `reservationID`.
   * - `checkInTime` is set to the current time.
   * - `arrivalWindow` is calculated: if `desiredArrivalTime` is provided, it's used as the center; otherwise, current time is used.
   *   For simplicity, `arrivalWindow` will be `[centerTime, centerTime + 15 minutes]`.
   * - `status` is set to 'active'.
   *
   * returns:
   * - On success: `{ reservationID: ID, arrivalWindow: [Date, Date] }`
   * - On failure: `{ error: string }` if preconditions are not met.
   */
  async checkIn(
    { queueID, userID, desiredArrivalTime }: { queueID: Queue; userID: User; desiredArrivalTime?: Date },
  ): Promise<{ reservationID: ID; arrivalWindow: [Date, Date] } | { error: string }> {
    // Check if user already has an active reservation for this queue
    const existingCheckIn = await this.checkIns.findOne({
      queueID: queueID,
      userID: userID,
      status: CheckInStatus.Active,
    });

    if (existingCheckIn) {
      return { error: `User ${userID} already has an active reservation for queue ${queueID}.` };
    }

    const reservationID = freshID();
    const now = new Date();
    const arrivalWindowCenter = desiredArrivalTime || now;
    const arrivalWindowStart = new Date(arrivalWindowCenter.getTime());
    const arrivalWindowEnd = new Date(arrivalWindowCenter.getTime() + 15 * 60 * 1000); // 15 minutes later

    const newCheckIn: VirtualCheckInRecord = {
      _id: reservationID,
      queueID,
      userID,
      checkInTime: now,
      arrivalWindow: [arrivalWindowStart, arrivalWindowEnd],
      status: CheckInStatus.Active,
    };

    await this.checkIns.insertOne(newCheckIn);

    return { reservationID, arrivalWindow: newCheckIn.arrivalWindow };
  }

  /**
   * Action: useReservation (reservationID: ID): Empty | (error: String)
   *
   * purpose: Allows event staff to mark a reservation as 'used' when the user arrives.
   *
   * requires:
   * - A `reservationID` must exist.
   * - The reservation must have an 'active' status.
   *
   * effects:
   * - The `status` of the specified reservation is updated to 'used'.
   *
   * returns:
   * - On success: `Empty`
   * - On failure: `{ error: string }` if preconditions are not met.
   */
  async useReservation(
    { reservationID }: { reservationID: ID },
  ): Promise<Empty | { error: string }> {
    const checkIn = await this.checkIns.findOne({ _id: reservationID });

    if (!checkIn) {
      return { error: `Reservation with ID ${reservationID} not found.` };
    }
    if (checkIn.status !== CheckInStatus.Active) {
      return { error: `Reservation ${reservationID} is not active; current status is ${checkIn.status}.` };
    }

    await this.checkIns.updateOne(
      { _id: reservationID },
      { $set: { status: CheckInStatus.Used } },
    );

    return {};
  }

  /**
   * Action: cancelReservation (reservationID: ID): Empty | (error: String)
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
  async cancelReservation(
    { reservationID }: { reservationID: ID },
  ): Promise<Empty | { error: string }> {
    const checkIn = await this.checkIns.findOne({ _id: reservationID });

    if (!checkIn) {
      return { error: `Reservation with ID ${reservationID} not found.` };
    }
    if (checkIn.status !== CheckInStatus.Active) {
      return { error: `Reservation ${reservationID} is not active; current status is ${checkIn.status}.` };
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
   *
   * requires:
   * - The current time is after `arrivalWindow[1]` (the end of the arrival window) for an active reservation.
   *
   * effects:
   * - All 'active' reservations whose `arrivalWindow[1]` is in the past are updated to 'expired'.
   *
   * returns:
   * - Always `Empty`.
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
   * Query: _getReservationStatus (reservationID: ID): (reservation: VirtualCheckInRecord) | (error: String)
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
  async _getReservationStatus(
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
      return { error: `No active reservation found for user ${userID} in queue ${queueID}.` };
    }
    return { reservation };
  }
}
```

***

**Explanation of Implementation Choices:**

1. **Concept Structure**: The `VirtualCheckInConcept` class encapsulates all state and behavior. The constructor initializes the MongoDB collection specifically for this concept.
2. **State Mapping**:
   * The `VirtualCheckInRecord` interface directly maps to the described state.
   * `_id` in MongoDB is used for `reservationID`, which is branded as `ID`.
   * `queueID` and `userID` are also branded `ID`s, reflecting their external polymorphic nature.
   * `checkInTime` and `arrivalWindow` elements are `Date` objects for proper date/time handling.
   * `status` is an enum `CheckInStatus` for clarity and type safety.
   * The `checkIns` private member holds the MongoDB `Collection` for these records.
3. **Action Implementations**:
   * Each action (`checkIn`, `useReservation`, `cancelReservation`, `expireReservations`) is an `async` method.
   * **Input/Output**: They strictly adhere to the dictionary input/output requirement. `Empty` is used for actions that don't need to return data on success.
   * **Error Handling**: Instead of throwing exceptions for expected failures (like a reservation not found or not active), methods return `{ error: "message" }`, allowing syncs to handle these gracefully.
   * **Preconditions (`requires`)**: Checked at the beginning of each action. If not met, an error is returned. For `checkIn`, it prevents double-booking an active reservation for the same user in the same queue.
   * **Effects (`effects`)**: MongoDB operations (`insertOne`, `updateOne`, `updateMany`) are used to mutate the concept's state as described.
   * **`freshID()`**: Used to generate unique `_id` values for new reservations.
   * **`system` Action**: `expireReservations` is commented as a `system` action. Its `requires` condition implies it should be periodically run (e.g., via a cron job or background worker in the application layer that uses syncs), and it updates all matching records in a single `updateMany` operation.
4. **Query Implementations**:
   * Queries (`_getReservationStatus`, `_getUserActiveReservation`) start with an underscore.
   * They return dictionary objects, which can include the `VirtualCheckInRecord` or an `error` message.
5. **Polymorphism (`ID` types)**: `Queue` and `User` are defined as `ID` types, ensuring the concept treats them as opaque identifiers, not making any assumptions about their internal structure or properties. This upholds the independence principle.
6. **Separation of Concerns**: This concept solely manages virtual check-ins. It doesn't handle user authentication, queue management (like defining available queues), or event details – those would be separate concepts. It just stores `queueID` and `userID` as external references.
7. **Completeness**: The concept defines all necessary actions and state to fulfill its purpose of managing virtual check-ins without depending on *calling* actions in other concepts. Interactions (like a user being added to a queue or a user being notified) would happen via syncs.
8. **Documentation**: Inline JSDoc comments are used to document the purpose, principle, state, and each action/query, including `requires`, `effects`, and `returns` information.

***

**How Syncs Would Interact:**

* **User Check-In**: A `Request` sync could trigger `VirtualCheckIn.checkIn` when a user submits a form.
  ```
  sync UserRequestsCheckIn
  when
      Request.submitCheckIn (form)
  where
      in Session: user of session form.sessionID is u
      in Queueing: isValidQueue (form.queueID) // Assuming a Queueing concept
  then
      VirtualCheckIn.checkIn (queueID: form.queueID, userID: u, desiredArrivalTime: form.desiredTime)
  ```
* **Notify User**: A sync could notify a user after `checkIn` completes.
  ```
  sync NotifyOnCheckInSuccess
  when
      VirtualCheckIn.checkIn (reservationID: r, arrivalWindow: [start, end], ...) // successful result
  then
      Notification.send (userID: r.userID, message: "Your reservation ${r} is confirmed for ${start}-${end}.") // Assuming a Notification concept
  ```
* **Trigger Expiry**: A timed sync or a service that periodically calls `expireReservations` would be needed.
  ```
  sync ScheduleExpiryCheck
  when
      System.periodicEvent (interval: "1 minute")
  then
      VirtualCheckIn.expireReservations ()
  ```
* **User Arrives**: Staff action via a `Request` sync.
  ```
  sync StaffUsesReservation
  when
      Request.markReservationUsed (reservationID: r, staffSession: s)
  where
      in Session: user of session s is staffUser
      // Optionally, check if staffUser has permission via an Authorization concept
      // in Authorization: staffUser has permission "mark_reservation_used"
  then
      VirtualCheckIn.useReservation (reservationID: r)
  ```
