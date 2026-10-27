import { decode as decodeMsgpack } from "@msgpack/msgpack"
import Elysia, { ParseError } from "elysia"

export interface PluginOptions {
  keyResolver?: (ctx: {
    identifier: string
    cypher: string
  }) => Promise<BufferSource>
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
    .parser("blehaj", async (ctx) => parseBlehaj(ctx, options || {}))
    .onParse(async (ctx) => {
      console.log("onParse")
      if (ctx.contentType === "application/blehaj")
        return parseBlehaj(ctx, options || {})
    })
    .as("global")

export default contentTypeBlehaj

async function parseBlehaj(
  { request }: { request: Request },
  { keyResolver }: PluginOptions
) {
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

  const bodyAsArrayBuffer = await Bun.readableStreamToArrayBuffer(request.body!)

  return Bun.zstdDecompress(bodyAsArrayBuffer)
    .then((decompressed) => decodeMsgpack(decompressed) as SignedPayload)
    .then((signedEnvelope) => {
      const envelope = decodeMsgpack(signedEnvelope.payload) as Envelope

      if (signedEnvelope.signature) {
        if (keyResolver) {
          const sig_bytes = Uint8Array.fromHex(signedEnvelope.signature)

          return keyResolver(envelope)
            .then((key_bytes) => {
              return key_bytes
            })
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
          console.warn(
            `device ${envelope.identifier} is sending signed requests but parser is configured without 'keyResolver', so it can't be validated`
          )
          return envelope
        }
      } else {
        return envelope
      }
    })
}

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
