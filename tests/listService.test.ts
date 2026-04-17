import { jest, describe, it, expect, beforeEach } from "@jest/globals";

type AnyFn = (...args: any[]) => any;

jest.unstable_mockModule("../queue/redis/redis.js", () => ({
  Connection: { on: jest.fn<AnyFn>() },
}));

jest.unstable_mockModule("../service/clickhouse/clickhouseService.js", () => ({
  insertInteractionEvents: jest.fn<AnyFn>(),
  insertImpressionEvent: jest.fn<AnyFn>(),
}));

jest.unstable_mockModule("../queue/updateEmbedding/updateEmbeddingQueue.js", () => ({
  default: { add: jest.fn<AnyFn>() },
}));

jest.unstable_mockModule("../service/friend/friendService.js", () => ({
  checkIsFriends: jest.fn<AnyFn>(),
}));

const {
  createDefaultWatchlist, createList, getUserLists, deleteList, renameList,
  addListItem, removeListItem, getListItems, getListRole,
  createListInvite, redeemListInvite, getListInvites, removeMember, getListMembers,
} = await import("../service/list/listService.js");
const { insertInteractionEvents } = await import("../service/clickhouse/clickhouseService.js");
const { default: updateEmbeddingQueue } = await import("../queue/updateEmbedding/updateEmbeddingQueue.js");
const { checkIsFriends } = await import("../service/friend/friendService.js");

const mockFrom = jest.fn<AnyFn>();
const mockRpc = jest.fn<AnyFn>();
const supabaseClient = { from: mockFrom, rpc: mockRpc } as any;
const userId = "user-list" as any;

beforeEach(() => {
  jest.clearAllMocks();
});

// --- Helpers for mock chains ---
const mockSelect = (data: any, error: any = null) => {
  const single = jest.fn<AnyFn>().mockResolvedValue({ data, error });
  const eq3 = jest.fn<AnyFn>().mockReturnValue({ single });
  const eq2 = jest.fn<AnyFn>().mockReturnValue({ eq: eq3, single });
  const eq1 = jest.fn<AnyFn>().mockReturnValue({ eq: eq2 });
  const select = jest.fn<AnyFn>().mockReturnValue({ eq: eq1 });
  return { select, eq1, eq2, eq3, single };
};

// --- List CRUD ---

describe("createDefaultWatchlist", () => {
  it("creates a watchlist with is_default true", async () => {
    const single = jest.fn<AnyFn>().mockResolvedValue({ data: { list_id: "l1", name: "Watchlist", is_default: true }, error: null });
    const select = jest.fn<AnyFn>().mockReturnValue({ single });
    const insert = jest.fn<AnyFn>().mockReturnValue({ select });
    mockFrom.mockReturnValue({ insert });

    const result = await createDefaultWatchlist({ supabaseClient, userId });

    expect(insert).toHaveBeenCalledWith({ user_id: userId, name: "Watchlist", is_default: true });
    expect(result).toEqual({ list_id: "l1", name: "Watchlist", is_default: true });
  });
});

describe("createList", () => {
  it("creates a custom list and adds owner to List_Members", async () => {
    // Lists insert
    const listSingle = jest.fn<AnyFn>().mockResolvedValue({ data: { list_id: "l2", name: "Favorites", is_default: false }, error: null });
    const listSelect = jest.fn<AnyFn>().mockReturnValue({ single: listSingle });
    const listInsert = jest.fn<AnyFn>().mockReturnValue({ select: listSelect });

    // List_Members insert
    const memberInsert = jest.fn<AnyFn>().mockResolvedValue({ error: null });

    mockFrom
      .mockReturnValueOnce({ insert: listInsert })
      .mockReturnValueOnce({ insert: memberInsert });

    const result = await createList({ supabaseClient, userId, name: "Favorites" });

    expect(result.name).toBe("Favorites");
    expect(memberInsert).toHaveBeenCalledWith({
      list_id: "l2", user_id: userId, role: "owner", status: "accepted",
    });
  });
});

