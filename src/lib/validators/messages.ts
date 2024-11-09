import { z } from "zod";

export const messageValidator = z.object({
  id: z.string(),
  senderId: z.string(),
  senderImage: z.string().optional(),
  senderName: z.string().optional(),
  text: z.string(),
  timestamp: z.number(),
});

export const messageListValidator = z.array(messageValidator);

export type Message = z.infer<typeof messageValidator>;
