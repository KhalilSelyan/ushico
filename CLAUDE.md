# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Ushico is a Next.js 13 social video-watching application that allows users to watch videos together with friends in real-time. The app features user authentication, friend management, real-time messaging, synchronized video playback, and collaborative movie voting.

## Commands

- `pnpm dev` - Start development server
- `pnpm build` - Build production application
- `pnpm lint` - Run ESLint linting
- `pnpm check` - Run Biome formatting check (run before commits)
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
- **Real-time**: WebSocket service for live sync and messaging
- **State Management**: React hooks with WebSocket synchronization

### Core Features
1. **User Authentication**: Google OAuth integration via Better Auth
2. **Friend System**: Send/accept friend requests, manage friendships
3. **Real-time Chat**: WebSocket-powered messaging between friends
4. **Video Synchronization**: Real-time synchronized video playback for watch parties
5. **Movie Voting**: Collaborative movie selection with TMDb integration
6. **Responsive Design**: Mobile and desktop layouts with custom fullscreen support

### Directory Structure
- `src/app/` - Next.js 13 App Router pages and API routes
  - `(auth)/` - Authentication pages
  - `(dashboard)/` - Main app dashboard, friends, movies, chat
  - `(watch)/` - Video watching interface
  - `api/` - Backend API endpoints for friends, messages, movies
- `src/components/` - React components including VideoPlayer, chat interface
- `src/db/` - Database schema, queries, and connection
- `src/lib/` - Utilities including WebSocket service and validators
- `src/auth/` - Better Auth configuration

### Database Schema
The app uses a relational schema with these main entities:
- **Users**: Authentication and profile data
- **Friends**: Bidirectional friendship relationships
- **FriendRequests**: Pending friendship invitations
- **Messages**: Direct messages between friends
- **Movies**: TMDb movie data cache
- **MovieVotes**: User voting on movies (upvote/downvote/neutral)

### WebSocket Integration
Real-time features powered by WebSocket service (`src/lib/websocket.ts`):
- Message delivery
- Friend request notifications
- Video synchronization (play/pause, seek, URL changes)
- Connection quality monitoring

### Key Components
- `VideoPlayer`: Advanced video synchronization with host/watcher roles
- `MoviesPageClient`: Movie discovery and voting interface
- `FriendsPageClient`: Friend management with request handling
- `Messages`: Real-time chat interface

## Development Notes

- Uses pnpm as package manager
- All branches should be created from `dev` branch
- Run `pnpm check` before commits to ensure Biome formatting
- Authentication requires Google OAuth credentials in environment variables
- Database requires PostgreSQL connection string in `DATABASE_URL`
- WebSocket server endpoint configurable via environment variables