describe("deleteList", () => {
  it("deletes a non-default list when owner", async () => {
    // getListRole: owner
    const roleSingle = jest.fn<AnyFn>().mockResolvedValue({ data: { role: "owner" }, error: null });
    const roleEq3 = jest.fn<AnyFn>().mockReturnValue({ single: roleSingle });
    const roleEq2 = jest.fn<AnyFn>().mockReturnValue({ eq: roleEq3 });
    const roleEq1 = jest.fn<AnyFn>().mockReturnValue({ eq: roleEq2 });
    const roleSelect = jest.fn<AnyFn>().mockReturnValue({ eq: roleEq1 });

    // isDefaultList: false
    const defaultSingle = jest.fn<AnyFn>().mockResolvedValue({ data: { is_default: false }, error: null });
    const defaultEq = jest.fn<AnyFn>().mockReturnValue({ single: defaultSingle });
    const defaultSelect = jest.fn<AnyFn>().mockReturnValue({ eq: defaultEq });

    // delete
    const deleteEq = jest.fn<AnyFn>().mockResolvedValue({ error: null });
    const deleteFn = jest.fn<AnyFn>().mockReturnValue({ eq: deleteEq });

    mockFrom
      .mockReturnValueOnce({ select: roleSelect })   // getListRole
      .mockReturnValueOnce({ select: defaultSelect }) // isDefaultList
      .mockReturnValueOnce({ delete: deleteFn });     // delete

    await deleteList({ supabaseClient, userId, listId: "l2" as any });

    expect(deleteFn).toHaveBeenCalled();
  });

  it("rejects deleting the default watchlist", async () => {
    const roleSingle = jest.fn<AnyFn>().mockResolvedValue({ data: { role: "owner" }, error: null });
    const roleEq3 = jest.fn<AnyFn>().mockReturnValue({ single: roleSingle });
    const roleEq2 = jest.fn<AnyFn>().mockReturnValue({ eq: roleEq3 });
    const roleEq1 = jest.fn<AnyFn>().mockReturnValue({ eq: roleEq2 });
    const roleSelect = jest.fn<AnyFn>().mockReturnValue({ eq: roleEq1 });

    const defaultSingle = jest.fn<AnyFn>().mockResolvedValue({ data: { is_default: true }, error: null });
    const defaultEq = jest.fn<AnyFn>().mockReturnValue({ single: defaultSingle });
    const defaultSelect = jest.fn<AnyFn>().mockReturnValue({ eq: defaultEq });

    mockFrom
      .mockReturnValueOnce({ select: roleSelect })
      .mockReturnValueOnce({ select: defaultSelect });

    await expect(deleteList({ supabaseClient, userId, listId: "l1" as any }))
      .rejects.toThrow("Cannot delete the default Watchlist");
  });

  it("rejects non-owner", async () => {
    const roleSingle = jest.fn<AnyFn>().mockResolvedValue({ data: null, error: { message: "not found" } });
    const roleEq3 = jest.fn<AnyFn>().mockReturnValue({ single: roleSingle });
    const roleEq2 = jest.fn<AnyFn>().mockReturnValue({ eq: roleEq3 });
    const roleEq1 = jest.fn<AnyFn>().mockReturnValue({ eq: roleEq2 });
    const roleSelect = jest.fn<AnyFn>().mockReturnValue({ eq: roleEq1 });
    mockFrom.mockReturnValueOnce({ select: roleSelect });

    await expect(deleteList({ supabaseClient, userId, listId: "l2" as any }))
      .rejects.toThrow("Access denied");
  });
});

// --- List Members ---

