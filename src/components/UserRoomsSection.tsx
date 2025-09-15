"use client";

import { Room } from "@/db/schema";
import { Plus, Users, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface UserRoomsSectionProps {
  rooms: Room[];
  onCreateRoom: () => void;
  onJoinRoom: (roomId: string) => void;
}

export default function UserRoomsSection({
  rooms,
  onCreateRoom,
  onJoinRoom,
}: UserRoomsSectionProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Watch Parties
          </CardTitle>
          <Button onClick={onCreateRoom} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Create Party
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {rooms.length === 0 ? (
          <div className="text-center py-8">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">
              No Active Watch Parties
            </h3>
            <p className="text-muted-foreground mb-4">
              Create a watch party to start watching videos with friends
            </p>
            <Button onClick={onCreateRoom}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Party
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {rooms.map((room) => (
              <div
                key={room.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Play className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-medium">{room.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      Created {new Date(room.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <div className="flex items-center text-xs text-muted-foreground">
                    <div className="h-2 w-2 bg-green-500 rounded-full mr-1" />
                    Active
                  </div>
                  <Button size="sm" onClick={() => onJoinRoom(room.id)}>
                    Join
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
