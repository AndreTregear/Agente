export interface FoodEntry {
  /** Food name in Spanish */
  name: string;
  /** Alternative names / common misspellings */
  aliases: string[];
  /** Category */
  category: 'cereal' | 'tuberculo' | 'proteina_animal' | 'legumbre' | 'lacteo' | 'fruta' | 'verdura' | 'preparado' | 'bebe' | 'grasa' | 'otro';
  /** Calories per 100g */
  kcal: number;
  /** Protein in grams per 100g */
  protein_g: number;
  /** Carbohydrates in grams per 100g */
  carbs_g: number;
  /** Fat in grams per 100g */
  fat_g: number;
  /** Iron in mg per 100g */
  iron_mg: number;
  /** Zinc in mg per 100g */
  zinc_mg: number;
  /** Vitamin A in mcg RAE per 100g */
  vitamin_a_mcg: number;
  /** Typical serving description */
  typical_serving: string;
  /** Typical serving size in grams */
  typical_serving_g: number;
}

export const PERUVIAN_FOODS: FoodEntry[] = [
  // ── CEREALS / GRAINS ──
  { name: 'arroz', aliases: ['arroz blanco', 'arrocito'], category: 'cereal', kcal: 130, protein_g: 2.7, carbs_g: 28, fat_g: 0.3, iron_mg: 0.2, zinc_mg: 0.5, vitamin_a_mcg: 0, typical_serving: '1 taza cocida', typical_serving_g: 158 },
  { name: 'quinua', aliases: ['quinoa', 'kinwa'], category: 'cereal', kcal: 120, protein_g: 4.4, carbs_g: 21.3, fat_g: 1.9, iron_mg: 1.5, zinc_mg: 1.1, vitamin_a_mcg: 1, typical_serving: '1 taza cocida', typical_serving_g: 185 },
  { name: 'kiwicha', aliases: ['amaranto', 'amaranth'], category: 'cereal', kcal: 102, protein_g: 3.8, carbs_g: 18.7, fat_g: 1.6, iron_mg: 2.1, zinc_mg: 0.9, vitamin_a_mcg: 0, typical_serving: '1 taza cocida', typical_serving_g: 246 },
  { name: 'cañihua', aliases: ['kañiwa', 'canihua'], category: 'cereal', kcal: 343, protein_g: 14, carbs_g: 64, fat_g: 4.3, iron_mg: 10, zinc_mg: 3.7, vitamin_a_mcg: 0, typical_serving: '1/4 taza seca', typical_serving_g: 45 },
  { name: 'maíz', aliases: ['choclo', 'mote', 'maiz'], category: 'cereal', kcal: 86, protein_g: 3.2, carbs_g: 19, fat_g: 1.2, iron_mg: 0.5, zinc_mg: 0.5, vitamin_a_mcg: 10, typical_serving: '1 choclo', typical_serving_g: 150 },
  { name: 'trigo', aliases: ['harina de trigo', 'pan'], category: 'cereal', kcal: 340, protein_g: 13.2, carbs_g: 72, fat_g: 2.5, iron_mg: 3.2, zinc_mg: 2.6, vitamin_a_mcg: 0, typical_serving: '1 pan', typical_serving_g: 60 },
  { name: 'cebada', aliases: ['cebada perlada'], category: 'cereal', kcal: 123, protein_g: 2.3, carbs_g: 28.2, fat_g: 0.4, iron_mg: 1.3, zinc_mg: 0.8, vitamin_a_mcg: 0, typical_serving: '1 taza cocida', typical_serving_g: 157 },
  { name: 'avena', aliases: ['quaker', 'avena en hojuelas'], category: 'cereal', kcal: 68, protein_g: 2.5, carbs_g: 12, fat_g: 1.4, iron_mg: 0.6, zinc_mg: 0.5, vitamin_a_mcg: 0, typical_serving: '1 taza cocida', typical_serving_g: 234 },
  { name: 'fideos', aliases: ['pasta', 'tallarines', 'spaghetti', 'espagueti'], category: 'cereal', kcal: 131, protein_g: 5, carbs_g: 25, fat_g: 1.1, iron_mg: 0.5, zinc_mg: 0.5, vitamin_a_mcg: 0, typical_serving: '1 taza cocida', typical_serving_g: 140 },

  // ── TUBERS ──
  { name: 'papa', aliases: ['patata', 'papa blanca', 'papita'], category: 'tuberculo', kcal: 77, protein_g: 2, carbs_g: 17, fat_g: 0.1, iron_mg: 0.8, zinc_mg: 0.3, vitamin_a_mcg: 0, typical_serving: '1 papa mediana', typical_serving_g: 150 },
  { name: 'camote', aliases: ['batata', 'boniato'], category: 'tuberculo', kcal: 86, protein_g: 1.6, carbs_g: 20, fat_g: 0.1, iron_mg: 0.6, zinc_mg: 0.3, vitamin_a_mcg: 709, typical_serving: '1 camote mediano', typical_serving_g: 130 },
  { name: 'yuca', aliases: ['mandioca', 'cassava'], category: 'tuberculo', kcal: 160, protein_g: 1.4, carbs_g: 38, fat_g: 0.3, iron_mg: 0.3, zinc_mg: 0.3, vitamin_a_mcg: 1, typical_serving: '1 trozo', typical_serving_g: 100 },
  { name: 'olluco', aliases: ['ollucto', 'ulluco'], category: 'tuberculo', kcal: 62, protein_g: 1.1, carbs_g: 14, fat_g: 0.1, iron_mg: 1.1, zinc_mg: 0.3, vitamin_a_mcg: 5, typical_serving: '1/2 taza', typical_serving_g: 100 },
  { name: 'oca', aliases: ['oka'], category: 'tuberculo', kcal: 61, protein_g: 1, carbs_g: 13.3, fat_g: 0.6, iron_mg: 1.6, zinc_mg: 0.3, vitamin_a_mcg: 1, typical_serving: '1/2 taza', typical_serving_g: 100 },

  // ── ANIMAL PROTEINS ──
  { name: 'pollo', aliases: ['pollito', 'pechuga', 'pierna de pollo', 'muslo'], category: 'proteina_animal', kcal: 239, protein_g: 27.3, carbs_g: 0, fat_g: 13.6, iron_mg: 1.3, zinc_mg: 1.5, vitamin_a_mcg: 21, typical_serving: '1 pieza', typical_serving_g: 120 },
  { name: 'res', aliases: ['carne de res', 'bistec', 'carne', 'bife'], category: 'proteina_animal', kcal: 250, protein_g: 26, carbs_g: 0, fat_g: 15, iron_mg: 2.6, zinc_mg: 6.3, vitamin_a_mcg: 0, typical_serving: '1 bistec', typical_serving_g: 120 },
  { name: 'pescado', aliases: ['pescadito', 'jurel', 'bonito', 'trucha', 'tilapia'], category: 'proteina_animal', kcal: 136, protein_g: 23, carbs_g: 0, fat_g: 4.5, iron_mg: 1.0, zinc_mg: 0.7, vitamin_a_mcg: 12, typical_serving: '1 filete', typical_serving_g: 150 },
  { name: 'cuy', aliases: ['cobayo', 'cuycito'], category: 'proteina_animal', kcal: 96, protein_g: 19, carbs_g: 0, fat_g: 1.6, iron_mg: 1.9, zinc_mg: 1.9, vitamin_a_mcg: 0, typical_serving: '1/4 cuy', typical_serving_g: 150 },
  { name: 'huevo', aliases: ['huevito', 'huevos'], category: 'proteina_animal', kcal: 155, protein_g: 13, carbs_g: 1.1, fat_g: 11, iron_mg: 1.8, zinc_mg: 1.3, vitamin_a_mcg: 160, typical_serving: '1 huevo', typical_serving_g: 50 },
  { name: 'hígado', aliases: ['higado', 'hígado de pollo', 'hígado de res', 'higadito'], category: 'proteina_animal', kcal: 135, protein_g: 21, carbs_g: 3.9, fat_g: 3.6, iron_mg: 6.5, zinc_mg: 4.0, vitamin_a_mcg: 4968, typical_serving: '1 porción', typical_serving_g: 85 },
  { name: 'sangrecita', aliases: ['sangre de pollo', 'sangre cocida', 'relleno'], category: 'proteina_animal', kcal: 62, protein_g: 14, carbs_g: 0.5, fat_g: 0.3, iron_mg: 29.5, zinc_mg: 0.3, vitamin_a_mcg: 0, typical_serving: '2 cucharadas', typical_serving_g: 50 },
  { name: 'atún', aliases: ['tuna', 'atun en lata'], category: 'proteina_animal', kcal: 132, protein_g: 28, carbs_g: 0, fat_g: 1.3, iron_mg: 1.3, zinc_mg: 0.6, vitamin_a_mcg: 18, typical_serving: '1 lata', typical_serving_g: 85 },
  { name: 'cerdo', aliases: ['chancho', 'carne de cerdo'], category: 'proteina_animal', kcal: 242, protein_g: 27, carbs_g: 0, fat_g: 14, iron_mg: 0.9, zinc_mg: 2.4, vitamin_a_mcg: 2, typical_serving: '1 porción', typical_serving_g: 120 },

  // ── LEGUMES ──
  { name: 'lentejas', aliases: ['lenteja'], category: 'legumbre', kcal: 116, protein_g: 9, carbs_g: 20, fat_g: 0.4, iron_mg: 3.3, zinc_mg: 1.3, vitamin_a_mcg: 2, typical_serving: '1 taza cocida', typical_serving_g: 198 },
  { name: 'frijoles', aliases: ['frejoles', 'porotos', 'frijol'], category: 'legumbre', kcal: 127, protein_g: 8.7, carbs_g: 22.8, fat_g: 0.5, iron_mg: 2.9, zinc_mg: 1.1, vitamin_a_mcg: 0, typical_serving: '1 taza cocida', typical_serving_g: 177 },
  { name: 'pallares', aliases: ['pallar', 'lima beans'], category: 'legumbre', kcal: 115, protein_g: 7.8, carbs_g: 20.9, fat_g: 0.4, iron_mg: 2.4, zinc_mg: 0.9, vitamin_a_mcg: 0, typical_serving: '1 taza cocida', typical_serving_g: 170 },
  { name: 'garbanzos', aliases: ['garbanzo'], category: 'legumbre', kcal: 164, protein_g: 8.9, carbs_g: 27.4, fat_g: 2.6, iron_mg: 2.9, zinc_mg: 1.5, vitamin_a_mcg: 1, typical_serving: '1 taza cocida', typical_serving_g: 164 },
  { name: 'habas', aliases: ['haba'], category: 'legumbre', kcal: 110, protein_g: 7.6, carbs_g: 19.7, fat_g: 0.4, iron_mg: 1.5, zinc_mg: 1.0, vitamin_a_mcg: 4, typical_serving: '1 taza cocida', typical_serving_g: 170 },
  { name: 'tarwi', aliases: ['chocho', 'lupino'], category: 'legumbre', kcal: 151, protein_g: 11.6, carbs_g: 9.9, fat_g: 6.4, iron_mg: 1.4, zinc_mg: 1.2, vitamin_a_mcg: 0, typical_serving: '1/2 taza', typical_serving_g: 100 },

  // ── DAIRY ──
  { name: 'leche', aliases: ['lechita', 'leche de vaca', 'leche entera', 'leche fresca'], category: 'lacteo', kcal: 61, protein_g: 3.2, carbs_g: 4.8, fat_g: 3.3, iron_mg: 0.03, zinc_mg: 0.4, vitamin_a_mcg: 46, typical_serving: '1 vaso', typical_serving_g: 244 },
  { name: 'queso', aliases: ['quesito', 'queso fresco', 'queso andino'], category: 'lacteo', kcal: 264, protein_g: 17.5, carbs_g: 3.1, fat_g: 21, iron_mg: 0.7, zinc_mg: 3.6, vitamin_a_mcg: 198, typical_serving: '1 tajada', typical_serving_g: 30 },
  { name: 'yogur', aliases: ['yogurt', 'yogurt natural'], category: 'lacteo', kcal: 63, protein_g: 5.3, carbs_g: 7.0, fat_g: 1.6, iron_mg: 0.1, zinc_mg: 0.9, vitamin_a_mcg: 14, typical_serving: '1 vaso', typical_serving_g: 245 },

  // ── FRUITS ──
  { name: 'plátano', aliases: ['banana', 'platano', 'banano', 'guineo'], category: 'fruta', kcal: 89, protein_g: 1.1, carbs_g: 23, fat_g: 0.3, iron_mg: 0.3, zinc_mg: 0.2, vitamin_a_mcg: 3, typical_serving: '1 plátano', typical_serving_g: 118 },
  { name: 'mango', aliases: ['mangito'], category: 'fruta', kcal: 60, protein_g: 0.8, carbs_g: 15, fat_g: 0.4, iron_mg: 0.2, zinc_mg: 0.1, vitamin_a_mcg: 54, typical_serving: '1 mango', typical_serving_g: 200 },
  { name: 'papaya', aliases: ['papayita', 'fruta bomba'], category: 'fruta', kcal: 43, protein_g: 0.5, carbs_g: 11, fat_g: 0.3, iron_mg: 0.3, zinc_mg: 0.1, vitamin_a_mcg: 47, typical_serving: '1 taza', typical_serving_g: 145 },
  { name: 'lúcuma', aliases: ['lucuma'], category: 'fruta', kcal: 99, protein_g: 1.5, carbs_g: 25, fat_g: 0.5, iron_mg: 0.4, zinc_mg: 0.2, vitamin_a_mcg: 92, typical_serving: '1 lúcuma', typical_serving_g: 100 },
  { name: 'chirimoya', aliases: ['anona'], category: 'fruta', kcal: 75, protein_g: 1.6, carbs_g: 18, fat_g: 0.7, iron_mg: 0.3, zinc_mg: 0.2, vitamin_a_mcg: 0, typical_serving: '1 chirimoya', typical_serving_g: 160 },
  { name: 'camu camu', aliases: ['camu'], category: 'fruta', kcal: 17, protein_g: 0.4, carbs_g: 4.7, fat_g: 0.2, iron_mg: 0.5, zinc_mg: 0.2, vitamin_a_mcg: 2, typical_serving: '10 frutos', typical_serving_g: 30 },
  { name: 'aguaje', aliases: ['moriche', 'buriti'], category: 'fruta', kcal: 283, protein_g: 2.3, carbs_g: 18.1, fat_g: 25.1, iron_mg: 0.7, zinc_mg: 0.3, vitamin_a_mcg: 1860, typical_serving: '5 frutos', typical_serving_g: 100 },
  { name: 'naranja', aliases: ['china'], category: 'fruta', kcal: 47, protein_g: 0.9, carbs_g: 12, fat_g: 0.1, iron_mg: 0.1, zinc_mg: 0.1, vitamin_a_mcg: 11, typical_serving: '1 naranja', typical_serving_g: 131 },
  { name: 'mandarina', aliases: ['tangerina'], category: 'fruta', kcal: 53, protein_g: 0.8, carbs_g: 13, fat_g: 0.3, iron_mg: 0.2, zinc_mg: 0.1, vitamin_a_mcg: 34, typical_serving: '1 mandarina', typical_serving_g: 88 },
  { name: 'manzana', aliases: ['manzanita'], category: 'fruta', kcal: 52, protein_g: 0.3, carbs_g: 14, fat_g: 0.2, iron_mg: 0.1, zinc_mg: 0.0, vitamin_a_mcg: 3, typical_serving: '1 manzana', typical_serving_g: 182 },
  { name: 'palta', aliases: ['aguacate', 'avocado'], category: 'fruta', kcal: 160, protein_g: 2, carbs_g: 8.5, fat_g: 14.7, iron_mg: 0.6, zinc_mg: 0.6, vitamin_a_mcg: 7, typical_serving: '1/2 palta', typical_serving_g: 68 },
  { name: 'granadilla', aliases: ['granada china'], category: 'fruta', kcal: 97, protein_g: 2.2, carbs_g: 23.4, fat_g: 0.7, iron_mg: 1.6, zinc_mg: 0.1, vitamin_a_mcg: 64, typical_serving: '1 granadilla', typical_serving_g: 50 },

  // ── VEGETABLES ──
  { name: 'tomate', aliases: ['tomatito', 'jitomate'], category: 'verdura', kcal: 18, protein_g: 0.9, carbs_g: 3.9, fat_g: 0.2, iron_mg: 0.3, zinc_mg: 0.2, vitamin_a_mcg: 42, typical_serving: '1 tomate', typical_serving_g: 123 },
  { name: 'cebolla', aliases: ['cebollita'], category: 'verdura', kcal: 40, protein_g: 1.1, carbs_g: 9.3, fat_g: 0.1, iron_mg: 0.2, zinc_mg: 0.2, vitamin_a_mcg: 0, typical_serving: '1 cebolla', typical_serving_g: 110 },
  { name: 'zanahoria', aliases: ['zanahoriita'], category: 'verdura', kcal: 41, protein_g: 0.9, carbs_g: 10, fat_g: 0.2, iron_mg: 0.3, zinc_mg: 0.2, vitamin_a_mcg: 835, typical_serving: '1 zanahoria', typical_serving_g: 61 },
  { name: 'espinaca', aliases: ['espinacas'], category: 'verdura', kcal: 23, protein_g: 2.9, carbs_g: 3.6, fat_g: 0.4, iron_mg: 2.7, zinc_mg: 0.5, vitamin_a_mcg: 469, typical_serving: '1 taza', typical_serving_g: 30 },
  { name: 'zapallo', aliases: ['calabaza', 'zapallo macre'], category: 'verdura', kcal: 26, protein_g: 1.0, carbs_g: 6.5, fat_g: 0.1, iron_mg: 0.8, zinc_mg: 0.3, vitamin_a_mcg: 426, typical_serving: '1 taza', typical_serving_g: 116 },
  { name: 'ají', aliases: ['aji amarillo', 'rocoto', 'aji'], category: 'verdura', kcal: 40, protein_g: 2, carbs_g: 9, fat_g: 0.2, iron_mg: 1.0, zinc_mg: 0.3, vitamin_a_mcg: 48, typical_serving: '1 ají', typical_serving_g: 15 },
  { name: 'brócoli', aliases: ['brocoli', 'brecol'], category: 'verdura', kcal: 34, protein_g: 2.8, carbs_g: 7, fat_g: 0.4, iron_mg: 0.7, zinc_mg: 0.4, vitamin_a_mcg: 31, typical_serving: '1 taza', typical_serving_g: 91 },
  { name: 'choclo', aliases: ['elote', 'maíz tierno'], category: 'verdura', kcal: 86, protein_g: 3.2, carbs_g: 19, fat_g: 1.2, iron_mg: 0.5, zinc_mg: 0.5, vitamin_a_mcg: 10, typical_serving: '1 choclo', typical_serving_g: 150 },
  { name: 'lechuga', aliases: ['ensalada'], category: 'verdura', kcal: 15, protein_g: 1.4, carbs_g: 2.9, fat_g: 0.2, iron_mg: 0.9, zinc_mg: 0.2, vitamin_a_mcg: 370, typical_serving: '2 hojas', typical_serving_g: 36 },

  // ── PREPARED DISHES ──
  { name: 'ceviche', aliases: ['cebiche', 'seviche'], category: 'preparado', kcal: 120, protein_g: 18, carbs_g: 8, fat_g: 2, iron_mg: 1.0, zinc_mg: 0.8, vitamin_a_mcg: 10, typical_serving: '1 plato', typical_serving_g: 250 },
  { name: 'lomo saltado', aliases: ['lomito saltado'], category: 'preparado', kcal: 180, protein_g: 15, carbs_g: 16, fat_g: 7, iron_mg: 2.2, zinc_mg: 3.5, vitamin_a_mcg: 25, typical_serving: '1 plato', typical_serving_g: 350 },
  { name: 'arroz con pollo', aliases: ['arrocito con pollo'], category: 'preparado', kcal: 170, protein_g: 12, carbs_g: 22, fat_g: 4, iron_mg: 1.2, zinc_mg: 1.3, vitamin_a_mcg: 35, typical_serving: '1 plato', typical_serving_g: 400 },
  { name: 'papa a la huancaína', aliases: ['huancaina', 'papa a la huancaina'], category: 'preparado', kcal: 195, protein_g: 5, carbs_g: 18, fat_g: 12, iron_mg: 0.8, zinc_mg: 0.9, vitamin_a_mcg: 80, typical_serving: '1 porción', typical_serving_g: 250 },
  { name: 'caldo de gallina', aliases: ['caldo de pollo', 'caldito', 'sopa de gallina'], category: 'preparado', kcal: 75, protein_g: 6, carbs_g: 8, fat_g: 2, iron_mg: 0.5, zinc_mg: 0.6, vitamin_a_mcg: 50, typical_serving: '1 plato', typical_serving_g: 400 },
  { name: 'ají de gallina', aliases: ['aji de gallina'], category: 'preparado', kcal: 165, protein_g: 10, carbs_g: 12, fat_g: 9, iron_mg: 1.5, zinc_mg: 1.2, vitamin_a_mcg: 80, typical_serving: '1 plato', typical_serving_g: 350 },
  { name: 'seco de res', aliases: ['seco de carne'], category: 'preparado', kcal: 155, protein_g: 14, carbs_g: 8, fat_g: 7, iron_mg: 2.5, zinc_mg: 4.0, vitamin_a_mcg: 15, typical_serving: '1 plato', typical_serving_g: 350 },
  { name: 'tacu tacu', aliases: ['tacutacu'], category: 'preparado', kcal: 190, protein_g: 7, carbs_g: 30, fat_g: 5, iron_mg: 2.0, zinc_mg: 1.0, vitamin_a_mcg: 5, typical_serving: '1 porción', typical_serving_g: 250 },
  { name: 'causa', aliases: ['causa limeña', 'causa rellena'], category: 'preparado', kcal: 170, protein_g: 7, carbs_g: 20, fat_g: 7, iron_mg: 0.8, zinc_mg: 0.6, vitamin_a_mcg: 30, typical_serving: '1 porción', typical_serving_g: 200 },
  { name: 'sopa de quinua', aliases: ['crema de quinua'], category: 'preparado', kcal: 85, protein_g: 4, carbs_g: 14, fat_g: 1.5, iron_mg: 1.2, zinc_mg: 0.8, vitamin_a_mcg: 40, typical_serving: '1 plato', typical_serving_g: 400 },
  { name: 'anticucho', aliases: ['anticuchos'], category: 'preparado', kcal: 220, protein_g: 20, carbs_g: 5, fat_g: 14, iron_mg: 5, zinc_mg: 3.5, vitamin_a_mcg: 0, typical_serving: '3 palitos', typical_serving_g: 150 },
  { name: 'pachamanca', aliases: [], category: 'preparado', kcal: 160, protein_g: 12, carbs_g: 18, fat_g: 5, iron_mg: 1.8, zinc_mg: 2.0, vitamin_a_mcg: 30, typical_serving: '1 plato', typical_serving_g: 400 },

  // ── BABY FOODS ──
  { name: 'papilla', aliases: ['papilla de frutas', 'puré de frutas'], category: 'bebe', kcal: 55, protein_g: 0.5, carbs_g: 13, fat_g: 0.2, iron_mg: 0.2, zinc_mg: 0.1, vitamin_a_mcg: 30, typical_serving: '1/2 taza', typical_serving_g: 120 },
  { name: 'puré de papa', aliases: ['pure de papa', 'purecito'], category: 'bebe', kcal: 83, protein_g: 2, carbs_g: 18, fat_g: 0.5, iron_mg: 0.3, zinc_mg: 0.3, vitamin_a_mcg: 0, typical_serving: '1/2 taza', typical_serving_g: 120 },
  { name: 'mazamorra', aliases: ['mazamorra morada', 'mazamorrita'], category: 'bebe', kcal: 100, protein_g: 1, carbs_g: 24, fat_g: 0.2, iron_mg: 0.4, zinc_mg: 0.1, vitamin_a_mcg: 0, typical_serving: '1 taza', typical_serving_g: 200 },
  { name: 'papilla de hígado', aliases: ['higadito para bebe'], category: 'bebe', kcal: 100, protein_g: 14, carbs_g: 5, fat_g: 3, iron_mg: 5.5, zinc_mg: 3.0, vitamin_a_mcg: 4000, typical_serving: '3 cucharadas', typical_serving_g: 60 },

  // ── FATS / OTHER ──
  { name: 'aceite', aliases: ['aceite vegetal', 'aceite de oliva'], category: 'grasa', kcal: 884, protein_g: 0, carbs_g: 0, fat_g: 100, iron_mg: 0, zinc_mg: 0, vitamin_a_mcg: 0, typical_serving: '1 cucharada', typical_serving_g: 14 },
  { name: 'azúcar', aliases: ['azucar', 'azuquitar'], category: 'otro', kcal: 387, protein_g: 0, carbs_g: 100, fat_g: 0, iron_mg: 0, zinc_mg: 0, vitamin_a_mcg: 0, typical_serving: '1 cucharada', typical_serving_g: 12 },
  { name: 'miel', aliases: ['miel de abeja'], category: 'otro', kcal: 304, protein_g: 0.3, carbs_g: 82, fat_g: 0, iron_mg: 0.4, zinc_mg: 0.2, vitamin_a_mcg: 0, typical_serving: '1 cucharada', typical_serving_g: 21 },
  { name: 'maní', aliases: ['cacahuate', 'cacahuete'], category: 'legumbre', kcal: 567, protein_g: 26, carbs_g: 16, fat_g: 49, iron_mg: 4.6, zinc_mg: 3.3, vitamin_a_mcg: 0, typical_serving: '1/4 taza', typical_serving_g: 36 },
];

/**
 * Search for a food in the database using fuzzy matching.
 * Returns the best match or null.
 */
export function findFood(query: string): FoodEntry | null {
  const q = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

  // Exact match on name
  let match = PERUVIAN_FOODS.find(f =>
    f.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === q
  );
  if (match) return match;

  // Exact match on alias
  match = PERUVIAN_FOODS.find(f =>
    f.aliases.some(a => a.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === q)
  );
  if (match) return match;

  // Partial match on name
  match = PERUVIAN_FOODS.find(f =>
    f.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(q) ||
    q.includes(f.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
  );
  if (match) return match;

  // Partial match on aliases
  match = PERUVIAN_FOODS.find(f =>
    f.aliases.some(a => {
      const norm = a.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return norm.includes(q) || q.includes(norm);
    })
  );
  return match || null;
}

/**
 * Search for all foods matching a query (returns multiple results).
 */
export function searchFoods(query: string): FoodEntry[] {
  const q = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

  return PERUVIAN_FOODS.filter(f => {
    const nameNorm = f.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (nameNorm.includes(q) || q.includes(nameNorm)) return true;
    return f.aliases.some(a => {
      const aliasNorm = a.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return aliasNorm.includes(q) || q.includes(aliasNorm);
    });
  });
}