describe("createListInvite", () => {
  it("creates an invite code for a custom list", async () => {
    // getListRole: owner
    const roleSingle = jest.fn<AnyFn>().mockResolvedValue({ data: { role: "owner" }, error: null });
    const roleEq3 = jest.fn<AnyFn>().mockReturnValue({ single: roleSingle });
    const roleEq2 = jest.fn<AnyFn>().mockReturnValue({ eq: roleEq3 });
    const roleEq1 = jest.fn<AnyFn>().mockReturnValue({ eq: roleEq2 });
    const roleSelect = jest.fn<AnyFn>().mockReturnValue({ eq: roleEq1 });

    // isDefaultList: false
    const defaultSingle = jest.fn<AnyFn>().mockResolvedValue({ data: { is_default: false }, error: null });
    const defaultEq = jest.fn<AnyFn>().mockReturnValue({ single: defaultSingle });
    const defaultSelect = jest.fn<AnyFn>().mockReturnValue({ eq: defaultEq });

    // insert invite
    const inviteInsert = jest.fn<AnyFn>().mockResolvedValue({ error: null });

    mockFrom
      .mockReturnValueOnce({ select: roleSelect })
      .mockReturnValueOnce({ select: defaultSelect })
      .mockReturnValueOnce({ insert: inviteInsert });

    const result = await createListInvite({ supabaseClient, userId, listId: "l2" as any });

    expect(result.code).toBeDefined();
    expect(result.expiresAt).toBeDefined();
    expect(inviteInsert).toHaveBeenCalledWith(expect.objectContaining({
      list_id: "l2", user_id: userId,
    }));
  });

  it("rejects invite for default Watchlist", async () => {
    const roleSingle = jest.fn<AnyFn>().mockResolvedValue({ data: { role: "owner" }, error: null });
    const roleEq3 = jest.fn<AnyFn>().mockReturnValue({ single: roleSingle });
    const roleEq2 = jest.fn<AnyFn>().mockReturnValue({ eq: roleEq3 });
    const roleEq1 = jest.fn<AnyFn>().mockReturnValue({ eq: roleEq2 });
    const roleSelect = jest.fn<AnyFn>().mockReturnValue({ eq: roleEq1 });

    const defaultSingle = jest.fn<AnyFn>().mockResolvedValue({ data: { is_default: true }, error: null });
    const defaultEq = jest.fn<AnyFn>().mockReturnValue({ single: defaultSingle });
    const defaultSelect = jest.fn<AnyFn>().mockReturnValue({ eq: defaultEq });

    mockFrom
      .mockReturnValueOnce({ select: roleSelect })
      .mockReturnValueOnce({ select: defaultSelect });

    await expect(createListInvite({ supabaseClient, userId, listId: "l1" as any }))
      .rejects.toThrow("Cannot share the default Watchlist");
  });

  it("rejects non-owner", async () => {
    const roleSingle = jest.fn<AnyFn>().mockResolvedValue({ data: null, error: { message: "not found" } });
    const roleEq3 = jest.fn<AnyFn>().mockReturnValue({ single: roleSingle });
    const roleEq2 = jest.fn<AnyFn>().mockReturnValue({ eq: roleEq3 });
    const roleEq1 = jest.fn<AnyFn>().mockReturnValue({ eq: roleEq2 });
    const roleSelect = jest.fn<AnyFn>().mockReturnValue({ eq: roleEq1 });
    mockFrom.mockReturnValueOnce({ select: roleSelect });

    await expect(createListInvite({ supabaseClient, userId, listId: "l2" as any }))
      .rejects.toThrow("Access denied");
  });
});

