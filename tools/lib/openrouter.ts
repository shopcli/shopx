import axios, { AxiosError } from 'axios';
import { MealDecision, MenuItem, SelectedItems } from './types';

export class OpenRouterClient {
  private apiKey: string;
  private baseURL: string = 'https://api.openai.com/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async decideMeal(prompt: string, context: Record<string, any> = {}): Promise<MealDecision> {
    try {
      const systemPrompt = `You are a meal ordering assistant. Analyze the request and provide a concise JSON response.

      Available categories: Pizza, Burgers, Chinese, Indian, Italian, Mexican, Thai, Japanese, Korean, Fast Food, Healthy, Vegetarian, Vegan, Desserts, Coffee, Breakfast, Sandwich, Salads, Soup, Seafood, BBQ, Mediterranean, Middle Eastern.

      Return JSON with:
      1. cuisine_type: Primary category
      2. restaurant_preferences: 1-2 restaurant types
      3. items: 2-3 food items
      4. dietary_restrictions: Any restrictions
      5. price_range: budget/moderate/expensive
      6. special_instructions: Brief instructions
      7. search_strategy: One sentence why

      Be concise. Response must be under 200 tokens.`;

      const response = await axios.post(
        `${this.baseURL}/chat/completions`,
        {
          model: 'gpt-5-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt }
          ],
          response_format: { type: 'json_object' },
          max_completion_tokens: 25000
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const content = response.data.choices[0].message.content;

      if (!content || content.trim() === '') {
        throw new Error('Empty response from AI');
      }

      const decision = JSON.parse(content) as MealDecision;
      return decision;
    } catch (error) {
      const axiosError = error as AxiosError;
      console.error('OpenAI API Error:', axiosError.response?.data || axiosError.message);
      throw error;
    }
  }

  async selectBestRestaurant(restaurants: any[], preferences: MealDecision): Promise<{ selectedRestaurant: any; reasoning: string }> {
    try {
      const systemPrompt = `Select the best restaurant quickly. Consider cuisine match, ratings, and delivery time. Be concise.`;

      const userPrompt = `Restaurants: ${JSON.stringify(restaurants.slice(0, 10))}
      Preferences: ${JSON.stringify(preferences)}

      Return JSON with:
      - restaurant_index: Index (0-based)
      - reasoning: One sentence
      - confidence_score: 1-10`;

      const response = await axios.post(
        `${this.baseURL}/chat/completions`,
        {
          model: 'gpt-5-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          response_format: { type: 'json_object' },
          max_completion_tokens: 25000
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const result = JSON.parse(response.data.choices[0].message.content);
      return {
        selectedRestaurant: restaurants[result.restaurant_index] || restaurants[0],
        reasoning: result.reasoning
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      console.error('Restaurant selection error:', axiosError.response?.data || axiosError.message);
      return { selectedRestaurant: restaurants[0], reasoning: 'Fallback to first restaurant due to error' };
    }
  }

  async analyzeMenuItems(items: MenuItem[], preferences: MealDecision): Promise<SelectedItems> {
    try {
      const systemPrompt = `Select 1-3 menu items quickly based on preferences and price. Be concise.`;

      const userPrompt = `Menu: ${JSON.stringify(items.slice(0, 20))}
      Preferences: ${JSON.stringify(preferences)}

      Return JSON with:
      - selected_items: 1-3 exact item names
      - total_estimated_cost: Number
      - reasoning: One sentence`;

      const response = await axios.post(
        `${this.baseURL}/chat/completions`,
        {
          model: 'gpt-5-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          response_format: { type: 'json_object' },
          max_completion_tokens: 25000
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
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