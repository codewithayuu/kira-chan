import { prisma } from './db';
import { MemoryService } from './services/memory';

async function seed() {
  console.log('🌱 Starting database seed...');

  try {
    // Create a test user
    const testUser = await prisma.user.create({
      data: {
        id: 'test-user-1',
        profileJson: {
          name: 'Test User',
          preferences: {
            language: 'hinglish',
            personality: 'romantic',
            emojiLevel: 'medium',
          },
          interests: ['technology', 'music', 'travel'],
          communicationStyle: 'casual and friendly',
          relationshipLevel: 'new',
        },
      },
    });

    console.log('✅ Created test user:', testUser.id);

    // Create a test conversation
    const testConvo = await prisma.convo.create({
      data: {
        userId: testUser.id,
        summaryText: 'Initial conversation with test user',
      },
    });

    console.log('✅ Created test conversation:', testConvo.id);

    // Add some test messages
    const messages = [
      { role: 'user', content: 'Hello! I\'m excited to meet you.' },
      { role: 'assistant', content: 'Hello! I\'m Aanya, and I\'m so happy to meet you too! ✨ How are you doing today?' },
      { role: 'user', content: 'I\'m doing great! I love technology and music.' },
      { role: 'assistant', content: 'That\'s wonderful! I love that you\'re into technology and music! 🎵 What kind of music do you enjoy listening to?' },
    ];

    for (const message of messages) {
      await prisma.message.create({
        data: {
          convoId: testConvo.id,
          role: message.role,
          content: message.content,
        },
      });
    }

    console.log('✅ Created test messages');

    // Add some test memories
    const memories = [
      {
        content: 'User loves technology and music',
        kind: 'preference',
        importance: 0.8,
        tags: ['interests', 'music', 'technology'],
      },
      {
        content: 'User is excited to meet Aanya',
        kind: 'moment',
        importance: 0.7,
        tags: ['first_meeting', 'positive'],
      },
    ];

    for (const memory of memories) {
      await prisma.memory.create({
        data: {
          userId: testUser.id,
          content: memory.content,
          kind: memory.kind,
          importance: memory.importance,
          tags: memory.tags,
        },
      });
    }

    console.log('✅ Created test memories');

    // Add some LLM providers (these would normally be added via admin API)
    const providers = [
      {
        name: 'openai',
        model: 'gpt-4o-mini',
        apiKey: process.env.OPENAI_API_KEY || 'dummy-key',
        enabled: true,
        priority: 1,
        maxTokens: 4000,
        temperature: 0.7,
      },
      {
        name: 'groq',
        model: 'llama-3.1-70b',
        apiKey: process.env.GROQ_API_KEY || 'dummy-key',
        enabled: true,
        priority: 2,
        maxTokens: 4000,
        temperature: 0.7,
      },
    ];

    for (const provider of providers) {
      await prisma.lLMProvider.create({
        data: provider,
      });
    }

    console.log('✅ Created LLM providers');

    // Add voice providers
    const voiceProviders = [
      {
        name: 'elevenlabs',
        type: 'tts',
        apiKey: process.env.ELEVENLABS_API_KEY || 'dummy-key',
        enabled: true,
        voices: ['bella', 'josh', 'arnold', 'adam', 'sam'],
        languages: ['en', 'es', 'fr', 'de', 'it'],
      },
      {
        name: 'deepgram',
        type: 'stt',
        apiKey: process.env.DEEPGRAM_API_KEY || 'dummy-key',
        enabled: true,
        languages: ['en', 'es', 'fr', 'de', 'it', 'hi'],
      },
    ];

    for (const provider of voiceProviders) {
      await prisma.voiceProvider.create({
        data: provider,
      });
    }

    console.log('✅ Created voice providers');

    console.log('🎉 Database seed completed successfully!');
    console.log('\nTest data created:');
    console.log(`- User ID: ${testUser.id}`);
    console.log(`- Conversation ID: ${testConvo.id}`);
    console.log(`- Messages: ${messages.length}`);
    console.log(`- Memories: ${memories.length}`);
    console.log(`- LLM Providers: ${providers.length}`);
    console.log(`- Voice Providers: ${voiceProviders.length}`);

  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run seed if this file is executed directly
if (require.main === module) {
  seed().catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  });
}

export default seed;
