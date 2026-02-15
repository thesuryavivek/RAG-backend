import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { ingestController } from "./controllers/ingestController.js";
import { messagesController } from "./controllers/messagesController.js";
import { queryController } from "./controllers/queryController.js";
import { sourceController } from "./controllers/sourceController.js";
import { validate } from "./middleware/validate.js";
import { ingestSchema } from "./schemas/ingestSchema.js";
import { querySchema } from "./schemas/querySchema.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

app.get("/items", sourceController);
app.get("/messages", messagesController);

app.post("/ingest", validate(ingestSchema), ingestController);
app.post("/query", validate(querySchema), queryController);

app.listen(PORT, () => {
  console.log(`⚡️[server]: Server is running in port ${PORT}`);
});
