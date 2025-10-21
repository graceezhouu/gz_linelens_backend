[@api-extraction-from-spec](api-extraction-from-spec.md)

# Extracting from code

The following is an explanation of how concepts are implemented, for the purposes of understanding how to extract an API.

[@implementing-concepts](../background/implementing-concepts.md)

# prompt: 

Now, analyze the following Concept Implementations and generate the API documentation based on these instructions.

[@queuestatus-concept](../../src/concepts/QueueStatus/QueueStatusConcept.ts)

[@prediction-concept](../../src/concepts/Prediction/PredictionConcept.ts)

[@userreport-concept](../../src/concepts/UserReport/UserReportConcept.ts)

[@virtualcheckin-concept](../../src/concepts/VirtualCheckIn/VirtualCheckInConcept.ts)


# response:

# API Specification: QueueStatus Concept

**Purpose:** Represent the current state of a line at a given event. Aggregate real-time information (crowdsourced and predictive) into a single source of truth about the queue.

---

## API Endpoints

### POST /api/QueueStatus/createQueue

**Description:** Creates a new queue with the given ID and location.

**Requirements:**
- `queueID` must not already exist in the system.

**Effects:**
- A new queue document is created in the database with the provided ID and location.
- `estWaitTime` and `estPplInLine` are initialized to `null` or provided values.
- `virtualCheckInEligible` is set based on the input, defaulting to `false`.
- `lastUpdated` is set to the current timestamp.

**Request Body:**
```json
{
  "queueID": "string",
  "location": "{ \"latitude\": \"number\", \"longitude\": \"number\" } | string",
  "estWaitTime": "number | null (optional, default: null)",
  "estPplInLine": "number | null (optional, default: null)",
  "virtualCheckInEligible": "boolean (optional, default: false)"
}
```

**Success Response Body (Action):**
```json
{}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```

---

### POST /api/QueueStatus/updateStatus

**Description:** Updates the estimated number of people in line and estimated wait time for a given queue.

**Requirements:**
- `queueID` must exist in the system.

**Effects:**
- The `estPplInLine`, `estWaitTime`, and `lastUpdated` fields for the specified queue are updated.

**Request Body:**
```json
{
  "queueID": "string",
  "estPplInLine": "number",
  "estWaitTime": "number"
}
```

**Success Response Body (Action):**
```json
{}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```

---

### POST /api/QueueStatus/_viewStatus

**Description:** Retrieves the current status information for a specified queue.

**Requirements:**
- `queueID` must exist.

**Effects:**
- Outputs the current `estPplInLine`, `estWaitTime`, and `lastUpdated` time for the queue. These values may be `null` if insufficient information has been provided.

**Request Body:**
```json
{
  "queueID": "string"
}
```

**Success Response Body (Query):**
```json
[
  {
    "estPplInLine": "number | null",
    "estWaitTime": "number | null",
    "lastUpdated": "string (ISO 8601)"
  }
]
```

**Error Response Body:**
```json
{
  "error": "string"
}
```

---

# API Specification: Prediction Concept

**Purpose:** Provide users with estimated wait times and entry likelihoods for specific locations, leveraging both historical trends, real-time user-contributed data, and AI predictions.

---

## API Endpoints

### POST /api/Prediction/runPrediction

**Description:** Runs an AI prediction for a specific queue (location) and stores the result.

