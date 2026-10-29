import { createApp } from "./app.js";
import { env } from "./env.js";

createApp().listen(env.PORT, () => {
  console.log(`API on http://localhost:${env.PORT}`);
});
