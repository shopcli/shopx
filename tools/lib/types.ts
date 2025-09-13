export interface MealDecision {
  cuisine_type: string;
  restaurant_preferences?: string;
  items: Array<{
    name: string;
    quantity: number;
  }>;
  dietary_restrictions?: string[];
  price_range: 'budget' | 'moderate' | 'expensive';
  special_instructions?: string;
}

export interface MenuItem {
  name: string;
  price: string;
  description?: string;
}

export interface Restaurant {
  url: string;
  name: string;
  rating: string;
  deliveryTime?: string;
  priceLevel?: number;
}

export interface SelectedItems {
  selected_items: string[];
  total_estimated_cost: number;
  reasoning: string;
}

export interface OrderResult {
  success: boolean;
  decision: MealDecision;
  selectedItems: SelectedItems;
  message: string;
}

export interface AgentConfig {
  headless?: boolean;
  address?: string;
  openRouterApiKey?: string;
  timeout?: number;
  useSavedCookies?: boolean;
  cookiesPath?: string;
}

export interface UberEatsCookies {
  cookies: any[];
  domain: string;
  lastUpdated: string;
}