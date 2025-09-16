/* eslint-disable @next/next/no-img-element */
import { auth } from "@/auth/auth";
import { getUserRooms, getUserRoomInvitations } from "@/db/queries";
import { getFriendsById } from "@/helpers/getfriendsbyid";
import { headers } from "next/headers";
import DashboardClient from "@/components/DashboardClient";


const page = async () => {
  const session = await auth.api.getSession({
    headers: headers(),
  });
  if (!session?.user?.id) {
    return null;
  }

  // Fetch all data in parallel
  const [friends, rooms, invitations] = await Promise.all([
    getFriendsById(session.user.id),
    getUserRooms(session.user.id),
    getUserRoomInvitations(session.user.id),
  ]);

  return (
    <DashboardClient
      user={session.user}
      friends={friends}
      rooms={rooms}
      invitations={invitations}
    />
  );
};

export default page;
