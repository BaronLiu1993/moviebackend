import { Router } from "express";
import { sendFriendRequest, acceptFriendRequest, rejectFriendRequest, getFollowers, getFollowing, getProfile, getFriendRequests } from "../../service/friend/friendService.js";
import { verifyToken } from "../../middleware/verifyToken.js";
const router = Router();
router.post("/send-request", verifyToken, async (req, res) => {
    const { friendId } = req.body;
    const supabaseClient = req.supabaseClient;
    const userId = req.user?.sub;
    if (!userId || !friendId || !supabaseClient) {
        return res.status(400).json({ message: "Missing Inputs" });
    }
    try {
        await sendFriendRequest({ userId, friendId, supabaseClient });
        return res.status(201).send();
    }
    catch (err) {
        console.log(err);
        return res.status(500).json({ message: "Internal Server Error" });
    }
});
router.get("/get-friend-requests", verifyToken, async (req, res) => {
    const supabaseClient = req.supabaseClient;
    const userId = req.user?.sub;
    if (!userId || !supabaseClient) {
        return res.status(400).json({ message: "Missing Inputs" });
    }
    try {
        const data = await getFriendRequests({ userId, supabaseClient });
        return res.status(200).json({ data });
    }
    catch (err) {
        console.log(err);
        return res.status(500).json({ message: "Internal Server Error" });
    }
});
router.post("/accept-request", verifyToken, async (req, res) => {
    const { requestId } = req.body;
    const supabaseClient = req.supabaseClient;
    const userId = req.user?.sub;
    if (!requestId || !supabaseClient || !userId) {
        return res.status(400).json({ message: "Missing Inputs" });
    }
    try {
        await acceptFriendRequest({ userId, requestId, supabaseClient });
        return res.status(201).send();
    }
    catch (err) {
        return res.status(500).json({ message: "Internal Server Error" });
    }
});
router.post("/decline-request", verifyToken, async (req, res) => {
    const { requestId } = req.body;
    const supabaseClient = req.supabaseClient;
    const userId = req.user?.sub;
    if (!requestId || !supabaseClient || !userId) {
        return res.status(400).json({ message: "Missing Inputs" });
    }
    try {
        await rejectFriendRequest({ userId, requestId, supabaseClient });
        return res.status(204).send();
    }
    catch (err) {
        return res.status(500).json({ message: "Internal Server Error" });
    }
});
router.get("/get-following", verifyToken, async (req, res) => {
    const userId = req.user?.sub;
    const supabaseClient = req.supabaseClient;
    if (!userId || !supabaseClient) {
        return res.status(400).json({ message: "Missing Inputs" });
    }
    try {
        const data = await getFollowing({ userId, supabaseClient });
        return res.status(200).json({ data });
    }
    catch (err) {
        return res.status(500).json({ message: "Internal Server Error" });
    }
});
router.get("/get-followers", verifyToken, async (req, res) => {
    const userId = req.user?.sub;
    const supabaseClient = req.supabaseClient;
    if (!userId || !supabaseClient) {
        return res.status(400).json({ message: "Missing Inputs" });
    }
    try {
        const data = await getFollowers({ userId, supabaseClient });
        return res.status(200).json({ data });
    }
    catch (err) {
        return res.status(500).json({ message: "Internal Server Error" });
    }
});
router.get("/get-profile", verifyToken, async (req, res) => {
    const { friendId } = req.query;
    const supabaseClient = req.supabaseClient;
    const userId = req.user?.sub;
    if (!userId || !friendId || !supabaseClient || typeof friendId !== "string") {
        return res.status(400).json({ message: "Missing Inputs" });
    }
    try {
        const data = await getProfile({
            userId,
            supabaseClient,
            friendId: friendId,
        });
        return res.status(200).json({ data });
    }
    catch (err) {
        return res.status(500).json({ message: "Internal Server Error" });
    }
});
export default router;
//# sourceMappingURL=friendRouter.js.map