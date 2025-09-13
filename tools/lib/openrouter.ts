import axios, { AxiosError } from 'axios';
import { MealDecision, MenuItem, SelectedItems } from './types';

export class OpenRouterClient {
  private apiKey: string;
  private baseURL: string = 'https://openrouter.ai/api/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async decideMeal(prompt: string, context: Record<string, any> = {}): Promise<MealDecision> {
    try {
      const systemPrompt = `You are a helpful meal ordering assistant. Given a user's request, decide what to order from Uber Eats.

      Context:
      - Location: Engineering 7, 200 University Ave W, Waterloo, ON N2L 3G5
      - Time: ${new Date().toLocaleTimeString()}
      - Day: ${new Date().toLocaleDateString('en-US', { weekday: 'long' })}

      You must provide a structured JSON response with the following fields:
      1. cuisine_type: The type of cuisine (e.g., Italian, Chinese, Indian, etc.)
      2. restaurant_preferences: Any specific restaurant preferences
      3. items: An array of items to order with quantities
      4. dietary_restrictions: Any dietary restrictions to consider
      5. price_range: Budget preference (budget/moderate/expensive)
      6. special_instructions: Any special instructions for the order

      Always respond in valid JSON format.`;

      const response = await axios.post(
        `${this.baseURL}/chat/completions`,
        {
          model: 'openai/gpt-3.5-turbo',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.7,
          max_tokens: 500
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://github.com/shopx-agent',
            'X-Title': 'ShopX Uber Eats Agent'
          }
        }
      );

      const decision = JSON.parse(response.data.choices[0].message.content) as MealDecision;
      return decision;
    } catch (error) {
      const axiosError = error as AxiosError;
      console.error('OpenRouter API Error:', axiosError.response?.data || axiosError.message);
      throw error;
    }
  }

  async analyzeMenuItems(items: MenuItem[], preferences: MealDecision): Promise<SelectedItems> {
    try {
      const systemPrompt = `You are a menu selection assistant. Given a list of menu items and user preferences, select the best items to order. Always respond with valid JSON.`;

      const userPrompt = `Menu items: ${JSON.stringify(items)}
      Preferences: ${JSON.stringify(preferences)}

      Select items that best match the preferences. Return a JSON object with:
      - selected_items: Array of item names to order
      - total_estimated_cost: Estimated total cost as a number
      - reasoning: Brief explanation of choices`;

      const response = await axios.post(
        `${this.baseURL}/chat/completions`,
        {
          model: 'openai/gpt-3.5-turbo',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.7,
          max_tokens: 300
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://github.com/shopx-agent',
            'X-Title': 'ShopX Menu Analyzer'
          }
        }
      );

      return JSON.parse(response.data.choices[0].message.content) as SelectedItems;
    } catch (error) {
      const axiosError = error as AxiosError;
      console.error('Menu analysis error:', axiosError.response?.data || axiosError.message);
      throw error;
    }
  }
}