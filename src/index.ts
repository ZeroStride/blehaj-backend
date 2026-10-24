import { staticPlugin } from "@elysia/static";
import { Elysia } from "elysia";

export const app = new Elysia()
  .use(staticPlugin({ 
    bunFullstack: true,
    prefix: "/"
  }))
  .listen(3000)

console.log(
  `🦊 Elysia is running at http${app.server?.hostname === "localhost" ? "" : "s"}://${app.server?.hostname}:${app.server?.port}`
);
