import { jest, describe, it, expect, beforeEach } from "@jest/globals";

type AnyFn = (...args: any[]) => any;

import {
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  removeFriend,
  getFollowers,
  getFriendRequests,
  getFollowing,
  getProfile,
  createInvite,
  redeemInvite,
  getActiveInvites,
} from "../service/friend/friendService.js";

const mockFrom = jest.fn<AnyFn>();
const mockRpc = jest.fn<AnyFn>();
const supabaseClient = { from: mockFrom, rpc: mockRpc } as any;
const userId = "user-1" as any;
const friendId = "user-2" as any;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("sendFriendRequest", () => {
  it("throws if user tries to add themselves", async () => {
    await expect(
      sendFriendRequest({ supabaseClient, userId, friendId: userId })
    ).rejects.toThrow("Failed to send friend request");
  });

  it("throws if friend does not exist", async () => {
    const single = jest.fn<AnyFn>().mockResolvedValue({ data: null, error: { message: "not found" } });
    const eq = jest.fn<AnyFn>().mockReturnValue({ single });
    const select = jest.fn<AnyFn>().mockReturnValue({ eq });
    mockFrom.mockReturnValueOnce({ select });

    await expect(
      sendFriendRequest({ supabaseClient, userId, friendId })
    ).rejects.toThrow("Failed to send friend request");
  });

  it("throws if request already exists", async () => {
    const singleFriend = jest.fn<AnyFn>().mockResolvedValue({ data: { user_id: friendId }, error: null });
    const eqFriend = jest.fn<AnyFn>().mockReturnValue({ single: singleFriend });
    const selectFriend = jest.fn<AnyFn>().mockReturnValue({ eq: eqFriend });

    const singleExisting = jest.fn<AnyFn>().mockResolvedValue({
      data: { request_id: "r1", status: "pending" },
      error: null,
    });
    const eqExistingFriend = jest.fn<AnyFn>().mockReturnValue({ single: singleExisting });
    const eqExistingUser = jest.fn<AnyFn>().mockReturnValue({ eq: eqExistingFriend });
    const selectExisting = jest.fn<AnyFn>().mockReturnValue({ eq: eqExistingUser });

    mockFrom
      .mockReturnValueOnce({ select: selectFriend })
      .mockReturnValueOnce({ select: selectExisting });

    await expect(
      sendFriendRequest({ supabaseClient, userId, friendId })
    ).rejects.toThrow("Failed to send friend request");
  });

  it("creates a friend request successfully", async () => {
    const singleFriend = jest.fn<AnyFn>().mockResolvedValue({ data: { user_id: friendId }, error: null });
    const eqFriend = jest.fn<AnyFn>().mockReturnValue({ single: singleFriend });
    const selectFriend = jest.fn<AnyFn>().mockReturnValue({ eq: eqFriend });

    const singleExisting = jest.fn<AnyFn>().mockResolvedValue({ data: null, error: { code: "PGRST116" } });
    const eqExistingFriend = jest.fn<AnyFn>().mockReturnValue({ single: singleExisting });
    const eqExistingUser = jest.fn<AnyFn>().mockReturnValue({ eq: eqExistingFriend });
    const selectExisting = jest.fn<AnyFn>().mockReturnValue({ eq: eqExistingUser });

    const insertFn = jest.fn<AnyFn>().mockResolvedValue({ error: null });

    mockFrom
      .mockReturnValueOnce({ select: selectFriend })
      .mockReturnValueOnce({ select: selectExisting })
      .mockReturnValueOnce({ insert: insertFn });

    const result = await sendFriendRequest({ supabaseClient, userId, friendId });

    expect(result).toBe(true);
    expect(insertFn).toHaveBeenCalledWith({
      user_id: userId,
      friend_id: friendId,
      status: "pending",
    });
  });
});

