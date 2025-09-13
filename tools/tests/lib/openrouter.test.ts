import axios from 'axios';
import { OpenRouterClient } from '../../lib/openrouter';
import { MealDecision, MenuItem } from '../../lib/types';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('OpenRouterClient', () => {
  let client: OpenRouterClient;
  const mockApiKey = 'test-api-key-123';

  beforeEach(() => {
    client = new OpenRouterClient(mockApiKey);
    jest.clearAllMocks();
  });

  describe('decideMeal', () => {
    it('should make a meal decision based on user prompt', async () => {
      const mockResponse: MealDecision = {
        cuisine_type: 'Italian',
        restaurant_preferences: 'Pizza place',
        items: [
          { name: 'Margherita Pizza', quantity: 1 },
          { name: 'Caesar Salad', quantity: 1 }
        ],
        dietary_restrictions: ['vegetarian'],
        price_range: 'moderate',
        special_instructions: 'Extra cheese please'
      };

      mockedAxios.post.mockResolvedValueOnce({
        data: {
          choices: [
            {
              message: {
                content: JSON.stringify(mockResponse)
              }
            }
          ]
        }
      });

      const result = await client.decideMeal('I want Italian food for lunch');

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/chat/completions',
        expect.objectContaining({
          model: 'openai/gpt-3.5-turbo',
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'system' }),
            expect.objectContaining({ role: 'user', content: 'I want Italian food for lunch' })
          ]),
          response_format: { type: 'json_object' },
          temperature: 0.7,
          max_tokens: 500
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': `Bearer ${mockApiKey}`,
            'Content-Type': 'application/json'
          })
        })
      );

      expect(result).toEqual(mockResponse);
    });

    it('should handle API errors gracefully', async () => {
      const errorMessage = 'API rate limit exceeded';
      const error = new Error(errorMessage);
      (error as any).response = {
        data: { error: errorMessage }
      };
      mockedAxios.post.mockRejectedValueOnce(error);

      await expect(client.decideMeal('Order food')).rejects.toThrow();
      expect(console.error).toHaveBeenCalledWith(
        'OpenRouter API Error:',
        expect.objectContaining({ error: errorMessage })
      );
    });

    it('should include current time and day in context', async () => {
      const mockResponse: MealDecision = {
        cuisine_type: 'Chinese',
        items: [{ name: 'Fried Rice', quantity: 1 }],
        price_range: 'budget'
      };

      mockedAxios.post.mockResolvedValueOnce({
        data: {
          choices: [
            {
              message: {
                content: JSON.stringify(mockResponse)
              }
            }
          ]
        }
      });

      await client.decideMeal('Quick dinner');

      const callArgs = mockedAxios.post.mock.calls[0][1] as any;
      const systemMessage = callArgs.messages[0].content;

      expect(systemMessage).toContain('Engineering 7, 200 University Ave W, Waterloo');
      expect(systemMessage).toContain('Time:');
      expect(systemMessage).toContain('Day:');
    });
  });

  describe('analyzeMenuItems', () => {
    it('should analyze menu items and select best matches', async () => {
      const menuItems: MenuItem[] = [
        { name: 'Veggie Burger', price: '$12.99', description: 'Plant-based patty' },
        { name: 'Chicken Sandwich', price: '$14.99', description: 'Grilled chicken' },
        { name: 'Caesar Salad', price: '$9.99', description: 'Fresh romaine' }
      ];

      const preferences: MealDecision = {
        cuisine_type: 'American',
        dietary_restrictions: ['vegetarian'],
        price_range: 'moderate',
        items: []
      };

      const mockAnalysis = {
        selected_items: ['Veggie Burger', 'Caesar Salad'],
        total_estimated_cost: 22.98,
        reasoning: 'Selected vegetarian options within budget'
      };

      mockedAxios.post.mockResolvedValueOnce({
        data: {
          choices: [
            {
              message: {
                content: JSON.stringify(mockAnalysis)
              }
            }
          ]
        }
      });

      const result = await client.analyzeMenuItems(menuItems, preferences);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/chat/completions',
        expect.objectContaining({
          model: 'openai/gpt-3.5-turbo',
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'system' }),
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining('Menu items:')
            })
          ])
        }),
        expect.any(Object)
      );

      expect(result).toEqual(mockAnalysis);
    });

    it('should handle empty menu items', async () => {
      const emptyItems: MenuItem[] = [];
      const preferences: MealDecision = {
        cuisine_type: 'Any',
        price_range: 'budget',
        items: []
      };

      const mockResponse = {
        selected_items: [],
        total_estimated_cost: 0,
        reasoning: 'No items available to select'
      };

      mockedAxios.post.mockResolvedValueOnce({
        data: {
          choices: [
            {
              message: {
                content: JSON.stringify(mockResponse)
              }
            }
          ]
        }
      });

      const result = await client.analyzeMenuItems(emptyItems, preferences);
      expect(result.selected_items).toHaveLength(0);
    });

    it('should handle network errors', async () => {
      const menuItems: MenuItem[] = [
        { name: 'Test Item', price: '$10', description: 'Test' }
      ];

      mockedAxios.post.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        client.analyzeMenuItems(menuItems, { cuisine_type: 'Any', price_range: 'budget', items: [] })
      ).rejects.toThrow('Network error');
    });
  });
});