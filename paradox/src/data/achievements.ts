export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  coins: number;
  hints?: number;
  icon: string;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first-level', name: 'First Steps', description: 'Complete your first level.', coins: 20, icon: '◆' },
  { id: 'perfect-1', name: 'Flawless', description: 'Earn three stars on any level.', coins: 25, icon: '★' },
  { id: 'perfect-10', name: 'Precision', description: 'Earn three stars on 10 levels.', coins: 75, hints: 1, icon: '✦' },
  { id: 'hint-free-10', name: 'Self-Reliant', description: 'Complete 10 levels without using a path hint.', coins: 60, icon: '☯' },
  { id: 'world-1', name: 'Awakened', description: 'Complete The Awakening.', coins: 50, icon: 'Ⅰ' },
  { id: 'world-2', name: 'Riftwalker', description: 'Complete The Fractured Realm.', coins: 75, icon: 'Ⅱ' },
  { id: 'world-3', name: 'Upside Down', description: 'Complete The Gravity Labyrinth.', coins: 100, icon: 'Ⅲ' },
  { id: 'world-4', name: 'Out of Time', description: 'Complete The Timeless Abyss.', coins: 125, icon: 'Ⅳ' },
  { id: 'paradox', name: 'The Loop Closes', description: 'Awaken the Paradox Core in Level 100.', coins: 250, hints: 3, icon: '∞' },
  { id: 'echo-first', name: 'Echo Chamber', description: 'Complete a level using a time echo.', coins: 30, icon: '◎' },
  { id: 'gravity-first', name: 'Which Way Is Down', description: 'Complete a gravity chamber.', coins: 30, icon: '⇅' },
  { id: 'stars-100', name: 'Constellation', description: 'Collect 100 stars.', coins: 100, hints: 2, icon: '✶' },
  { id: 'stars-300', name: 'Galaxy', description: 'Collect all 300 stars.', coins: 300, hints: 5, icon: '✺' },
  { id: 'daily-1', name: 'Daily Ritual', description: 'Complete a daily challenge.', coins: 30, icon: '☀' },
  { id: 'falls-10', name: 'Learning to Fly', description: 'Fall or get zapped 10 times. It happens.', coins: 15, icon: '☄' },
  { id: 'stylish', name: 'Stylish', description: 'Equip a cosmetic other than the defaults.', coins: 15, icon: '✿' },
];

export const achievementById = (id: string) => ACHIEVEMENTS.find((a) => a.id === id);