describe("redeemListInvite", () => {
  const ownerId = "owner-1" as any;
  const redeemerId = "redeemer-1" as any;

  const mockInviteLookup = (data: any, error: any = null) => {
    const single = jest.fn<AnyFn>().mockResolvedValue({ data, error });
    const eq = jest.fn<AnyFn>().mockReturnValue({ single });
    const select = jest.fn<AnyFn>().mockReturnValue({ eq });
    return { select, eq, single };
  };

  it("redeems a valid invite and joins as collaborator", async () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString();

    // lookup invite
    const inviteLookup = mockInviteLookup({ list_id: "l2", user_id: ownerId, expires_at: futureDate });

    // checkIsFriends: true
    (checkIsFriends as jest.Mock<AnyFn>).mockResolvedValueOnce(true);

    // check existing membership: not found
    const memberSingle = jest.fn<AnyFn>().mockResolvedValue({ data: null, error: { message: "not found" } });
    const memberEq3 = jest.fn<AnyFn>().mockReturnValue({ single: memberSingle });
    const memberEq2 = jest.fn<AnyFn>().mockReturnValue({ eq: memberEq3 });
    const memberEq1 = jest.fn<AnyFn>().mockReturnValue({ eq: memberEq2 });
    const memberSelect = jest.fn<AnyFn>().mockReturnValue({ eq: memberEq1 });

    // insert member
    const memberInsert = jest.fn<AnyFn>().mockResolvedValue({ error: null });

    // fetch list name
    const listSingle = jest.fn<AnyFn>().mockResolvedValue({ data: { name: "Favorites" }, error: null });
    const listEq = jest.fn<AnyFn>().mockReturnValue({ single: listSingle });
    const listSelect = jest.fn<AnyFn>().mockReturnValue({ eq: listEq });

    mockFrom
      .mockReturnValueOnce({ select: inviteLookup.select })  // List_Invites lookup
      .mockReturnValueOnce({ select: memberSelect })          // List_Members check
      .mockReturnValueOnce({ insert: memberInsert })           // List_Members insert
      .mockReturnValueOnce({ select: listSelect });            // Lists name lookup

    const result = await redeemListInvite({ supabaseClient, userId: redeemerId, code: "abc123" });

    expect(result.listName).toBe("Favorites");
    expect(memberInsert).toHaveBeenCalledWith(expect.objectContaining({
      list_id: "l2", user_id: redeemerId, role: "collaborator", status: "accepted", invited_by: ownerId,
    }));
  });

  it("rejects expired invite", async () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString();
    const inviteLookup = mockInviteLookup({ list_id: "l2", user_id: ownerId, expires_at: pastDate });

    mockFrom.mockReturnValueOnce({ select: inviteLookup.select });

    await expect(redeemListInvite({ supabaseClient, userId: redeemerId, code: "expired" }))
      .rejects.toThrow("Invite not found or expired");
  });

  it("rejects self-redeem", async () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString();
    const inviteLookup = mockInviteLookup({ list_id: "l2", user_id: ownerId, expires_at: futureDate });

    mockFrom.mockReturnValueOnce({ select: inviteLookup.select });

    await expect(redeemListInvite({ supabaseClient, userId: ownerId, code: "self" }))
      .rejects.toThrow("Cannot redeem your own invite");
  });

  it("rejects non-friend of owner", async () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString();
    const inviteLookup = mockInviteLookup({ list_id: "l2", user_id: ownerId, expires_at: futureDate });

    (checkIsFriends as jest.Mock<AnyFn>).mockResolvedValueOnce(false);

    mockFrom.mockReturnValueOnce({ select: inviteLookup.select });

    await expect(redeemListInvite({ supabaseClient, userId: redeemerId, code: "nofriend" }))
      .rejects.toThrow("Must be friends with the list owner");
  });

  it("rejects already-member", async () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString();
    const inviteLookup = mockInviteLookup({ list_id: "l2", user_id: ownerId, expires_at: futureDate });

    (checkIsFriends as jest.Mock<AnyFn>).mockResolvedValueOnce(true);

    // existing membership found
    const memberSingle = jest.fn<AnyFn>().mockResolvedValue({ data: { member_id: "m1" }, error: null });
    const memberEq3 = jest.fn<AnyFn>().mockReturnValue({ single: memberSingle });
    const memberEq2 = jest.fn<AnyFn>().mockReturnValue({ eq: memberEq3 });
    const memberEq1 = jest.fn<AnyFn>().mockReturnValue({ eq: memberEq2 });
    const memberSelect = jest.fn<AnyFn>().mockReturnValue({ eq: memberEq1 });

    mockFrom
      .mockReturnValueOnce({ select: inviteLookup.select })
      .mockReturnValueOnce({ select: memberSelect });

    await expect(redeemListInvite({ supabaseClient, userId: redeemerId, code: "dupe" }))
      .rejects.toThrow("Already a member of this list");
  });
});

describe("removeMember", () => {
  it("owner removes a collaborator", async () => {
    const roleSingle = jest.fn<AnyFn>().mockResolvedValue({ data: { role: "owner" }, error: null });
    const roleEq3 = jest.fn<AnyFn>().mockReturnValue({ single: roleSingle });
    const roleEq2 = jest.fn<AnyFn>().mockReturnValue({ eq: roleEq3 });
    const roleEq1 = jest.fn<AnyFn>().mockReturnValue({ eq: roleEq2 });
    const roleSelect = jest.fn<AnyFn>().mockReturnValue({ eq: roleEq1 });

    const deleteEq3 = jest.fn<AnyFn>().mockResolvedValue({ error: null });
    const deleteEq2 = jest.fn<AnyFn>().mockReturnValue({ eq: deleteEq3 });
    const deleteEq1 = jest.fn<AnyFn>().mockReturnValue({ eq: deleteEq2 });
    const deleteFn = jest.fn<AnyFn>().mockReturnValue({ eq: deleteEq1 });

    mockFrom
      .mockReturnValueOnce({ select: roleSelect })
      .mockReturnValueOnce({ delete: deleteFn });

    await removeMember({ supabaseClient, userId, listId: "l2" as any, targetUserId: "collab-1" as any });

    expect(deleteFn).toHaveBeenCalled();
  });

  it("owner cannot remove themselves", async () => {
    const roleSingle = jest.fn<AnyFn>().mockResolvedValue({ data: { role: "owner" }, error: null });
    const roleEq3 = jest.fn<AnyFn>().mockReturnValue({ single: roleSingle });
    const roleEq2 = jest.fn<AnyFn>().mockReturnValue({ eq: roleEq3 });
    const roleEq1 = jest.fn<AnyFn>().mockReturnValue({ eq: roleEq2 });
    const roleSelect = jest.fn<AnyFn>().mockReturnValue({ eq: roleEq1 });
    mockFrom.mockReturnValueOnce({ select: roleSelect });

    await expect(removeMember({ supabaseClient, userId, listId: "l2" as any, targetUserId: userId }))
      .rejects.toThrow("Cannot remove yourself as owner");
  });
});

