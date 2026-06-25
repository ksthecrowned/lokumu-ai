const CULTURAL_PATTERNS: RegExp[] = [
  /proverbe|proverb|ndakisa/i,
  /culture|tradition|coutume/i,
  /lingala|lingala|kituba|kituba|lin|kit/i,
  /mbote|sango nini|matondo|kimia/i,
  /comment dit-on|how do you say|traduire|translate/i,
];

export function shouldUseRag(prompt: string): boolean {
  if (!prompt.trim()) return false;
  return CULTURAL_PATTERNS.some((pattern) => pattern.test(prompt));
}
