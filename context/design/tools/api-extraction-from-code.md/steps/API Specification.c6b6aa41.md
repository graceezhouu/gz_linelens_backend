---
timestamp: 'Mon Oct 20 2025 18:13:41 GMT-0400 (Eastern Daylight Time)'
parent: '[[../20251020_181341.883f246b.md]]'
content_id: c6b6aa41d8447e4627ec8721f3123a38cae15d2c5fd20535c6bfcd24235edbe3
---

# API Specification: VirtualCheckIn Concept

**Purpose:** Enable users to reserve a place in line remotely for supported events.

***

## API Endpoints

### POST /api/VirtualCheckIn/reserveSpot

**Description:** Allows a user to reserve a virtual spot in a queue.

**Requirements:**

* `userID` and `queueID` must exist (external validation, e.g., by a sync's `where` clause).
* The event *must* have enabled virtual check-in (external validation).
* The `userID` must not have an existing 'active' reservation for the given `queueID`.

**Effects:**

* A new `VirtualCheckInRecord` is created.
* `_id` is a fresh `reservationID`.
* `checkInTime` is set to the current time.
* `arrivalWindow` is calculated: For simplicity, it's `[current_time, current_time + 15 minutes]`.
* `status` is set to 'active'.

**Request Body:**

```json
{
  "userID": "string",
  "queueID": "string"
}
```

**Success Response Body (Action):**

```json
{
  "reservationID": "string"
}
```

**Error Response Body:**

```json
{
  "error": "string"
}
```

***

### POST /api/VirtualCheckIn/cancelSpot

**Description:** Allows a user to cancel their existing virtual check-in.

**Requirements:**

* A `reservationID` must exist.
* The reservation must have an 'active' status.

**Effects:**

* The `status` of the specified reservation is updated to 'cancelled'.

**Request Body:**

```json
{
  "reservationID": "string"
}
```

**Success Response Body (Action):**

```json
{}
```

**Error Response Body:**

```json
{
  "error": "string"
}
```

***

### POST /api/VirtualCheckIn/expireReservations

**Description:** Automatically marks active reservations as 'expired' if their arrival window has passed.

**Requirements:**

* The current time is after `arrivalWindow[1]` (the end of the arrival window) for an active reservation.

**Effects:**

* All 'active' reservations whose `arrivalWindow[1]` is in the past are updated to 'expired'.

**Request Body:**

```json
{}
```

**Success Response Body (Action):**

```json
{}
```

**Error Response Body:**

```json
{
  "error": "string"
}
```

***

### POST /api/VirtualCheckIn/\_getReservationDetails

**Description:** Retrieves the full details of a specific virtual check-in reservation.

**Requirements:**

* A `reservationID` must exist.

**Effects:**

* Returns the matching `VirtualCheckInRecord`.

**Request Body:**

```json
{
  "reservationID": "string"
}
```

**Success Response Body (Query):**

```json
[
  {
    "reservation": {
      "_id": "string",
      "queueID": "string",
      "userID": "string",
      "checkInTime": "string (ISO 8601)",
      "arrivalWindow": "[string (ISO 8601), string (ISO 8601)]",
      "status": "string ('active' | 'used' | 'cancelled' | 'expired')"
    }
  }
]
```

**Error Response Body:**

```json
{
  "error": "string"
}
```

***

### POST /api/VirtualCheckIn/\_getUserActiveReservation

**Description:** Retrieves the active virtual check-in reservation for a specific user in a given queue.

**Requirements:**

* A `userID` and `queueID` must exist.

**Effects:**

* Returns the matching active `VirtualCheckInRecord` if one exists.

**Request Body:**

```json
{
  "userID": "string",
  "queueID": "string"
}
```

**Success Response Body (Query):**

```json
[
  {
    "reservation": {
      "_id": "string",
      "queueID": "string",
      "userID": "string",
      "checkInTime": "string (ISO 8601)",
      "arrivalWindow": "[string (ISO 8601), string (ISO 8601)]",
      "status": "string ('active' | 'used' | 'cancelled' | 'expired')"
    }
  }
]
```

**Error Response Body:**

```json
{
  "error": "string"
}
```

***
