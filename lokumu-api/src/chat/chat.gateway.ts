import {
  ConnectedSocket,
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AssistantService } from '../assistant/assistant.service';
import { CommunityService } from '../community/community.service';
import { CreateContributionDto } from '../community/dto/create-contribution.dto';
import { CreateTrainingDialogueDto } from '../training/dto/create-training-dialogue.dto';
import { TrainingService } from '../training/training.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class ChatGateway {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly assistantService: AssistantService,
    private readonly communityService: CommunityService,
    private readonly trainingService: TrainingService,
  ) {}

  @SubscribeMessage('message')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { prompt: string; language?: string; conversationId?: string },
  ) {
    try {
      const result = await this.assistantService.processRequest(
        data.prompt,
        data.language,
        data.conversationId,
      );

      const response = result.response;
      client.emit('stream', {
        chunk: response,
        done: true,
        mode: result.mode,
        sources: result.sources,
        messageId: result.messageId,
        conversationId: result.conversationId,
      });

      return result;
    } catch (error) {
      const message =
        error instanceof Error && error.message === 'ollama_unavailable'
          ? 'Le modele met trop de temps a repondre. Reessayez dans un instant, ou utilisez une question du corpus (proverbe, salutation).'
          : 'Une erreur est survenue. Reessayez.';

      client.emit('stream', {
        chunk: message,
        done: true,
        mode: 'chat',
        sources: [],
      });
      return { error: message };
    }
  }

  @SubscribeMessage('typing')
  handleTyping(@MessageBody() data: { isTyping: boolean }) {
    this.server.emit('user_typing', data);
  }

  @SubscribeMessage('contribution:submit')
  async handleContribution(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: CreateContributionDto,
  ) {
    const contribution = await this.communityService.submit(dto);
    client.emit('contribution:status', {
      id: contribution.id,
      status: contribution.status,
      message: 'Merci pour votre contribution.',
    });
    return contribution;
  }

  @SubscribeMessage('training:submit')
  async handleTrainingSubmit(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: CreateTrainingDialogueDto,
  ) {
    const dialogue = await this.trainingService.submit(dto);
    client.emit('training:status', {
      id: dialogue.id,
      status: dialogue.status,
    });
    return dialogue;
  }
}
