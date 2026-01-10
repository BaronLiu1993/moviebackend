import express from 'express';
import authRouter from "./router/auth/authRouter.js"
import queryRouter from "./router/query/queryRouter.js"
import rateRouter from "./router/rate/rateRouter.js"
import cors from "cors"
import bodyParser from 'body-parser';
import cookieParser from "cookie-parser"
import rateLimit from 'express-rate-limit';

const app = express()

app.use("/v1/auth", authRouter)
app.use("/v1/query", queryRouter)
app.use("/v1/rate", rateRouter)

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

app.listen(8000, () => {
    console.log(`Running on Server`)
})


