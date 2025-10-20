# Console Output from Execution of PredictionConcept.test

running 1 test from ./src/concepts/Prediction/PredictionConcept.test.ts

PredictionConcept ...

------- post-test output -------

[Test Setup] Initialized mock database

----- post-test output end -----

  should fulfill its principle: update forecasts based on inputs and retrieve them ...

------- post-test output -------

[MockCollection] createIndex called with keys: { queueID: 1 } options: { unique: true }

[Test Setup] PredictionConcept initialized for a new test.

--- Principle Test: location:principle_cafe ---

[PredictionConcept] Attempting to run prediction for queue: location:principle_cafe

[AIPredictionEngine] Running prediction for queue: location:principle_cafe with model: 

default_prediction_model_v1

[AIPredictionEngine] Prediction for location:principle_cafe: {

  estWaitTime: 17,

  entryProbability: 0.86,

  confidenceInterval: [ 12, 27 ]

}
[PredictionConcept] Stored/updated prediction for queue: location:principle_cafe

[Principle Test] First runPrediction result: {

  queueID: "location:principle_cafe",

  estWaitTime: 17,

  entryProbability: 0.86,

  confidenceInterval: [ 12, 27 ]

}

[PredictionConcept] Getting forecast for queue: location:principle_cafe

[Principle Test] First getForecast result: {

  queueID: "location:principle_cafe",

  estWaitTime: 17,

  entryProbability: 0.86,

  confidenceInterval: [ 12, 27 ],

  lastRun: 2025-10-19T21:36:37.841Z

}

[Principle Test] First run time: 2025-10-19T21:36:37.841Z

[PredictionConcept] Attempting to run prediction for queue: location:principle_cafe

[AIPredictionEngine] Running prediction for queue: location:principle_cafe with model:

default_prediction_model_v1

[AIPredictionEngine] Prediction for location:principle_cafe: {

  estWaitTime: 24,

  entryProbability: 0.81,

  confidenceInterval: [ 19, 34 ]

}

[PredictionConcept] Stored/updated prediction for queue: location:principle_cafe

[Principle Test] Second runPrediction result: {

  queueID: "location:principle_cafe",

  estWaitTime: 24,

  entryProbability: 0.81,

  confidenceInterval: [ 19, 34 ]

}

[PredictionConcept] Getting forecast for queue: location:principle_cafe

[Principle Test] Second getForecast result: {

  queueID: "location:principle_cafe",

  estWaitTime: 24,

  entryProbability: 0.81,

  confidenceInterval: [ 19, 34 ],

  lastRun: 2025-10-19T21:36:38.345Z

}

[Principle Test] Second run time: 2025-10-19T21:36:38.345Z

--- Principle Test Passed ---

----- post-test output end -----

  should fulfill its principle: update forecasts based on inputs and retrieve them ... ok (942ms)

  should return error for runPrediction if AI engine reports insufficient data ...

------- post-test output -------

[MockCollection] createIndex called with keys: { queueID: 1 } options: { unique: true }

[Test Setup] PredictionConcept initialized for a new test.

--- Variant Test: Insufficient Data for queue:insufficient_data ---

[PredictionConcept] Attempting to run prediction for queue: queue:insufficient_data

[AIPredictionEngine] Running prediction for queue: queue:insufficient_data with model: 

default_prediction_model_v1

[AIPredictionEngine] Insufficient data for prediction for queue: queue:insufficient_data

[PredictionConcept] Insufficient information for prediction for queue: queue:insufficient_data. No forecast stored.

[Insufficient Data Test] runPrediction result: {

  error: "Insufficient information to generate a prediction for queue 'queue:insufficient_data'."

}

--- Insufficient Data Test Passed ---

----- post-test output end -----

  should return error for runPrediction if AI engine reports insufficient data ... ok (479ms)

  should return error for getForecast if no prediction exists for the queue ...

------- post-test output -------

[MockCollection] createIndex called with keys: { queueID: 1 } options: { unique: true }

[Test Setup] PredictionConcept initialized for a new test.


