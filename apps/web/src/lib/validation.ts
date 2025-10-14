import { z } from 'zod';
import { useState, useCallback } from 'react';

// User Profile Validation
export const UserProfileSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50, 'Name too long'),
  email: z.string().email('Invalid email address').optional(),
  age: z.number().min(13, 'Must be at least 13').max(120, 'Invalid age').optional(),
  preferences: z.object({
    language: z.enum(['hinglish', 'english', 'hindi']).default('hinglish'),
    personality: z.enum(['romantic', 'friendly', 'professional']).default('romantic'),
    emojiLevel: z.enum(['low', 'medium', 'high']).default('medium'),
    responseLength: z.enum(['short', 'medium', 'long']).default('medium'),
    voice: z.string().min(1, 'Voice selection required'),
    volume: z.number().min(0).max(1).default(0.8),
    speed: z.number().min(0.5).max(2).default(1),
  }),
  interests: z.array(z.string()).max(20, 'Too many interests'),
  relationshipLevel: z.enum(['new', 'acquaintance', 'friend', 'close', 'intimate']).default('new'),
  boundaries: z.array(z.string()).optional(),
  customInstructions: z.string().max(1000, 'Instructions too long').optional(),
});

// Chat Message Validation
export const ChatMessageSchema = z.object({
  content: z.string().min(1, 'Message cannot be empty').max(4000, 'Message too long'),
  type: z.enum(['text', 'voice', 'image']).default('text'),
  metadata: z.object({
    voiceUrl: z.string().url().optional(),
    imageUrl: z.string().url().optional(),
    duration: z.number().positive().optional(),
    confidence: z.number().min(0).max(1).optional(),
  }).optional(),
});

// Voice Settings Validation
export const VoiceSettingsSchema = z.object({
  provider: z.enum(['elevenlabs', 'azure', 'piper']).default('elevenlabs'),
  voice: z.string().min(1, 'Voice selection required'),
  language: z.string().min(2, 'Invalid language code').max(5, 'Invalid language code'),
  speed: z.number().min(0.5, 'Speed too slow').max(2, 'Speed too fast').default(1),
  pitch: z.number().min(0.5, 'Pitch too low').max(2, 'Pitch too high').default(1),
  volume: z.number().min(0, 'Volume too low').max(1, 'Volume too high').default(0.8),
  quality: z.enum(['low', 'medium', 'high']).default('high'),
  streaming: z.boolean().default(true),
  autoPlay: z.boolean().default(true),
  pushToTalk: z.boolean().default(false),
  voiceActivation: z.boolean().default(true),
  vadThreshold: z.number().min(0).max(1).default(0.5),
  vadSensitivity: z.enum(['low', 'medium', 'high']).default('medium'),
});

// Live2D Settings Validation
export const Live2DSettingsSchema = z.object({
  modelPath: z.string().min(1, 'Model path required'),
  scale: z.number().min(0.1, 'Scale too small').max(2, 'Scale too large').default(0.3),
  position: z.object({
    x: z.number().default(200),
    y: z.number().default(450),
  }),
  animations: z.object({
    idle: z.string().default('idle'),
    happy: z.string().default('happy'),
    sad: z.string().default('sad'),
    surprised: z.string().default('surprised'),
    thinking: z.string().default('thinking'),
    talking: z.string().default('talking'),
  }),
  lipSync: z.object({
    enabled: z.boolean().default(true),
    sensitivity: z.number().min(0).max(1).default(0.7),
    smoothing: z.number().min(0).max(1).default(0.8),
    parameters: z.array(z.string()).default(['PARAM_MOUTH_OPEN_Y']),
  }),
  interactions: z.object({
    clickable: z.boolean().default(true),
    hoverable: z.boolean().default(true),
    draggable: z.boolean().default(false),
    autoIdle: z.boolean().default(true),
    idleTimeout: z.number().min(1000).max(60000).default(30000),
  }),
});

// Memory Validation
export const MemorySchema = z.object({
  content: z.string().min(1, 'Memory content required').max(1000, 'Memory too long'),
  kind: z.enum(['fact', 'moment', 'preference', 'memory', 'goal', 'fear', 'dream']),
  importance: z.number().min(0, 'Importance too low').max(1, 'Importance too high').default(0.5),
  tags: z.array(z.string().max(20, 'Tag too long')).max(10, 'Too many tags'),
  isPrivate: z.boolean().default(false),
  expiresAt: z.date().optional(),
});

// Conversation Validation
export const ConversationSchema = z.object({
  title: z.string().min(1, 'Title required').max(100, 'Title too long'),
  description: z.string().max(500, 'Description too long').optional(),
  isPublic: z.boolean().default(false),
  tags: z.array(z.string().max(20, 'Tag too long')).max(10, 'Too many tags'),
  settings: z.object({
    model: z.string().default('fast-cheap'),
    temperature: z.number().min(0).max(2).default(0.7),
    maxTokens: z.number().min(100).max(8000).default(4000),
    voiceEnabled: z.boolean().default(true),
    memoryEnabled: z.boolean().default(true),
  }),
});

// API Request Validation
export const APIRequestSchema = z.object({
  endpoint: z.string().min(1, 'Endpoint required'),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']),
  headers: z.record(z.string()).optional(),
  body: z.any().optional(),
  timeout: z.number().min(1000).max(30000).default(10000),
  retries: z.number().min(0).max(5).default(3),
});

// Form Validation Helpers
export const validateForm = <T>(schema: z.ZodSchema<T>, data: unknown): {
  success: boolean;
  data?: T;
  errors?: Record<string, string[]>;
} => {
  try {
    const result = schema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors: Record<string, string[]> = {};
      error.errors.forEach((err) => {
        const path = err.path.join('.');
        if (!errors[path]) {
          errors[path] = [];
        }
        errors[path].push(err.message);
      });
      return { success: false, errors };
    }
    return { success: false, errors: { general: ['Validation failed'] } };
  }
};

// Real-time Validation Hook
export const useValidation = <T>(schema: z.ZodSchema<T>) => {
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [isValid, setIsValid] = useState(false);

  const validate = useCallback((data: unknown) => {
    const result = validateForm(schema, data);
    setErrors(result.errors || {});
    setIsValid(result.success);
    return result;
  }, [schema]);

  const clearErrors = useCallback(() => {
    setErrors({});
    setIsValid(false);
  }, []);

  return {
    errors,
    isValid,
    validate,
    clearErrors,
  };
};

// Export types
export type UserProfile = z.infer<typeof UserProfileSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type VoiceSettings = z.infer<typeof VoiceSettingsSchema>;
export type Live2DSettings = z.infer<typeof Live2DSettingsSchema>;
export type Memory = z.infer<typeof MemorySchema>;
export type Conversation = z.infer<typeof ConversationSchema>;
export type APIRequest = z.infer<typeof APIRequestSchema>;