**Requirements:**
- `queueID` must exist (meaning it's a valid location for which predictions are desired). (This concept assumes `queueID` validity is handled externally or by the AI engine).

**Effects:**
- Generates updated prediction results for wait time and entry likelihood based on historical + live inputs, generates nothing if there is insufficient information.

**Request Body:**
```json
{
  "queueID": "string",
  "modelID": "string"
}
```

**Success Response Body (Action):**
```json
{
  "queueID": "string",
  "estWaitTime": "number",
  "entryProbability": "number",
  "confidenceInterval": "[number, number]"
}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```

---

### POST /api/Prediction/getForecast

**Description:** Retrieves the most recently available prediction and its `lastRun` timestamp for a specified queue.

**Requirements:**
- `queueID` must exist (meaning a prediction for it has been run and stored).

**Effects:**
- Returns the most recently available prediction and `lastRun`.

**Request Body:**
```json
{
  "queueID": "string"
}
```

**Success Response Body (Action):**
```json
{
  "queueID": "string",
  "estWaitTime": "number",
  "entryProbability": "number",
  "confidenceInterval": "[number, number]",
  "lastRun": "string (ISO 8601)"
}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```

---

### POST /api/Prediction/cleanOldReports

**Description:** Automatically deletes predictions (forecasts) older than a certain threshold (e.g., 2 hours, 2 days).

**Requirements:**
- true (This action can always be triggered autonomously by the system.)

**Effects:**
- Delete Predictions (forecasts) older than a certain threshold (e.g., 2 hours, 2 days). For this implementation, the threshold is set to 2 days.

**Request Body:**
```json
{}
```

**Success Response Body (Action):**
```json
{}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```

---

# API Specification: UserReport Concept

**Purpose:** Enable users to submit real-time data about queue conditions, which, once validated, can improve prediction accuracy and trustworthiness.

---

## API Endpoints

### POST /api/UserReport/submitReport

**Description:** Creates a new report entity for user-submitted queue conditions.

**Requirements:**
- true (The concept treats `User` and `Queue` as polymorphic identifiers; their existence or verification is handled by syncs involving other concepts.)

**Effects:**
- Creates a new `Report` entity (let's call it `r`) in the concept's state such that: `r.user` := `user`, `r.queue` := `queue`, `r.timestamp` := the current `DateTime`, `r.estimatedPeopleInLine` := `estimatedPeopleInLine`, `r.currentWaitTime` := `currentWaitTime`, `r.entryOutcome` := `entryOutcome`, `r.validated` := `false` and returns `r` (the identifier of the newly created report).

**Request Body:**
```json
{
  "user": "string",
  "queue": "string",
  "estimatedPeopleInLine": "number (optional)",
  "currentWaitTime": "number (optional)",
  "entryOutcome": "string ('entered' | 'denied' | 'left') (optional)"
}
```

**Success Response Body (Action):**
```json
{
  "report": "string"
}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```

---

### POST /api/UserReport/setReportValidationStatus

**Description:** Updates the validation status of a specified report.

**Requirements:**
- The `report` (identified by its `Report` ID) must exist in the concept's state.

**Effects:**
- Updates the `validated` property of the specified `report` such that: `report.validated` := `isValid`. On success, returns an empty dictionary. If the report does not exist, returns an error string.

**Request Body:**
```json
{
  "report": "string",
  "isValid": "boolean"
}
```

**Success Response Body (Action):**
```json
{}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```

---

### POST /api/UserReport/_getReport

**Description:** Retrieves the full report document by its ID.

**Requirements:**
- None explicitly stated, but implicit that the `report` must exist to be returned.

**Effects:**
- Returns the full report document if found, otherwise null.

**Request Body:**
```json
{
  "report": "string"
}
```

**Success Response Body (Query):**
```json
[
  {
    "_id": "string",
    "user": "string",
    "queue": "string",
    "timestamp": "string (ISO 8601)",
    "estimatedPeopleInLine": "number (optional)",
    "currentWaitTime": "number (optional)",
    "entryOutcome": "string ('entered' | 'denied' | 'left') (optional)",
    "validated": "boolean"
  }
]
```

**Error Response Body:**
```json
{
  "error": "string"
}
```

---

### POST /api/UserReport/_getValidatedReportsByQueue

**Description:** Retrieves all validated reports for a given queue.

**Requirements:**
- None explicitly stated.

**Effects:**
- Returns an array of validated report documents for the specified queue.

**Request Body:**
```json
{
  "queue": "string"
}
```

**Success Response Body (Query):**
```json
[
  {
    "_id": "string",
    "user": "string",
    "queue": "string",
    "timestamp": "string (ISO 8601)",
    "estimatedPeopleInLine": "number (optional)",
    "currentWaitTime": "number (optional)",
    "entryOutcome": "string ('entered' | 'denied' | 'left') (optional)",
    "validated": "boolean"
  }
]
```

**Error Response Body:**
```json
{
  "error": "string"
}
```

---

### POST /api/UserReport/_getAllReports

**Description:** Retrieves all reports in the system.

**Requirements:**
- None explicitly stated.

**Effects:**
- Returns an array of all report documents.

**Request Body:**
```json
{}
```

**Success Response Body (Query):**
```json
[
  {
    "_id": "string",
    "user": "string",
    "queue": "string",
    "timestamp": "string (ISO 8601)",
    "estimatedPeopleInLine": "number (optional)",
    "currentWaitTime": "number (optional)",
    "entryOutcome": "string ('entered' | 'denied' | 'left') (optional)",
    "validated": "boolean"
  }
]
```

**Error Response Body:**
```json
{
  "error": "string"
}
```

---

# API Specification: VirtualCheckIn Concept

**Purpose:** Enable users to reserve a place in line remotely for supported events.

---

## API Endpoints

### POST /api/VirtualCheckIn/reserveSpot

**Description:** Allows a user to reserve a virtual spot in a queue.

**Requirements:**
- `userID` and `queueID` must exist (external validation, e.g., by a sync's `where` clause).
- The event *must* have enabled virtual check-in (external validation).
- The `userID` must not have an existing 'active' reservation for the given `queueID`.

**Effects:**
- A new `VirtualCheckInRecord` is created.
- `_id` is a fresh `reservationID`.
- `checkInTime` is set to the current time.
- `arrivalWindow` is calculated: For simplicity, it's `[current_time, current_time + 15 minutes]`.
- `status` is set to 'active'.

**Request Body:**
```json
{
  "userID": "string",
  "queueID": "string"
}
```

**Success Response Body (Action):**
```json
{
  "reservationID": "string"
}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```

---

### POST /api/VirtualCheckIn/cancelSpot

**Description:** Allows a user to cancel their existing virtual check-in.

**Requirements:**
- A `reservationID` must exist.
- The reservation must have an 'active' status.

**Effects:**
- The `status` of the specified reservation is updated to 'cancelled'.

**Request Body:**
```json
{
  "reservationID": "string"
}
```

**Success Response Body (Action):**
```json
{}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```

---

### POST /api/VirtualCheckIn/expireReservations

**Description:** Automatically marks active reservations as 'expired' if their arrival window has passed.

**Requirements:**
- The current time is after `arrivalWindow[1]` (the end of the arrival window) for an active reservation.

**Effects:**
- All 'active' reservations whose `arrivalWindow[1]` is in the past are updated to 'expired'.

**Request Body:**
```json
{}
```

**Success Response Body (Action):**
```json
{}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```

---

### POST /api/VirtualCheckIn/_getReservationDetails

**Description:** Retrieves the full details of a specific virtual check-in reservation.

**Requirements:**
- A `reservationID` must exist.

**Effects:**
- Returns the matching `VirtualCheckInRecord`.

**Request Body:**
```json
{
  "reservationID": "string"
}
```

**Success Response Body (Query):**
```json
[
  {
    "reservation": {
      "_id": "string",
      "queueID": "string",
      "userID": "string",
      "checkInTime": "string (ISO 8601)",
      "arrivalWindow": "[string (ISO 8601), string (ISO 8601)]",
      "status": "string ('active' | 'used' | 'cancelled' | 'expired')"
    }
  }
]
```

**Error Response Body:**
```json
{
  "error": "string"
}
```

---

### POST /api/VirtualCheckIn/_getUserActiveReservation

**Description:** Retrieves the active virtual check-in reservation for a specific user in a given queue.

**Requirements:**
- A `userID` and `queueID` must exist.

**Effects:**
- Returns the matching active `VirtualCheckInRecord` if one exists.

**Request Body:**
```json
{
  "userID": "string",
  "queueID": "string"
}
```

**Success Response Body (Query):**
```json
[
  {
    "reservation": {
      "_id": "string",
      "queueID": "string",
      "userID": "string",
      "checkInTime": "string (ISO 8601)",
      "arrivalWindow": "[string (ISO 8601), string (ISO 8601)]",
      "status": "string ('active' | 'used' | 'cancelled' | 'expired')"
    }
  }
]
```

**Error Response Body:**
```json
{
  "error": "string"
}
```

---