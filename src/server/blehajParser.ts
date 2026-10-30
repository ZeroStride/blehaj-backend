import { decode as decodeMsgpack } from "@msgpack/msgpack"
import Elysia, { ParseError } from "elysia"
import { ILogLayer } from "loglayer"

// https://developer.mozilla.org/docs/Web/API/SubtleCrypto/importKey)
export interface KeyResolverContext {
  identifier: string
  algorithm:
    | AlgorithmIdentifier
    | RsaHashedImportParams
    | EcKeyImportParams
    | HmacImportParams
    | AesKeyAlgorithm
  extractable: boolean
  keyUsages: ReadonlyArray<KeyUsage>
}

export interface PluginOptions {
  keyResolver?: (ctx: KeyResolverContext) => Promise<CryptoKey>
  log?: ILogLayer
}

export interface BlehajRequest {
  identifier: string
  algorithm: string
  request: Partial<BlehajRequestType>
}

export interface BlehajRequestType {
  NetworkManagerConfiguration: { interface: string; capsul: Uint8Array }
}

export const contentTypeBlehaj = (options?: PluginOptions) =>
  new Elysia()
    .state("plugin-version", 1)
    .error({ 403: SignatureMismatchError, 422: UnsupportedAlgorithmError })
    .onError(({ error }) => {
      if (
        error instanceof ParseError &&
        error.cause instanceof SignatureMismatchError
      ) {
        return error.cause.toResponse()
      }
      throw error
    })
    .parser("blehaj", (ctx) => parseBlehaj(ctx, options || {}))
    .onParse((ctx) => {
      if (ctx.contentType === "application/blehaj") {
        return parseBlehaj(ctx, options || {})
      }
    })
    .as("global")

export default contentTypeBlehaj

async function parseBlehaj(
  { request }: { request: Request },
  { keyResolver, log }: PluginOptions & { scope?: string }
): Promise<BlehajRequest> {
  interface Envelope {
    identifier: string
    algorithm: string
    request: Partial<BlehajRequestType>
  }

  interface SignedPayload {
    signature: string
    payload: Uint8Array
  }

  const bodyAsArrayBuffer = await Bun.readableStreamToArrayBuffer(request.body!)
  log
    ?.withGroup("parser")
    .withMetadata({ bodyLength: bodyAsArrayBuffer.byteLength })
    .info("decompressing application/blehaj")
  return Bun.zstdDecompress(bodyAsArrayBuffer)
    .then((decompressed) => {
      log?.withGroup("parser").debug("decoding signed payload")
      return decodeMsgpack(decompressed) as SignedPayload
    })
    .then((signedEnvelope) => {
      log?.withGroup("parser").debug("decoding envelope")
      const envelope = decodeMsgpack(signedEnvelope.payload) as Envelope

      if (
        envelope.algorithm &&
        envelope.algorithm.toLowerCase() !== "ed25519"
      ) {
        throw new UnsupportedAlgorithmError(envelope.algorithm)
      }

      if (signedEnvelope.signature) {
        if (keyResolver) {
          const sig_bytes = Uint8Array.fromHex(signedEnvelope.signature)
          const algorithm = { name: "Ed25519" }

          log
            ?.withGroup("parser")
            .withMetadata({
              identifier: envelope.identifier,
            })
            .debug("resolving key")
          return keyResolver({
            identifier: envelope.identifier,
            algorithm,
            extractable: false,
            keyUsages: ["verify"],
          })
            .then((key) => {
              log
                ?.withGroup("parser")
                .withMetadata({ sig: signedEnvelope.signature })
                .debug("verifying signature")
              return crypto.subtle.verify(
                algorithm,
                key,
                sig_bytes,
                Buffer.from(signedEnvelope.payload)
              )
            })
            .then((matched) => {
              if (!matched) {
                throw new SignatureMismatchError("Signature mismatch")
              }

              return envelope
            })
        } else {
          log
            ?.withGroup("parser")
            .withMetadata({
              identifier: envelope.identifier,
            })
            .warn(
              `device is sending signed requests but parser is configured without 'keyResolver', so it can't be validated`
            )
          return envelope
        }
      } else {
        log
          ?.withGroup("parser")
          .withMetadata({
            identifier: envelope.identifier,
          })
          .debug("unsigned request")
        return envelope
      }
    })
    .then((envelope) => envelope as BlehajRequest) // Todo - Reformat here if needed
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

class UnsupportedAlgorithmError extends Error {
  status = 422

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
