/* eslint-disable @next/next/no-img-element */
"use client";

import { Transition, Dialog } from "@headlessui/react";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { FC, Fragment, useEffect, useState } from "react";
import { Icons } from "./Icons";
import SignOutButton from "./SignoutButton";
import Button, { buttonVariants } from "./ui/Button";
import { usePathname } from "next/navigation";
import Messages from "./Messages";
import ChatInput from "./ChatInput";
import { User } from "next-auth";

interface MobileChatWatchLayoutProps {
  chatId: string;
  user: User;
  chatPartner: User;
  initialMessages: Message[];
}

const MobileChatWatchLayout: FC<MobileChatWatchLayoutProps> = ({
  chatId,
  user,
  chatPartner,
  initialMessages,
}) => {
  const [open, setOpen] = useState<boolean>(false);

  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="fixed bg-zinc-50 border-b border-zinc-200 top-0 inset-x-0 py-2 px-4">
      <div className="w-full flex justify-between items-center">
        <Link
          href="/dashboard"
          className={buttonVariants({ variant: "ghost" })}
        >
          <Icons.Logo className="h-6 w-auto text-indigo-600" />
        </Link>
        <Button onClick={() => setOpen(true)} className="gap-4">
          Menu <Menu className="h-6 w-6" />
        </Button>
      </div>
      <Transition.Root show={open} as={Fragment}>
        <Dialog as="div" className="relative z-10" onClose={setOpen}>
          <div className="fixed inset-0" />

          <div className="fixed inset-0 overflow-hidden">
            <div className="absolute inset-0 overflow-hidden">
              <div className="pointer-events-none fixed inset-y-0 left-0 flex max-w-full pr-10">
                <Transition.Child
                  as={Fragment}
                  enter="transform transition ease-in-out duration-500 sm:duration-700"
                  enterFrom="-translate-x-full"
                  enterTo="translate-x-0"
                  leave="transform transition ease-in-out duration-500 sm:duration-700"
                  leaveFrom="translate-x-0"
                  leaveTo="-translate-x-full"
                >
                  <Dialog.Panel className="pointer-events-auto w-screen max-w-md">
                    <div className="flex h-full flex-col overflow-hidden bg-white py-6 shadow-xl">
                      <div className="px-4 sm:px-6">
                        <div className="flex items-start justify-between">
                          <div className="ml-3 flex h-7 items-center">
                            <button
                              type="button"
                              className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                              onClick={() => setOpen(false)}
                            >
                              <span className="sr-only">Close panel</span>
                              <X className="h-6 w-6" aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="relative h-full mt-6 flex-1 px-4 sm:px-6">
                        {/* Content */}
                        <nav className="flex flex-col h-full flex-1">
                          <ul
                            role="list"
                            className="flex flex-1 flex-col gap-y-4 justify-between"
                          >
                            <li className="max-h-[36rem]">
                              <Messages
                                chatId={chatId}
                                user={user}
                                chatPartner={chatPartner}
                                initialMessages={initialMessages}
                              />
                            </li>
                            <li className="-mx-6 flex flex-col w-full justify-center">
                              <ChatInput
                                chatId={chatId}
                                user={user}
                                chatPartner={chatPartner}
                              />
                              <div className="flex flex-row items-center">
                                <div className="flex flex-1 items-center gap-x-4 px-6 py-3 text-sm font-semibold leading-6 text-gray-900">
                                  <div className="relative h-8 w-8 bg-gray-50">
                                    <img
                                      referrerPolicy="no-referrer"
                                      className="rounded-full"
                                      src={user.image || ""}
                                      alt="user profile image"
                                    />
                                  </div>
                                  <span className="sr-only">Your Profile</span>
                                  <div className="flex flex-col">
                                    <span aria-hidden="true">{user.name}</span>
                                    <span
                                      className="text-xs text-zinc-400"
                                      aria-hidden="true"
                                    >
                                      {user.email}
                                    </span>
                                  </div>
                                </div>
                                <SignOutButton className="h-full aspect-square" />
                              </div>
                            </li>
                          </ul>
                        </nav>

                        {/* content end */}
                      </div>
                    </div>
                  </Dialog.Panel>
                </Transition.Child>
              </div>
            </div>
          </div>
        </Dialog>
      </Transition.Root>
    </div>
  );
};

export default MobileChatWatchLayout;
