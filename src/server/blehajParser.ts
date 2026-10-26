import {
  decodeAsync as decodeAsyncMsgpack,
  decode as decodeMsgpack,
} from "@msgpack/msgpack"

export interface BlehajBody {
  identifier: string
  data: Uint8Array
}

export default async function parseBlehaj({
  request,
}: {
  request: Request
}): Promise<BlehajBody> {
  interface BleRequest {
    identifier: string
    data: Uint8Array
  }

  interface BleEnvelope {
    signature: string
    payload: Uint8Array
  }

  return decodeAsyncMsgpack(request.body!)
    .then((decoded_raw) => decoded_raw as [string, Uint8Array])
    .then((decoded) => {
      return {
        signature: decoded[0],
        payload: decoded[1],
      } as BleEnvelope
    })
    .then((envelope) => {
      const request_decoded = decodeMsgpack(envelope.payload) as [
        string,
        Uint8Array,
      ]
      const request = {
        identifier: request_decoded[0],
        data: request_decoded[1],
      } as BleRequest

      if (envelope.signature) {
        const sig_bytes = Uint8Array.fromHex(envelope.signature)

        // Todo - This would fetch from the database using 'identifier'
        const todoFetchFromDatabaseOrWhatever = Promise.resolve(
          Uint8Array.fromHex(
            "731e93151e81e645fd6ba7642c57d7551d9fb5d167f796e039727c97e1f1a70e"
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
              Buffer.from(envelope.payload)
            )
          )
          .then((matched) => {
            if (!matched) {
              throw new Error("signature mismatch")
            }

            return request
          })
      } else {
        return request
      }
    })
    .then((request) => request as BlehajBody)
}
