//Setting up connection to mongodb DIRECTLY instead of using utils/database.ts just for practice

import { Collection, Db, MongoClient } from "npm:mongodb";
import { assert, assertEquals, assertExists } from "jsr:@std/assert";
import { ID } from "../../utils/types.ts";
import UserReportConcept from "./UserReportConcept.ts";

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  it,
} from "jsr:@std/testing/bdd";

// --- MongoDB Connection Setup ---
const MONGO_URI = Deno.env.get("MONGODB_URL") ?? "mongodb://localhost:27017";
const DB_NAME = Deno.env.get("DB_NAME") ?? "test_UserReportConcept";

let client: MongoClient;
let db: Db;

// --- Test Initialization ---
beforeAll(async () => {
  console.log(`Connecting to MongoDB at ${MONGO_URI} ...`);
  client = new MongoClient(MONGO_URI);
  await client.connect();
  db = client.db(DB_NAME);
  console.log("MongoDB connected successfully.");
});

afterAll(async () => {
  console.log("Closing MongoDB connection...");
  await client.close();
  console.log("MongoDB connection closed.");
});

// --- Test Data Helpers ---
function freshID(): ID {
  return `mongo-test-id:${crypto.randomUUID()}` as ID;
}

interface UserReportDocument {
  _id: ID;
  user: ID;
  queue: ID;
  estimatedPeopleInLine?: number;
  currentWaitTime?: number;
  entryOutcome?: string;
  validated: boolean;
  timestamp: Date;
}

const USER_ALICE_ID = "user:Alice" as ID;
const USER_BOB_ID = "user:Bob" as ID;
const QUEUE_A_ID = "queue:MainEntrance" as ID;
const QUEUE_B_ID = "queue:HelpDesk" as ID;

let userReportConcept: UserReportConcept;
let reportsCollection: Collection<UserReportDocument>;

describe("UserReportConcept (Integration Tests with MongoDB)", () => {
  beforeAll(async () => {
    userReportConcept = new UserReportConcept(db);
    reportsCollection = db.collection<UserReportDocument>(
      "UserReport.reports",
    );
    await reportsCollection.createIndex({ queue: 1 });
  });

  beforeEach(async () => {
    await reportsCollection.deleteMany({});
  });

  afterAll(async () => {
    await db.dropDatabase();
  });

  // -----------------------------------------------------------------------------------------
  it("Principle: User submits a report and it gets validated", async () => {
    console.log("\n--- Principle Test ---");

    const submitResult = await userReportConcept.submitReport({
      user: USER_ALICE_ID,
      queue: QUEUE_A_ID,
      estimatedPeopleInLine: 10,
      currentWaitTime: 15,
      entryOutcome: "entered",
    });

    assertExists(submitResult.report);
    const reportId = submitResult.report;

    const report1 = await userReportConcept._getReport({ report: reportId });
    assertExists(report1);
    assertEquals(report1.user, USER_ALICE_ID);
    assertEquals(report1.queue, QUEUE_A_ID);
    assertEquals(report1.estimatedPeopleInLine, 10);
    assertEquals(report1.currentWaitTime, 15);
    assertEquals(report1.entryOutcome, "entered");
    assertEquals(report1.validated, false);

    const validationResult = await userReportConcept.setReportValidationStatus({
      report: reportId,
      isValid: true,
    });
    assertEquals(validationResult, {});

    const report2 = await userReportConcept._getReport({ report: reportId });
    assertEquals(report2?.validated, true);

    const validatedReports = await userReportConcept
      ._getValidatedReportsByQueue({ queue: QUEUE_A_ID });
    assertEquals(validatedReports.length, 1);
    assertEquals(validatedReports[0]._id, reportId);
  });

  // -----------------------------------------------------------------------------------------
  it("Variant 1: Submit report with only mandatory fields", async () => {
    const result = await userReportConcept.submitReport({
      user: USER_BOB_ID,
      queue: QUEUE_B_ID,
    });

    assertExists(result.report);
    const report = await userReportConcept._getReport({
      report: result.report,
    });
    assertExists(report);
    assertEquals(report.user, USER_BOB_ID);
    assertEquals(report.queue, QUEUE_B_ID);
    assertEquals(report.validated, false);
    assertExists(report.timestamp);
  });

  // -----------------------------------------------------------------------------------------
  it("Variant 2: Submit report with all optional fields, then invalidate it", async () => {
    const result = await userReportConcept.submitReport({
      user: USER_ALICE_ID,
      queue: QUEUE_B_ID,
      estimatedPeopleInLine: 50,
      currentWaitTime: 60,
      entryOutcome: "denied",
    });

    const reportId = result.report;
    let report = await userReportConcept._getReport({ report: reportId });
    assertExists(report);
    assertEquals(report.validated, false);

    await userReportConcept.setReportValidationStatus({
      report: reportId,
      isValid: true,
    });
    report = await userReportConcept._getReport({ report: reportId });
    assertEquals(report?.validated, true);

    await userReportConcept.setReportValidationStatus({
      report: reportId,
      isValid: false,
    });
    report = await userReportConcept._getReport({ report: reportId });
    assertEquals(report?.validated, false);

    const validatedReports = await userReportConcept
      ._getValidatedReportsByQueue({ queue: QUEUE_B_ID });
    assertEquals(validatedReports.length, 0);
  });

  // -----------------------------------------------------------------------------------------
  it("Variant 3: Attempt to validate a non-existent report", async () => {
    const fakeId = freshID();
    const result = await userReportConcept.setReportValidationStatus({
      report: fakeId,
      isValid: true,
    });

    if (result && "error" in result) {
      assertExists(result.error);
      assert(result.error.includes("not found"));
    } else {
      const check = await userReportConcept._getReport({ report: fakeId });
      assertEquals(check, null);
    }
  });

  // -----------------------------------------------------------------------------------------
  it("Variant 4: Submit multiple reports, validate selectively, and query", async () => {
    const r1 = (await userReportConcept.submitReport({
      user: USER_ALICE_ID,
      queue: QUEUE_A_ID,
      currentWaitTime: 10,
    })).report;

    const r2 = (await userReportConcept.submitReport({
      user: USER_BOB_ID,
      queue: QUEUE_A_ID,
      estimatedPeopleInLine: 5,
    })).report;

    const r3 = (await userReportConcept.submitReport({
      user: USER_ALICE_ID,
      queue: QUEUE_A_ID,
      entryOutcome: "left",
    })).report;

    const r4 = (await userReportConcept.submitReport({
      user: USER_ALICE_ID,
      queue: QUEUE_B_ID,
      entryOutcome: "entered",
    })).report;

    await userReportConcept.setReportValidationStatus({
      report: r1,
      isValid: true,
    });
    await userReportConcept.setReportValidationStatus({
      report: r3,
      isValid: true,
    });
    await userReportConcept.setReportValidationStatus({
      report: r4,
      isValid: true,
    });

    const validatedA = await userReportConcept
      ._getValidatedReportsByQueue({ queue: QUEUE_A_ID });
    assertEquals(validatedA.length, 2);

    const validatedB = await userReportConcept
      ._getValidatedReportsByQueue({ queue: QUEUE_B_ID });
    assertEquals(validatedB.length, 1);

    const all = await userReportConcept._getAllReports();
    assertEquals(all.length, 4);
  });
});
