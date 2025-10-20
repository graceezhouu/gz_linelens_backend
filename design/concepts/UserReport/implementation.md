[@concept-design-overview](../../background/concept-design-overview.md)

[@concept-specifications](../../background/concept-specifications.md)

[@implementing-concepts](../../background/implementing-concepts.md)

[@all-syncs](../../background/all-syncs.md)


# instructions: Given the backend code of the concept UserReport below as well as the written concept itself, implement tests. Reminder that tests should include a successful and legible test execution that corresponds to the operational principle and 3–5 test executions that explore variants, covering all the actions and some interesting cases.

# Concept UserReport

**concept** UserReport \[User, Queue\]

**purpose** Enable users to submit real-time data about queue conditions, which, once validated, can improve prediction accuracy and trustworthiness.

**principle** If a user submits a report about a queue's condition, and that report is later processed and marked as validated, then the system's queue predictions will be updated to reflect the most accurate real-time data, thus fulfilling the goal of improving prediction accuracy.

**state**

a set of Reports with

    id: Report // The unique identifier for this specific report

    user: User // Reference to the user who submitted the report (generic type)

    queue: Queue // Reference to the queue the report is about (generic type)

    timestamp: DateTime // When the report was submitted

    estimatedPeopleInLine: Optional Number // User's estimate of people in line

    currentWaitTime: Optional Number // User's reported current wait time

    entryOutcome: Optional Enum ('entered', 'denied', 'left') // User's outcome after queueing
    
    validated: Boolean = false // True if the report has been confirmed as accurate

**actions**

---

**submitReport (user: User, queue: Queue, estimatedPeopleInLine: Optional Number, currentWaitTime: Optional Number, entryOutcome: Optional Enum('entered', 'denied', 'left')): (report: Report)**

**requires** true // The concept treats `User` and `Queue` as polymorphic identifiers; their existence or verification is handled by syncs involving other concepts.

**effects** creates a new `Report` entity (let's call it `r`) in the concept's state such that:

    `r.user` := `user`

    `r.queue` := `queue`

    `r.timestamp` := the current `DateTime`

    `r.estimatedPeopleInLine` := `estimatedPeopleInLine`

    `r.currentWaitTime` := `currentWaitTime`

    `r.entryOutcome` := `entryOutcome`

    `r.validated` := `false`

and returns `r` (the identifier of the newly created report)

---

**setReportValidationStatus (report: Report, isValid: Boolean): Empty**
**setReportValidationStatus (report: Report, isValid: Boolean): (error: String)**

**requires** the `report` (identified by its `Report` ID) must exist in the concept's state.

**effects** updates the `validated` property of the specified `report` such that:
  `report.validated` := `isValid`
On success, returns an empty dictionary. If the report does not exist, returns an error string.

---
