export class CreateContributionDto {
  conversationId?: string;
  messageId?: string;
  language!: 'fra' | 'eng' | 'lin' | 'kit';
  originalQuery!: string;
  originalAnswer!: string;
  correctedAnswer!: string;
  contributorNote?: string;
}
