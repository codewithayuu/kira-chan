# 🤖 LLM Setup Guide

## Current Status
✅ **Backend updated** with real LLM integration (Groq)
✅ **OpenAI package installed**
⏳ **Need API key** to activate

## 🚀 Quick Setup (2 minutes)

### Step 1: Get Free Groq API Key
1. Go to: https://console.groq.com/
2. Sign up with Google/GitHub (free)
3. Go to "API Keys" section
4. Click "Create API Key"
5. Copy the key (starts with `gsk_...`)

### Step 2: Add API Key
1. Open `minimal-backend/.env` (create if doesn't exist)
2. Add: `GROQ_API_KEY=your-actual-key-here`
3. Save the file

### Step 3: Restart Backend
1. Stop the current backend (Ctrl+C in the backend window)
2. Run: `cd minimal-backend && node server.js`

## 🎯 What You'll Get
- **Real AI responses** using Llama 3.1 8B (free tier)
- **Hinglish personality** with proper context
- **Streaming responses** word by word
- **Conversation memory** (remembers last 10 messages)
- **Fallback protection** if API fails

## 🔧 Alternative LLMs (if needed)
- **Gemini**: `https://aistudio.google.com/` (free tier)
- **OpenAI**: `https://platform.openai.com/` (pay-per-use)
- **Together AI**: `https://together.ai/` (free credits)

## 📊 Free Tier Limits
- **Groq**: 14,400 requests/day (very generous!)
- **Gemini**: 15 requests/minute
- **OpenAI**: $5 free credit

The app will work with fallback responses even without the API key, but you'll get much better responses with the real LLM!
