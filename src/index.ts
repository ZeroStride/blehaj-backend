import { staticPlugin } from "@elysia/static"
import { encode as msgpackEncode } from "@msgpack/msgpack"
import { Elysia } from "elysia"

import index from "@public/index.html"
import { BlehajRequest, contentTypeBlehaj } from "@server/blehajParser"
import { NetworkManagerConnectionBuilder } from "@server/networkManagerConnectionBuilder"

export const app = new Elysia()
  .use(
    // Future-ezri: Do not remove this 'await' it breaks shit
    await staticPlugin({
      bunFullstack: true,
      prefix: "/",
    })
  )
  .get("/:uuid", index)
  .use(
    contentTypeBlehaj({
      keyResolver: ({ identifier, algorithm, extractable, keyUsages }) => {
        // Todo - This would fetch from the database using 'identifier'
        console.log("Resolving key", identifier)
        const key_bytes = Uint8Array.fromHex(
          "731e93151e81e645fd6ba7642c57d7551d9fb5d167f796e039727c97e1f1a70e"
        )

        return crypto.subtle.importKey(
          "raw",
          key_bytes,
          algorithm,
          extractable,
          keyUsages
        )
      },
    })
  )
  .post("/api/configure", async ({ body, status }) => {
    const request = body as BlehajRequest
    console.log("now in the handler", request)
    if (!request.request.NetworkManagerConfiguration) {
      return status(422, `Unable to process request type: ${request.request}`)
    }

    if (
      !request.request.NetworkManagerConfiguration.interface.startsWith("wlan")
    ) {
      return status(
        422,
        `Don't know how to configure ${request.request.NetworkManagerConfiguration.interface}`
      )
    }

    const nonce = Bun.randomUUIDv7()

    // Todo - Assign status to nonce entry

    return {
      configuration_parameters: "wifi",
      nonce,
    }
  })
  .post("/api/nonce", ({ body, status }) => {
    const { nonce, ssid, security, psk } = body as {
      nonce: string
      ssid: string
      security: string
      psk?: string
    }

    // Todo - Verify nonce status

    const builder = NetworkManagerConnectionBuilder.wireless802_11(ssid)
    let connectionConfiguration
    switch (security.toLowerCase()) {
      case "wpa":
        connectionConfiguration = builder.withWPA_PSK(psk!).build()
        break
      case "none":
        connectionConfiguration = builder.build()
        break
      default:
        return status(
          422,
          `Don't know how to configure ${security} security type`
        )
    }

    return Bun.zstdCompressSync(
      msgpackEncode({
        nonce: nonce,
        connection_configuration: connectionConfiguration,
      })
    )
  })
  .listen(3000)

console.log(
  `🦊 Elysia is running at http${app.server?.hostname === "localhost" ? "" : "s"}://${app.server?.hostname}:${app.server?.port}`
)
