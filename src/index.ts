import { staticPlugin } from "@elysia/static"
import { encode as msgpackEncode } from "@msgpack/msgpack"
import { createClient as redisClient } from "@redis/client"
import { Elysia } from "elysia"
import { createMlKem768 } from "mlkem"
const { createCipheriv, createDecipheriv } = await import("node:crypto")

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
  .group("/api", (app) =>
    app
      .use(
        contentTypeBlehaj({
          keyResolver: ({ identifier, algorithm, extractable, keyUsages }) => {
            // Todo - This would fetch from the database using 'identifier'
            console.log(`resolving key for ${identifier}`)
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
      .resolve(() => {
        return {
          redis: redisClient({
            url: process.env.REDIS_URL || "redis://localhost:6379",
          })
            .on("error", (err) => console.error("redis:", err))
            .connect(),
        }
      })
      .onAfterResponse(({ redis }) => {
        redis.then((redis) => redis.destroy())
      })
      .post("/configure", async ({ body, status, set, redis }) => {
        const request = body as BlehajRequest

        if (!request.request.NetworkManagerConfiguration) {
          return status(
            422,
            `Unable to process request type: ${request.request}`
          )
        }
        const configurationRequest = request.request.NetworkManagerConfiguration

        if (!configurationRequest.interface.startsWith("wlan")) {
          return status(
            422,
            `Don't know how to configure ${configurationRequest.interface}`
          )
        }

        return redis
          .then((redis) => {
            if (!configurationRequest.capsul) {
              console.warn(
                "device did not provide an encapsulation key, proceeding without encryption"
              )
              return null
            }

            // Write encapsulation key (for now) into ephemeral session
            //
            // Todo - Write in other contextual information, like "device asked for wifi etc"
            //        goal is to give opportunity for background workers to do things if needed
            //        while the web app collects any needed input.
            const session = Bun.randomUUIDv7()
            return redis.set(session, configurationRequest.capsul.toHex())
          })
          .then((session) => {
            console.log("created session", session)
            return {
              configuration_parameters: "wifi",
              session,
            }
          })
      })
      .post("/session", async ({ body, status, redis }) => {
        const { session, ssid, security, psk } = body as {
          session: string
          ssid: string
          security: string
          psk?: string
        }

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

        return redis
          .then((redis) => {
            if (!session) {
              return [null, null] as unknown as [typeof redis, string]
            }

            return Promise.all([redis, redis.get(session)])
          })
          .then(([redis, device_ek]) => {
            if (!device_ek) {
              return [
                new Uint8Array(0),
                new Uint8Array(0),
                Buffer.from(msgpackEncode(connectionConfiguration)),
              ] as [Uint8Array, Uint8Array, Buffer]
            }

            try {
              redis.set(session, "\0".repeat(device_ek.length))
            } catch {
              console.warn("failed to zero-out session contents")
            }

            const ek_bytes = Uint8Array.fromHex(device_ek)
            return createMlKem768()
              .then((mlKemInterface) => mlKemInterface.encap(ek_bytes))
              .then(([ciphertext, sharedSecret]) => {
                const nonce = crypto.getRandomValues(new Uint8Array(32))
                const cipher = createCipheriv(
                  "aes-256-gcm",
                  sharedSecret,
                  nonce
                )
                let connection_configuration = cipher.update(
                  msgpackEncode(connectionConfiguration)
                )
                return [
                  nonce,
                  ciphertext,
                  Buffer.concat([connection_configuration, cipher.final()]),
                ] as [Uint8Array, Uint8Array, Buffer]
              })
          })
          .then(([nonce, ciphertext, connection_configuration]) => {
            // Bun.file("foo.txt", "application/octet-stream")
            if (!process.env.BLEHAJ_ORG_DEV) {
              return [
                nonce,
                ciphertext,
                connection_configuration,
                null,
              ] as unknown as [Uint8Array, Uint8Array, Buffer, CryptoKey]
            }

            return Promise.all([
              nonce,
              ciphertext,
              connection_configuration,
              crypto.subtle.importKey(
                "jwk",
                JSON.parse(process.env.BLEHAJ_ORG_DEV),
                { name: "Ed25519" },
                false,
                ["sign"]
              ),
            ])
          })
          .then(([nonce, ciphertext, connection_configuration, key]) => {
            if (!key) {
              return [
                nonce,
                ciphertext,
                connection_configuration,
                new Uint8Array(0),
              ] as unknown as [Uint8Array, Uint8Array, Buffer, Uint8Array]
            }

            return Promise.all([
              nonce,
              ciphertext,
              connection_configuration,
              crypto.subtle
                .sign(
                  {
                    name: "Ed25519",
                  },
                  key,
                  Buffer.concat([nonce, ciphertext, connection_configuration])
                )
                .then((sig) => new Uint8Array(sig)),
            ])
          })
          .then(([nonce, ciphertext, connection_configuration, sig]) =>
            Bun.zstdCompress(
              msgpackEncode({
                nonce,
                ciphertext,
                connection_configuration,
                sig,
              })
            )
          )
          .then((compressed) => {
            console.log(`compressed size ${compressed.length}`)
            return compressed
          })
      })
  )

  .listen(3000)

console.log(
  `🦊 Elysia is running at http${app.server?.hostname === "localhost" ? "" : "s"}://${app.server?.hostname}:${app.server?.port}`
)
