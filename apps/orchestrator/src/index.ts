import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';

import chatRoutes from './routes/chat';
import voiceRoutes from './routes/voice';
import adminRoutes from './routes/admin';
import { prisma } from './db';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const port = process.env.ORCHESTRATOR_PORT || 3001;

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.NEXT_PUBLIC_ORCHESTRATOR_URL || 'http://localhost:3000',
  credentials: true,
}));
// Basic rate limiting (can move to Redis-backed if needed)
const limiter = rateLimit({ windowMs: 60 * 1000, max: 120 });
app.use('/api/', limiter);
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.use('/api/chat', chatRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'orchestrator'
  });
});

// WebSocket server for real-time communication
const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  console.log('New WebSocket connection');
  
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());
      
      switch (data.type) {
        case 'chat':
          // Handle real-time chat
          break;
        case 'audio':
          // Handle real-time audio
          break;
        default:
          ws.send(JSON.stringify({ 
            type: 'error', 
            error: 'Unknown message type' 
          }));
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
      ws.send(JSON.stringify({ 
        type: 'error', 
        error: 'Invalid message format' 
      }));
    }
  });

  ws.on('close', () => {
    console.log('WebSocket connection closed');
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Error handling middleware
app.use((error: any, req: any, res: any, next: any) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  
  // Close WebSocket connections
  wss.clients.forEach(ws => {
    ws.close();
  });
  
  // Close database connection
  await prisma.$disconnect();
  
  // Close HTTP server
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  
  wss.clients.forEach(ws => {
    ws.close();
  });
  
  await prisma.$disconnect();
  
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Start server
server.listen(port, () => {
  console.log(`🚀 Orchestrator server running on port ${port}`);
  console.log(`📊 Health check: http://localhost:${port}/health`);
  console.log(`🔗 WebSocket: ws://localhost:${port}`);
});

export default app;
