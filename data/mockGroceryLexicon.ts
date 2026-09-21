// Sample data for the MOCK provider only (lib/providers/mock.ts).
//
// This is NOT the application's product catalogue — Khoj never ships with a
// hardcoded SKU database. It exists purely so the mock provider can return
// realistic-looking, internally-consistent fake results while no
// QuickCommerce API key is configured. The real provider (quickcommerce.ts)
// never reads this file.

export type MockUnit = "ml" | "g" | "pcs";

export interface MockCanonicalItem {
  id: string;
  brand: string;
  product: string;
  category: string;
  quantityValue: number;
  quantityUnit: MockUnit;
  variantTags: string[];
  /** Terms that should make this item show up as a search result candidate. */
  keywords: string[];
  basePrice: number;
}

export const MOCK_LEXICON: MockCanonicalItem[] = [
  {
    id: "amul-taaza-1l",
    brand: "Amul",
    product: "Taaza Toned Milk",
    category: "dairy",
    quantityValue: 1000,
    quantityUnit: "ml",
    variantTags: ["toned"],
    keywords: ["amul taaza", "taaza", "milk"],
    basePrice: 68,
  },
  {
    id: "amul-taaza-500ml",
    brand: "Amul",
    product: "Taaza Toned Milk",
    category: "dairy",
    quantityValue: 500,
    quantityUnit: "ml",
    variantTags: ["toned"],
    keywords: ["amul taaza 500", "milk 500"],
    basePrice: 36,
  },
  {
    id: "britannia-bread",
    brand: "Britannia",
    product: "White Bread",
    category: "bakery",
    quantityValue: 400,
    quantityUnit: "g",
    variantTags: [],
    keywords: ["bread"],
    basePrice: 45,
  },
  {
    id: "eggs-6pc",
    brand: "Farm Fresh",
    product: "Eggs",
    category: "eggs",
    quantityValue: 6,
    quantityUnit: "pcs",
    variantTags: [],
    keywords: ["egg", "eggs"],
    basePrice: 48,
  },
  {
    id: "maggi-2min",
    brand: "Nestle",
    product: "Maggi 2-Minute Noodles",
    category: "instant-food",
    quantityValue: 70,
    quantityUnit: "g",
    variantTags: [],
    keywords: ["maggi"],
    basePrice: 14,
  },
  {
    id: "coke-regular",
    brand: "Coca-Cola",
    product: "Coca-Cola",
    category: "beverages",
    quantityValue: 750,
    quantityUnit: "ml",
    variantTags: [],
    keywords: ["coke", "coca-cola", "coca cola"],
    basePrice: 45,
  },
  {
    id: "coke-zero",
    brand: "Coca-Cola",
    product: "Coca-Cola Zero Sugar",
    category: "beverages",
    quantityValue: 750,
    quantityUnit: "ml",
    variantTags: ["zero"],
    keywords: ["coke zero", "coca-cola zero", "diet coke"],
    basePrice: 45,
  },
  {
    id: "amul-butter",
    brand: "Amul",
    product: "Butter",
    category: "dairy",
    quantityValue: 100,
    quantityUnit: "g",
    variantTags: [],
    keywords: ["butter"],
    basePrice: 58,
  },
  {
    id: "aashirvaad-atta",
    brand: "Aashirvaad",
    product: "Whole Wheat Atta",
    category: "staples",
    quantityValue: 5000,
    quantityUnit: "g",
    variantTags: [],
    keywords: ["atta", "flour"],
    basePrice: 275,
  },
  {
    id: "tata-salt",
    brand: "Tata",
    product: "Salt",
    category: "staples",
    quantityValue: 1000,
    quantityUnit: "g",
    variantTags: [],
    keywords: ["salt"],
    basePrice: 28,
  },
  {
    id: "bambino-pasta",
    brand: "Bambino",
    product: "Macaroni Pasta",
    category: "instant-food",
    quantityValue: 200,
    quantityUnit: "g",
    variantTags: [],
    keywords: ["pasta", "macaroni"],
    basePrice: 40,
  },
  {
    id: "india-gate-rice",
    brand: "India Gate",
    product: "Basmati Rice",
    category: "staples",
    quantityValue: 1000,
    quantityUnit: "g",
    variantTags: [],
    keywords: ["rice", "basmati"],
    basePrice: 130,
  },
];
