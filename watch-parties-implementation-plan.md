# Multi-Person Watch Parties Implementation Plan

## Overview

Convert the current 1-on-1 watch system (`user1--user2` chatIds) to support multi-person watch parties with rooms, hosts, and viewers.

## Phase 1: Database Schema Updates (30 minutes)

### New Tables

```sql
-- Room table
CREATE TABLE room_table (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  host_id TEXT NOT NULL REFERENCES user_table(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Room participants
CREATE TABLE room_participant_table (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES room_table(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES user_table(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('host', 'viewer')),
  joined_at TIMESTAMP DEFAULT NOW()
);

-- Room messages (replace direct messages in rooms)
CREATE TABLE room_message_table (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES room_table(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL REFERENCES user_table(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  timestamp TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Schema Changes in `src/db/schema.ts`

- Add `room`, `roomParticipant`, `roomMessage` tables with proper relations
- Keep existing `message` table for direct messages (maintain backward compatibility)

## Phase 2: Database Queries & API Routes (2 hours)

### New Functions in `src/db/queries.ts`

- `createRoom(hostId: string, name: string, invitedUserIds: string[])`
- `joinRoom(roomId: string, userId: string)`
- `leaveRoom(roomId: string, userId: string)`
- `getRoomById(roomId: string)` with participants
- `getRoomMessages(roomId: string)`
- `sendRoomMessage(roomId: string, senderId: string, text: string)`
- `transferRoomHost(roomId: string, newHostId: string)`
- `getUserRooms(userId: string)` - active rooms user is in
- `validateRoomAccess(roomId: string, userId: string)`

### New API Routes

- `POST /api/rooms/create` - Create new room and invite friends
- `POST /api/rooms/join` - Join existing room (by invite/code)
- `POST /api/rooms/leave` - Leave room
- `POST /api/rooms/transfer-host` - Transfer host role
- `GET /api/rooms/[roomId]` - Get room details and participants
- `POST /api/rooms/[roomId]/messages` - Send room message
- `GET /api/rooms/[roomId]/messages` - Get room messages

## Phase 3: URL Structure Migration (1 hour)

### Route Changes

- **Current**: `/watch/user1--user2`
- **New**: `/watch/room/[roomId]`
- **Backward Compatibility**: Redirect old chatId URLs to create temporary rooms

### Files to Update

- `src/app/(watch)/watch/[chatId]/` → `src/app/(watch)/watch/room/[roomId]/`
- Update all `chatId.split('--')` references to use `roomId`
- Add redirect middleware for old URLs

## Phase 4: WebSocket Client Updates (1 hour)

### Message Type Updates in `src/lib/websocket.ts`

```typescript
export type WebSocketEvent =
  | "incoming_message"
  | "new_message"
  | "new_friend"
  | "incoming_friend_request"
  | "friend_request_denied"
  | "friend_request_accepted"
  | "friend_removed"
  | "subscribe"
  | "unsubscribe"
  | "sync"
  // NEW ROOM EVENTS
  | "create_room"
  | "join_room"
  | "leave_room"
  | "host_sync"  // renamed from "sync"
  | "room_message"
  | "participant_joined"
  | "participant_left"
  | "host_transferred";
