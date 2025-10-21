---
timestamp: 'Mon Oct 20 2025 18:13:41 GMT-0400 (Eastern Daylight Time)'
parent: '[[../20251020_181341.883f246b.md]]'
content_id: b704ce52d0af00c851e6d188db4c1bc7884ba2a77f10d30b62308a0788d4ac38
---

# API Specification: Prediction Concept

**Purpose:** Provide users with estimated wait times and entry likelihoods for specific locations, leveraging both historical trends, real-time user-contributed data, and AI predictions.

***

## API Endpoints

### POST /api/Prediction/runPrediction

**Description:** Runs an AI prediction for a specific queue (location) and stores the result.

**Requirements:**

* `queueID` must exist (meaning it's a valid location for which predictions are desired). (This concept assumes `queueID` validity is handled externally or by the AI engine).

**Effects:**

* Generates updated prediction results for wait time and entry likelihood based on historical + live inputs, generates nothing if there is insufficient information.

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

***

### POST /api/Prediction/getForecast

**Description:** Retrieves the most recently available prediction and its `lastRun` timestamp for a specified queue.

**Requirements:**

* `queueID` must exist (meaning a prediction for it has been run and stored).

**Effects:**

* Returns the most recently available prediction and `lastRun`.

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

***

### POST /api/Prediction/cleanOldReports

**Description:** Automatically deletes predictions (forecasts) older than a certain threshold (e.g., 2 hours, 2 days).

**Requirements:**

* true (This action can always be triggered autonomously by the system.)

**Effects:**

* Delete Predictions (forecasts) older than a certain threshold (e.g., 2 hours, 2 days). For this implementation, the threshold is set to 2 days.

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

***
