import { staticPlugin } from "@elysia/static"
import { Elysia } from "elysia"

import index from "@public/index.html"
import { contentTypeBlehaj } from "@server/blehajParser"

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
      // Todo - This would fetch from the database using 'identifier'
      keyResolver: (ctx) => {
        console.log("Resolving key", ctx)
        return Promise.resolve(
          Uint8Array.fromHex(
            "731e93151e81e645fd6ba7642c57d7551d9fb5d167f796e039727c97e1f1a70e"
          )
        )
      },
    })
  )
  .post("/api/configure", ({ body }) => {
    console.log("now in the handler", body)
  })
  .listen(3000)

console.log(
  `🦊 Elysia is running at http${app.server?.hostname === "localhost" ? "" : "s"}://${app.server?.hostname}:${app.server?.port}`
)
