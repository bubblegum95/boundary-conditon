import { Body, Controller, HttpStatus, Post, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import AdminSignUpDto from './dto/admin-signup.dto';
import { Response } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup/admin')
  async signUpAdmin(@Body() dto: AdminSignUpDto, @Res() res: Response) {
    try {
      const token = await this.authService.verifyRoleAdmin(dto);
      return res
        .status(HttpStatus.OK)
        .json({
          message: '관리자 페이지 로그인 성공',
        })
        .setHeader('Authorization', `Bearer ${token}`);
    } catch (error) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        message: `관리자 페이지에 로그인할 수 없습니다. ${error.message}`,
      });
    }
  }
}
