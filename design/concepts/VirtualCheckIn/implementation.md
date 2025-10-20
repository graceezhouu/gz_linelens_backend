[@concept-design-overview](../../background/concept-design-overview.md)

[@concept-specifications](../../background/concept-specifications.md)

[@implementing-concepts](../../background/implementing-concepts.md)

# concept: VirtualCheckIn

**purpose** Enable users to reserve a place in line remotely for supported events.

**principle** Minimize physical waiting and coordinate arrival times. If a user checks into a queue at a desired time, they will receive an arrival window, minimizing physical waiting and coordinating their arrival. If they do not arrive within their window, their reservation will expire.

**state**

    reservationID: String

    queueID: String

    userID: String

    checkInTime: DateTime

    arrivalWindow: [DateTime, DateTime]

    status: Enum('active', 'used', 'cancelled', 'expired')

**actions**

---

**reserveSpot(userID: String, queueID: String): ReservationID**

  **requires** userID and queueID must exist; the event *must* have enabled virtual check-in.

  **effects** creates a virtual reservation entry, assigns an arrival window based on current queue status

---  
**cancelSpot(reservationID: String): Void**

  **requires** reservation must exist and be active

  **effects** cancels the virtual reservation, freeing capacity for others

---