describe("acceptFriendRequest", () => {
  const requestId = "req-1" as any;

  it("accepts a pending request", async () => {
    const singleValidate = jest.fn<AnyFn>().mockResolvedValue({ data: { status: "pending" }, error: null });
    const eqValidateFriend = jest.fn<AnyFn>().mockReturnValue({ single: singleValidate });
    const eqValidateReq = jest.fn<AnyFn>().mockReturnValue({ eq: eqValidateFriend });
    const selectValidate = jest.fn<AnyFn>().mockReturnValue({ eq: eqValidateReq });

    const eqUpdateFriend = jest.fn<AnyFn>().mockResolvedValue({ error: null });
    const eqUpdateReq = jest.fn<AnyFn>().mockReturnValue({ eq: eqUpdateFriend });
    const updateFn = jest.fn<AnyFn>().mockReturnValue({ eq: eqUpdateReq });

    mockFrom
      .mockReturnValueOnce({ select: selectValidate })
      .mockReturnValueOnce({ update: updateFn });

    await acceptFriendRequest({ supabaseClient, userId, requestId });

    expect(updateFn).toHaveBeenCalledWith({ status: "accepted" });
  });

  it("throws if request is not pending", async () => {
    const singleValidate = jest.fn<AnyFn>().mockResolvedValue({ data: { status: "accepted" }, error: null });
    const eqValidateFriend = jest.fn<AnyFn>().mockReturnValue({ single: singleValidate });
    const eqValidateReq = jest.fn<AnyFn>().mockReturnValue({ eq: eqValidateFriend });
    const selectValidate = jest.fn<AnyFn>().mockReturnValue({ eq: eqValidateReq });
    mockFrom.mockReturnValueOnce({ select: selectValidate });

    await expect(
      acceptFriendRequest({ supabaseClient, userId, requestId })
    ).rejects.toThrow("Failed to accept friend request");
  });
});

describe("rejectFriendRequest", () => {
  const requestId = "req-2" as any;

  it("deletes a pending request", async () => {
    const singleValidate = jest.fn<AnyFn>().mockResolvedValue({ data: { status: "pending" }, error: null });
    const eqValidateFriend = jest.fn<AnyFn>().mockReturnValue({ single: singleValidate });
    const eqValidateReq = jest.fn<AnyFn>().mockReturnValue({ eq: eqValidateFriend });
    const selectValidate = jest.fn<AnyFn>().mockReturnValue({ eq: eqValidateReq });

    const eqDeleteFriend = jest.fn<AnyFn>().mockResolvedValue({ error: null });
    const eqDeleteReq = jest.fn<AnyFn>().mockReturnValue({ eq: eqDeleteFriend });
    const deleteFn = jest.fn<AnyFn>().mockReturnValue({ eq: eqDeleteReq });

    mockFrom
      .mockReturnValueOnce({ select: selectValidate })
      .mockReturnValueOnce({ delete: deleteFn });

    await rejectFriendRequest({ supabaseClient, userId, requestId });

    expect(deleteFn).toHaveBeenCalled();
  });
});

describe("getFollowers", () => {
  it("returns pending incoming requests with pagination", async () => {
    const followers = [{ request_id: "r1", user_id: "u1", status: "pending" }];
    const range = jest.fn<AnyFn>().mockResolvedValue({ data: followers, error: null });
    const eqStatus = jest.fn<AnyFn>().mockReturnValue({ range });
    const eqFriend = jest.fn<AnyFn>().mockReturnValue({ eq: eqStatus });
    const select = jest.fn<AnyFn>().mockReturnValue({ eq: eqFriend });
    mockFrom.mockReturnValue({ select });

    const result = await getFollowers({ supabaseClient, userId, page: 1, pageSize: 10 });

    expect(result).toEqual(followers);
  });
});

describe("getFriendRequests", () => {
  it("returns pending friend requests with pagination", async () => {
    const requests = [{ request_id: "r1", user_id: "u1", status: "pending", friend_id: userId }];
    const range = jest.fn<AnyFn>().mockResolvedValue({ data: requests, error: null });
    const eqStatus = jest.fn<AnyFn>().mockReturnValue({ range });
    const eqFriend = jest.fn<AnyFn>().mockReturnValue({ eq: eqStatus });
    const select = jest.fn<AnyFn>().mockReturnValue({ eq: eqFriend });
    mockFrom.mockReturnValue({ select });

    const result = await getFriendRequests({ supabaseClient, userId, page: 1, pageSize: 10 });

    expect(result).toEqual(requests);
    expect(range).toHaveBeenCalledWith(0, 9);
  });
});

