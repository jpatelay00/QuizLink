import "dotenv/config";
import { createApp } from "./api.js";

const port = Number(process.env.PORT || 5001);
createApp().listen(port, "0.0.0.0", () => {
  console.log(`QuizLink backend running at http://localhost:${port}`);
});
