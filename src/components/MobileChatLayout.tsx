/* eslint-disable @next/next/no-img-element */
"use client";

import { Icons } from "@/components/Icons";
import { Session, User } from "better-auth";
import Link from "next/link";
import SidebarChatList from "./SidebarChatList";
import SignOutButton from "./SignoutButton";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import FriendRequestBadge from "./FriendRequestBadge";
import { FC } from "react";

interface SidebarOption {
  id: number;
  name: string;
  href: string;
  Icon: keyof typeof Icons;
}

interface MobileChatLayoutProps {
  friends: User[];
  session: {
    user: User;
  };
  sidebarOptions: SidebarOption[];
  unseenRequestCount: number;
}

const MobileChatLayout: FC<MobileChatLayoutProps> = ({
  friends,
  session,
  sidebarOptions,
  unseenRequestCount,
}) => {
  const [open, setOpen] = useState<boolean>(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="fixed top-0 z-40 w-full md:hidden">
      <div className="flex h-16 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm">
        <div className="flex flex-1 items-center gap-x-4 justify-between">
          <Link href="/dashboard" className="-m-1.5 p-1.5">
            <Icons.Logo className="h-8 w-auto text-indigo-600" />
          </Link>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-md text-gray-500 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
            onClick={() => setOpen(true)}
          >
            <span className="sr-only">Open sidebar</span>
            <Icons.Menu className="h-6 w-6" />
          </button>
        </div>
      </div>

      {/* Mobile sidebar */}
      {open && (
        <div className="fixed inset-0 z-40 flex">
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-gray-600 bg-opacity-75 transition-opacity"
            onClick={() => setOpen(false)}
          />

          {/* Sidebar */}
          <div className="relative flex w-full max-w-xs flex-1 flex-col bg-white pb-4">
            <div className="absolute right-0 top-0 -mr-12 pt-4">
              <button
                type="button"
                className="ml-1 flex h-10 w-10 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                onClick={() => setOpen(false)}
              >
                <span className="sr-only">Close sidebar</span>
                <Icons.X className="h-6 w-6 text-white" />
              </button>
            </div>

            {/* Sidebar content */}
            <div className="flex flex-1 flex-col overflow-y-auto pt-5">
              <div className="flex items-center justify-between px-4">
                <Link href="/dashboard" className="flex items-center gap-x-2">
                  <Icons.Logo className="h-8 w-auto text-indigo-600" />
                </Link>
                <SignOutButton className="h-8 w-8" />
              </div>

              <div className="mt-5 flex-1 px-2">
                <nav className="flex-1 space-y-1">
                  <div className="text-xs font-semibold leading-6 text-gray-400">
                    Your chats
                  </div>
                  <SidebarChatList chats={friends} userId={session.user.id} />
                </nav>
              </div>

              <div className="mt-5 px-2">
                <nav className="space-y-1">
                  <div className="text-xs font-semibold leading-6 text-gray-400">
                    Overview
                  </div>
                  <ul role="list" className="-mx-2 mt-2 space-y-1">
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
                </nav>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileChatLayout;
