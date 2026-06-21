import { GoogleStrategy } from './google.strategy';
import { AuthService } from '../auth.service';

describe('GoogleStrategy', () => {
  it('should be defined', () => {
    const authService = {} as AuthService;
    const strategy = new GoogleStrategy(authService);
    expect(strategy).toBeDefined();
  });
});