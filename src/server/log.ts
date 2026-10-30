import { PinoTransport } from "@loglayer/transport-pino"
import { getPrettyTerminal } from "@loglayer/transport-pretty-terminal"
import { Database } from "bun:sqlite"
import { LogLayer } from "loglayer"
import { pino } from "pino"
import { serializeError } from "serialize-error"

const p = pino({
  level: "trace",

  // Emit "level": "info" instead of "level": 30
  formatters: {
    level: (label) => ({ level: label }),
  },

  // Emit "message" instead of "msg" (Railway normalizes "msg" too,
  // but "message" matches the parsed format exactly)
  messageKey: "message",
})

export const log = new LogLayer({
  errorSerializer: serializeError,
  transport: [
    new PinoTransport({
      enabled: process.env.NODE_ENV !== "development",
      logger: p,
    }),
    getPrettyTerminal({
      database: new Database(":memory:"),
      enabled: process.env.NODE_ENV === "development",
    }),
  ],
})

log.withMetadata({ foo: "bar" }).info("Hello from Pretty Terminal!")
