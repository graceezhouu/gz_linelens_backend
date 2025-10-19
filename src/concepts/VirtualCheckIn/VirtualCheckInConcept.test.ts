// src/VirtualCheckIn/VirtualCheckInConcept.test.ts

import { assertEquals, assertExists, assertInstanceOf } from "jsr:@std/assert";
// import { afterAll, beforeAll } from "jsr:@std/testing/bdd";

// --- Mocking MongoDB and utility types/functions for testing ---
// These mocks replicate the behavior of the real utilities and MongoDB client
// in a simplified in-memory fashion, suitable for isolated unit testing.

export type ID = string & { readonly __brand: unique symbol };
export type Empty = Record<PropertyKey, never>;

let currentMockIdCounter = 0; // Simple counter for freshID in tests
export function freshID(): ID {
  return `test-id:${Date.now()}-${currentMockIdCounter++}` as ID;
}

// Helper for filter matching in MockCollection
// This function simulates MongoDB's document matching logic for filters
function matchesFilter<T extends { _id: ID }>(
  document: T,
  filter: Partial<T>,
): boolean {
  for (const key in filter) {
    if (Object.prototype.hasOwnProperty.call(filter, key)) {
      let documentValue: any = document;
      let filterValue: any = (filter as any)[key];

      // Handle nested properties (e.g., "arrivalWindow.1")
      if (key.includes(".")) {
        const parts = key.split(".");
        for (const part of parts) {
          documentValue = documentValue ? documentValue[part] : undefined;
        }
      } else {
        documentValue = documentValue[key];
      }

      // Handle MongoDB operators (currently only $lt is implemented as used by the concept)
      if (typeof filterValue === "object" && filterValue !== null) {
        if ("$lt" in filterValue) {
          // Compare Date objects by their timestamp values
          const filterLtValue = filterValue.$lt instanceof Date
            ? filterValue.$lt.getTime()
            : filterValue.$lt;
          const documentActualValue = documentValue instanceof Date
            ? documentValue.getTime()
            : documentValue;

          if (
            documentValue === undefined || documentActualValue >= filterLtValue
          ) {
            return false; // Not less than
          }
        }
        // Extend with other operators ($gt, $eq, $ne, $in, etc.) if your concept uses them
      } else {
        // Direct equality comparison for non-operator filters
        if (documentValue !== filterValue) {
          return false;
        }
      }
    }
  }
  return true;
}

