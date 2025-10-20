---
timestamp: 'Sun Oct 19 2025 22:42:58 GMT-0400 (Eastern Daylight Time)'
parent: '[[../20251019_224258.4eb62b49.md]]'
content_id: 8439f4b6f983f79b010ee0de40d9ac0ee68a54d2c5e3117fdc4f2cd8aa633b76
---

# concept: Prediction \[Location, User]

**Purpose** Provide users with estimated wait times and entry likelihoods for specific locations, leveraging both historical trends, real-time user-contributed data, and AI predictions.

**Principle** Combines user reports about queue status and LLM natural-language interpretation
to produce structured predictions and user-facing summaries. If users at a location submit reports about their current experience (e.g., wait time, crowd level), then the system will quickly update its forecasts for that location, combining these live inputs with historical trends, making the predictions more accurate and useful for all interested users.

**state**

```
modelID: String

modelType: Enum('regression', 'bayesian', 'neural')

accuracyThreshold: Number  // e.g., 0.85 

predictionResult: {

  queueID: String

  estWaitTime: Number

  entryProbability: Number

  confidenceInterval: [Number, Number]
  
} | Null

lastRun: DateTime
```

**actions**

**runPrediction(queueID: String, modelID: String): predictionResult**
**requires** queueID must exist
**effects** generates updated prediction results for wait time and entry likelihood based on historical + live inputs, generates nothing if there is insufficient information

**getForecast(queueID: String): predictionResult**
**requires** queueID must exist
**effects** returns the most recently available prediction and lastRun

**system cleanOldReports (): Empty**
**requires** true // This action can always be triggered
**effects** delete Predictions older than a certain threshold (e.g., 2 hours, 2 days)

**Notes**:

* Prediction is not an independent data store but a service built on top of UserReport and QueueStatus.
* Prediction pulls from `UserReport` through a **sync**, not a redundant data store.
