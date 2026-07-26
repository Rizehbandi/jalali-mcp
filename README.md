# Jalali MCP

A public, read-only Remote MCP server that converts dates between Gregorian and
Jalali (Solar Hijri) calendars. It is designed for Cloudflare Workers and can be
connected directly to ChatGPT, Codex, MCP Inspector, and other MCP clients.

## Tools

- `gregorian_to_jalali`
- `jalali_to_gregorian`
- `current_jalali_datetime`

Inputs accept Latin, Persian, and Arabic-Indic digits in `YYYY-MM-DD`,
`YYYY/MM/DD`, or `YYYY.MM.DD` form. Outputs can use Latin or Persian digits.

## Architecture

This is a tool-only, stateless MCP server. A fresh MCP server instance is
created for every HTTP request, as required by MCP SDK 1.26+ security guidance.
A Durable Object counts daily tool calls globally and enables a configurable
soft limit before Cloudflare's hard free-plan request limit.

The default soft limit is 80,000 tool calls per UTC day. This is deliberately
below Cloudflare's request ceiling because one MCP interaction can use more than
one HTTP request.

## Local development

```bash
npm install
npm run check
npm run dev
```

The endpoints are:

- MCP: `http://localhost:8787/mcp`
- Health: `http://localhost:8787/health`

Run MCP Inspector:

```bash
npx @modelcontextprotocol/inspector@latest
```

Select **Streamable HTTP** and connect to `http://localhost:8787/mcp`.

## Deploy to Cloudflare

1. Create a free Cloudflare account.
2. Authenticate Wrangler:

   ```bash
   npx wrangler login
   ```

3. Deploy:

   ```bash
   npm run deploy
   ```

4. Copy the resulting URL and append `/mcp`.

Alternatively, import this GitHub repository from the Cloudflare Workers
dashboard. Cloudflare can then deploy every push to `main` automatically.

### Optional owner alert

Set a secret webhook URL. The service sends one JSON POST per UTC day when the
configured warning percentage is reached.

```bash
npx wrangler secret put ALERT_WEBHOOK_URL
```

The webhook receives:

```json
{
  "event": "jalali_mcp_usage_alert",
  "message": "Jalali MCP reached 64000 of 80000 daily tool calls.",
  "usage": {}
}
```

`DAILY_TOOL_LIMIT` and `ALERT_AT_PERCENT` are configured in `wrangler.jsonc`.
Never commit webhook URLs or other secrets.

## Connect to ChatGPT

1. Deploy the Worker to obtain a public HTTPS URL.
2. In ChatGPT, enable Developer Mode under **Settings → Security and login**.
3. Open **Settings → Plugins**, select **+**, and enter the complete public URL
   ending in `/mcp`.
4. Review the three discovered read-only tools and create the connection.
5. After changing tool metadata, deploy and refresh the connection in ChatGPT.

Developer Mode availability can depend on account and workspace policy.

## Example prompts

- Convert `2026-07-26` to Jalali.
- تاریخ ۱۴۰۵/۰۵/۰۴ را به میلادی تبدیل کن.
- What is the current Jalali date in Asia/Tehran?

## Security and privacy

- All tools are read-only and idempotent.
- Inputs are validated before conversion.
- No dates or user data are stored.
- No credential is logged or returned.
- The public version has no user identity. Per-user quotas require OAuth and
  should not be approximated by IP because ChatGPT requests may share egress IPs.
- Cloudflare secrets are used for the optional alert webhook.

## References

- [OpenAI: Build an MCP server](https://developers.openai.com/plugins/build/mcp-server)
- [OpenAI: Connect and test your plugin](https://developers.openai.com/plugins/deploy/connect-chatgpt)
- [Cloudflare: Build a Remote MCP server](https://developers.cloudflare.com/agents/model-context-protocol/guides/remote-mcp-server/)
- [Cloudflare: Stateless MCP handler](https://developers.cloudflare.com/agents/model-context-protocol/apis/handler-api/)

## License

MIT
