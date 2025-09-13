import { FoodOrderingAgent } from '../index';
import { UberEatsAgent } from '../agents/uberEatsAgent';
import { OrderResult } from '../lib/types';

jest.mock('../agents/uberEatsAgent');

const MockedUberEatsAgent = UberEatsAgent as jest.MockedClass<typeof UberEatsAgent>;

describe('FoodOrderingAgent', () => {
  let agent: FoodOrderingAgent;
  let mockUberEatsAgent: jest.Mocked<UberEatsAgent>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create a mock instance
    mockUberEatsAgent = {
      orderMeal: jest.fn(),
      initialize: jest.fn(),
      navigateToUberEats: jest.fn(),
      setDeliveryAddress: jest.fn(),
      searchForFood: jest.fn(),
      selectRestaurant: jest.fn(),
      extractMenuItems: jest.fn(),
      addItemToCart: jest.fn(),
      close: jest.fn(),
    } as any;

    MockedUberEatsAgent.mockImplementation(() => mockUberEatsAgent);

    agent = new FoodOrderingAgent();
  });

  describe('constructor', () => {
    it('should create instance with default config', () => {
      const agent = new FoodOrderingAgent();
      expect(MockedUberEatsAgent).toHaveBeenCalledWith(undefined);
    });

    it('should create instance with custom config', () => {
      const config = {
        headless: false,
        openRouterApiKey: 'custom-key',
        timeout: 60000,
      };

      const agent = new FoodOrderingAgent(config);
      expect(MockedUberEatsAgent).toHaveBeenCalledWith(config);
    });
  });

  describe('orderFromPrompt', () => {
    it('should successfully order food based on prompt', async () => {
      const mockResult: OrderResult = {
        success: true,
        decision: {
          cuisine_type: 'Italian',
          restaurant_preferences: 'Pizza Place',
          items: [{ name: 'Pizza', quantity: 1 }],
          price_range: 'moderate',
        },
        selectedItems: {
          selected_items: ['Margherita Pizza', 'Caesar Salad'],
          total_estimated_cost: 25.99,
          reasoning: 'Selected based on preferences',
        },
        message: 'Order prepared in cart. Please complete checkout manually.',
      };

      mockUberEatsAgent.orderMeal.mockResolvedValue(mockResult);

      const result = await agent.orderFromPrompt('I want Italian food');

      expect(mockUberEatsAgent.orderMeal).toHaveBeenCalledWith('I want Italian food');
      expect(result).toEqual(mockResult);
    });

    it('should handle and propagate errors', async () => {
      const error = new Error('Failed to connect to Uber Eats');
      mockUberEatsAgent.orderMeal.mockRejectedValue(error);

      await expect(agent.orderFromPrompt('Order food')).rejects.toThrow(
        'Failed to connect to Uber Eats'
      );
    });

    it('should log appropriate messages during execution', async () => {
      const mockResult: OrderResult = {
        success: true,
        decision: {
          cuisine_type: 'Chinese',
          items: [{ name: 'Fried Rice', quantity: 1 }],
          price_range: 'budget',
        },
        selectedItems: {
          selected_items: ['Vegetable Fried Rice'],
          total_estimated_cost: 12.99,
          reasoning: 'Budget-friendly option',
        },
        message: 'Order prepared successfully',
      };

      mockUberEatsAgent.orderMeal.mockResolvedValue(mockResult);

      const consoleSpy = jest.spyOn(console, 'log');

      await agent.orderFromPrompt('Quick Chinese food');

      expect(consoleSpy).toHaveBeenCalledWith('🍔 Food Ordering Agent Started');
      expect(consoleSpy).toHaveBeenCalledWith('📝 User Request: Quick Chinese food');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('─'));
      expect(consoleSpy).toHaveBeenCalledWith('✅ Order Summary:');
      expect(consoleSpy).toHaveBeenCalledWith('   Cuisine: Chinese');
      expect(consoleSpy).toHaveBeenCalledWith('   Price Range: budget');
      expect(consoleSpy).toHaveBeenCalledWith('   Items Selected: Vegetable Fried Rice');
      expect(consoleSpy).toHaveBeenCalledWith('   Estimated Cost: $12.99');
    });

    it('should handle empty selected items gracefully', async () => {
      const mockResult: OrderResult = {
        success: true,
        decision: {
          cuisine_type: 'Any',
          items: [],
          price_range: 'budget',
        },
        selectedItems: {
          selected_items: [],
          total_estimated_cost: 0,
          reasoning: 'No items matched criteria',
        },
        message: 'No items could be selected',
      };

      mockUberEatsAgent.orderMeal.mockResolvedValue(mockResult);

      const result = await agent.orderFromPrompt('Find anything cheap');

      expect(result.selectedItems.selected_items).toHaveLength(0);
      expect(result.selectedItems.total_estimated_cost).toBe(0);
    });

    it('should handle complex dietary restrictions', async () => {
      const mockResult: OrderResult = {
        success: true,
        decision: {
          cuisine_type: 'Mediterranean',
          dietary_restrictions: ['vegan', 'gluten-free'],
          items: [
            { name: 'Quinoa Bowl', quantity: 1 },
            { name: 'Hummus Plate', quantity: 1 },
          ],
          price_range: 'moderate',
        },
        selectedItems: {
          selected_items: ['Vegan Quinoa Bowl', 'Gluten-Free Hummus'],
          total_estimated_cost: 28.50,
          reasoning: 'Selected items meeting all dietary restrictions',
        },
        message: 'Order prepared with dietary restrictions considered',
      };

      mockUberEatsAgent.orderMeal.mockResolvedValue(mockResult);

      const result = await agent.orderFromPrompt('Vegan and gluten-free Mediterranean food');

      expect(result.decision.dietary_restrictions).toContain('vegan');
      expect(result.decision.dietary_restrictions).toContain('gluten-free');
      expect(result.selectedItems.selected_items).toHaveLength(2);
    });
  });
});