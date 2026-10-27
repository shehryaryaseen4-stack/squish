// Foods people eat, with calories and protein per everyday portion, for the
// diet search. Pakistani and common international dishes, with Urdu / Roman Urdu
// names to search by. Values are typical (USDA and common recipes); home cooking
// varies, mostly with the oil and ghee.
(function (root) {
  // [id, name, other names, portion, kcal, protein, carbs, fat]
  const RAW = [
    // Eggs and dairy
    ['egg-boiled', 'Egg, boiled', 'anda ubla', '1 large egg', 78, 6.3, 0.6, 5.3],
    ['egg-fried', 'Egg, fried', 'anda fry', '1 egg', 90, 6.3, 0.4, 7],
    ['omelette', 'Omelette (2 eggs)', 'anda omelet khagina', '2 eggs', 190, 13, 1.5, 15],
    ['egg-white', 'Egg white', 'safaidi anday ki', '1 egg white', 17, 3.6, 0.2, 0],
    ['milk', 'Milk, full cream', 'doodh', '1 glass (250 ml)', 150, 8, 12, 8],
    ['milk-skim', 'Milk, skimmed', 'doodh low fat', '1 glass (250 ml)', 85, 8.5, 12, 0.2],
    ['dahi', 'Dahi (plain yogurt)', 'yogurt curd dahi', '1 cup (245 g)', 150, 8.5, 11.4, 8],
    ['greek-yogurt', 'Greek yogurt, plain', 'yogurt', '1 pot (170 g)', 100, 17, 6, 0.7],
    ['lassi-sweet', 'Lassi, sweet', 'meethi lassi', '1 glass (250 ml)', 230, 7, 35, 6],
    ['lassi-salty', 'Lassi, salty', 'namkeen lassi', '1 glass (250 ml)', 120, 6, 9, 6],
    ['paneer', 'Paneer', 'cottage cheese', '100 g', 265, 18, 3.6, 20],
    ['cheese-slice', 'Cheese slice', 'cheese', '1 slice (20 g)', 60, 3.5, 1.5, 4.5],
    ['cheddar', 'Cheddar cheese', 'cheese', '1 slice (28 g)', 113, 7, 0.4, 9.3],
    ['butter', 'Butter', 'makhan', '1 tbsp (14 g)', 102, 0.1, 0, 11.5],
    ['ghee', 'Desi ghee', 'ghee', '1 tbsp (13 g)', 117, 0, 0, 13],
    ['oil', 'Cooking oil', 'tail oil', '1 tbsp (14 g)', 120, 0, 0, 14],
    ['cream', 'Cream', 'malai', '1 tbsp (15 g)', 50, 0.4, 0.4, 5.4],
    ['chai', 'Chai with milk and sugar', 'tea chai', '1 cup', 90, 2.5, 13, 3],
    ['doodh-patti', 'Doodh patti', 'tea doodh pati', '1 cup', 130, 4, 16, 5],
    ['coffee-milk', 'Coffee with milk', 'coffee latte', '1 cup', 110, 6, 10, 5],
    ['coffee-black', 'Black coffee / green tea', 'coffee green tea', '1 cup', 2, 0.3, 0, 0],

    // Meat, chicken, fish
    ['chicken-breast', 'Chicken breast, cooked', 'murgi chicken seena', '100 g', 165, 31, 0, 3.6],
    ['chicken-thigh', 'Chicken thigh, cooked', 'murgi chicken leg ran', '100 g', 209, 26, 0, 10.9],
    ['chicken-karahi', 'Chicken karahi', 'murgi karahi', '1 plate (250 g)', 450, 35, 8, 30],
    ['chicken-curry', 'Chicken curry (salan)', 'murgi salan shorba', '1 bowl (250 g)', 350, 28, 10, 22],
    ['chicken-tikka', 'Chicken tikka', 'tikka bbq', '1 piece (150 g)', 230, 36, 3, 8],
    ['chicken-boti', 'Chicken boti / grilled', 'boti grilled chicken bbq', '100 g', 160, 26, 2, 5],
    ['chicken-handi', 'Chicken handi', 'handi murgi', '1 bowl (250 g)', 480, 30, 10, 35],
    ['chicken-shawarma', 'Chicken shawarma', 'shawarma', '1 roll', 500, 25, 45, 24],
    ['chicken-roll', 'Chicken roll paratha', 'roll paratha', '1 roll', 450, 20, 40, 22],
    ['chicken-nuggets', 'Chicken nuggets', 'nuggets', '6 pieces', 280, 14, 17, 17],
    ['chicken-broast', 'Chicken broast / fried', 'broast fried chicken', '1 piece', 320, 22, 12, 20],
    ['chicken-sandwich', 'Chicken sandwich', 'sandwich', '1 sandwich', 300, 18, 30, 11],
    ['club-sandwich', 'Club sandwich', 'sandwich', '1 plate', 500, 25, 40, 25],
    ['chicken-corn-soup', 'Chicken corn soup', 'soup', '1 bowl', 150, 9, 18, 4],
    ['mutton', 'Mutton, cooked', 'gosht bakra lamb', '100 g', 294, 25, 0, 21],
    ['mutton-karahi', 'Mutton karahi', 'gosht karahi', '1 plate (250 g)', 550, 35, 8, 42],
    ['beef', 'Beef, lean, cooked', 'gaye ka gosht beef', '100 g', 250, 26, 0, 15],
    ['qeema', 'Qeema (beef mince), cooked', 'keema mince', '1 bowl (150 g)', 375, 30, 4, 26],
    ['nihari', 'Nihari', 'nihari', '1 bowl (300 g)', 520, 32, 12, 38],
    ['haleem', 'Haleem', 'haleem daleem', '1 bowl (300 g)', 400, 22, 40, 16],
    ['paya', 'Paya', 'paye trotters', '1 bowl (300 g)', 450, 25, 6, 36],
    ['seekh-kabab', 'Seekh kabab', 'kabab kebab', '1 piece (50 g)', 140, 9, 2, 10],
    ['chapli-kabab', 'Chapli kabab', 'kabab chappal', '1 kabab (100 g)', 300, 17, 8, 22],
    ['shami-kabab', 'Shami kabab', 'kabab', '1 kabab (50 g)', 120, 7, 7, 7],
    ['fish-fried', 'Fish, fried', 'machli fry', '100 g', 230, 20, 8, 13],
    ['fish-grilled', 'Fish, grilled', 'machli', '100 g', 140, 22, 0, 5],
    ['fish-curry', 'Fish curry', 'machli salan', '1 bowl (250 g)', 320, 28, 8, 19],
    ['tuna', 'Tuna, canned in water', 'tuna', '100 g', 116, 26, 0, 1],
    ['prawns', 'Prawns, cooked', 'jhinga shrimp', '100 g', 99, 24, 0.2, 0.3],
    ['sausage', 'Chicken sausage', 'sausage', '1 sausage (50 g)', 120, 7, 3, 9],

    // Rice dishes and bread
    ['roti', 'Roti / chapati', 'chapati phulka', '1 roti', 120, 3, 18, 3.7],
    ['paratha', 'Paratha, plain', 'parontha', '1 paratha', 260, 5, 36, 10],
    ['aloo-paratha', 'Aloo paratha', 'parontha', '1 paratha', 300, 6, 40, 13],
    ['naan', 'Naan', 'nan tandoori', '1 naan', 260, 9, 45, 5],
    ['roghni-naan', 'Roghni naan', 'nan', '1 naan', 330, 9, 50, 10],
    ['puri', 'Puri', 'poori', '1 puri', 100, 2, 12, 5],
    ['rice', 'Rice, white, cooked', 'chawal boiled', '1 cup (160 g)', 205, 4.3, 45, 0.4],
    ['brown-rice', 'Rice, brown, cooked', 'chawal', '1 cup (160 g)', 215, 5, 45, 1.8],
    ['chicken-biryani', 'Chicken biryani', 'biryani', '1 plate (350 g)', 600, 25, 75, 20],
    ['beef-biryani', 'Beef biryani', 'biryani', '1 plate (350 g)', 650, 27, 75, 25],
    ['pulao', 'Pulao', 'yakhni pulao', '1 plate (250 g)', 400, 12, 60, 13],
    ['daal-chawal', 'Daal chawal', 'dal rice', '1 plate', 450, 15, 75, 9],
    ['khichdi', 'Khichdi', 'khichri', '1 plate (250 g)', 300, 10, 50, 7],
    ['bread-white', 'Bread, white', 'double roti', '1 slice', 75, 2.5, 14, 1],
    ['bread-brown', 'Bread, brown', 'double roti', '1 slice', 80, 4, 13, 1],
    ['oats', 'Oats', 'daliya oatmeal', '50 g dry', 190, 6.5, 33, 3.4],
    ['cornflakes', 'Cornflakes', 'cereal', '30 g', 110, 2, 25, 0.1],
    ['pasta', 'Pasta, cooked', 'macaroni spaghetti', '1 cup (140 g)', 220, 8, 43, 1.3],
    ['chicken-macaroni', 'Chicken macaroni', 'macaroni pasta', '1 plate', 450, 20, 55, 15],
    ['noodles', 'Instant noodles', 'maggi noodles', '1 pack', 380, 8, 52, 15],
    ['pizza', 'Pizza', 'pizza', '1 slice', 285, 12, 36, 10],
    ['burger-zinger', 'Zinger burger', 'burger', '1 burger', 550, 25, 50, 26],
    ['burger-beef', 'Beef burger', 'burger', '1 burger', 500, 25, 40, 25],
    ['anda-shami-burger', 'Anda shami burger', 'burger bun', '1 burger', 400, 15, 40, 20],
    ['bun-kabab', 'Bun kabab', 'bun kebab', '1 bun kabab', 350, 12, 40, 15],
    ['fries', 'French fries', 'chips fries', 'medium portion', 365, 4, 48, 17],

    // Daal, beans, vegetables
    ['daal', 'Daal (lentils)', 'dal masoor moong mash chana daal', '1 bowl (200 g)', 230, 14, 34, 5],
    ['chana', 'Chanay (chickpeas)', 'chane cholay chickpeas', '1 cup (165 g)', 270, 14.5, 45, 4.2],
    ['chana-chaat', 'Chana chaat', 'chaat', '1 plate', 250, 10, 38, 7],
    ['rajma', 'Rajma (kidney beans)', 'lobia beans', '1 bowl (200 g)', 230, 13, 40, 1],
    ['soya', 'Soya chunks', 'soya', '50 g dry', 172, 26, 16, 0.5],
    ['tofu', 'Tofu, firm', 'tofu', '100 g', 144, 17, 3, 8.7],
    ['mixed-sabzi', 'Mixed vegetable curry', 'sabzi salan', '1 bowl', 150, 4, 15, 9],
    ['aloo-sabzi', 'Aloo (potato) curry', 'aloo salan', '1 bowl', 180, 3, 22, 9],
    ['palak', 'Palak (spinach)', 'saag palak paneer', '1 bowl', 160, 6, 10, 11],
    ['bhindi', 'Bhindi (okra)', 'okra', '1 bowl', 150, 3, 12, 10],
    ['salad', 'Salad / vegetables', 'salad kheera tamatar', '1 plate', 60, 2, 12, 0.5],
    ['potato', 'Potato, boiled', 'aloo', '1 medium', 130, 3, 30, 0.2],
    ['sweet-potato', 'Sweet potato', 'shakarkandi', '1 medium', 115, 2, 27, 0.1],
    ['cucumber', 'Cucumber', 'kheera', '1 cucumber', 30, 1.3, 7, 0.2],
    ['tomato', 'Tomato', 'tamatar', '1 tomato', 22, 1, 5, 0.2],
    ['carrot', 'Carrot', 'gajar', '1 carrot', 25, 0.6, 6, 0.1],
    ['broccoli', 'Broccoli', 'broccoli', '1 cup', 55, 3.7, 11, 0.6],
    ['corn', 'Sweet corn', 'makai bhutta', '1 cup', 130, 5, 29, 2],

    // Nuts
    ['peanuts', 'Peanuts', 'moongphali', '30 g (a handful)', 170, 7, 5, 14],
    ['peanut-butter', 'Peanut butter', 'peanut butter', '1 tbsp', 95, 4, 3, 8],
    ['almonds', 'Almonds', 'badam', '10 almonds', 70, 2.5, 2.6, 6],
    ['walnuts', 'Walnuts', 'akhrot', '7 halves', 92, 2, 2, 9],
    ['cashews', 'Cashews', 'kaju', '10 cashews', 90, 2.5, 5, 7],
    ['chia', 'Chia seeds', 'chia', '1 tbsp', 60, 2, 5, 4],

    // Fruit
    ['banana', 'Banana', 'kela', '1 banana', 105, 1.3, 27, 0.4],
    ['apple', 'Apple', 'saib seb', '1 apple', 95, 0.5, 25, 0.3],
    ['orange', 'Orange / kinnow', 'malta kinno santra', '1 orange', 62, 1.2, 15, 0.2],
    ['mango', 'Mango', 'aam', '1 cup (165 g)', 100, 1.4, 25, 0.6],
    ['dates', 'Dates', 'khajoor', '3 dates', 70, 0.6, 19, 0],
    ['grapes', 'Grapes', 'angoor', '1 cup', 104, 1, 27, 0.2],
    ['watermelon', 'Watermelon', 'tarbooz', '1 cup', 46, 0.9, 11.5, 0.2],
    ['guava', 'Guava', 'amrood', '1 guava', 37, 1.4, 8, 0.5],
    ['papaya', 'Papaya', 'papita', '1 cup', 62, 0.7, 16, 0.4],
    ['pomegranate', 'Pomegranate', 'anar', 'half', 117, 2.4, 26, 1.6],
    ['strawberry', 'Strawberries', 'strawberry', '1 cup', 50, 1, 12, 0.5],
    ['pineapple', 'Pineapple', 'ananas', '1 cup', 82, 0.9, 22, 0.2],
    ['peach', 'Peach', 'aaru', '1 peach', 59, 1.4, 14, 0.4],
    ['raisins', 'Raisins', 'kishmish', '30 g', 90, 1, 24, 0.1],
    ['avocado', 'Avocado', 'avocado', 'half', 120, 1.5, 6, 11],
    ['fruit-chaat', 'Fruit chaat', 'chaat', '1 bowl', 150, 2, 35, 1],

    // Snacks and sweets
    ['samosa', 'Samosa', 'samosa', '1 samosa', 260, 4, 25, 16],
    ['pakora', 'Pakora', 'pakoray bhajia', '5 pieces (100 g)', 280, 7, 25, 17],
    ['dahi-bhalla', 'Dahi bhalla', 'dahi baray', '1 plate', 300, 10, 40, 10],
    ['crisps', 'Crisps (chips)', 'lays chips', '1 small pack (30 g)', 160, 2, 15, 10],
    ['biscuits', 'Biscuits', 'biscuit cookies', '3 biscuits (30 g)', 140, 2, 20, 6],
    ['cake', 'Cake', 'cake', '1 slice', 300, 3.5, 45, 12],
    ['gulab-jamun', 'Gulab jamun', 'mithai sweets', '1 piece', 150, 2, 25, 5],
    ['jalebi', 'Jalebi', 'mithai', '50 g', 200, 1, 30, 9],
    ['kheer', 'Kheer', 'rice pudding', '1 bowl (150 g)', 220, 6, 32, 7],
    ['halwa', 'Halwa (suji)', 'halwa', '100 g', 350, 4, 45, 17],
    ['ice-cream', 'Ice cream', 'ice cream kulfi', '1 scoop', 140, 2.5, 16, 7],
    ['chocolate', 'Milk chocolate', 'chocolate', '1 bar (50 g)', 270, 4, 30, 15],
    ['sugar', 'Sugar', 'cheeni', '1 tsp', 16, 0, 4, 0],
    ['honey', 'Honey', 'shehad', '1 tbsp', 64, 0, 17, 0],

    // Drinks and shakes
    ['cola', 'Soft drink (cola)', 'cold drink coke pepsi', '1 can (330 ml)', 140, 0, 35, 0],
    ['diet-cola', 'Diet soft drink', 'diet coke', '1 can', 1, 0, 0, 0],
    ['orange-juice', 'Orange juice', 'juice', '1 glass (250 ml)', 112, 1.7, 26, 0.5],
    ['sugarcane', 'Sugarcane juice', 'ganne ka ras', '1 glass (250 ml)', 180, 0, 45, 0],
    ['energy-drink', 'Energy drink', 'sting red bull', '1 can (250 ml)', 110, 0, 27, 0],
    ['coconut-water', 'Coconut water', 'nariyal pani', '1 glass (250 ml)', 45, 1.7, 9, 0.5],
    ['banana-shake', 'Banana shake', 'milkshake', '1 glass', 250, 8, 40, 6],
    ['whey-water', 'Whey protein in water', 'protein shake whey', '1 scoop', 120, 24, 3, 1.5],
    ['whey-milk', 'Whey protein in milk', 'protein shake whey', '1 scoop + 1 glass milk', 270, 32, 15, 9.5],
  ];

  const LIST = RAW.map(([id, name, alt, portion, kcal, protein, carbs, fat]) => ({ id, name, alt, portion, kcal, protein, carbs, fat }));
  const norm = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

  /** Foods matching what was typed: names first, then other names; the member's own foods too. */
  function search(q, extra = [], limit = 12) {
    const t = norm(q);
    if (!t) return [];
    const words = t.split(' ');
    const scored = [];
    for (const f of [...extra, ...LIST]) {
      const name = norm(f.name);
      const all = `${name} ${norm(f.alt)}`;
      if (!words.every((w) => all.includes(w))) continue;
      // Names (or Urdu names) that start with what was typed first, shortest first (anda → eggs, roti → roti).
      const starts = name.startsWith(t) || norm(f.alt).startsWith(t);
      const score = (starts ? 0 : name.split(' ').some((w) => w.startsWith(words[0])) ? 1 : 2) + (f.own ? -0.5 : 0);
      scored.push([score, f]);
    }
    return scored.sort((a, b) => a[0] - b[0] || a[1].name.length - b[1].name.length).slice(0, limit).map((x) => x[1]);
  }

  /** Totals of a day's list: [{ kcal, protein, carbs, fat, qty }]. */
  function totals(items = []) {
    const t = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
    for (const x of items) for (const k of Object.keys(t)) t[k] += (Number(x[k]) || 0) * (Number(x.qty) || 1);
    return { kcal: Math.round(t.kcal), protein: Math.round(t.protein), carbs: Math.round(t.carbs), fat: Math.round(t.fat) };
  }

  const api = { LIST, search, totals, byId: Object.fromEntries(LIST.map((f) => [f.id, f])) };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Foods = api;
})(typeof window !== 'undefined' ? window : globalThis);