describe("getFollowing", () => {
  it("returns accepted friendships with pagination", async () => {
    const following = [{ request_id: "r1", friend_id: "f1", status: "accepted" }];
    const range = jest.fn<AnyFn>().mockResolvedValue({ data: following, error: null });
    const eqStatus = jest.fn<AnyFn>().mockReturnValue({ range });
    const eqUser = jest.fn<AnyFn>().mockReturnValue({ eq: eqStatus });
    const select = jest.fn<AnyFn>().mockReturnValue({ eq: eqUser });
    mockFrom.mockReturnValue({ select });

    const result = await getFollowing({ supabaseClient, userId, page: 1, pageSize: 10 });

    expect(result).toEqual(following);
    expect(eqStatus).toHaveBeenCalledWith("status", "accepted");
  });
});

describe("getProfile", () => {
  it("returns friend profile and ratings with like data", async () => {
    mockRpc.mockResolvedValueOnce({ data: true, error: null });

    const ratings = [{ rating_id: "r1", film_id: 1, rating: 5, note: "great", film_name: "Drama", like_count: 2 }];
    const eqRatings = jest.fn<AnyFn>().mockResolvedValue({ data: ratings, error: null });
    const selectRatings = jest.fn<AnyFn>().mockReturnValue({ eq: eqRatings });

    const singleProfile = jest.fn<AnyFn>().mockResolvedValue({
      data: { genres: ["drama"], movies: ["Squid Game"] },
      error: null,
    });
    const eqProfile = jest.fn<AnyFn>().mockReturnValue({ single: singleProfile });
    const selectProfile = jest.fn<AnyFn>().mockReturnValue({ eq: eqProfile });

    // Rating_Likes query for has_liked
    const eqLikesUser = jest.fn<AnyFn>().mockResolvedValue({ data: [{ rating_id: "r1" }], error: null });
    const inLikes = jest.fn<AnyFn>().mockReturnValue({ eq: eqLikesUser });
    const selectLikes = jest.fn<AnyFn>().mockReturnValue({ in: inLikes });

    mockFrom
      .mockReturnValueOnce({ select: selectRatings })
      .mockReturnValueOnce({ select: selectProfile })
      .mockReturnValueOnce({ select: selectLikes });

    const result = await getProfile({ supabaseClient, userId, friendId });

    expect(result.ratings[0]).toMatchObject({
      rating_id: "r1",
      like_count: 2,
      has_liked: true,
    });
    expect(result.profile).toEqual({ genres: ["drama"], movies: ["Squid Game"] });
  });

  it("throws if users are not friends", async () => {
    mockRpc.mockResolvedValueOnce({ data: false, error: null });

    await expect(
      getProfile({ supabaseClient, userId, friendId })
    ).rejects.toThrow("Failed to fetch friend profile");
  });
});

describe("removeFriend", () => {
  it("removes an accepted friendship", async () => {
    const single = jest.fn<AnyFn>().mockResolvedValue({ data: { request_id: "r1" }, error: null });
    const or = jest.fn<AnyFn>().mockReturnValue({ single });
    const eqStatus = jest.fn<AnyFn>().mockReturnValue({ or });
    const selectFind = jest.fn<AnyFn>().mockReturnValue({ eq: eqStatus });

    const eqDelete = jest.fn<AnyFn>().mockResolvedValue({ error: null });
    const deleteFn = jest.fn<AnyFn>().mockReturnValue({ eq: eqDelete });

    mockFrom
      .mockReturnValueOnce({ select: selectFind })
      .mockReturnValueOnce({ delete: deleteFn });

    await removeFriend({ supabaseClient, userId, friendId });

    expect(eqDelete).toHaveBeenCalledWith("request_id", "r1");
  });

  it("throws if friendship not found", async () => {
    const single = jest.fn<AnyFn>().mockResolvedValue({ data: null, error: { message: "not found" } });
    const or = jest.fn<AnyFn>().mockReturnValue({ single });
    const eqStatus = jest.fn<AnyFn>().mockReturnValue({ or });
    const selectFind = jest.fn<AnyFn>().mockReturnValue({ eq: eqStatus });
    mockFrom.mockReturnValueOnce({ select: selectFind });

    await expect(
      removeFriend({ supabaseClient, userId, friendId })
    ).rejects.toThrow("Failed to remove friend");
  });
});

