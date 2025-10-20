---
timestamp: 'Sun Oct 19 2025 22:12:42 GMT-0400 (Eastern Daylight Time)'
parent: '[[../20251019_221242.80c68994.md]]'
content_id: d4f2ace0dbdc617316863307ff60da5d40146e40a9eaab5986e56d8357a61849
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

**actions**

***

**reserveSpot(userID: String, queueID: String): ReservationID**

**requires** userID and queueID must exist; the event *must* have enabled virtual check-in.

**effects** creates a virtual reservation entry, assigns an arrival window based on current queue status

***

**cancelSpot(reservationID: String): Void**

**requires** reservation must exist and be active

**effects** cancels the virtual reservation, freeing capacity for others

***
