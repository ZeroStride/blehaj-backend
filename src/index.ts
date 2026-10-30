import { staticPlugin } from "@elysia/static"
import { elysiaLogLayer } from "@loglayer/elysia"
import { encode as msgpackEncode } from "@msgpack/msgpack"
import { createClient as redisClient } from "@redis/client"
import { Elysia } from "elysia"
import { createMlKem768 } from "mlkem"
const { createCipheriv, createDecipheriv } = await import("node:crypto")

import index from "@public/index.html"
import { BlehajRequest, contentTypeBlehaj } from "@server/blehajParser"
import { log } from "@server/log"
import { NetworkManagerConnectionBuilder } from "@server/networkManagerConnectionBuilder"

// Todo - This should probably get moved somewhere else along with the /api group
interface Session {
  device: string
  capsul?: Buffer
  interface: string
}

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
      .use(elysiaLogLayer({ instance: log }))
      .use(
        contentTypeBlehaj({
          log: log,
          keyResolver: ({ identifier, algorithm, extractable, keyUsages }) => {
            // Todo - This would fetch from the database using 'identifier'
            log?.debug("fetching key")
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
      .resolve(({ log }) => {
        return {
          redis: redisClient({
            url: process.env.REDIS_URL || "redis://localhost:6379",
          })
            .on("error", (err) => log?.withGroup("redis").error(err))
            .connect(),
        }
      })
      .onAfterResponse(({ redis }) => {
        redis.then((redis) => redis.destroy())
      })
      .post("/configure", ({ body, status, set, redis, log }) => {
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

        log
          ?.withMetadata({
            interface: configurationRequest.interface,
          })
          .info("starting configuration session")

        return redis
          .then((redis) => {
            if (!configurationRequest.capsul) {
              log?.warn(
                "device did not provide an encapsulation key, proceeding without encryption"
              )
            }

            // Write encapsulation key (for now) into ephemeral session
            //
            // Todo - Write in other contextual information, like "device asked for wifi etc"
            //        goal is to give opportunity for background workers to do things if needed
            //        while the web app collects any needed input.
            const session_id = Bun.randomUUIDv7()
            return Promise.all([
              session_id,
              redis.hSet(session_id, {
                device: request.identifier,
                interface: configurationRequest.interface,
                ...(configurationRequest.capsul && {
                  capsul: Buffer.from(configurationRequest.capsul),
                }),
              }),
            ])
          })
          .then(([session, _]) => {
            log?.debug("created session", session)
            return {
              session,
              configuration_parameters: "wifi",
            }
          })
      })
      .post("/session", async ({ body, status, redis, log }) => {
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
            log?.withContext({ session }).info("resuming session")
            return Promise.all([
              redis,
              redis.hGetAll(session) as unknown as Promise<Session>,
            ])
          })
          .then(([redis, session]) => {
            if (!session || !session.capsul) {
              return [
                new Uint8Array(0),
                new Uint8Array(0),
                Buffer.from(msgpackEncode(connectionConfiguration)),
              ] as [Uint8Array, Uint8Array, Buffer]
            }

            log?.debug("creating server encapsulation key")
            return createMlKem768()
              .then((mlKemInterface) => mlKemInterface.encap(session.capsul!))
              .then(([ciphertext, sharedSecret]) => {
                const nonce = crypto.getRandomValues(new Uint8Array(32))
                log?.withMetadata({ nonce }).debug("encrypting configuration")
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
            log?.debug("loading signing key")

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
              log?.warn("signing key could not be found/created")
              return [
                nonce,
                ciphertext,
                connection_configuration,
                new Uint8Array(0),
              ] as unknown as [Uint8Array, Uint8Array, Buffer, Uint8Array]
            }

            log?.debug("signing reply")
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
          .then(([nonce, ciphertext, connection_configuration, sig]) => {
            log?.debug("encoding and compressing reply")
            return Bun.zstdCompress(
              msgpackEncode({
                nonce,
                ciphertext,
                connection_configuration,
                sig,
              })
            )
          })
          .then((compressed) => {
            log?.debug("compressed size", compressed.length)
            return compressed
          })
      })
  )
  .listen(3000)

console.log(
  `🦊 Elysia is running at http${app.server?.hostname === "localhost" ? "" : "s"}://${app.server?.hostname}:${app.server?.port}`
)
