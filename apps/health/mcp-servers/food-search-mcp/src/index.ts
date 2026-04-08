/**
 * Food Search MCP Server — Open Food Facts API integration.
 * Provides a search_food tool that queries the Open Food Facts database.
 * Falls back to local Peruvian food database when API is unavailable.
 */

const OPENFOODFACTS_BASE = process.env.OPENFOODFACTS_BASE_URL || 'https://world.openfoodfacts.org';

interface OpenFoodFactsProduct {
  product_name?: string;
  nutriments?: {
    'energy-kcal_100g'?: number;
    proteins_100g?: number;
    carbohydrates_100g?: number;
    fat_100g?: number;
    iron_100g?: number;
    zinc_100g?: number;
    'vitamin-a_100g'?: number;
  };
  categories_tags?: string[];
  image_url?: string;
}

interface SearchResult {
  name: string;
  kcal_100g: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  iron_mg: number;
  zinc_mg: number;
  vitamin_a_mcg: number;
  source: 'openfoodfacts' | 'local_db';
}

/**
 * Search Open Food Facts API for a food product.
 */
async function searchOpenFoodFacts(query: string, limit: number = 5): Promise<SearchResult[]> {
  const url = `${OPENFOODFACTS_BASE}/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&json=1&page_size=${limit}&lc=es`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'YayaHealth/1.0 (health@yaya.sh)' },
    });
    clearTimeout(timeout);

    if (!response.ok) return [];

    const data = await response.json() as { products?: OpenFoodFactsProduct[] };
    if (!data.products) return [];

    return data.products
      .filter((p) => p.product_name && p.nutriments)
      .map((p) => ({
        name: p.product_name!,
        kcal_100g: p.nutriments?.['energy-kcal_100g'] ?? 0,
        protein_g: p.nutriments?.proteins_100g ?? 0,
        carbs_g: p.nutriments?.carbohydrates_100g ?? 0,
        fat_g: p.nutriments?.fat_100g ?? 0,
        iron_mg: (p.nutriments?.iron_100g ?? 0) * 1000, // Convert g to mg
        zinc_mg: (p.nutriments?.zinc_100g ?? 0) * 1000,
        vitamin_a_mcg: (p.nutriments?.['vitamin-a_100g'] ?? 0) * 1e6, // Convert g to mcg
        source: 'openfoodfacts' as const,
      }));
  } catch {
    return []; // API unavailable — caller should fall back to local DB
  }
}

// MCP tool definition
const tools = {
  search_food_online: {
    description: 'Buscar un alimento en la base de datos Open Food Facts (online). Retorna información nutricional por 100g. Usar como complemento a la base de datos local peruana.',
    parameters: {
      query: 'Nombre del alimento (en español o inglés)',
      limit: 'Número máximo de resultados (default: 5)',
    },
    execute: async (params: { query: string; limit?: number }) => {
      const results = await searchOpenFoodFacts(params.query, params.limit ?? 5);
      return {
        count: results.length,
        source: 'openfoodfacts',
        foods: results,
        note: results.length === 0
          ? 'No se encontraron resultados en Open Food Facts. Usa la base de datos local (search_food).'
          : undefined,
      };
    },
  },
};

console.error('Food Search MCP server ready. Tools:', Object.keys(tools).join(', '));

export { tools, searchOpenFoodFacts };
