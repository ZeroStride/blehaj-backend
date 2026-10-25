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
  .parser("blehaj", parseBlehaj)
  .post(
    "/api/configure",
    async ({ request, body }) => {
      // console.log(request)
      console.log("now in the handler", body)
    },
    {
      parse: ["blehaj"],
    }
  )
  .listen(3000)

console.log(
  `🦊 Elysia is running at http${app.server?.hostname === "localhost" ? "" : "s"}://${app.server?.hostname}:${app.server?.port}`
)
