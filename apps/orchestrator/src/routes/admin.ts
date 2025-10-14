import { Router } from 'express';
import { z } from 'zod';
import { LLMService } from '../services/llm';
import { prisma } from '../db';

const router = Router();
const llmService = new LLMService();

// Middleware to check admin authentication
const adminAuth = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token || token !== process.env.LITELLM_MASTER_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  next();
};

// Add LLM provider
router.post('/providers', adminAuth, async (req, res) => {
  try {
    const { name, model, apiKey, baseUrl, enabled, priority, maxTokens, temperature } = req.body;

    // Add to LiteLLM
    await llmService.addProvider({
      name,
      model,
      apiKey,
      baseUrl,
      enabled: enabled ?? true,
      priority: priority ?? 1,
      maxTokens,
      temperature,
    });

    // Store in database
    const provider = await prisma.lLMProvider.create({
      data: {
        name,
        model,
        apiKey,
        baseUrl,
        enabled: enabled ?? true,
        priority: priority ?? 1,
        maxTokens,
        temperature,
      },
    });

    res.json({ provider });
  } catch (error) {
    console.error('Add provider error:', error);
    res.status(500).json({ error: 'Failed to add provider' });
  }
});

// Get all providers
router.get('/providers', adminAuth, async (req, res) => {
  try {
    const providers = await prisma.lLMProvider.findMany({
      orderBy: { priority: 'asc' },
    });

    res.json({ providers });
  } catch (error) {
    console.error('Get providers error:', error);
    res.status(500).json({ error: 'Failed to get providers' });
  }
});

// Update provider
router.put('/providers/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const provider = await prisma.lLMProvider.update({
      where: { id },
      data: updates,
    });

    res.json({ provider });
  } catch (error) {
    console.error('Update provider error:', error);
    res.status(500).json({ error: 'Failed to update provider' });
  }
});

// Delete provider
router.delete('/providers/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.lLMProvider.delete({
      where: { id },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete provider error:', error);
    res.status(500).json({ error: 'Failed to delete provider' });
  }
});

// Test provider
router.post('/providers/:id/test', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const provider = await prisma.lLMProvider.findUnique({
      where: { id },
    });

    if (!provider) {
      return res.status(404).json({ error: 'Provider not found' });
    }

    const isWorking = await llmService.testProvider(provider.name, provider.model);

    res.json({ 
      provider: provider.name,
      model: provider.model,
      isWorking 
    });
  } catch (error) {
    console.error('Test provider error:', error);
    res.status(500).json({ error: 'Failed to test provider' });
  }
});

// Get system health
router.get('/health', adminAuth, async (req, res) => {
  try {
    const providerStatus = await llmService.getProviderStatus();
    const userCount = await prisma.user.count();
    const convoCount = await prisma.convo.count();
    const messageCount = await prisma.message.count();
    const memoryCount = await prisma.memory.count();

    res.json({
      status: 'healthy',
      providers: providerStatus,
      database: { userCount, convoCount, messageCount, memoryCount },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      status: 'unhealthy',
      error: 'System health check failed',
    });
  }
});

// Get usage statistics
router.get('/stats', adminAuth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();

    const messages = await prisma.message.findMany({
      where: {
        createdAt: { gte: start, lte: end },
      },
      select: { createdAt: true, convoId: true },
    });

    // Aggregate by date (YYYY-MM-DD)
    const daily: Record<string, { messageCount: number; convoIds: Set<string> }> = {};
    for (const m of messages) {
      const key = m.createdAt.toISOString().slice(0, 10);
      if (!daily[key]) daily[key] = { messageCount: 0, convoIds: new Set() };
      daily[key].messageCount += 1;
      daily[key].convoIds.add(m.convoId);
    }

    const stats = Object.entries(daily)
      .map(([date, v]) => ({ date, message_count: v.messageCount, convo_count: v.convoIds.size }))
      .sort((a, b) => (a.date < b.date ? 1 : -1));

    res.json({ stats, range: { start, end } });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

// Get user analytics
router.get('/users/:userId/analytics', adminAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const convoCount = await prisma.convo.count({ where: { userId } });
    const messageCount = await prisma.message.count({ where: { convo: { userId } } });
    const memoryCount = await prisma.memory.count({ where: { userId } });

    const recentActivity = await prisma.message.findMany({
      where: {
        convo: {
          userId,
        },
      },
      include: {
        convo: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
    });

    res.json({
      userStats: {
        id: user.id,
        createdAt: user.createdAt,
        convoCount,
        messageCount,
        memoryCount,
      },
      recentActivity,
    });
  } catch (error) {
    console.error('User analytics error:', error);
    res.status(500).json({ error: 'Failed to get user analytics' });
  }
});

export default router;
