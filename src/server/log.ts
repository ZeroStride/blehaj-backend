import {
  getSimplePrettyTerminal,
  moonlight,
} from "@loglayer/transport-simple-pretty-terminal"
import { LogLayer, StructuredTransport } from "loglayer"
import { serializeError } from "serialize-error"

export const log =
  process.env.NODE_ENV === "production"
    ? new LogLayer({
        transport: new StructuredTransport({
          logger: console,
        }),
      })
    : new LogLayer({
        errorSerializer: serializeError,
        transport: getSimplePrettyTerminal({
          runtime: "node",
          theme: moonlight,
        }),
      })
