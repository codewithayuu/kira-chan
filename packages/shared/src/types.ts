import { z } from 'zod';

// API Request/Response Types
export const ChatRequestSchema = z.object({
  userId: z.string(),
  convoId: z.string(),
  text: z.string(),
  voiceEnabled: z.boolean().optional().default(false),
});

export const ChatResponseSchema = z.object({
  message: z.string(),
  convoId: z.string(),
  timestamp: z.date(),
  voiceUrl: z.string().optional(),
  memories: z.array(z.string()).optional(),
});

export const AudioTranscribeRequestSchema = z.object({
  audio: z.string(), // base64 encoded audio
  language: z.string().optional().default('en'),
});

export const AudioTranscribeResponseSchema = z.object({
  text: z.string(),
  confidence: z.number().optional(),
});

export const TTSRequestSchema = z.object({
  text: z.string(),
  voice: z.string().optional().default('bella'),
  language: z.string().optional().default('en'),
  speed: z.number().min(0.5).max(2).optional().default(1),
  pitch: z.number().min(0.5).max(2).optional().default(1),
  style: z.string().optional(),
  provider: z.enum(['elevenlabs', 'azure']).optional().default('elevenlabs'),
});

export const TTSResponseSchema = z.object({
  audioUrl: z.string(),
  duration: z.number(),
});

export const MemoryRequestSchema = z.object({
  userId: z.string(),
  content: z.string(),
  kind: z.enum(['fact', 'moment', 'preference', 'memory']),
  importance: z.number().min(0).max(1).optional().default(0.5),
  tags: z.array(z.string()).optional().default([]),
});

export const UserProfileRequestSchema = z.object({
  userId: z.string(),
  name: z.string().optional(),
  preferences: z.record(z.any()).optional(),
  communicationStyle: z.string().optional(),
  interests: z.array(z.string()).optional(),
  relationshipLevel: z.enum(['new', 'acquaintance', 'friend', 'close', 'intimate']).optional(),
});

// WebSocket Message Types
export const WebSocketMessageSchema = z.object({
  type: z.enum(['chat', 'audio', 'memory', 'error']),
  data: z.any(),
  timestamp: z.date(),
});

export const ChatStreamMessageSchema = z.object({
  type: z.literal('token'),
  token: z.string(),
  isComplete: z.boolean().default(false),
});

export const AudioStreamMessageSchema = z.object({
  type: z.literal('audio'),
  audioChunk: z.string(), // base64 encoded audio chunk
  isComplete: z.boolean().default(false),
});

// Live2D Types
export const Live2DConfigSchema = z.object({
  modelPath: z.string(),
  scale: z.number().default(0.3),
  position: z.object({
    x: z.number().default(200),
    y: z.number().default(450),
  }),
  lipSyncEnabled: z.boolean().default(true),
  animations: z.array(z.string()).default(['idle', 'happy', 'sad', 'surprised']),
});

// Voice Configuration
export const VoiceConfigSchema = z.object({
  sttProvider: z.enum(['whisper', 'deepgram', 'azure']).default('whisper'),
  ttsProvider: z.enum(['elevenlabs', 'azure', 'piper']).default('elevenlabs'),
  voice: z.string().default('bella'),
  language: z.string().default('en'),
  streaming: z.boolean().default(true),
});

// Error Types
export const APIErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.any().optional(),
  timestamp: z.date(),
});

// Export types
export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export type ChatResponse = z.infer<typeof ChatResponseSchema>;
export type AudioTranscribeRequest = z.infer<typeof AudioTranscribeRequestSchema>;
export type AudioTranscribeResponse = z.infer<typeof AudioTranscribeResponseSchema>;
export type TTSRequest = z.infer<typeof TTSRequestSchema>;
export type TTSResponse = z.infer<typeof TTSResponseSchema>;
export type MemoryRequest = z.infer<typeof MemoryRequestSchema>;
export type UserProfileRequest = z.infer<typeof UserProfileRequestSchema>;
export type WebSocketMessage = z.infer<typeof WebSocketMessageSchema>;
export type ChatStreamMessage = z.infer<typeof ChatStreamMessageSchema>;
export type AudioStreamMessage = z.infer<typeof AudioStreamMessageSchema>;
export type Live2DConfig = z.infer<typeof Live2DConfigSchema>;
export type VoiceConfig = z.infer<typeof VoiceConfigSchema>;
export type APIError = z.infer<typeof APIErrorSchema>;

// Database Entity Types
export interface User {
  id: string;
  profileJson: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface Convo {
  id: string;
  userId: string;
  summaryText: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: string;
  convoId: string;
  role: string;
  content: string;
  createdAt: Date;
}

export interface Memory {
  id: string;
  userId: string;
  kind: 'fact' | 'moment' | 'preference' | 'memory';
  content: string;
  importance: number;
  tags: string[];
  embedding: number[];
  createdAt: Date;
}

// Provider Configuration
export interface LLMProvider {
  name: string;
  model: string;
  apiKey: string;
  baseUrl?: string;
  enabled: boolean;
  priority: number;
  maxTokens?: number;
  temperature?: number;
}

export interface VoiceProvider {
  name: string;
  type: 'stt' | 'tts';
  apiKey: string;
  baseUrl?: string;
  enabled: boolean;
  voices?: string[];
  languages?: string[];
}
