import { fetchRedis } from "./redis";

export async function getFriendsById(id: string) {
  const friendIds = (await fetchRedis(
    "smembers",
    `unstorage:user:${id}:friends`
  )) as string[];

  const friends = await Promise.allSettled(
    friendIds.map(async (friendId) =>
      JSON.parse(await fetchRedis("get", `unstorage:user:${friendId}`))
    )
  );

  const friendsFailed = friends.filter(
    (friend) => friend.status === "rejected"
  );

  const friendsResolved = friends
    .filter(
      (friend): friend is PromiseFulfilledResult<User> =>
        friend.status === "fulfilled"
    )
    .map((friend) => {
      return friend.value;
    });

  return friendsResolved;
}

export async function getSpecificUserById(id: string) {
  console.log("getSpecificUserById", id);
  return JSON.parse(await fetchRedis("get", `unstorage:user:${id}`)) as User;
}
