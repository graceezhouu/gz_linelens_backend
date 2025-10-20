[@concept-design-overview](../../background/concept-design-overview.md)

[@concept-specifications](../../background/concept-specifications.md)

[@implementing-concepts](../../background/implementing-concepts.md)

[@implementation](../../concepts/UserReport/implementation.md)

# Design for UserReport

The `UserReport` concept exemplifies core concept design principles:

1.  **Modularity & Independence**: It's a self-contained unit focused solely on the lifecycle of user-submitted reports. It uses generic type parameters (`User`, `Queue`) to represent external entities polymorphically, meaning it doesn't assume anything about their internal structure or properties. 

2.  **Separation of Concerns**: The concept's state (`Reports`) and actions are strictly limited to managing user report data (timestamp, estimated values, outcome, validation status). 

3.  **Completeness of Functionality**: Within its specific concern (user reporting), it provides all necessary actions (`submitReport`, `setReportValidationStatus`) to manage its internal state. It doesn't rely on external calls for its core operations.
4.  **Composition by Synchronization**: The `submitReport` action's `requires true` condition is a deliberate choice reflecting independence. The concept simply records a report; whether the `User` or `Queue` actually exist or are valid is handled *externally* by syncs (e.g., `validatedReportToQueue`, `reportToPredict`) that integrate this concept with others, rather than having `UserReport` directly depend on them. The `validated` flag in the state is key to enabling these selective syncs, ensuring only trusted data propagates.