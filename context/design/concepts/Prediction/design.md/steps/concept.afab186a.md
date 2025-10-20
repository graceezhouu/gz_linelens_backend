---
timestamp: 'Sun Oct 19 2025 22:47:36 GMT-0400 (Eastern Daylight Time)'
parent: '[[../20251019_224736.e888e96e.md]]'
content_id: afab186a6d04c2063db8d730f6bd47d1ce210b94a845c729629ddae0fa646b43
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

The `Prediction` concept is designed to embody the core tenets of concept design, particularly emphasizing **separation of concerns**, **independence**, and **reusability**, while providing **complete functionality** for its specific purpose.

**Based on feedback from Assigment 2**:

* Prediction is not an independent data store but a service built on top of UserReport and QueueStatus.

* Prediction pulls from `UserReport` through a **sync**, not a redundant data store.

* **Specific, Need-Focused Purpose**:
  * **Design Choice**: The purpose "Provide users with estimated wait times and entry likelihoods for specific locations, leveraging both historical trends, real-time user-contributed data, and AI predictions" is highly specific and directly addresses a user need.
  * **Reasoning**: This adheres to the "Need-focused" criterion for purposes. It defines a tangible benefit for the user (knowing wait times/entry likelihood) and sets clear boundaries for what the concept should achieve. It's not vague (e.g., "improve user experience") nor overly technical (e.g., "execute a machine learning model").

* **Independence through Generic Type Parameters**:
  * **Design Choice**: `concept Prediction [Location, User]` uses `Location` and `User` as generic type parameters.
  * **Reasoning**: This is a direct application of the **Concept Independence** principle and polymorphism. The `Prediction` concept does not need to know the internal structure or properties of a `Location` or `User`. It only needs their identities (`ID`s). This makes the `Prediction` concept highly reusable. For example, it could be used for predicting wait times at a restaurant (`RestaurantLocation`, `CustomerUser`), a clinic (`ClinicLocation`, `PatientUser`), or a tourist attraction (`AttractionLocation`, `VisitorUser`) without modification. Other concepts (like `LocationProfile` or `UserAuthentication`) would define these `Location` and `User` types and their properties, but `Prediction` remains oblivious to those details.

* **Rigorous Separation of Concerns**:
  * **Design Choice**: The concept's state and actions are focused solely on the generation, storage, and retrieval of *predictions*.
  * **Reasoning**: This aligns with the "Improved separation of concerns" advantage. The `Prediction` concept is not responsible for collecting user reports, managing queues, or authenticating users. Its `state` reflects prediction parameters (`modelID`, `accuracyThreshold`) and results (`predictionResult`, `lastRun`), but not the raw data inputs. This avoids conflating responsibilities, for instance, a `UserReport` concept would handle receiving and storing user-submitted data, and a `QueueStatus` concept might manage real-time queue data.

* **Composition by Synchronization, Not Direct Dependency**:
  * **Design Choice**: Prediction pulls from `UserReport` through a **sync**, not a redundant data store."
  * **Reasoning**: This is a critical design choice for achieving **Concept Independence** and **Completeness of functionality**. The `Prediction` concept *relies* on data from `UserReport` and `QueueStatus` but does not directly import or call methods from those concepts. Instead, the application's overall orchestration layer will use `syncs` to trigger `runPrediction` when new `UserReport` or `QueueStatus` data becomes available. This ensures `Prediction` remains a self-contained unit concerning *prediction logic*, even as it participates in a larger application workflow. It prevents circular dependencies and promotes true modularity.

* **Complete Functionality for its Concern**:
  * **Design Choice**: The actions `runPrediction`, `getForecast`, and `system cleanOldReports` cover the full lifecycle of a prediction within this concept.
  * **Reasoning**: The concept is "complete" for the *prediction* concern. It defines how predictions are generated (`runPrediction`), how they are accessed (`getForecast`), and how their underlying data is managed (`cleanOldReports`). It doesn't offload parts of the prediction process to other concepts. For example, the `runPrediction` action implicitly includes the logic for combining inputs, using models, and determining the `predictionResult`.
