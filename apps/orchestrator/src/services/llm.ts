import OpenAI from 'openai';
import axios from 'axios';
import { ChatMessage, LLMProvider } from '@ai-companion/shared';

export class LLMService {
  private openai: OpenAI;
  private litellmUrl: string;

  constructor() {
    this.litellmUrl = process.env.LITELLM_URL || 'http://localhost:4000';
    this.openai = new OpenAI({
      apiKey: 'unused', // LiteLLM handles the actual API keys
      baseURL: this.litellmUrl,
    });
  }

  async generateResponse(
    messages: ChatMessage[],
    model: string = 'fast-cheap',
    temperature: number = 0.7,
    maxTokens?: number
  ): Promise<AsyncGenerator<string, void, unknown>> {
    try {
      const completion = await this.openai.chat.completions.create({
        model,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content,
        })),
        temperature,
        max_tokens: maxTokens,
        stream: true,
      });

      return this.streamResponse(completion);
    } catch (error) {
      console.error('LLM generation error:', error);
      throw new Error('Failed to generate response');
    }
  }

  private async *streamResponse(completion: any): AsyncGenerator<string, void, unknown> {
    for await (const chunk of completion) {
      const token = chunk.choices[0]?.delta?.content || '';
      if (token) {
        yield token;
      }
    }
  }

  async generateSummary(messages: ChatMessage[]): Promise<string> {
    try {
      const summaryPrompt = `Please provide a concise summary (2-3 sentences) of this conversation, focusing on:
- Key topics discussed
- Important facts about the user
- Relationship developments
- Any preferences or interests mentioned

Conversation:
${messages.map(m => `${m.role}: ${m.content}`).join('\n')}

Summary:`;

      const completion = await this.openai.chat.completions.create({
        model: 'fast-cheap',
        messages: [{ role: 'user', content: summaryPrompt }],
        temperature: 0.3,
        max_tokens: 200,
      });

      return completion.choices[0]?.message?.content || 'No summary available';
    } catch (error) {
      console.error('Summary generation error:', error);
      return 'Summary generation failed';
    }
  }

  async addProvider(provider: Omit<LLMProvider, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
    try {
      const response = await axios.post(
        `${this.litellmUrl}/manage/model/add`,
        {
          model_name: `${provider.name}/${provider.model}`,
          litellm_provider: provider.name,
          api_key: provider.apiKey,
          base_url: provider.baseUrl,
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.LITELLM_MASTER_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.status !== 200) {
        throw new Error('Failed to add provider');
      }
    } catch (error) {
      console.error('Provider addition error:', error);
      throw new Error('Failed to add LLM provider');
    }
  }

  async getProviderStatus(): Promise<any> {
    try {
      const response = await axios.get(`${this.litellmUrl}/health`, {
        headers: {
          'Authorization': `Bearer ${process.env.LITELLM_MASTER_KEY}`,
        },
      });

      return response.data;
    } catch (error) {
      console.error('Provider status error:', error);
      throw new Error('Failed to get provider status');
    }
  }

  async testProvider(providerName: string, model: string): Promise<boolean> {
    try {
      const testMessages = [
        { role: 'user', content: 'Hello, this is a test message.' }
      ];

      const completion = await this.openai.chat.completions.create({
        model: `${providerName}/${model}`,
        messages: testMessages,
        temperature: 0.1,
        max_tokens: 10,
      });

      return completion.choices[0]?.message?.content !== undefined;
    } catch (error) {
      console.error('Provider test error:', error);
      return false;
    }
  }
}
