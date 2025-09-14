export interface AgentConfig {
  headless?: boolean;
  timeout?: number;
  useSavedCookies?: boolean;
}

export interface OrderDecision {
  cuisine_type: string;
  price_range: string;
  delivery_time: string;
  restaurant_preference: string;
}

export interface SelectedItems {
  selected_items: string[];
  total_estimated_cost: number;
  restaurant_name: string;
  delivery_estimate: string;
}

export interface OrderResult {
  decision: OrderDecision;
  selectedItems: SelectedItems;
  message: string;
}
