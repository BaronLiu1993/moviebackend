import express from 'express';
import authRouter from "./router/auth/authRouter.js"
import queryRouter from "./router/query/queryRouter.js"

const app = express()
app.use(authRouter)
app.use(queryRouter)

app.get("/health", (req, res) => {
    return res.status(200).json({ status: "ok"})
})

app.listen(8000, () => {
    console.log(`Running on Server`)
})


