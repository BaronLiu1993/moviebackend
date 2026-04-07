import { jest, describe, it, expect, beforeEach } from "@jest/globals";

type AnyFn = (...args: any[]) => any;

import {
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  getFollowers,
  getFriendRequests,
  getFollowing,
  getProfile,
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
  it("returns pending friend requests", async () => {
    const requests = [{ request_id: "r1", user_id: "u1", status: "pending", friend_id: userId }];
    const eqStatus = jest.fn<AnyFn>().mockResolvedValue({ data: requests, error: null });
    const eqFriend = jest.fn<AnyFn>().mockReturnValue({ eq: eqStatus });
    const select = jest.fn<AnyFn>().mockReturnValue({ eq: eqFriend });
    mockFrom.mockReturnValue({ select });

    const result = await getFriendRequests({ supabaseClient, userId });

    expect(result).toEqual(requests);
  });
});

describe("getFollowing", () => {
  it("returns outgoing requests with pagination", async () => {
    const following = [{ request_id: "r1", friend_id: "f1", status: "accepted" }];
    const range = jest.fn<AnyFn>().mockResolvedValue({ data: following, error: null });
    const eq = jest.fn<AnyFn>().mockReturnValue({ range });
    const select = jest.fn<AnyFn>().mockReturnValue({ eq });
    mockFrom.mockReturnValue({ select });

    const result = await getFollowing({ supabaseClient, userId, page: 1, pageSize: 10 });

    expect(result).toEqual(following);
  });
});

describe("getProfile", () => {
  it("returns friend profile and ratings when users are friends", async () => {
    mockRpc.mockResolvedValueOnce({ data: true, error: null });

    const ratings = [{ film_id: 1, rating: 5, note: "great", film_name: "Drama" }];
    const eqRatings = jest.fn<AnyFn>().mockResolvedValue({ data: ratings, error: null });
    const selectRatings = jest.fn<AnyFn>().mockReturnValue({ eq: eqRatings });

    const singleProfile = jest.fn<AnyFn>().mockResolvedValue({
      data: { genre: ["drama"], movie: ["Squid Game"] },
      error: null,
    });
    const eqProfile = jest.fn<AnyFn>().mockReturnValue({ single: singleProfile });
    const selectProfile = jest.fn<AnyFn>().mockReturnValue({ eq: eqProfile });

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
    ).rejects.toThrow("Failed to fetch friend profile");
  });
});
