"use client";
import { AddFriend, addFriendValidator } from "@/lib/validators/add-friend";
import { zodResolver } from "@hookform/resolvers/zod";
import axios, { AxiosError } from "axios";
import { FC, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import Button from "./ui/Button";

import { useSession } from "@/auth/auth-client";
import { wsService } from "@/lib/websocket";

interface AddFriendButtonProps {}

type FormData = AddFriend;

const AddFriendButton: FC<AddFriendButtonProps> = ({}) => {
  const { data: session } = useSession();
  const [showSuccessState, setShowSuccessState] = useState(false);

  const {
    register,
    formState: { errors },
    setError,
    handleSubmit,
  } = useForm<FormData>({
    resolver: zodResolver(addFriendValidator),
  });

  const addFriend = async (email: string) => {
    try {
      const validatedEmail = addFriendValidator.parse({ email });

      const response = await axios.post("/api/friends/add", {
        email: validatedEmail.email,
      });

      const { request, receiver } = response.data;

      if (session) {
        // Send WebSocket message to notify the receiver
        // Using the channel format: user:{userId}:incoming_friend_requests
        const channel = `user:${receiver.id}:incoming_friend_requests`;
        await wsService.send(channel, "incoming_friend_request", {
          senderId: session.user.id,
          senderEmail: session.user.email,
          senderName: session.user.name,
          senderImage: session.user.image,
          requestId: request.id,
          timestamp: new Date().toISOString(),
        });
      }

      setShowSuccessState(true);
    } catch (err) {
      if (err instanceof z.ZodError) {
        setError("email", { message: err.message });
        return;
      }
      if (err instanceof AxiosError) {
        setError("email", {
          message: err.response?.data?.error || "Something went wrong",
        });
        return;
      }

      setError("email", { message: "Something went wrong" });
    }
  };

  const onSubmit = async (data: FormData) => {
    await addFriend(data.email);
  };

  return (
    <form className="max-w-sm" onSubmit={handleSubmit(onSubmit)}>
      <label
        htmlFor="email"
        className="block text-sm font-medium leading-6 text-gray-900"
      >
        Add friend by Email
      </label>
      <div className="mt-2 flex gap-4">
        <input
          {...register("email")}
          type="text"
          className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-600 sm:text-sm sm:leading-6"
          placeholder="you@example.com"
        />
        <Button type="submit">Add</Button>
      </div>
      <p className="mt-1 text-sm text-red-600" id="email-error">
        {errors.email?.message}
      </p>
      {showSuccessState && (
        <p className="mt-1 text-sm text-green-600" id="email-success">
          Friend request sent successfully
        </p>
      )}
    </form>
  );
};

export default AddFriendButton;
