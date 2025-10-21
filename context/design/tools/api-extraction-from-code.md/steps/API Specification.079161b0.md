---
timestamp: 'Mon Oct 20 2025 18:13:41 GMT-0400 (Eastern Daylight Time)'
parent: '[[../20251020_181341.883f246b.md]]'
content_id: 079161b0b8d6b319b8e6b746e4785873744bf8434108e331289ec394aa4379b6
---

# API Specification: QueueStatus Concept

**Purpose:** Represent the current state of a line at a given event. Aggregate real-time information (crowdsourced and predictive) into a single source of truth about the queue.

***

## API Endpoints

### POST /api/QueueStatus/createQueue

**Description:** Creates a new queue with the given ID and location.

**Requirements:**

* `queueID` must not already exist in the system.

**Effects:**

* A new queue document is created in the database with the provided ID and location.
* `estWaitTime` and `estPplInLine` are initialized to `null` or provided values.
* `virtualCheckInEligible` is set based on the input, defaulting to `false`.
* `lastUpdated` is set to the current timestamp.

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

***

### POST /api/QueueStatus/updateStatus

**Description:** Updates the estimated number of people in line and estimated wait time for a given queue.

**Requirements:**

* `queueID` must exist in the system.

**Effects:**

* The `estPplInLine`, `estWaitTime`, and `lastUpdated` fields for the specified queue are updated.

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

***

### POST /api/QueueStatus/\_viewStatus

**Description:** Retrieves the current status information for a specified queue.

**Requirements:**

* `queueID` must exist.

**Effects:**

* Outputs the current `estPplInLine`, `estWaitTime`, and `lastUpdated` time for the queue. These values may be `null` if insufficient information has been provided.

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

***