--- Variant Test: Get Forecast for Non-Existent Queue location:non_existent_queue ---

[PredictionConcept] Getting forecast for queue: location:non_existent_queue

[Non-Existent Queue Test] getForecast result: { error: "No forecast found for queue 
'location:non_existent_queue'." }

--- Non-Existent Queue Test Passed ---

----- post-test output end -----

  should return error for getForecast if no prediction exists for the queue ... ok (0ms)

  should successfully clean old predictions but keep recent ones ...

------- post-test output -------

[MockCollection] createIndex called with keys: { queueID: 1 } options: { unique: true }

[Test Setup] PredictionConcept initialized for a new test.


--- Variant Test: Clean Old Reports ---

[PredictionConcept] Attempting to run prediction for queue: location:old_report_queue

[AIPredictionEngine] Running prediction for queue: location:old_report_queue with model: 

default_prediction_model_v1

[AIPredictionEngine] Prediction for location:old_report_queue: {

  estWaitTime: 28,

  entryProbability: 0.86,

  confidenceInterval: [ 23, 38 ]

}
[PredictionConcept] Stored/updated prediction for queue: location:old_report_queue

[Clean Reports Test] Manually set oldPredictionDoc lastRun for location:old_report_queue to: 2025-10-16T21:36:39.295Z

[PredictionConcept] Attempting to run prediction for queue: location:recent_report_queue

[AIPredictionEngine] Running prediction for queue: location:recent_report_queue with model: 

default_prediction_model_v1

[AIPredictionEngine] Prediction for location:recent_report_queue: {

  estWaitTime: 21,

  entryProbability: 0.84,

  confidenceInterval: [ 16, 31 ]

}
[PredictionConcept] Stored/updated prediction for queue: location:recent_report_queue

[Clean Reports Test] Created recentPredictionDoc for location:recent_report_queue with lastRun:
 
2025-10-19T21:36:39.775Z

[Clean Reports Test] Running cleanOldReports action.

[PredictionConcept] Initiating cleanup of old predictions.

[PredictionConcept] Deleted 1 old predictions.

[Clean Reports Test] cleanOldReports result: {}

[Clean Reports Test] Verified old prediction for location:old_report_queue is deleted.

[Clean Reports Test] Verified recent prediction for location:recent_report_queue is still present.

--- Clean Old Reports Test Passed ---

----- post-test output end -----

  should successfully clean old predictions but keep recent ones ... ok (948ms)

  should handle invalid modelID in runPrediction gracefully (default to concept's model) ...

------- post-test output -------

[MockCollection] createIndex called with keys: { queueID: 1 } options: { unique: true }

[Test Setup] PredictionConcept initialized for a new test.

--- Variant Test: Invalid Model ID in runPrediction for location:invalid_model_test ---

[Invalid Model ID Test] Attempting runPrediction with invalid modelID: 'non_existent_model'

[PredictionConcept] Mismatch: runPrediction called with modelID 'non_existent_model' but concept configured with 'default_prediction_model_v1'. Proceeding with configured model.

[PredictionConcept] Attempting to run prediction for queue: location:invalid_model_test

[AIPredictionEngine] Running prediction for queue: location:invalid_model_test with model: 

default_prediction_model_v1

[AIPredictionEngine] Prediction for location:invalid_model_test: {

  estWaitTime: 17,

  entryProbability: 0.86,

  confidenceInterval: [ 12, 27 ]

}

[PredictionConcept] Stored/updated prediction for queue: location:invalid_model_test

[Invalid Model ID Test] runPrediction result with invalid modelID: {

  queueID: "location:invalid_model_test",

  estWaitTime: 17,

  entryProbability: 0.86,

  confidenceInterval: [ 12, 27 ]

}
--- Invalid Model ID Test Passed ---

----- post-test output end -----

  should handle invalid modelID in runPrediction gracefully (default to concept's model) ... ok (480ms)

------- post-test output -------

[Test Teardown] Cleared mock database

----- post-test output end -----

PredictionConcept ... ok (2s)