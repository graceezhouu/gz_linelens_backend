---
timestamp: 'Mon Oct 20 2025 18:13:41 GMT-0400 (Eastern Daylight Time)'
parent: '[[../20251020_181341.883f246b.md]]'
content_id: b4aed8695869a0f64bed47b8e863b1c853f8604c52badd2de4842dd3ce140df1
---

# API Specification: UserReport Concept

**Purpose:** Enable users to submit real-time data about queue conditions, which, once validated, can improve prediction accuracy and trustworthiness.

***

## API Endpoints

### POST /api/UserReport/submitReport

**Description:** Creates a new report entity for user-submitted queue conditions.

**Requirements:**

* true (The concept treats `User` and `Queue` as polymorphic identifiers; their existence or verification is handled by syncs involving other concepts.)

**Effects:**

* Creates a new `Report` entity (let's call it `r`) in the concept's state such that: `r.user` := `user`, `r.queue` := `queue`, `r.timestamp` := the current `DateTime`, `r.estimatedPeopleInLine` := `estimatedPeopleInLine`, `r.currentWaitTime` := `currentWaitTime`, `r.entryOutcome` := `entryOutcome`, `r.validated` := `false` and returns `r` (the identifier of the newly created report).

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

***

### POST /api/UserReport/setReportValidationStatus

**Description:** Updates the validation status of a specified report.

**Requirements:**

* The `report` (identified by its `Report` ID) must exist in the concept's state.

**Effects:**

* Updates the `validated` property of the specified `report` such that: `report.validated` := `isValid`. On success, returns an empty dictionary. If the report does not exist, returns an error string.

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

***

### POST /api/UserReport/\_getReport

**Description:** Retrieves the full report document by its ID.

**Requirements:**

* None explicitly stated, but implicit that the `report` must exist to be returned.

**Effects:**

* Returns the full report document if found, otherwise null.

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

***

### POST /api/UserReport/\_getValidatedReportsByQueue

**Description:** Retrieves all validated reports for a given queue.

**Requirements:**

* None explicitly stated.

**Effects:**

* Returns an array of validated report documents for the specified queue.

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

***

### POST /api/UserReport/\_getAllReports

**Description:** Retrieves all reports in the system.

**Requirements:**

* None explicitly stated.

**Effects:**

* Returns an array of all report documents.

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

***
