[@concept-design-overview](../../background/concept-design-overview.md)

[@concept-specifications](../../background/concept-specifications.md)

[@implementing-concepts](../../background/implementing-concepts.md)

# Overall System Synchonizations ALL

| # | Sync                   | From → To                   | Primary Role                                 |
|---|------------------------|-----------------------------|----------------------------------------------|
| 1 | reportToPredict        | UserReport → Prediction     | Keep forecasts current                       |
| 2 | predictToQueue         | Prediction → QueueStatus    | Propagate predictions                        |
| 3 | checkInToQueue         | VirtualCheckIn → QueueStatus| Reflect virtual reservations                 |
| 4 | validatedReportToQueue | UserReport → QueueStatus    | Reflect validated crowd data immediately     |
| 5 | queueDeleteCascade     | QueueStatus → Others        | Maintain lifecycle coherence                 |
| 6 | checkInToPredict       | VirtualCheckIn → Prediction | Incorporate reservation data into forecasts  |
| 7 | predictToValidate      | Prediction → UserReport     | Improve validation accuracy                  |
