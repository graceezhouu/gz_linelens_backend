---
timestamp: 'Sun Oct 19 2025 10:33:17 GMT-0400 (Eastern Daylight Time)'
parent: '[[../20251019_103317.05563a20.md]]'
content_id: 0f5e56a6d51a61d4afad20d8d71f7eef6160f90ce45b5cfc28fcd07ed10a23ec
---

# concept: VirtualCheckIn

**purpose** Enable users to reserve a place in line remotely for supported events.

**principle** Minimize physical waiting and coordinate arrival times. If a user checks into a queue at a desired time, they will receive an arrival window, minimizing physical waiting and coordinating their arrival. If they do not arrive within their window, their reservation will expire.

**state**

```
reservationID: String

queueID: String

userID: String

checkInTime: DateTime

arrivalWindow: [DateTime, DateTime]

status: Enum('active', 'used', 'cancelled', 'expired')
```

## **actions**

**reserveSpot(userID: String, queueID: String): ReservationID**

**requires** userID and queueID must exist; the event *must* have enabled virtual check-in. The user must not have an existing active reservation for this queue.

**effects** creates a virtual reservation entry, assigns an arrival window based on current queue status.

***

**cancelSpot(reservationID: String): Void**

**requires** reservation must exist and be active

**effects** cancels the virtual reservation, freeing capacity for others

***
