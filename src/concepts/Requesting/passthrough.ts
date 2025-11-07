/**
 * The Requesting concept exposes passthrough routes by default,
 * which allow POSTs to the route:
 *
 * /{REQUESTING_BASE_URL}/{Concept name}/{action or query}
 *
 * to passthrough directly to the concept action or query.
 * This is a convenient and natural way to expose concepts to
 * the world, but should only be done intentionally for public
 * actions and queries.
 *
 * This file allows you to explicitly set inclusions and exclusions
 * for passthrough routes:
 * - inclusions: those that you can justify their inclusion
 * - exclusions: those to exclude, using Requesting routes instead
 */

/**
 * INCLUSIONS
 *
 * Each inclusion must include a justification for why you think
 * the passthrough is appropriate (e.g. public query).
 *
 * inclusions = {"route": "justification"}
 */

export const inclusions: Record<string, string> = {
  // Feel free to delete these example inclusions
  // "/api/LikertSurvey/_getSurveyQuestions": "this is a public query",
  // "/api/LikertSurvey/_getSurveyResponses": "responses are public",
  // "/api/LikertSurvey/_getRespondentAnswers": "answers are visible",
  // "/api/LikertSurvey/submitResponse": "allow anyone to submit response",
  // "/api/LikertSurvey/updateResponse": "allow anyone to update their response",

  "/api/QueueStatus/_getAllQueues": "public query to view all queues",
  "/api/QueueStatus/createQueue": "public action to create a new queue",
  "/api/QueueStatus/_viewStatus": "public query to view queue status",
  "/api/QueueStatus/updateStatus": "public action to update queue status",

  "/api/Prediction/runPrediction": "public action to run predictions",
  "/api/Prediction/getForecast": "public action to get forecast",
  "/api/Prediction/cleanOldReports": "public action to clean old reports",

  "/api/Requesting/request": "core Requesting action for passthrough",
  "/api/Requesting/respond": "core Requesting action for passthrough",
  "/api/Requesting/_awaitResponse": "core Requesting query for passthrough",

  "/api/UserReport/submitReport": "public action to submit user report",
  "/api/UserReport/setReportValidationStatus":
    "public action to set report validation status",
  "/api/UserReport/_getReport": "public action to get user report",
  "/api/UserReport/_getValidatedReportsByQueue":
    "public action to get validated reports by queue",
  "/api/UserReport/_getAllReports": "public action to get all user reports",

  "/api/VirtualCheckIn/reserveSpot":
    "public action to reserve a virtual spot in line",
  "/api/VirtualCheckIn/cancelSpot":
    "public action to cancel a virtual spot in line",
  "/api/VirtualCheckIn/expireReservations":
    "public action to expire old reservations",
  "/api/VirtualCheckIn/_getReservationDetails":
    "public query to get reservation details",
  "/api/VirtualCheckIn/_getUserActiveReservation":
    "public query to get user's active reservations",
};

/**
 * EXCLUSIONS
 *
 * Excluded routes fall back to the Requesting concept, and will
 * instead trigger the normal Requesting.request action. As this
 * is the intended behavior, no justification is necessary.
 *
 * exclusions = ["route"]
 */

export const exclusions: Array<string> = [
  // Feel free to delete these example exclusions
  "/api/LikertSurvey/createSurvey",
  "/api/LikertSurvey/addQuestion",
];
