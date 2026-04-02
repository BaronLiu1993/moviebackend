import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import {
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  getFollowers,
  getFriendRequests,
  getFollowing,
  getProfile,
} from "../service/friend/friendService.js";

const mockFrom = jest.fn();
const mockRpc = jest.fn();
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
    ).rejects.toThrow("Cannot send friend request to yourself");
  });

  it("throws if friend does not exist", async () => {
    const single = jest.fn().mockResolvedValue({ data: null, error: { message: "not found" } });
    const eq = jest.fn().mockReturnValue({ single });
    const select = jest.fn().mockReturnValue({ eq });
    mockFrom.mockReturnValueOnce({ select });

    await expect(
      sendFriendRequest({ supabaseClient, userId, friendId })
    ).rejects.toThrow("User not found");
  });

  it("throws if request already exists", async () => {
    const singleFriend = jest.fn().mockResolvedValue({ data: { user_id: friendId }, error: null });
    const eqFriend = jest.fn().mockReturnValue({ single: singleFriend });
    const selectFriend = jest.fn().mockReturnValue({ eq: eqFriend });

    const singleExisting = jest.fn().mockResolvedValue({
      data: { request_id: "r1", status: "pending" },
      error: null,
    });
    const eqExistingFriend = jest.fn().mockReturnValue({ single: singleExisting });
    const eqExistingUser = jest.fn().mockReturnValue({ eq: eqExistingFriend });
    const selectExisting = jest.fn().mockReturnValue({ eq: eqExistingUser });

    mockFrom
      .mockReturnValueOnce({ select: selectFriend })
      .mockReturnValueOnce({ select: selectExisting });

    await expect(
      sendFriendRequest({ supabaseClient, userId, friendId })
    ).rejects.toThrow("Friend request already pending");
  });

  it("creates a friend request successfully", async () => {
    const singleFriend = jest.fn().mockResolvedValue({ data: { user_id: friendId }, error: null });
    const eqFriend = jest.fn().mockReturnValue({ single: singleFriend });
    const selectFriend = jest.fn().mockReturnValue({ eq: eqFriend });

    const singleExisting = jest.fn().mockResolvedValue({ data: null, error: { code: "PGRST116" } });
    const eqExistingFriend = jest.fn().mockReturnValue({ single: singleExisting });
    const eqExistingUser = jest.fn().mockReturnValue({ eq: eqExistingFriend });
    const selectExisting = jest.fn().mockReturnValue({ eq: eqExistingUser });

    const insertFn = jest.fn().mockResolvedValue({ error: null });

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
    const singleValidate = jest.fn().mockResolvedValue({ data: { status: "pending" }, error: null });
    const eqValidateFriend = jest.fn().mockReturnValue({ single: singleValidate });
    const eqValidateReq = jest.fn().mockReturnValue({ eq: eqValidateFriend });
    const selectValidate = jest.fn().mockReturnValue({ eq: eqValidateReq });

    const eqUpdateFriend = jest.fn().mockResolvedValue({ error: null });
    const eqUpdateReq = jest.fn().mockReturnValue({ eq: eqUpdateFriend });
    const updateFn = jest.fn().mockReturnValue({ eq: eqUpdateReq });

    mockFrom
      .mockReturnValueOnce({ select: selectValidate })
      .mockReturnValueOnce({ update: updateFn });

    await acceptFriendRequest({ supabaseClient, userId, requestId });

    expect(updateFn).toHaveBeenCalledWith({ status: "accepted" });
  });

  it("throws if request is not pending", async () => {
    const singleValidate = jest.fn().mockResolvedValue({ data: { status: "accepted" }, error: null });
    const eqValidateFriend = jest.fn().mockReturnValue({ single: singleValidate });
    const eqValidateReq = jest.fn().mockReturnValue({ eq: eqValidateFriend });
    const selectValidate = jest.fn().mockReturnValue({ eq: eqValidateReq });
    mockFrom.mockReturnValueOnce({ select: selectValidate });

    await expect(
      acceptFriendRequest({ supabaseClient, userId, requestId })
    ).rejects.toThrow("Only pending friend requests can be modified");
  });
});

