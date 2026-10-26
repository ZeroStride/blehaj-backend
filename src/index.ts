import { staticPlugin } from "@elysia/static"
import { Elysia } from "elysia"

import index from "@public/index.html"
import parseBlehaj from "@server/blehajParser"

export const app = new Elysia()
  .use(
    staticPlugin({
      bunFullstack: true,
      prefix: "/",
    })
  )
  .get("/:uuid", index)
  .onParse(async ({ request, contentType }) => {
    if (contentType === "application/blehaj") return parseBlehaj({ request })
  })
  .post("/api/configure", ({ body }) => {
    console.log("now in the handler", body)
  })
  .listen(3000)

console.log(
  `🦊 Elysia is running at http${app.server?.hostname === "localhost" ? "" : "s"}://${app.server?.hostname}:${app.server?.port}`
)
