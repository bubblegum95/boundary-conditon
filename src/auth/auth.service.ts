import { BadRequestException, Injectable } from '@nestjs/common';
import AdminSignInDto from './dto/admin-signin.dto';
import { UserService } from '../user/user.service';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import AdminSignUpDto from './dto/admin-signup.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService
  ) {}

  async findRoleAdminAddr(dto: AdminSignInDto) {
    try {
      const foundAddr = await this.userService.findAdminAddress(dto);
      return foundAddr;
    } catch (error) {
      throw error;
    }
  }

  async issueToken(email: string, id: number, roles: string[]) {
    try {
      const payload = {
        email,
        sub: id,
        roles,
      };
      console.log('payload: ', payload);
      const token = this.jwtService.sign(payload);

      return token;
    } catch (error) {
      throw error;
    }
  }

  async verifyRoleAdmin(dto: AdminSignInDto) {
    try {
      const { email, id, roles } = await this.findRoleAdminAddr(dto);

      if (!email) {
        throw new BadRequestException(
          '관리자 계정 비밀번호가 일치하지 않습니다.'
        );
      }

      const token = await this.issueToken(email, id, roles);

      if (!token) {
        throw new Error('토큰을 발급할 수 없습니다.');
      }

      return token;
    } catch (error) {
      throw error;
    }
  }

  async signUpAdmin(dto: AdminSignUpDto) {
    try {
      const admin = await this.userService.signUpAdmin(dto);
      return admin;
    } catch (error) {
      throw error;
    }
  }
}
