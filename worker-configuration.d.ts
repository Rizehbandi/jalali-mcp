interface Env {
  RATE_LIMITER: DurableObjectNamespace<
    import("./src/rate-limiter").DailyRateLimiter
  >;
  DAILY_TOOL_LIMIT: string;
  ALERT_AT_PERCENT: string;
  ALERT_WEBHOOK_URL?: string;
}
