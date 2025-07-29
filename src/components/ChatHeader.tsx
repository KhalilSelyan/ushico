/* eslint-disable @next/next/no-img-element */
"use client";

import { Film, MonitorPlay, User2Icon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import ChooseMovieTogether from "./ChooseMovieTogether";

interface ChatHeaderProps {
  chatPartner: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
  };
  chatId: string;
}

export default function ChatHeader({ chatPartner, chatId }: ChatHeaderProps) {
  const [showChooseMovie, setShowChooseMovie] = useState(false);

  return (
    <>
      <div className="flex sm:items-center justify-between py-3 px-4 border-b-2 border-gray-200">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <div className="relative -z-10 h-8 sm:h-12 w-8 sm:w-12">
              {chatPartner.image ? (
                <img
                  src={chatPartner.image}
                  referrerPolicy="no-referrer"
                  alt={`${chatPartner.name} profile`}
                  className="rounded-full -z-10 object-cover"
                />
              ) : (
                <User2Icon className="h-8 sm:h-12 w-8 sm:w-12" />
              )}
            </div>
          </div>
          <div className="flex flex-col">
            <h2 className="text-lg sm:text-2xl font-semibold text-gray-800">
              {chatPartner.name}
            </h2>
            <p className="text-xs sm:text-sm text-gray-500">
              {chatPartner.email}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setShowChooseMovie(true)}
            className="p-2 text-gray-400 hover:text-indigo-600 transition-colors"
            title="Choose Movie Together"
          >
            <Film className="h-6 w-6" />
          </button>
          <Link href={`/watch/${chatId}`}>
            <MonitorPlay className="h-8 w-8 text-gray-400 hover:text-indigo-600 cursor-pointer" />
          </Link>
        </div>
      </div>

      {showChooseMovie && (
        <ChooseMovieTogether
          friendId={chatPartner.id}
          friendName={chatPartner.name}
          onClose={() => setShowChooseMovie(false)}
        />
      )}
    </>
  );
}
