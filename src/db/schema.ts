import { pgTable, text, serial, timestamp, integer, boolean } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Unique identifier or username
  username: text('username').notNull().unique(),
  displayName: text('display_name').notNull(),
  passwordHash: text('password_hash').notNull(),
  avatarUrl: text('avatar_url').notNull(),
  bio: text('bio').default(''),
  customTagText: text('custom_tag_text'),
  customTagColor: text('custom_tag_color'),
  isVerified: boolean('is_verified').default(false),
  isBanned: boolean('is_banned').default(false),
  following: text('following').default('[]'), // JSON array of followed usernames
  createdAt: timestamp('created_at').defaultNow()
});

export const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  authorUsername: text('author_username').notNull(),
  authorName: text('author_name').notNull(),
  authorAvatar: text('author_avatar').notNull(),
  content: text('content').notNull(),
  mediaUrl: text('media_url'),
  mediaType: text('media_type'), // 'image' | 'video' | 'audio'
  likes: text('likes').default('[]'), // JSON array of usernames
  reposts: integer('reposts').default(0),
  createdAt: timestamp('created_at').defaultNow()
});

export const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  sender: text('sender').notNull(),
  senderName: text('sender_name').notNull(),
  recipient: text('recipient').notNull(),
  text: text('text').notNull(),
  createdAt: timestamp('created_at').defaultNow()
});

export const musicTracks = pgTable('music_tracks', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  artist: text('artist').notNull(),
  audioUrl: text('audio_url').notNull(),
  duration: integer('duration').default(0),
  createdAt: timestamp('created_at').defaultNow()
});
