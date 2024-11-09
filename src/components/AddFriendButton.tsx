"use client";
import { FC, useState } from "react";
import Button from "./ui/Button";
import axios, { AxiosError } from "axios";
import { AddFriend, addFriendValidator } from "@/lib/validators/add-friend";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSession } from "next-auth/react";
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
      const validatedEmail = addFriendValidator.parse({
        email,
      });

      const response = await axios.post("/api/friends/add", {
        email: validatedEmail,
      });

      const { idToAdd } = response.data;

      if (session) {
        // Send WebSocket message to the recipient's channel
        wsService.send(
          `user:${idToAdd}:incoming_friend_requests`,
          "incoming_friend_request",
          {
            senderId: session.user.id,
            senderEmail: session.user.email,
            senderName: session.user.name,
            senderImage: session.user.image,
          }
        );
      } else {
        console.error("User is not authenticated");
      }

      setShowSuccessState(true);
    } catch (err) {
      if (err instanceof z.ZodError) {
        setError("email", {
          message: err.message,
        });
        return;
      }
      if (err instanceof AxiosError) {
        setError("email", {
          message: err.response?.data,
        });
        return;
      }

      setError("email", {
        message: "Something went wrong",
      });
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
