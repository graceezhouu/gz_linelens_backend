[@concept-design-overview](../../background/concept-design-overview.md)

[@concept-specifications](../../background/concept-specifications.md)

[@implementing-concepts](../../background/implementing-concepts.md)

# Concept QueueStatus

**Concept:** QueueStatus

**Purpose:** Represent the current state of a line at a given event.

**Purpose:** Aggregate real-time information (crowdsourced and predictive) into a single source of truth about the queue.

**State:**

A set of queues with

    queueID: String

    location: GeoCoordinate | String

    estWaitTime: Number | Null //in minutes

    estPplInLine: Number | Null

    virtualCheckInEligible: Boolean

    lastUpdated: DateTime

**Actions:**

---------------

**createQueue(queueID: String, location: GeoCoordinate | String):**

  **requires** queueID must not already exist in the system
  
  **effect** creates a new queue with the given ID and location, initializing estWaitTime and estPplInLine to null or values provided, virtualCheckInEligible is set to True the queue was created by an event organizer and they enabled the feature

  -------------

**updateStatus(queueID: String, estPplInLine: Number, estWaitTime: Number): Void**

  **requires** queueID must exist aka the event must exist in the system

  **effect** generates a best-effort estimated wait time based on historical data and current inputs

 -------------

**viewStatus(queueID: String): (estPplInLine: Number, estWaitTime: Number, lastUpdated: DateTime)**

  **requires** queueID must exist

  **effect** outputs any current information, including the number of people in line, the estimated wait time, and the last updated time (these values may be null if there is insufficient information)

-------------
