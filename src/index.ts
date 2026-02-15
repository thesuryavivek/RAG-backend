import dotenv from "dotenv";
import express, { type Request, type Response } from "express";
import { ingestController } from "./controllers/ingestController.js";
import { queryController } from "./controllers/queryController.js";
import { validate } from "./middleware/validate.js";
import { ingestSchema } from "./schemas/ingestSchema.js";
import { querySchema } from "./schemas/querySchema.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/items", (req: Request, res: Response) => {
  res.json({
    dataSources: [],
  });
});

app.post("/ingest", validate(ingestSchema), ingestController);
app.post("/query", validate(querySchema), queryController);

app.listen(PORT, () => {
  console.log(`⚡️[server]: Server is running in port ${PORT}`);
});