```

### Channel Format Changes

- **Current**: `sync-user1--user2`, `message-user1--user2`
- **New**: `room-{roomId}` for both sync and messages
- **Subscription Logic**: Subscribe to `room-{roomId}` instead of user-pair channels

## Phase 5: Component Updates (4-5 hours)

### 1. VideoPlayer Component (`src/components/VideoPlayer.tsx`)

**Changes Needed:**

- Replace `chatId` prop with `roomId`
- Add `userRole: 'host' | 'viewer'` prop
- Add `participants: User[]` prop for participant list
- **Host Controls**: Only show URL input and controls to host
- **Viewer UI**: Show "Only host can control playback" message
- **Participant List**: Show avatars of all room participants
- **WebSocket**: Subscribe to `room-{roomId}` instead of `sync-{chatId}`
- **Sync Events**: Send `host_sync` instead of `sync` (host only)

### 2. New Room Management Components

#### `src/components/CreateRoomModal.tsx`

- Room name input
- Friend selection (checkboxes from friends list)
- Create room button
- Generate shareable room code/link

#### `src/components/RoomParticipantsList.tsx`

- Display participant avatars and names
- Show host badge
- Leave room button
- Transfer host controls (host only)
- Kick participant (host only)

#### `src/components/RoomInviteModal.tsx`

- Copy room link
- Send invites to specific friends
- Room code display

### 3. Messages Component Updates (`src/components/Messages.tsx`)

- Support both `chatId` (direct) and `roomId` (room) modes
- Handle room messages vs direct messages
- Show participant join/leave notifications
- Display sender names (not just partner name)

### 4. Layout Updates

- `src/app/(watch)/watch/room/[roomId]/layout.tsx` - New room-based layout
- `src/app/(watch)/watch/room/[roomId]/page.tsx` - Room watch page
- Add room participant list to sidebar
- Room name in header instead of chat partner name

## Phase 6: Dashboard Integration (2 hours)

### 1. Dashboard Updates (`src/app/(dashboard)/dashboard/page.tsx`)

- Add "Create Watch Party" button
- Show active rooms user is in
- Show room invitations received

### 2. Friends Page Updates (`src/app/(dashboard)/dashboard/friends/page.tsx`)

- Add "Invite to Watch Party" button for each friend
- Show friends' active rooms (if public)

### 3. New Movies Page Integration (`src/app/(dashboard)/dashboard/movies/page.tsx`)

- "Watch Together" button that creates room and invites friends
- Integrate with room creation flow

## Phase 7: Migration Strategy (1 hour)

### Backward Compatibility

1. **URL Redirects**: `/watch/user1--user2` → create temporary room with those users
2. **Direct Messages**: Keep existing 1-on-1 messaging system
3. **Database Migration**: Add new tables without breaking existing data
4. **Feature Flag**: Enable rooms gradually, keep 1-on-1 as fallback

### Migration Script

```typescript
// Convert existing watch sessions to rooms if active
async function migrateActiveSessions() {
  // Find active WebSocket sessions
  // Create temporary rooms for active watch sessions
  // Maintain backward compatibility during transition
}
```

## Phase 8: Testing & Polish (2 hours)

### Testing Scenarios

- Host creates room, invites friends
- Multiple viewers join and sync correctly
- Host transfers to another participant
- Host disconnects, room management
- Room chat with multiple participants
- Mobile responsiveness for room UI

### Edge Cases

- **Host Disconnection**: Transfer to longest-connected participant
- **Empty Room**: Auto-close after timeout
- **Permission Changes**: Real-time updates via WebSocket
- **Network Issues**: Graceful reconnection and sync

## Total Estimated Time: 12-15 hours

- **Database & Backend**: 3-4 hours
- **Frontend Components**: 6-7 hours
- **Integration & Testing**: 2-3 hours
- **Migration & Polish**: 1-2 hours

## Implementation Order

1. Database schema and queries
2. API routes for room management
3. WebSocket message type updates
4. Core VideoPlayer component changes
5. Room management UI components
6. Layout and navigation updates
7. Dashboard integration
8. Migration and testing

This plan maintains backward compatibility while adding comprehensive multi-person watch party functionality that builds naturally on your existing WebSocket and component architecture.

## Key Benefits of This Approach

### Leverages Existing Architecture

- **WebSocket Service**: Already supports multi-subscriber channels - perfect for rooms
- **VideoPlayer**: Host/watcher pattern already exists, just needs role-based permissions
- **Messages Component**: Group chat pattern can be extended for room chat
- **Database**: Clean schema that extends naturally

### Maintains Backward Compatibility

- Keep existing 1-on-1 messaging and watch functionality
- Gradual migration path for users
- Old URLs redirect to equivalent room functionality

### Scalable Design

- Room-based architecture supports any number of participants
- Clear host/viewer role separation
- Real-time updates via existing WebSocket infrastructure
- Permission system ready for future features (moderators, etc.)

### Implementation Highlights

- **Go Backend**: Minimal changes needed (~400-500 lines as analyzed)
- **Frontend**: Clean component architecture with reusable patterns
- **Database**: Normalized design with proper relationships
- **Real-time**: Leverages existing WebSocket service optimally

This approach transforms your 1-on-1 watch experience into a full-featured watch party platform while maintaining the simplicity and performance of your current architecture.
