import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '../../users/entities/user.entity';

export const CurrentUser = createParamDecorator(
  (property: keyof User | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<{ user?: User }>();
    const user = request.user;

    return property ? user?.[property] : user;
  },
);
