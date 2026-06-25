export type TrainingTurn = {
  role: 'user' | 'assistant';
  content: string;
};

export class CreateTrainingDialogueDto {
  title!: string;
  language!: 'lin' | 'kit';
  turns!: TrainingTurn[];
  tags?: string[];
  contributorNote?: string;
}
