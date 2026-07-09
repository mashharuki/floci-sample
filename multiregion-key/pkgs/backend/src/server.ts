import { serve } from "@hono/node-server";
import { createDefaultApp } from "./app.js";

const port = Number(process.env.PORT ?? "3000");

serve({ fetch: createDefaultApp().fetch, port }, (info) => {
  console.log(`listening on http://localhost:${info.port}`);
});
