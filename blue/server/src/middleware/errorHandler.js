export function errorHandler(err, req, res, _next) {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err);

  let status = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
  let message = "Something went wrong on Blue's server. Please try again.";

  if (err.code === "INVALID_MODEL_CONFIGURATION") {
    status = 503;
    message = "Blue is not configured correctly for Gemini. Check the GEMINI_MODEL setting in the server environment.";
  } else if (err.code === "MISSING_API_KEY") {
    status = 503;
    message = "Blue couldn't connect to the AI service. Please check the API configuration (GEMINI_API_KEY).";
  } else if (err.code === "AI_PROVIDER_ERROR" && err.status === 400) {
    status = 400;
    message = "The AI request was invalid. Please rephrase it or remove unsupported attachments and try again.";
  } else if (err.code === "AI_PROVIDER_ERROR" && (err.status === 401 || err.status === 403)) {
    status = err.status;
    message = "Blue could not authenticate with the Gemini API. Please check the API key and Google project permissions.";
  } else if (err.code === "AI_PROVIDER_ERROR" && err.status === 404) {
    status = 404;
    message = "The configured Gemini model or endpoint is unavailable. Please check GEMINI_MODEL and the Google AI Studio configuration.";
  } else if (err.code === "AI_PROVIDER_ERROR" && err.status === 429) {
    status = 429;
    message = err.retryAfterMs
      ? `Blue hit Gemini's rate limit. Please wait about ${(Math.ceil(err.retryAfterMs / 1000))} seconds and try again.`
      : "Blue hit Gemini's rate limit or quota. Please wait a moment and try again later.";
  } else if (err.code === "AI_PROVIDER_ERROR" && err.status >= 500) {
    status = err.status;
    message = `The AI service is temporarily unavailable (HTTP ${err.status}). Please try again shortly.`;
  } else if (err.name === "AbortError" || err.message === "The request was cancelled." || err.message === "Request cancelled.") {
    status = 499;
    message = "The request was cancelled.";
  } else if (err.status === 429) {
    status = 429;
    message = "Blue is receiving too many requests right now. Please wait a moment and try again.";
  } else if (err.message?.includes("timed out")) {
    status = 504;
    message = "That took too long to complete. Please try again or simplify the request.";
  } else if (err.name === "MulterError") {
    status = 400;
    message =
      err.code === "LIMIT_FILE_SIZE"
        ? "That file is too large. Please upload a smaller file."
        : err.message;
  } else if (err.message?.includes("is not supported")) {
    status = 400;
    message = err.message;
  } else if (err.status && err.status < 500) {
    message = err.message;
  }

  res.status(status).json({ error: message });
}

export function notFoundHandler(req, res) {
  res.status(404).json({ error: "Not found." });
}
