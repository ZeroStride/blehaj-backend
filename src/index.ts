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
  .use(contentTypeBlehaj())
  .post("/api/configure", ({ body }) => {
    console.log("now in the handler", body)
  })
  .listen(3000)

console.log(
  `🦊 Elysia is running at http${app.server?.hostname === "localhost" ? "" : "s"}://${app.server?.hostname}:${app.server?.port}`
)