describe("createInvite", () => {
  it("creates an invite and returns code + expiresAt", async () => {
    const insertFn = jest.fn<AnyFn>().mockResolvedValue({ error: null });
    mockFrom.mockReturnValueOnce({ insert: insertFn });

    const result = await createInvite({ supabaseClient, userId });

    expect(result.code).toBeDefined();
    expect(result.code.length).toBeGreaterThan(0);
    expect(result.expiresAt).toBeDefined();
    expect(insertFn).toHaveBeenCalled();
  });

  it("throws on insert error", async () => {
    const insertFn = jest.fn<AnyFn>().mockResolvedValue({ error: { message: "db error" } });
    mockFrom.mockReturnValueOnce({ insert: insertFn });

    await expect(createInvite({ supabaseClient, userId })).rejects.toThrow("Failed to create invite");
  });
});

describe("redeemInvite", () => {
  const futureDate = new Date(Date.now() + 86400000).toISOString();
  const pastDate = new Date(Date.now() - 86400000).toISOString();

  it("creates accepted friendship on valid invite", async () => {
    // Fetch invite
    const singleInvite = jest.fn<AnyFn>().mockResolvedValue({
      data: { user_id: friendId, expires_at: futureDate }, error: null,
    });
    const eqInvite = jest.fn<AnyFn>().mockReturnValue({ single: singleInvite });
    const selectInvite = jest.fn<AnyFn>().mockReturnValue({ eq: eqInvite });

    // Check existing friendship — none found
    const singleExisting = jest.fn<AnyFn>().mockResolvedValue({ data: null, error: { code: "PGRST116" } });
    const orExisting = jest.fn<AnyFn>().mockReturnValue({ single: singleExisting });
    const selectExisting = jest.fn<AnyFn>().mockReturnValue({ or: orExisting });

    // Insert friendship
    const insertFn = jest.fn<AnyFn>().mockResolvedValue({ error: null });

    // Fetch inviter name
    const singleName = jest.fn<AnyFn>().mockResolvedValue({ data: { name: "Friend" }, error: null });
    const eqName = jest.fn<AnyFn>().mockReturnValue({ single: singleName });
    const selectName = jest.fn<AnyFn>().mockReturnValue({ eq: eqName });

    mockFrom
      .mockReturnValueOnce({ select: selectInvite })
      .mockReturnValueOnce({ select: selectExisting })
      .mockReturnValueOnce({ insert: insertFn })
      .mockReturnValueOnce({ select: selectName });

    const result = await redeemInvite({ supabaseClient, userId, code: "abc123" });

    expect(result.inviterName).toBe("Friend");
    expect(insertFn).toHaveBeenCalledWith({
      user_id: friendId, friend_id: userId, status: "accepted",
    });
  });

  it("throws on expired invite", async () => {
    const singleInvite = jest.fn<AnyFn>().mockResolvedValue({
      data: { user_id: friendId, expires_at: pastDate }, error: null,
    });
    const eqInvite = jest.fn<AnyFn>().mockReturnValue({ single: singleInvite });
    const selectInvite = jest.fn<AnyFn>().mockReturnValue({ eq: eqInvite });
    mockFrom.mockReturnValueOnce({ select: selectInvite });

    await expect(
      redeemInvite({ supabaseClient, userId, code: "expired" })
    ).rejects.toThrow("Invite not found or expired");
  });

  it("throws on self-redeem", async () => {
    const singleInvite = jest.fn<AnyFn>().mockResolvedValue({
      data: { user_id: userId, expires_at: futureDate }, error: null,
    });
    const eqInvite = jest.fn<AnyFn>().mockReturnValue({ single: singleInvite });
    const selectInvite = jest.fn<AnyFn>().mockReturnValue({ eq: eqInvite });
    mockFrom.mockReturnValueOnce({ select: selectInvite });

    await expect(
      redeemInvite({ supabaseClient, userId, code: "myown" })
    ).rejects.toThrow("Cannot redeem your own invite");
  });

  it("throws if already friends", async () => {
    const singleInvite = jest.fn<AnyFn>().mockResolvedValue({
      data: { user_id: friendId, expires_at: futureDate }, error: null,
    });
    const eqInvite = jest.fn<AnyFn>().mockReturnValue({ single: singleInvite });
    const selectInvite = jest.fn<AnyFn>().mockReturnValue({ eq: eqInvite });

    const singleExisting = jest.fn<AnyFn>().mockResolvedValue({
      data: { request_id: "r1", status: "accepted" }, error: null,
    });
    const orExisting = jest.fn<AnyFn>().mockReturnValue({ single: singleExisting });
    const selectExisting = jest.fn<AnyFn>().mockReturnValue({ or: orExisting });

    mockFrom
      .mockReturnValueOnce({ select: selectInvite })
      .mockReturnValueOnce({ select: selectExisting });

    await expect(
      redeemInvite({ supabaseClient, userId, code: "already" })
    ).rejects.toThrow("Already friends");
  });

  it("auto-accepts pending request", async () => {
    const singleInvite = jest.fn<AnyFn>().mockResolvedValue({
      data: { user_id: friendId, expires_at: futureDate }, error: null,
    });
    const eqInvite = jest.fn<AnyFn>().mockReturnValue({ single: singleInvite });
    const selectInvite = jest.fn<AnyFn>().mockReturnValue({ eq: eqInvite });

    const singleExisting = jest.fn<AnyFn>().mockResolvedValue({
      data: { request_id: "r1", status: "pending" }, error: null,
    });
    const orExisting = jest.fn<AnyFn>().mockReturnValue({ single: singleExisting });
    const selectExisting = jest.fn<AnyFn>().mockReturnValue({ or: orExisting });

    // Update to accepted
    const eqUpdate = jest.fn<AnyFn>().mockResolvedValue({ error: null });
    const updateFn = jest.fn<AnyFn>().mockReturnValue({ eq: eqUpdate });

    // Fetch inviter name
    const singleName = jest.fn<AnyFn>().mockResolvedValue({ data: { name: "Friend" }, error: null });
    const eqName = jest.fn<AnyFn>().mockReturnValue({ single: singleName });
    const selectName = jest.fn<AnyFn>().mockReturnValue({ eq: eqName });

    mockFrom
      .mockReturnValueOnce({ select: selectInvite })
      .mockReturnValueOnce({ select: selectExisting })
      .mockReturnValueOnce({ update: updateFn })
      .mockReturnValueOnce({ select: selectName });

    const result = await redeemInvite({ supabaseClient, userId, code: "pending" });

    expect(updateFn).toHaveBeenCalledWith({ status: "accepted" });
    expect(result.inviterName).toBe("Friend");
  });
});

describe("getActiveInvites", () => {
  it("returns unexpired invites", async () => {
    const invites = [{ code: "abc", created_at: "2024-01-01", expires_at: "2099-01-01" }];
    const order = jest.fn<AnyFn>().mockResolvedValue({ data: invites, error: null });
    const gt = jest.fn<AnyFn>().mockReturnValue({ order });
    const eq = jest.fn<AnyFn>().mockReturnValue({ gt });
    const select = jest.fn<AnyFn>().mockReturnValue({ eq });
    mockFrom.mockReturnValueOnce({ select });

    const result = await getActiveInvites({ supabaseClient, userId });

    expect(result).toEqual(invites);
  });
});
