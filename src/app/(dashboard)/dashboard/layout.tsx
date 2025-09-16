/* eslint-disable @next/next/no-img-element */

import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth/auth";
import FriendRequestBadge from "@/components/FriendRequestBadge";
import { Icons } from "@/components/Icons";
import MobileChatLayout from "@/components/MobileChatLayout";
import SignoutButton from "@/components/SignoutButton";
import { getUnseenFriendRequestCount } from "@/db/queries";
import { getFriendsById } from "@/helpers/getfriendsbyid";

interface LayoutProps {
  children: React.ReactNode;
}

interface SidebarOption {
  id: number;
  name: string;
  href: string;
  Icon: keyof typeof Icons;
}

const sidebarOptions: SidebarOption[] = [
  {
    id: 1,
    name: "Friends",
    href: "/dashboard/friends",
    Icon: "Users",
  },
  {
    id: 2,
    name: "Movies",
    href: "/dashboard/movies",
    Icon: "Film",
  },
];

const Layout = async ({ children }: LayoutProps) => {
  const session = await auth.api.getSession({
    headers: headers(),
  });
  if (!session) return redirect("/login");

  const [friends, unseenRequestCount] = await Promise.all([
    getFriendsById(session.user.id),
    getUnseenFriendRequestCount(session.user.id),
  ]);

  return (
    <div className="flex h-screen w-full">
      {/* Mobile navigation */}
      <div className="md:hidden">
        <MobileChatLayout
          friends={friends}
          session={{ user: session.user }}
          sidebarOptions={sidebarOptions}
          unseenRequestCount={unseenRequestCount}
        />
      </div>

      {/* Desktop sidebar */}
      <div className="hidden md:flex md:w-72 md:flex-col">
        <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-gray-200 bg-white px-6 pb-4">
          <div className="flex h-16 shrink-0 items-center">
            <Link href="/dashboard" className="flex items-center gap-x-2">
              <Icons.Logo className="h-8 w-auto text-indigo-600" />
            </Link>
          </div>
          <nav className="flex flex-1 flex-col">
            <ul className="flex flex-1 flex-col gap-y-7">
              <li>
                <div className="text-xs font-semibold leading-6 text-gray-400">
                  Overview
                </div>
                <ul className="-mx-2 mt-2 space-y-1">
                  {sidebarOptions.map((option) => {
                    const Icon = Icons[option.Icon];
                    return (
                      <li key={option.name}>
                        <Link
                          href={option.href}
                          className="text-gray-700 hover:text-indigo-600 hover:bg-gray-50 group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold"
                        >
                          <span className="text-gray-400 border-gray-200 group-hover:border-indigo-600 group-hover:text-indigo-600 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border text-[0.625rem] font-medium bg-white">
                            <Icon className="h-4 w-4" />
                          </span>
                          <span className="truncate">{option.name}</span>
                          {option.name === "Friends" && (
                            <FriendRequestBadge
                              initialUnseenRequestCount={unseenRequestCount}
                              userId={session.user.id}
                            />
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </li>
              <li className="mt-auto">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-x-4 py-3 text-sm font-semibold leading-6 text-gray-900">
                    <div className="relative h-8 w-8 bg-gray-50">
                      <img
                        referrerPolicy="no-referrer"
                        className="rounded-full h-full w-full object-cover"
                        src={session.user.image || ""}
                        alt="user profile "
                      />
                    </div>
                    <span className="sr-only">Your Profile</span>
                    <div className="flex flex-col">
                      <span aria-hidden="true">{session.user.name}</span>
                      <span
                        className="text-xs text-zinc-400"
                        aria-hidden="true"
                      >
                        {session.user.email}
                      </span>
                    </div>
                    <SignoutButton className="h-8 w-8" />
                  </div>
                </div>
              </li>
            </ul>
          </nav>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 md:pt-0">
        <div className="h-full pt-16 md:pt-0">{children}</div>
      </main>
    </div>
  );
};

export default Layout;
