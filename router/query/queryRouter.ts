import { Router } from "express";
import { getRecommendedFilms } from "../../service/query/queryService.js";
import { verifyToken } from "../../middleware/verifyToken.js";

const router = Router();

router.get("/search", verifyToken, async (req, res) => {
    const { query } = req.body
    const supabaseClient = req.supabaseClient
    
    if (!supabaseClient || !query) {
        return res.status(400).json({message: "Missing Parameters"})
    }

    try {
        const data = await getRecommendedFilms({supabaseClient})
        return res.status(200).json({ data })      
    } catch {
        return res.status(500).json({message: "Internal Server Error"})
    }
})









export default router