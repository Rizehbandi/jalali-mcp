import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpHandler } from "agents/mcp";
import { z } from "zod";
import {
  formatDate,
  gregorianToJalali,
  jalaliToGregorian,
  parseDate,
} from "./calendar";
import { DailyRateLimiter, type LimitResult } from "./rate-limiter";

export { DailyRateLimiter };

const annotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

const outputOptions = {
  separator: z.enum(["-", "/"]).default("/").describe("Output date separator."),
  persian_digits: z.boolean().default(true).describe("Return Persian digits when true."),
};

function result(text: string, data: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text }],
    structuredContent: data,
  };
}

function errorResult(message: string) {
  return {
    isError: true,
    content: [{ type: "text" as const, text: message }],
    structuredContent: { error: message },
  };
}

async function sendOwnerAlert(env: Env, usage: LimitResult): Promise<void> {
  if (!env.ALERT_WEBHOOK_URL) return;
  try {
    await fetch(env.ALERT_WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        event: "jalali_mcp_usage_alert",
        message: `Jalali MCP reached ${usage.count} of ${usage.limit} daily tool calls.`,
        usage,
      }),
    });
  } catch (error) {
    console.error("Owner alert failed", error);
  }
}

async function consumeQuota(env: Env, ctx: ExecutionContext): Promise<LimitResult> {
  const limit = Math.max(1, Number.parseInt(env.DAILY_TOOL_LIMIT || "80000", 10));
  const alertPercent = Math.min(
    99,
    Math.max(1, Number.parseInt(env.ALERT_AT_PERCENT || "80", 10)),
  );
  const usage = await env.RATE_LIMITER.getByName("global").checkAndIncrement(
    limit,
    alertPercent,
  );
  if (usage.alertDue) ctx.waitUntil(sendOwnerAlert(env, usage));
  return usage;
}

function createServer(env: Env, ctx: ExecutionContext) {
  const server = new McpServer(
    { name: "Jalali Calendar", version: "1.0.0" },
    {
      instructions:
        "Convert dates accurately between Gregorian and Jalali calendars. Preserve the user's requested separator and digit style. These tools are read-only.",
    },
  );

  server.registerTool(
    "gregorian_to_jalali",
    {
      title: "Convert Gregorian to Jalali",
      description:
        "Use this when the user wants to convert one Gregorian calendar date to its exact Jalali (Solar Hijri) equivalent.",
      inputSchema: {
        date: z
          .string()
          .describe("Gregorian date in YYYY-MM-DD, YYYY/MM/DD, or YYYY.MM.DD format."),
        ...outputOptions,
      },
      annotations,
    },
    async ({ date, separator, persian_digits }) => {
      const usage = await consumeQuota(env, ctx);
      if (!usage.allowed) {
        return errorResult(
          "ظرفیت رایگان امروز سرویس تکمیل شده است. لطفاً پس از بازنشانی روزانه دوباره تلاش کنید.",
        );
      }
      try {
        const input = parseDate(date);
        const output = gregorianToJalali(input);
        const formatted = formatDate(output, separator, persian_digits);
        return result(formatted, {
          calendar: "jalali",
          date: formatted,
          year: output.year,
          month: output.month,
          day: output.day,
          quota_remaining: usage.remaining,
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : "Invalid date.");
      }
    },
  );

  server.registerTool(
    "jalali_to_gregorian",
    {
      title: "Convert Jalali to Gregorian",
      description:
        "Use this when the user wants to convert one Jalali (Solar Hijri) calendar date to its exact Gregorian equivalent.",
      inputSchema: {
        date: z
          .string()
          .describe("Jalali date in YYYY-MM-DD, YYYY/MM/DD, or YYYY.MM.DD format."),
        ...outputOptions,
      },
      annotations,
    },
    async ({ date, separator, persian_digits }) => {
      const usage = await consumeQuota(env, ctx);
      if (!usage.allowed) {
        return errorResult(
          "ظرفیت رایگان امروز سرویس تکمیل شده است. لطفاً پس از بازنشانی روزانه دوباره تلاش کنید.",
        );
      }
      try {
        const input = parseDate(date);
        const output = jalaliToGregorian(input);
        const formatted = formatDate(output, separator, persian_digits);
        return result(formatted, {
          calendar: "gregorian",
          date: formatted,
          year: output.year,
          month: output.month,
          day: output.day,
          quota_remaining: usage.remaining,
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : "Invalid date.");
      }
    },
  );

  server.registerTool(
    "current_jalali_datetime",
    {
      title: "Get current Jalali date and time",
      description:
        "Use this when the user wants the current date or time expressed in the Jalali calendar for a named time zone.",
      inputSchema: {
        timezone: z
          .string()
          .default("Asia/Tehran")
          .describe("IANA time-zone name, for example Asia/Tehran."),
        ...outputOptions,
      },
      annotations,
    },
    async ({ timezone, separator, persian_digits }) => {
      const usage = await consumeQuota(env, ctx);
      if (!usage.allowed) {
        return errorResult(
          "ظرفیت رایگان امروز سرویس تکمیل شده است. لطفاً پس از بازنشانی روزانه دوباره تلاش کنید.",
        );
      }
      try {
        const parts = new Intl.DateTimeFormat("en-CA", {
          timeZone: timezone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hourCycle: "h23",
        }).formatToParts(new Date());
        const pick = (type: Intl.DateTimeFormatPartTypes) =>
          Number(parts.find((part) => part.type === type)?.value);
        const output = gregorianToJalali({
          year: pick("year"),
          month: pick("month"),
          day: pick("day"),
        });
        const date = formatDate(output, separator, persian_digits);
        const timeLatin = `${String(pick("hour")).padStart(2, "0")}:${String(pick("minute")).padStart(2, "0")}:${String(pick("second")).padStart(2, "0")}`;
        const time = persian_digits
          ? timeLatin.replace(/\d/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]!)
          : timeLatin;
        return result(`${date} ${time}`, {
          calendar: "jalali",
          date,
          time,
          timezone,
          quota_remaining: usage.remaining,
        });
      } catch {
        return errorResult("Invalid IANA time-zone name.");
      }
    },
  );

  return server;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return Response.json({ status: "ok", service: "jalali-mcp", version: "1.0.0" });
    }
    const server = createServer(env, ctx);
    return createMcpHandler(server, { route: "/mcp" })(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
