import {
  decodeAsync as decodeAsyncMsgpack,
  decode as decodeMsgpack,
} from "@msgpack/msgpack"
import Elysia, { ParseError } from "elysia"

/*
{
  identifier: "f0463ee4-7294-48a2-a1e8-e4b54d6ef7e6",
  cypher: "none",
  data: {
    NetworkManagerConfiguration: {
      interface: "wlan0",
    },
  },
}
*/

class SignatureMismatchError extends Error {
  status = 403

  constructor(public message: string) {
    super(message)
  }

  toResponse() {
    return Response.json(
      {
        error: this.message,
        code: this.status,
      },
      {
        status: this.status,
      }
    )
  }
}

interface PluginOptions {
  keyResolver?: (ctx: {
    identifier: string
    cypher: string
  }) => Promise<Uint8Array>
}

export const contentTypeBlehaj = (options?: PluginOptions) =>
  new Elysia()
    .state("plugin-version", 1)
    .error({ 403: SignatureMismatchError })
    .onError(({ error }) => {
      if (
        error instanceof ParseError &&
        error.cause instanceof SignatureMismatchError
      ) {
        return error.cause.toResponse()
      }
      throw error
    })
    .parser("blehaj", async (ctx) => {
      if (ctx.contentType === "application/blehaj") return parseBlehaj(ctx)
    })
    .onParse({ as: "global" }, async (ctx) => {
      if (ctx.contentType === "application/blehaj") return parseBlehaj(ctx)
    })

export default contentTypeBlehaj

async function parseBlehaj({ request }: { request: Request }) {
  interface Request {
    NetworkManagerConfiguration: { interface: string }
  }

  interface Envelope {
    identifier: string
    cypher: string
    request: Partial<Request>
  }

  interface SignedPayload {
    signature: string
    payload: Uint8Array
  }

  return decodeAsyncMsgpack(request.body!)
    .then((decoded) => decoded as SignedPayload)
    .then((signedEnvelope) => {
      const envelope = decodeMsgpack(signedEnvelope.payload) as Envelope

      if (signedEnvelope.signature) {
        const sig_bytes = Uint8Array.fromHex(signedEnvelope.signature)

        // Todo - This would fetch from the database using 'identifier'
        const todoFetchFromDatabaseOrWhatever = Promise.resolve(
          Uint8Array.fromHex(
            "731e93151e81e645fd6ba7642c57d7551d9fb5d167f796e039727c97e1f1a70f"
          )
        )

        return todoFetchFromDatabaseOrWhatever
          .then((key_bytes) =>
            crypto.subtle.importKey(
              "raw",
              key_bytes,
              { name: "Ed25519" },
              false,
              ["verify"]
            )
          )
          .then((key) =>
            crypto.subtle.verify(
              { name: "Ed25519" },
              key,
              sig_bytes,
              Buffer.from(signedEnvelope.payload)
            )
          )
          .then((matched) => {
            if (!matched) {
              throw new SignatureMismatchError("Signature mismatch")
            }

            return envelope
          })
      } else {
        return envelope
      }
    })
}
