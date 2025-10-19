import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert";
import type { ID } from "@utils/types.ts";
import QueueStatusConcept from "./QueueStatusConcept.ts";

// --- Mock in-memory MongoDB layer ----------------------------------

class MockCollection<T extends Record<string, unknown>> {
  data = new Map<string, T & { _id: string }>();

  async insertOne(doc: T & { _id: string }) {
    if (this.data.has(doc._id)) throw new Error("duplicate key error");
    this.data.set(doc._id, doc);
    return { acknowledged: true, insertedId: doc._id };
  }

  async findOne(
    query: Record<string, unknown>,
  ): Promise<(T & { _id: string }) | null> {
    if ("_id" in query) return this.data.get(query._id as string) ?? null;
    for (const doc of this.data.values()) {
      let match = true;
      for (const [key, val] of Object.entries(query)) {
        if ((doc as any)[key] !== val) {
          match = false;
          break;
        }
      }
      if (match) return doc;
    }
    return null;
  }

  async updateOne(
    filter: Record<string, unknown>,
    update: { $set: Partial<T> },
  ) {
    const id = filter._id as string;
    const existing = this.data.get(id);
    if (!existing) return { matchedCount: 0, modifiedCount: 0 };
    this.data.set(id, { ...existing, ...update.$set });
    return { matchedCount: 1, modifiedCount: 1 };
  }

  async deleteMany(): Promise<{ deletedCount: number }> {
    const count = this.data.size;
    this.data.clear();
    return { deletedCount: count };
  }
}

class MockDb {
  private collections = new Map<
    string,
    MockCollection<Record<string, unknown>>
  >();

  collection<T extends Record<string, unknown>>(
    name: string,
  ): MockCollection<T> {
    if (!this.collections.has(name)) {
      this.collections.set(name, new MockCollection());
    }
    return this.collections.get(name)! as MockCollection<T>;
  }
}

const mockDb = new MockDb();

// --- Replace QueueStatusConcept's expected DB dependency ------------
const createTestID = (id: string): ID => id as ID;
const queueStatusConcept = new QueueStatusConcept(mockDb as any);
const queuesCollection = mockDb.collection<Record<string, unknown>>(
  "QueueStatus.queues",
);

// --- Helper ---------------------------------------------------------
async function clearDatabase() {
  await queuesCollection.deleteMany();
}

// --- Tests ----------------------------------------------------------
Deno.test("QueueStatusConcept (Mocked DB) Tests", async (test) => {
  // Test 1: Create, Update, View
  await test.step("Principle Test: Create, Update, View a queue", async () => {
    await clearDatabase();
    const queueId = createTestID("principleQueue1");
    const location = { latitude: 34.0522, longitude: -118.2437 };

    const createResult = await queueStatusConcept.createQueue({
      queueID: queueId,
      location,
    });
    assertEquals(createResult, {}, "Queue created successfully");

    const initial = await queueStatusConcept._viewStatus({ queueID: queueId });
    if ("error" in initial) assert(false, initial.error);
    assertEquals(initial.estPplInLine, null);
    assertEquals(initial.estWaitTime, null);

    const updatedPplInLine = 50;
    const updatedWaitTime = 30;
    const updateResult = await queueStatusConcept.updateStatus({
      queueID: queueId,
      estPplInLine: updatedPplInLine,
      estWaitTime: updatedWaitTime,
    });
    assertEquals(updateResult, {}, "Queue updated successfully");

    const final = await queueStatusConcept._viewStatus({ queueID: queueId });
    if ("error" in final) assert(false, final.error);
    assertEquals(final.estPplInLine, updatedPplInLine);
    assertEquals(final.estWaitTime, updatedWaitTime);
  });

  // Test 2: Duplicate queue ID
  await test.step("Variant 1: duplicate ID should return an error", async () => {
    await clearDatabase();
    const queueId = createTestID("duplicateQueue");
    const location = "Conference Hall A";

    await queueStatusConcept.createQueue({ queueID: queueId, location });
    const duplicate = await queueStatusConcept.createQueue({
      queueID: queueId,
      location,
    });
    assert("error" in duplicate);
    assertStringIncludes(
      duplicate.error,
      `Queue with ID '${queueId}' already exists.`,
    );
  });

  // Test 3: Update non-existent queue
  await test.step("Variant 2: updating non-existent queue returns error", async () => {
    await clearDatabase();
    const queueId = createTestID("missingQueue");
    const result = await queueStatusConcept.updateStatus({
      queueID: queueId,
      estPplInLine: 10,
      estWaitTime: 5,
    });
    assert("error" in result);
    assertStringIncludes(result.error, `Queue with ID '${queueId}' not found.`);
  });

  // Test 4: View non-existent queue
  await test.step("Variant 3: viewing non-existent queue returns error", async () => {
    await clearDatabase();
    const queueId = createTestID("missingQueueView");
    const result = await queueStatusConcept._viewStatus({ queueID: queueId });
    assert("error" in result);
    assertStringIncludes(result.error, `Queue with ID '${queueId}' not found.`);
  });

  // Test 5: All optional parameters
  await test.step("Variant 4: createQueue with optional parameters", async () => {
    await clearDatabase();
    const queueId = createTestID("fullySpecifiedQueue");
    const location = "Virtual Waiting Room";
    const initialEstPpl = 100;
    const initialEstWait = 60;
    const virtualCheckIn = true;

    const createResult = await queueStatusConcept.createQueue({
      queueID: queueId,
      location,
      estPplInLine: initialEstPpl,
      estWaitTime: initialEstWait,
      virtualCheckInEligible: virtualCheckIn,
    });
    assertEquals(createResult, {}, "Creation succeeded");

    const doc = await queuesCollection.findOne({ _id: queueId });
    assert(doc !== null && typeof doc === "object");
    const typedDoc = doc as Record<string, unknown>;

    assertEquals(typedDoc.estPplInLine, initialEstPpl);
    assertEquals(typedDoc.estWaitTime, initialEstWait);
    assertEquals(typedDoc.virtualCheckInEligible, virtualCheckIn);
  });

  // Test 6: lastUpdated should change on updates
  await test.step("Variant 5: lastUpdated timestamp increments correctly", async () => {
    await clearDatabase();
    const queueId = createTestID("timestampQueue");
    const location = { latitude: 35.6895, longitude: 139.6917 };

    await queueStatusConcept.createQueue({ queueID: queueId, location });
    const update1 = await queueStatusConcept.updateStatus({
      queueID: queueId,
      estPplInLine: 10,
      estWaitTime: 5,
    });
    assertEquals(update1, {});

    const status1 = await queueStatusConcept._viewStatus({ queueID: queueId });
    if ("error" in status1) assert(false, status1.error);
    const lastUpdated1 = status1.lastUpdated.getTime();

    await new Promise((r) => setTimeout(r, 30));
    const update2 = await queueStatusConcept.updateStatus({
      queueID: queueId,
      estPplInLine: 20,
      estWaitTime: 10,
    });
    assertEquals(update2, {});

    const status2 = await queueStatusConcept._viewStatus({ queueID: queueId });
    if ("error" in status2) assert(false, status2.error);
    const lastUpdated2 = status2.lastUpdated.getTime();

    assert(
      lastUpdated2 > lastUpdated1,
      "lastUpdated should increase after update",
    );
  });
});
