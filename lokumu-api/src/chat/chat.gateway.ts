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
  ) {}

  @SubscribeMessage('message')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { prompt: string; language?: string },
  ) {
    const result = await this.assistantService.processRequest(data.prompt, data.language);

    const response = result.response;
    for (let i = 0; i <= response.length; i += 16) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      client.emit('stream', {
        chunk: response.slice(Math.max(0, i - 16), i),
        done: i >= response.length,
        mode: result.mode,
        sources: result.sources,
        messageId: result.messageId,
        conversationId: result.conversationId,
      });
    }

    return result;
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
}