// Mock implementation of MongoDB Collection interface
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
    filter: Partial<T> & { [key: string]: any },
  ): { toArray(): Promise<T[]> };
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
        return { ...item }; // Return a copy to prevent external modification of internal state
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
    update: any, // update can contain $set, $inc, etc.
    options?: { upsert?: boolean },
  ): Promise<any> {
    const item = await this.findOne(filter);
    if (item) {
      const updatedItem = { ...item };
      if (update.$set) {
        for (const key in update.$set) {
          if (key.includes(".")) { // Handle nested updates
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
    // Simplistic upsert for testing (if filter includes _id and no document found)
    if (options?.upsert && (filter as any)._id) {
      const newDoc = this.ensureId({ ...filter, ...update.$set });
      this.data.set(newDoc._id, newDoc);
      return { acknowledged: true, upsertedId: newDoc._id, modifiedCount: 0 };
    }
    return { acknowledged: true, modifiedCount: 0 };
  }

  async updateMany(filter: Partial<T>, update: any): Promise<any> {
    let modifiedCount = 0;
    // Create a copy of values to iterate, to avoid issues with map modification during iteration
    for (const item of Array.from(this.data.values())) {
      if (matchesFilter(item, filter)) {
        const updatedItem = { ...item };
        if (update.$set) {
          for (const key in update.$set) {
            if (key.includes(".")) { // Handle nested updates
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

  find(filter: Partial<T>): { toArray(): Promise<T[]> } {
    const results: T[] = [];
    for (const item of this.data.values()) {
      if (matchesFilter(item, filter)) {
        results.push({ ...item });
      }
    }
    return { toArray: async () => results };
  }

  clear() {
    this.data.clear();
  }
}

// Mock implementation of MongoDB Db interface
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

// --- Begin VirtualCheckInConcept.ts (included for self-contained test file) ---
// Note: In a real project, this would be imported: import VirtualCheckInConcept from "../VirtualCheckIn/VirtualCheckInConcept.ts";

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
    const now = new Date(); // This `now` will reflect the mocked Date.now() if Date is mocked
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

// --- End VirtualCheckInConcept.ts ---

// --- Test Suite ---
Deno.test("VirtualCheckInConcept Tests", async (t) => {
  const mockDb = new MockDb();
  const concept = new VirtualCheckInConcept(mockDb);

  // Store original Date to restore later
  const OriginalDate = globalThis.Date;

  // Custom mock Date function to control time in tests
  function mockDate(isoDate: string) {
    const mock = class MockDate extends OriginalDate {
      constructor(dateString?: string | number | Date) {
        if (dateString) {
          super(dateString);
        } else {
          super(isoDate);
        }
      }

      static override now() {
        return new OriginalDate(isoDate).getTime();
      }
    };
    globalThis.Date = mock as any;
  }

  // // Setup before each test step
  // t.beforeEach(() => {
  //   mockDb.clearAll();
  //   currentMockIdCounter = 0;
  // });

  // // Cleanup after all tests
  // t.afterAll(() => {
  //   globalThis.Date = OriginalDate;
  // });

  // Manual setup
  mockDb.clearAll();
  currentMockIdCounter = 0;

  // Ensure cleanup runs at the end of the entire test
  try {
    // all your test steps
  } finally {
    globalThis.Date = OriginalDate;
  }

  const userA: ID = "user:Alice" as ID;
  const userB: ID = "user:Bob" as ID;
  const userC: ID = "user:Charlie" as ID;
  const userD: ID = "user:David" as ID;

  const queueX: ID = "queue:Concert" as ID;
  const queueY: ID = "queue:Restaurant" as ID;
  const queueZ: ID = "queue:Workshop" as ID;
  const queueW: ID = "queue:Clinic" as ID;

  await t.step(
    "Principle Test: User reserves a spot, gets an arrival window, and it expires if not used",
    async () => {
      // 1. User A reserves a spot for Queue X at 10:00 AM, gets an arrival window [10:00, 10:15]
      mockDate("2023-10-26T10:00:00.000Z"); // Set initial time
      const reserveResult = await concept.reserveSpot({
        userID: userA,
        queueID: queueX,
      });
      assertExists(
        (reserveResult as { reservationID: ID }).reservationID,
        "Should return a reservation ID on successful reservation",
      );
      const reservationID =
        (reserveResult as { reservationID: ID }).reservationID;

      // Verify the created record's details
      const details1 = await concept._getReservationDetails({ reservationID });
      assertExists(
        details1.reservation,
        "Reservation details should be retrievable",
      );
      assertEquals(
        details1.reservation?.userID,
        userA,
        "Reservation userID mismatch",
      );
      assertEquals(
        details1.reservation?.queueID,
        queueX,
        "Reservation queueID mismatch",
      );
      assertEquals(
        details1.reservation?.status,
        CheckInStatus.Active,
        "Reservation status should be 'active'",
      );
      assertInstanceOf(
        details1.reservation?.checkInTime,
        Date,
        "checkInTime should be a Date object",
      );
      assertEquals(
        details1.reservation?.arrivalWindow.length,
        2,
        "arrivalWindow should have two Date objects",
      );
      assertInstanceOf(
        details1.reservation?.arrivalWindow[0],
        Date,
        "arrivalWindow start should be a Date object",
      );
      assertInstanceOf(
        details1.reservation?.arrivalWindow[1],
        Date,
        "arrivalWindow end should be a Date object",
      );

      // Check arrival window calculation: should be 15 minutes from checkInTime
      const expectedArrivalEnd = new Date(
        details1.reservation!.checkInTime.getTime() + 15 * 60 * 1000,
      );
      assertEquals(
        details1.reservation?.arrivalWindow[1].getTime(),
        expectedArrivalEnd.getTime(),
        "Arrival window end time is incorrect",
      );

      // 2. Simulate time passing beyond the arrival window
      // Arrival window for user A ends at 10:15. Set mock time to 10:20 (past the window).
      mockDate("2023-10-26T10:20:00.000Z");

      // 3. Call the system action to expire reservations
      await concept.expireReservations();

      // 4. Verify that user A's reservation status is now 'expired'
      const details2 = await concept._getReservationDetails({ reservationID });
      assertExists(
        details2.reservation,
        "Reservation details should still be retrievable after expiration attempt",
      );
      assertEquals(
        details2.reservation?.status,
        CheckInStatus.Expired,
        "Reservation status should be 'expired' after expiry window passed",
      );
    },
  );

  await t.step(
    "Variant 1: Attempt to reserve a spot for a user who already has an active reservation",
    async () => {
      // User B reserves a spot for Queue Y at 11:00 AM
      mockDate("2023-10-26T11:00:00.000Z");
      const firstReserve = await concept.reserveSpot({
        userID: userB,
        queueID: queueY,
      });
      assertExists(
        (firstReserve as { reservationID: ID }).reservationID,
        "First reservation attempt should succeed",
      );

      // User B attempts to reserve another spot for the same Queue Y (expect an error)
      const secondReserve = await concept.reserveSpot({
        userID: userB,
        queueID: queueY,
      });
      assertExists(
        (secondReserve as { error: string }).error,
        "Second reservation attempt for same user/queue should return an error",
      );
      assertEquals(
        (secondReserve as { error: string }).error,
        `User ${userB} already has an active reservation for queue ${queueY}.`,
        "Error message mismatch for duplicate reservation",
      );

      // Verify user B still has only one active reservation for Queue Y
      const activeReservations = await concept._getUserActiveReservation({
        userID: userB,
        queueID: queueY,
      });
      assertExists(
        activeReservations.reservation,
        "User B should still have exactly one active reservation",
      );
      assertEquals(
        activeReservations.reservation?._id,
        (firstReserve as { reservationID: ID }).reservationID,
        "The active reservation ID should match the first one",
      );
    },
  );

  await t.step(
    "Variant 2: Cancel an active reservation successfully",
    async () => {
      // User C reserves a spot for Queue Z at 12:00 PM
      mockDate("2023-10-26T12:00:00.000Z");
      const reserveResult = await concept.reserveSpot({
        userID: userC,
        queueID: queueZ,
      });
      const reservationID_C =
        (reserveResult as { reservationID: ID }).reservationID;
      assertExists(reservationID_C, "Reservation should be successful");

      // User C cancels their reservation
      const cancelResult = await concept.cancelSpot({
        reservationID: reservationID_C,
      });
      assertEquals(
        cancelResult,
        {},
        "Cancel operation should return an empty object on success",
      );

      // Verify the reservation's status is now 'cancelled'
      const details = await concept._getReservationDetails({
        reservationID: reservationID_C,
      });
      assertExists(
        details.reservation,
        "Reservation details should be retrievable after cancellation",
      );
      assertEquals(
        details.reservation?.status,
        CheckInStatus.Cancelled,
        "Reservation status should be 'cancelled' after successful cancellation",
      );

      // Verify user C no longer has an active reservation for Queue Z
      const activeReservationCheck = await concept._getUserActiveReservation({
        userID: userC,
        queueID: queueZ,
      });
      assertExists(
        activeReservationCheck.error,
        "User C should no longer have an active reservation for Queue Z",
      );
    },
  );

  await t.step(
    "Variant 3: Attempt to cancel a non-existent reservation",
    async () => {
      const fakeReservationID: ID = "res:fake123" as ID;
      const cancelResult = await concept.cancelSpot({
        reservationID: fakeReservationID,
      });
      assertExists(
        (cancelResult as { error: string }).error,
        "Should return an error for attempting to cancel a non-existent reservation",
      );
      assertEquals(
        (cancelResult as { error: string }).error,
        `Reservation with ID ${fakeReservationID} not found.`,
        "Error message mismatch for non-existent reservation",
      );
    },
  );

  await t.step(
    "Variant 4: Attempt to cancel an already cancelled or expired reservation",
    async () => {
      // Scenario A: Attempt to cancel an already 'cancelled' reservation
      mockDate("2023-10-26T13:00:00.000Z");
      const reserveResult1 = await concept.reserveSpot({
        userID: userD,
        queueID: queueW,
      });
      const reservationID_D1 =
        (reserveResult1 as { reservationID: ID }).reservationID;
      assertExists(
        reservationID_D1,
        "First reservation for user D should succeed",
      );

      await concept.cancelSpot({ reservationID: reservationID_D1 }); // Cancel it once
      const detailsD1_cancelled = await concept._getReservationDetails({
        reservationID: reservationID_D1,
      });
      assertEquals(
        detailsD1_cancelled.reservation?.status,
        CheckInStatus.Cancelled,
        "Reservation should be cancelled",
      );

      // Attempt to cancel it again (now it's 'cancelled', not 'active')
      const cancelResult2 = await concept.cancelSpot({
        reservationID: reservationID_D1,
      });
      assertExists(
        (cancelResult2 as { error: string }).error,
        "Should return an error for cancelling an already cancelled reservation",
      );
      assertEquals(
        (cancelResult2 as { error: string }).error,
        `Reservation ${reservationID_D1} is not active; current status is ${CheckInStatus.Cancelled}.`,
        "Error message mismatch for cancelling cancelled reservation",
      );

      // Scenario B: Attempt to cancel an 'expired' reservation
      // Clear DB for a fresh state for this sub-scenario
      mockDb.clearAll();
      currentMockIdCounter = 0;

      mockDate("2023-10-26T14:00:00.000Z");
      const reserveResult2 = await concept.reserveSpot({
        userID: userA,
        queueID: queueY,
      }); // Reusing userA, queueY
      const reservationID_A =
        (reserveResult2 as { reservationID: ID }).reservationID;
      assertExists(
        reservationID_A,
        "Second reservation for user A should succeed",
      );

      // Advance time past the arrival window (ends at 14:15, set to 14:20)
      mockDate("2023-10-26T14:20:00.000Z");
      await concept.expireReservations(); // Expire the reservation

      const detailsA_expired = await concept._getReservationDetails({
        reservationID: reservationID_A,
      });
      assertEquals(
        detailsA_expired.reservation?.status,
        CheckInStatus.Expired,
        "Reservation should be expired",
      );

      // Attempt to cancel the expired reservation
      const cancelResult3 = await concept.cancelSpot({
        reservationID: reservationID_A,
      });
      assertExists(
        (cancelResult3 as { error: string }).error,
        "Should return an error for cancelling an expired reservation",
      );
      assertEquals(
        (cancelResult3 as { error: string }).error,
        `Reservation ${reservationID_A} is not active; current status is ${CheckInStatus.Expired}.`,
        "Error message mismatch for cancelling expired reservation",
      );
    },
  );

  await t.step(
    "Variant 5: Multiple users, multiple queues, and targeted expiration",
    async () => {
      // User A reserves for Queue X at 15:00. Window: [15:00, 15:15]
      mockDate("2023-10-26T15:00:00.000Z");
      const reserveA = await concept.reserveSpot({
        userID: userA,
        queueID: queueX,
      });
      const reservationIDA = (reserveA as { reservationID: ID }).reservationID;
      assertExists(reservationIDA, "Reservation for user A should succeed");

      // User B reserves for Queue Y at 15:05. Window: [15:05, 15:20]
      mockDate("2023-10-26T15:05:00.000Z");
      const reserveB = await concept.reserveSpot({
        userID: userB,
        queueID: queueY,
      });
      const reservationIDB = (reserveB as { reservationID: ID }).reservationID;
      assertExists(reservationIDB, "Reservation for user B should succeed");

      // Simulate time passing: to 15:18.
      // This is past User A's window (ends 15:15), but before User B's window (ends 15:20).
      mockDate("2023-10-26T15:18:00.000Z");

      await concept.expireReservations(); // Run expiration logic

      // Verify User A's reservation is 'expired'
      const detailsA_final = await concept._getReservationDetails({
        reservationID: reservationIDA,
      });
      assertExists(
        detailsA_final.reservation,
        "User A's reservation details should be retrievable",
      );
      assertEquals(
        detailsA_final.reservation?.status,
        CheckInStatus.Expired,
        "User A's reservation should be expired",
      );

      // Verify User B's reservation is still 'active'
      const detailsB_final = await concept._getReservationDetails({
        reservationID: reservationIDB,
      });
      assertExists(
        detailsB_final.reservation,
        "User B's reservation details should be retrievable",
      );
      assertEquals(
        detailsB_final.reservation?.status,
        CheckInStatus.Active,
        "User B's reservation should still be active",
      );
    },
  );

  await t.step("Query: _getUserActiveReservation functionality", async () => {
    // User C reserves for Queue X at 16:00
    mockDate("2023-10-26T16:00:00.000Z");
    const reserveResult = await concept.reserveSpot({
      userID: userC,
      queueID: queueX,
    });
    const reservationID_C =
      (reserveResult as { reservationID: ID }).reservationID;
    assertExists(reservationID_C, "Reservation for user C should succeed");

    // Retrieve active reservation for user C in queue X
    const activeReservation = await concept._getUserActiveReservation({
      userID: userC,
      queueID: queueX,
    });
    assertExists(
      activeReservation.reservation,
      "Should find the active reservation for user C in queue X",
    );
    assertEquals(
      activeReservation.reservation?._id,
      reservationID_C,
      "Retrieved active reservation ID mismatch",
    );
    assertEquals(
      activeReservation.reservation?.userID,
      userC,
      "Retrieved active reservation userID mismatch",
    );
    assertEquals(
      activeReservation.reservation?.queueID,
      queueX,
      "Retrieved active reservation queueID mismatch",
    );
    assertEquals(
      activeReservation.reservation?.status,
      CheckInStatus.Active,
      "Retrieved active reservation status mismatch",
    );

    // Attempt to retrieve active reservation for a different user/queue combination (expect no result/error)
    const noReservation = await concept._getUserActiveReservation({
      userID: userD,
      queueID: queueX,
    });
    assertExists(
      noReservation.error,
      "Should not find an active reservation for user D in queue X",
    );
    assertEquals(
      noReservation.error,
      `No active reservation found for user ${userD} in queue ${queueX}.`,
      "Error message mismatch for non-existent active reservation",
    );

    // After cancelling the reservation, it should no longer be considered active
    await concept.cancelSpot({ reservationID: reservationID_C });
    const cancelledReservationCheck = await concept._getUserActiveReservation({
      userID: userC,
      queueID: queueX,
    });
    assertExists(
      cancelledReservationCheck.error,
      "Should not find an active reservation after cancellation",
    );
    assertEquals(
      cancelledReservationCheck.error,
      `No active reservation found for user ${userC} in queue ${queueX}.`,
      "Error message mismatch after cancellation",
    );
  });
});
