import axios from 'axios';

interface OrderRequest {
  originalPrompt: string;
  cuisineType: string;
  priceRange: string;
  specificItems: string[];
  randomToppings: string[];
  enhancedPrompt: string;
}

interface OpenRouteResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export class OrderProcessor {
  private openRouteApiKey: string;

  constructor() {
    this.openRouteApiKey = process.env.OPENROUTER_API_KEY || '';
    if (!this.openRouteApiKey) {
      throw new Error('OPENROUTER_API_KEY environment variable is required');
    }
  }

  // Pizza toppings for random selection
  private pizzaToppings = [
    'pepperoni', 'mushrooms', 'onions', 'green peppers', 'black olives',
    'sausage', 'bacon', 'extra cheese', 'pineapple', 'ham',
    'jalapeños', 'tomatoes', 'spinach', 'artichokes', 'anchovies',
    'chicken', 'beef', 'feta cheese', 'red peppers', 'basil'
  ];

  // Other food randomizers
  private burgerAddons = [
    'extra pickles', 'bacon', 'avocado', 'fried egg', 'onion rings',
    'mushrooms', 'cheese', 'lettuce', 'tomato', 'special sauce'
  ];

  private sushiAddons = [
    'extra wasabi', 'ginger', 'soy sauce', 'spicy mayo', 'eel sauce',
    'sesame seeds', 'tempura flakes', 'cucumber', 'avocado', 'cream cheese'
  ];

  async processOrder(userPrompt: string): Promise<OrderRequest> {
    console.log('🤖 Processing your order with AI...');
    
    // First, analyze the user's request
    const analysis = await this.analyzeOrder(userPrompt);
    
    // Add random toppings based on cuisine type
    const randomToppings = this.generateRandomToppings(analysis.cuisineType);
    
    // Create enhanced prompt with random elements
    const enhancedPrompt = this.createEnhancedPrompt(userPrompt, analysis, randomToppings);
    
    return {
      originalPrompt: userPrompt,
      cuisineType: analysis.cuisineType,
      priceRange: analysis.priceRange,
      specificItems: analysis.specificItems,
      randomToppings,
      enhancedPrompt
    };
  }

  private async analyzeOrder(prompt: string): Promise<{
    cuisineType: string;
    priceRange: string;
    specificItems: string[];
  }> {
    const analysisPrompt = `Analyze this food order request and extract key information: "${prompt}"

Return a JSON object with:
- cuisineType: (pizza, burger, sushi, chinese, italian, mexican, etc.)
- priceRange: (budget, moderate, premium, or specific range like "under $20")
- specificItems: array of specific food items mentioned

Example: {"cuisineType": "pizza", "priceRange": "moderate", "specificItems": ["pizza"]}`;

    try {
      const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
        model: 'openai/gpt-3.5-turbo',
        messages: [{ role: 'user', content: analysisPrompt }],
        max_tokens: 500
      }, {
        headers: {
          'Authorization': `Bearer ${this.openRouteApiKey}`,
          'Content-Type': 'application/json'
        }
      });

      const data = response.data as OpenRouteResponse;
      const analysis = JSON.parse(data.choices[0].message.content.trim());
      
      return {
        cuisineType: analysis.cuisineType || 'general',
        priceRange: analysis.priceRange || 'moderate',
        specificItems: analysis.specificItems || []
      };
    } catch (error) {
      console.error('Error analyzing order:', error);
      return {
        cuisineType: 'general',
        priceRange: 'moderate',
        specificItems: []
      };
    }
  }

  private generateRandomToppings(cuisineType: string): string[] {
    const numToppings = Math.floor(Math.random() * 3) + 2; // 2-4 toppings
    
    let availableToppings: string[] = [];
    
    switch (cuisineType.toLowerCase()) {
      case 'pizza':
        availableToppings = this.pizzaToppings;
        break;
      case 'burger':
        availableToppings = this.burgerAddons;
        break;
      case 'sushi':
        availableToppings = this.sushiAddons;
        break;
      default:
        // Mix of different types for general cuisine
        availableToppings = [...this.pizzaToppings, ...this.burgerAddons, ...this.sushiAddons];
    }
    
    // Shuffle and pick random toppings
    const shuffled = availableToppings.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, numToppings);
  }

  private createEnhancedPrompt(
    originalPrompt: string, 
    analysis: { cuisineType: string; priceRange: string; specificItems: string[] },
    randomToppings: string[]
  ): string {
    const toppingsText = randomToppings.length > 0 
      ? ` with ${randomToppings.join(', ')}` 
      : '';
    
    const priceText = analysis.priceRange !== 'moderate' 
      ? ` (${analysis.priceRange} price range)` 
      : '';
    
    return `${originalPrompt}${toppingsText}${priceText}`;
  }

  async generateSearchQuery(enhancedPrompt: string): Promise<string> {
    const prompt = `Convert this enhanced food order request into an effective search query for a food delivery app: "${enhancedPrompt}". 
    Return only the search query, no additional text. Focus on key food attributes like type, cuisine, specific items, etc.`;

    try {
      const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
        model: 'openai/gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500
      }, {
        headers: {
          'Authorization': `Bearer ${this.openRouteApiKey}`,
          'Content-Type': 'application/json'
        }
      });

      const data = response.data as OpenRouteResponse;
      return data.choices[0].message.content.trim();
    } catch (error) {
      console.error('Error generating search query:', error);
      return enhancedPrompt;
    }
  }
}
