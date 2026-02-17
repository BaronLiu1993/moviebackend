/**
 * Friend management service layer.
 * Handles friend requests (send/accept/reject), fetches followers/following, and friend profiles.
 * Request operations return boolean: true if successful, false if invalid or failed.
 */
// helpers
// Checks whether two users have an accepted friendship relationship
const checkIsFriends = async (supabaseClient, userId, friendId) => {
    try {
        const { data, error } = await supabaseClient.rpc("is_following", {
            p_follower_id: userId,
            p_following_id: friendId,
        });
        if (error) {
            throw new Error("Failed to check friendship status");
        }
        return Boolean(data);
    }
    catch (err) {
        throw err;
    }
};
// Validates that a friend request exists and is pending, returns the request data
const validatePendingRequest = async (supabaseClient, requestId, userId) => {
    const { data, error } = await supabaseClient
        .from("Friends")
        .select("status")
        .eq("request_id", requestId)
        .eq("friend_id", userId)
        .single();
    if (error || !data) {
        throw new Error("Friend request not found");
    }
    if (data.status !== "pending") {
        throw new Error("Only pending friend requests can be modified");
    }
};
// service functions
// Sends a friend request with a pending status
export const sendFriendRequest = async ({ userId, friendId, supabaseClient, }) => {
    try {
        // Check if user is trying to add themselves
        if (userId === friendId) {
            throw new Error("Cannot send friend request to yourself");
        }
        // Check if friendId user exists
        const { data: friendExists, error: friendCheckError } = await supabaseClient
            .from("User_Profiles")
            .select("user_id")
            .eq("user_id", friendId)
            .single();
        if (friendCheckError || !friendExists) {
            throw new Error("User not found");
        }
        // Check if request already exists (pending or accepted)
        const { data: existingRequest, error: existingError } = await supabaseClient
            .from("Friends")
            .select("request_id, status")
            .eq("user_id", userId)
            .eq("friend_id", friendId)
            .single();
        if (!existingError && existingRequest) {
            throw new Error(`Friend request already ${existingRequest.status}`);
        }
        // Create the friend request
        const { error } = await supabaseClient.from("Friends").insert({
            user_id: userId,
            friend_id: friendId,
            status: "pending",
        });
        if (error) {
            console.log(error);
            throw new Error("Failed to create friend request");
        }
        return true;
    }
    catch (err) {
        console.log(err);
        throw err;
    }
};
// Accepts a pending friend request
export const acceptFriendRequest = async ({ userId, requestId, supabaseClient, }) => {
    await validatePendingRequest(supabaseClient, requestId, userId);
    const { error } = await supabaseClient
        .from("Friends")
        .update({ status: "accepted" })
        .eq("request_id", requestId)
        .eq("friend_id", userId);
    if (error) {
        throw new Error("Failed to accept friend request");
    }
};
// Rejects (deletes) a pending friend request
export const rejectFriendRequest = async ({ userId, requestId, supabaseClient, }) => {
    await validatePendingRequest(supabaseClient, requestId, userId);
    const { error } = await supabaseClient
        .from("Friends")
        .delete()
        .eq("request_id", requestId)
        .eq("friend_id", userId);
    if (error) {
        throw new Error("Failed to reject friend request");
    }
};
// Returns incoming pending friend requests (followers)
export const getFollowers = async ({ userId, supabaseClient, page = 1, pageSize = 10, }) => {
    try {
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        const { data, error } = await supabaseClient
            .from("Friends")
            .select("request_id, user_id, status")
            .eq("friend_id", userId)
            .eq("status", "pending")
            .range(from, to);
        if (error) {
            throw new Error("Failed to fetch followers");
        }
        return data;
    }
    catch (err) {
        throw err;
    }
};
export const getFriendRequests = async ({ userId, supabaseClient, }) => {
    try {
        const { data, error } = await supabaseClient
            .from("Friends")
            .select("request_id, user_id, status, friend_id")
            .eq("friend_id", userId)
            .eq("status", "pending");
        if (error) {
            throw new Error("Failed to fetch friend requests");
        }
        return data;
    }
    catch (err) {
        throw err;
    }
};
// Returns outgoing friend requests and accepted friendships
export const getFollowing = async ({ userId, supabaseClient, page = 1, pageSize = 10, }) => {
    try {
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        const { data, error } = await supabaseClient
            .from("Friends")
            .select("request_id, friend_id, status")
            .eq("user_id", userId)
            .range(from, to);
        if (error) {
            throw new Error("Failed to fetch following");
        }
        return data;
    }
    catch (err) {
        throw err;
    }
};
// Fetches a friend's profile and ratings if the friendship is accepted
export const getProfile = async ({ userId, friendId, supabaseClient, }) => {
    try {
        const isFriend = await checkIsFriends(supabaseClient, userId, friendId);
        if (!isFriend) {
            throw new Error("Users are not friends");
        }
        const { data: ratings, error: ratingsError } = await supabaseClient
            .from("Ratings")
            .select("film_id, rating, note, film_name")
            .eq("user_id", friendId);
        if (ratingsError) {
            throw new Error("Failed to fetch ratings");
        }
        const { data: profile, error: profileError } = await supabaseClient
            .from("User_Profiles")
            .select("genre, movie")
            .eq("user_id", friendId)
            .single();
        if (profileError || !profile) {
            throw new Error("Failed to fetch user profile");
        }
        return {
            ratings,
            profile,
        };
    }
    catch (err) {
        throw err;
    }
};
export const enhanceFriendProfile = async ({ userId, friendId, filmId, supabaseClient, }) => {
    try {
        const isFriend = await checkIsFriends(supabaseClient, userId, friendId);
        if (!isFriend) {
            throw new Error("Users are not friends");
        }
    }
    catch (err) {
        throw err;
    }
};
//# sourceMappingURL=friendService.js.map