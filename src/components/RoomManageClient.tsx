"use client";

import { useState, useEffect } from "react";
import { User } from "better-auth";
import { Room, RoomJoinRequest } from "@/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, UserCheck, UserX, Clock, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { getWebSocketService } from "@/lib/websocket";

interface RoomManageClientProps {
  room: Room;
  user: User;
}

type JoinRequestWithRequester = RoomJoinRequest & { requester: User };

export default function RoomManageClient({ room, user }: RoomManageClientProps) {
  const router = useRouter();
  const [joinRequests, setJoinRequests] = useState<JoinRequestWithRequester[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingRequest, setProcessingRequest] = useState<string | null>(null);

  useEffect(() => {
    fetchJoinRequests();

    // Set up WebSocket listener for new join requests
    const wsService = getWebSocketService(user.id);
    const unsubscribe = wsService.subscribe(
      `user-${user.id}`,
      "room_join_request",
      (data: any) => {
        if (data.roomId === room.id) {
          // Add new join request to the list
          setJoinRequests(prev => [...prev, {
            id: data.id,
            roomId: data.roomId,
            requesterId: data.requesterId,
            message: data.message,
            status: "pending" as const,
            createdAt: data.timestamp,
            updatedAt: data.timestamp,
            requester: {
              id: data.requesterId,
              name: data.requesterName,
              image: data.requesterImage,
              email: "",
              emailVerified: false,
              createdAt: new Date(data.timestamp),
              updatedAt: new Date(data.timestamp),
            }
          }]);
        }
      }
    );

    return () => {
      unsubscribe.then(unsub => unsub());
    };
  }, [room.id, user.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchJoinRequests = async () => {
    try {
      const response = await fetch(`/api/rooms/${room.id}/join-requests`);
      if (response.ok) {
        const data = await response.json();
        setJoinRequests(data.requests);
      }
    } catch (error) {
      console.error("Error fetching join requests:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequest = async (requestId: string, action: "approve" | "deny") => {
    setProcessingRequest(requestId);

    try {
      const response = await fetch(`/api/rooms/${room.id}/join-requests/${requestId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (response.ok) {
        // Remove the processed request from the list
        setJoinRequests(prev => prev.filter(req => req.id !== requestId));
      } else {
        alert(`Failed to ${action} request. Please try again.`);
      }
    } catch (error) {
      console.error(`Error ${action}ing request:`, error);
      alert(`Failed to ${action} request. Please try again.`);
    } finally {
      setProcessingRequest(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Manage Room</h1>
            <p className="text-muted-foreground">{room.name}</p>
          </div>
        </div>
        <Button onClick={() => router.push(`/watch/room/${room.id}`)}>
          Go to Room
        </Button>
      </div>

      {/* Room Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Room Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Room Code:</span>
              <Badge variant="outline" className="ml-2 font-mono">
                {room.roomCode}
              </Badge>
            </div>
            <div>
              <span className="font-medium">Created:</span>
              <span className="ml-2">
                {formatDistanceToNow(new Date(room.createdAt), { addSuffix: true })}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Join Requests */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Pending Join Requests
            {joinRequests.length > 0 && (
              <Badge variant="secondary">{joinRequests.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading requests...
            </div>
          ) : joinRequests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No pending join requests</p>
            </div>
          ) : (
            <div className="space-y-4">
              {joinRequests.map((request) => (
                <div
                  key={request.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={request.requester.image || ""} />
                      <AvatarFallback>
                        {request.requester.name?.charAt(0) || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{request.requester.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}
                      </p>
                      {request.message && (
                        <p className="text-sm text-muted-foreground mt-1 italic">
                          &ldquo;{request.message}&rdquo;
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRequest(request.id, "deny")}
                      disabled={processingRequest === request.id}
                      className="text-red-600 hover:text-red-700"
                    >
                      <UserX className="h-4 w-4 mr-1" />
                      Deny
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleRequest(request.id, "approve")}
                      disabled={processingRequest === request.id}
                    >
                      <UserCheck className="h-4 w-4 mr-1" />
                      Approve
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}