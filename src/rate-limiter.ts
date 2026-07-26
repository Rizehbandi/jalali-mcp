import { DurableObject } from "cloudflare:workers";

export type LimitResult = {
  allowed: boolean;
  count: number;
  limit: number;
  remaining: number;
  dateUtc: string;
  alertDue: boolean;
};

export class DailyRateLimiter extends DurableObject<Env> {
  async checkAndIncrement(limit: number, alertPercent: number): Promise<LimitResult> {
    const dateUtc = new Date().toISOString().slice(0, 10);
    const storedDate = await this.ctx.storage.get<string>("dateUtc");
    let count = storedDate === dateUtc ? ((await this.ctx.storage.get<number>("count")) ?? 0) : 0;
    let alertSent = storedDate === dateUtc && ((await this.ctx.storage.get<boolean>("alertSent")) ?? false);

    if (storedDate !== dateUtc) {
      await this.ctx.storage.put({ dateUtc, count: 0, alertSent: false });
    }

    if (count >= limit) {
      return { allowed: false, count, limit, remaining: 0, dateUtc, alertDue: false };
    }

    count += 1;
    await this.ctx.storage.put("count", count);
    const threshold = Math.ceil((limit * alertPercent) / 100);
    const alertDue = !alertSent && count >= threshold;
    if (alertDue) {
      alertSent = true;
      await this.ctx.storage.put("alertSent", alertSent);
    }

    return {
      allowed: true,
      count,
      limit,
      remaining: Math.max(0, limit - count),
      dateUtc,
      alertDue,
    };
  }
}