describe("rejectFriendRequest", () => {
  const requestId = "req-2" as any;

  it("deletes a pending request", async () => {
    const singleValidate = jest.fn().mockResolvedValue({ data: { status: "pending" }, error: null });
    const eqValidateFriend = jest.fn().mockReturnValue({ single: singleValidate });
    const eqValidateReq = jest.fn().mockReturnValue({ eq: eqValidateFriend });
    const selectValidate = jest.fn().mockReturnValue({ eq: eqValidateReq });

    const eqDeleteFriend = jest.fn().mockResolvedValue({ error: null });
    const eqDeleteReq = jest.fn().mockReturnValue({ eq: eqDeleteFriend });
    const deleteFn = jest.fn().mockReturnValue({ eq: eqDeleteReq });

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
    const range = jest.fn().mockResolvedValue({ data: followers, error: null });
    const eqStatus = jest.fn().mockReturnValue({ range });
    const eqFriend = jest.fn().mockReturnValue({ eq: eqStatus });
    const select = jest.fn().mockReturnValue({ eq: eqFriend });
    mockFrom.mockReturnValue({ select });

    const result = await getFollowers({ supabaseClient, userId, page: 1, pageSize: 10 });

    expect(result).toEqual(followers);
  });
});

describe("getFriendRequests", () => {
  it("returns pending friend requests", async () => {
    const requests = [{ request_id: "r1", user_id: "u1", status: "pending", friend_id: userId }];
    const eqStatus = jest.fn().mockResolvedValue({ data: requests, error: null });
    const eqFriend = jest.fn().mockReturnValue({ eq: eqStatus });
    const select = jest.fn().mockReturnValue({ eq: eqFriend });
    mockFrom.mockReturnValue({ select });

    const result = await getFriendRequests({ supabaseClient, userId });

    expect(result).toEqual(requests);
  });
});

describe("getFollowing", () => {
  it("returns outgoing requests with pagination", async () => {
    const following = [{ request_id: "r1", friend_id: "f1", status: "accepted" }];
    const range = jest.fn().mockResolvedValue({ data: following, error: null });
    const eq = jest.fn().mockReturnValue({ range });
    const select = jest.fn().mockReturnValue({ eq });
    mockFrom.mockReturnValue({ select });

    const result = await getFollowing({ supabaseClient, userId, page: 1, pageSize: 10 });

    expect(result).toEqual(following);
  });
});

describe("getProfile", () => {
  it("returns friend profile and ratings when users are friends", async () => {
    mockRpc.mockResolvedValueOnce({ data: true, error: null });

    const ratings = [{ film_id: 1, rating: 5, note: "great", film_name: "Drama" }];
    const eqRatings = jest.fn().mockResolvedValue({ data: ratings, error: null });
    const selectRatings = jest.fn().mockReturnValue({ eq: eqRatings });

    const singleProfile = jest.fn().mockResolvedValue({
      data: { genre: ["drama"], movie: ["Squid Game"] },
      error: null,
    });
    const eqProfile = jest.fn().mockReturnValue({ single: singleProfile });
    const selectProfile = jest.fn().mockReturnValue({ eq: eqProfile });

    mockFrom
      .mockReturnValueOnce({ select: selectRatings })
      .mockReturnValueOnce({ select: selectProfile });

    const result = await getProfile({ supabaseClient, userId, friendId });

    expect(result).toEqual({
      ratings,
      profile: { genre: ["drama"], movie: ["Squid Game"] },
    });
  });

  it("throws if users are not friends", async () => {
    mockRpc.mockResolvedValueOnce({ data: false, error: null });

    await expect(
      getProfile({ supabaseClient, userId, friendId })
    ).rejects.toThrow("Users are not friends");
  });
});
