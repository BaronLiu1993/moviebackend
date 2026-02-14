import express from 'express';

import cors from "cors"
import bodyParser from 'body-parser';
import cookieParser from "cookie-parser"
import rateLimit from 'express-rate-limit';

import authRouter from "./router/auth/authRouter.js"
import queryRouter from "./router/query/queryRouter.js"
import rateRouter from "./router/rate/rateRouter.js"
import friendRouter from './router/friend/friendRouter.js';
import analyticsRouter from "./router/analytics/analyticsRouter.js"
import { startClickHouseConsumer } from './service/kafka/configureKafkaConsumer.js';

const app = express()

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
    exposedHeaders: ["Set-Cookie"],
  })
);

app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded());

app.use("/v1/api/auth", authRouter)
app.use("/v1/api/query", queryRouter)
app.use("/v1/api/rate", rateRouter)
app.use("/v1/api/friend", friendRouter)
app.use("/v1/api/analytics", analyticsRouter)

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,  
  max: 200,                
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

app.get("/health", (req, res) => {
    return res.status(200).json({ status: "ok"})
})

app.listen(8000, async () => {
    console.log(`Running on Server`)
    try {
      await startClickHouseConsumer();
      console.log("[Server] ✅ ClickHouse consumer started");
    } catch (err) {
      console.error("[Server] ❌ ClickHouse consumer error:", err);
    }
})