describe("getListInvites", () => {
  it("returns active invites for owner's list", async () => {
    // getListRole: owner
    const roleSingle = jest.fn<AnyFn>().mockResolvedValue({ data: { role: "owner" }, error: null });
    const roleEq3 = jest.fn<AnyFn>().mockReturnValue({ single: roleSingle });
    const roleEq2 = jest.fn<AnyFn>().mockReturnValue({ eq: roleEq3 });
    const roleEq1 = jest.fn<AnyFn>().mockReturnValue({ eq: roleEq2 });
    const roleSelect = jest.fn<AnyFn>().mockReturnValue({ eq: roleEq1 });

    // query List_Invites
    const invites = [{ code: "abc", created_at: "2024-01-01", expires_at: "2024-01-08" }];
    const order = jest.fn<AnyFn>().mockResolvedValue({ data: invites, error: null });
    const gt = jest.fn<AnyFn>().mockReturnValue({ order });
    const inviteEq2 = jest.fn<AnyFn>().mockReturnValue({ gt });
    const inviteEq1 = jest.fn<AnyFn>().mockReturnValue({ eq: inviteEq2 });
    const inviteSelect = jest.fn<AnyFn>().mockReturnValue({ eq: inviteEq1 });

    mockFrom
      .mockReturnValueOnce({ select: roleSelect })
      .mockReturnValueOnce({ select: inviteSelect });

    const result = await getListInvites({ supabaseClient, userId, listId: "l2" as any });

    expect(result).toEqual(invites);
  });

  it("rejects non-owner", async () => {
    const roleSingle = jest.fn<AnyFn>().mockResolvedValue({ data: null, error: { message: "not found" } });
    const roleEq3 = jest.fn<AnyFn>().mockReturnValue({ single: roleSingle });
    const roleEq2 = jest.fn<AnyFn>().mockReturnValue({ eq: roleEq3 });
    const roleEq1 = jest.fn<AnyFn>().mockReturnValue({ eq: roleEq2 });
    const roleSelect = jest.fn<AnyFn>().mockReturnValue({ eq: roleEq1 });
    mockFrom.mockReturnValueOnce({ select: roleSelect });

    await expect(getListInvites({ supabaseClient, userId, listId: "l2" as any }))
      .rejects.toThrow("Access denied");
  });
});

// --- addListItem with access control ---

describe("addListItem", () => {
  it("owner adds item to custom list", async () => {
    // isDefaultList: false
    const defaultSingle = jest.fn<AnyFn>().mockResolvedValue({ data: { is_default: false }, error: null });
    const defaultEq = jest.fn<AnyFn>().mockReturnValue({ single: defaultSingle });
    const defaultSelect = jest.fn<AnyFn>().mockReturnValue({ eq: defaultEq });

    // getListRole: owner
    const roleSingle = jest.fn<AnyFn>().mockResolvedValue({ data: { role: "owner" }, error: null });
    const roleEq3 = jest.fn<AnyFn>().mockReturnValue({ single: roleSingle });
    const roleEq2 = jest.fn<AnyFn>().mockReturnValue({ eq: roleEq3 });
    const roleEq1 = jest.fn<AnyFn>().mockReturnValue({ eq: roleEq2 });
    const roleSelect = jest.fn<AnyFn>().mockReturnValue({ eq: roleEq1 });

    // insert item
    const insertFn = jest.fn<AnyFn>().mockResolvedValue({ error: null });

    mockFrom
      .mockReturnValueOnce({ select: defaultSelect })  // isDefaultList
      .mockReturnValueOnce({ select: roleSelect })      // getListRole
      .mockReturnValueOnce({ insert: insertFn });        // insert item

    await addListItem({
      supabaseClient, userId, listId: "l2" as any,
      tmdbId: 42, title: "Drama", genre_ids: [18], poster_url: "https://img.com/p.jpg",
      accessToken: "token",
    });

    expect(insertFn).toHaveBeenCalledWith(expect.objectContaining({ tmdb_id: 42, title: "Drama" }));
    expect(insertInteractionEvents).toHaveBeenCalled();
    expect(updateEmbeddingQueue.add).toHaveBeenCalledWith("recompute", expect.objectContaining({ rating: 1.5 }));
  });
});
