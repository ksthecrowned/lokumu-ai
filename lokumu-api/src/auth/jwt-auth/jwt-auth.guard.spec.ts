import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtService } from '@nestjs/jwt';

describe('JwtAuthGuard', () => {
  it('should be defined', () => {
    const jwtService = new JwtService({ secret: 'test' });
    expect(new JwtAuthGuard(jwtService)).toBeDefined();
  });
});
