import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { AssistantService } from '../assistant/assistant.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class ChatGateway {
  @WebSocketServer()
  server: Server;

  constructor(private assistantService: AssistantService) {}

  @SubscribeMessage('message')
  async handleMessage(@MessageBody() data: { prompt: string; language?: string }) {
    const result = await this.assistantService.processRequest(data.prompt, data.language);
    
    // Stream response character by character for typing effect
    const response = result.response;
    for (let i = 0; i <= response.length; i += 10) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      this.server.emit('stream', {
        chunk: response.slice(i - 10, i),
        done: i >= response.length,
        mode: result.mode,
      });
    }

    return result;
  }

  @SubscribeMessage('typing')
  handleTyping(@MessageBody() data: { isTyping: boolean }) {
    this.server.emit('user_typing', data);
  }
}