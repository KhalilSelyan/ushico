# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Ushico is a Next.js 13 social video-watching application that allows users to watch videos together with friends in real-time. The app features user authentication, friend management, real-time messaging, synchronized video playback, and collaborative movie voting.

## Commands

- `pnpm dev` - Start development server
- `pnpm build` - Build production application
- `pnpm lint` - Run ESLint linting
- `pnpm db:generate` - Generate Drizzle schema migrations
- `pnpm db:migrate` - Run database migrations
- `pnpm db:push` - Push schema changes to database
- `pnpm db:studio` - Open Drizzle Studio for database management

## Architecture

### Tech Stack
- **Framework**: Next.js 13 with App Router
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Better Auth with Google OAuth
- **Styling**: Tailwind CSS with shadcn/ui components
- **Real-time**: WebSocket service (Go backend) for live sync and messaging
- **State Management**: React hooks with WebSocket synchronization

### Directory Structure
- `src/app/` - Next.js 13 App Router pages and API routes
  - `(auth)/` - Authentication pages
  - `(dashboard)/` - Main app dashboard, friends, movies, chat
  - `(watch)/` - Video watching interface
  - `api/` - Backend API endpoints for friends, messages, movies, rooms
- `src/components/` - React components including VideoPlayer, chat interface
- `src/db/` - Database schema, queries, and connection
- `src/lib/` - Utilities including WebSocket service and validators
- `src/auth/` - Better Auth configuration

### Database Schema
Main entities in `src/db/schema.ts`:
- **Users/Sessions/Accounts**: Authentication and profile data (Better Auth)
- **Friends/FriendRequests**: Bidirectional friendship system
- **Messages**: Direct messages between friends
- **Movies/MovieVotes**: TMDb movie cache and voting (upvote/downvote/neutral)
- **Rooms**: Watch party rooms with host, ephemeral rooms support, invite codes
- **RoomParticipants**: Users in rooms with roles (host/viewer)
- **RoomMessages**: Chat within rooms (separate from direct messages)
- **RoomInvitations/RoomJoinRequests**: Room access management

### WebSocket Integration
Real-time features via `src/lib/websocket.ts` connecting to Go WebSocket server:
- Channel-based pub/sub with event subscription
- Room events: `host_sync`, `room_message`, `participant_joined/left`, `host_transferred`
- UX features: `user_typing`, `video_reaction`, `room_announcement`
- Presence system: `user_presence_update`, `get_room_presence`
- Auto-reconnection with exponential backoff

### Key Patterns
- Tables use `_table` suffix via `pgTableCreator`
- WebSocket requires `userID` query param for authenticated connections
- Rooms support ephemeral mode (auto-delete after expiration)

## Development Notes

- Uses pnpm as package manager
- All branches should be created from `dev` branch
- Authentication requires Google OAuth credentials in environment variables
- Database requires PostgreSQL connection string in `DATABASE_URL`
- WebSocket server endpoint via `NEXT_PUBLIC_WEBSOCKET_URL`
