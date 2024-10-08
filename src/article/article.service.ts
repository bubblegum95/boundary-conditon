import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateArticleWithLinkDto } from './dto/create-article-with-link.dto';
import { UpdateArticleWithLinkDto } from './dto/update-article-with-link.dto';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import Article from './entities/article.entity';
import { DataSource, Like, QueryRunner, Repository } from 'typeorm';
import CreateArticleWithImageDto from './dto/create-article-with-image.dto';
import { UserService } from '../user/user.service';
import UserInfoDto from '../auth/dto/userinfo.dto';
import { CreateArticleDto } from './dto/create-article.dto';
import Thumbnail from './entities/thumbnail.entity';
import * as fs from 'fs';
import { join } from 'path';
import FindArticleQueryDto from './dto/find-article-query.dto';
import UpdateArticleWithImageDto from './dto/update-article-with-image.dto';
import UpdateArticleDto from './dto/update-article.dto';
import { CategoryService } from '../category/category.service';
import UpdateIsPublicDto from './dto/update-is-public.dto';
import { SearchArticleQueryDto } from './dto/search-article-query.dto';
import { FindArticlesAdminDto } from './resDto/find-articles-admin.dto';

@Injectable()
export class ArticleService {
  constructor(
    @InjectRepository(Article)
    private readonly articleRepository: Repository<Article>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly userService: UserService,
    private readonly categoryService: CategoryService
  ) {}

  async saveThumbnailImage(image: Express.Multer.File) {
    try {
      const imageName = image.originalname;
      const path = join(__dirname, '..', 'thumbnail', imageName);
      const writeStream = await fs.createWriteStream(path);
      writeStream.write(image.buffer);
      writeStream.end();
      if (!writeStream) {
        throw new Error('이미지를 저장할 수 없습니다.');
      }
      return path;
    } catch (error) {
      throw error;
    }
  }

  async createThumbnail(path: string, queryRunner: QueryRunner) {
    try {
      return await queryRunner.manager.save(Thumbnail, { path });
    } catch (error) {
      throw error;
    }
  }

  async findCategoryByName(name: string) {
    try {
      return await this.categoryService.findOneByName(name);
    } catch (error) {
      throw error;
    }
  }

  filterDate(date: Article['createdAt']): string {
    try {
      const newDate = new Date(date);
      const year = newDate.getFullYear();
      const month = String(newDate.getMonth() + 1).padStart(2, '0');
      const day = String(newDate.getDate()).padStart(2, '0');
      const formattedDate = `${year}.${month}.${day}`;
      return formattedDate;
    } catch (error) {
      throw error;
    }
  }

  async findOneById(id: number) {
    try {
      return await this.articleRepository.findOne({
        where: { id },
        relations: ['thumbnail', 'category'],
      });
    } catch (error) {
      throw error;
    }
  }

  async saveArticle(
    dto: CreateArticleDto,
    queryRunner: QueryRunner
  ): Promise<Article> {
    try {
      return await queryRunner.manager.save(Article, {
        ...dto,
      });
    } catch (error) {
      throw error;
    }
  }

  async updateArticle(
    id: number,
    dto: UpdateArticleDto,
    queryRunner: QueryRunner
  ) {
    try {
      const updatedArticle = await queryRunner.manager.update(
        Article,
        { id },
        { ...dto }
      );

      return updatedArticle;
    } catch (error) {
      throw error;
    }
  }

  async createArticleWithLink(
    dto: CreateArticleWithLinkDto,
    user: UserInfoDto
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { title, subtitle, thumbnail, link, category, isPublic } = dto;
      const { email, roles } = user;
      const foundUser = await this.userService.findUserbyEmail(email);

      if (!foundUser) {
        throw new NotFoundException('해당 계정이 존재하지 않습니다.');
      }

      if (!roles.includes('ADMIN')) {
        throw new UnauthorizedException('관리자 권한이 없습니다.');
      }

      const foundCategory = await this.findCategoryByName(category);
      if (!foundCategory) {
        throw new NotFoundException('해당 카테고리가 존재하지 않습니다.');
      }

      const savedThumbnail = await this.createThumbnail(thumbnail, queryRunner);
      if (!savedThumbnail) {
        throw new BadRequestException('썸네일을 저장할 수 없습니다.');
      }

      const articleDto = {
        userId: foundUser.id,
        title,
        subtitle,
        thumbnailId: savedThumbnail.id,
        link,
        categoryId: foundCategory.id,
        isPublic,
      };

      await this.saveArticle(articleDto, queryRunner);
      await queryRunner.commitTransaction();

      return true;
    } catch (error) {
      console.log('error: ', error);
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async createArticleWithImage(
    dto: CreateArticleWithImageDto,
    user: UserInfoDto,
    image: Express.Multer.File
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { title, subtitle, link, category, isPublic } = dto;
      const { email, roles } = user;
      const foundUser = await this.userService.findUserbyEmail(email);

      if (!foundUser) {
        throw new NotFoundException('해당 계정이 존재하지 않습니다.');
      }

      if (!roles.includes('ADMIN')) {
        throw new UnauthorizedException('관리자 권한이 없습니다.');
      }

      const foundCategory = await this.findCategoryByName(category);

      if (!foundCategory) {
        throw new NotFoundException('해당 카테고리가 존재하지 않습니다.');
      }

      const path = await this.saveThumbnailImage(image);

      if (!path) {
        throw new BadRequestException('해당 이미지를 저장할 수 없습니다.');
      }

      const savedThumbnail = await this.createThumbnail(path, queryRunner);

      if (!savedThumbnail) {
        throw new BadRequestException('썸네일을 저장할 수 없습니다.');
      }

      const articleDto = {
        userId: foundUser.id,
        title,
        subtitle,
        thumbnailId: savedThumbnail.id,
        link,
        categoryId: foundCategory.id,
        isPublic,
      };
      const savedArticle = await this.saveArticle(articleDto, queryRunner);

      if (!savedArticle) {
        throw new BadRequestException('아티클을 저장할 수 없습니다.');
      }

      await queryRunner.commitTransaction();
      return true;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findAllArticlesForAdmin(query: FindArticleQueryDto) {
    try {
      const { limit, page } = query;
      let foundArticles: Array<Article> = await this.articleRepository.find({
        relations: ['category', 'thumbnail'],
        skip: (page - 1) * limit,
        take: limit,
        order: { id: 'DESC' },
      });
      let articleArr: FindArticlesAdminDto[] = [];
      foundArticles.map((foundArticle) => {
        const filteredDate = this.filterDate(foundArticle.createdAt);
        const article: FindArticlesAdminDto = {
          id: foundArticle.id,
          title: foundArticle.title,
          subtitle: foundArticle.subtitle,
          category: foundArticle.category.name,
          isPublic: foundArticle.isPublic,
          createdAt: filteredDate,
        };
        articleArr.push(article);
      });
      return articleArr;
    } catch (error) {
      throw error;
    }
  }

  async findAllForAdmin(user: UserInfoDto, query: FindArticleQueryDto) {
    const { email, roles } = user;
    const foundUser = await this.userService.findUserbyEmail(email);
    if (!foundUser) {
      throw new NotFoundException('해당 계정이 존재하지 않습니다.');
    }
    if (!roles.includes('ADMIN')) {
      throw new UnauthorizedException('관리자 권한이 없습니다.');
    }
    const articles = await this.findAllArticlesForAdmin(query);
    return articles;
  }

  async findOneForAdmin(user: UserInfoDto, id: number) {
    try {
      const { email, roles } = user;
      const foundUser = await this.userService.findUserbyEmail(email);
      if (!foundUser) {
        throw new NotFoundException('해당 계정이 존재하지 않습니다.');
      }
      if (!roles.includes('ADMIN')) {
        throw new UnauthorizedException('관리자 권한이 없습니다.');
      }
      const foundArticle = await this.findOneById(id);
      if (!foundArticle) {
        throw new NotFoundException('해당 아티클을 찾을 수 없습니다.');
      }

      return {
        id: foundArticle.id,
        title: foundArticle.title,
        subtitle: foundArticle.subtitle,
        link: foundArticle.link,
        thumbnail: foundArticle.thumbnail.path,
        category: foundArticle.category.name,
        isPublic: foundArticle.isPublic,
      };
    } catch (error) {
      throw error;
    }
  }

  async updateArticleWithLink(
    id: number,
    dto: UpdateArticleWithLinkDto,
    user: UserInfoDto
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { email, roles } = user;
      let { title, subtitle, link, thumbnail, category, isPublic } = dto;
      let thumbnailId = 0;
      let categoryId = 0;
      const foundUser = await this.userService.findUserbyEmail(email);
      if (!foundUser) {
        throw new NotFoundException('해당 계정이 존재하지 않습니다.');
      }
      if (!roles.includes('ADMIN')) {
        throw new UnauthorizedException('관리자 권한이 없습니다.');
      }
      const foundArticle = await this.findOneById(id);
      if (!foundArticle) {
        throw new NotFoundException('해당 아티클이 존재하지 않습니다.');
      }
      if (!title) {
        title = foundArticle.title;
      }
      if (!subtitle) {
        subtitle = foundArticle.subtitle;
      }
      if (!link) {
        link = foundArticle.link;
      }
      if (!isPublic) {
        isPublic = foundArticle.isPublic;
      }
      if (thumbnail) {
        const foundThumbnail = await this.createThumbnail(
          thumbnail,
          queryRunner
        );
        thumbnailId = foundThumbnail.id;
      } else if (!thumbnail) {
        thumbnailId = foundArticle.thumbnail.id;
      }
      if (!category) {
        categoryId = foundArticle.categoryId;
      } else {
        const foundCategory = await this.findCategoryByName(category);
        if (!foundCategory) {
          throw new BadRequestException('해당 카테고리를 찾을 수 없습니다.');
        }
        categoryId = foundCategory.id;
      }
      const savingArticle = {
        userId: foundArticle.userId,
        title,
        subtitle,
        link,
        thumbnailId,
        categoryId,
        isPublic,
        createdAt: foundArticle.createdAt,
      };
      const updatedData = await this.updateArticle(
        foundArticle.id,
        savingArticle,
        queryRunner
      );

      await queryRunner.commitTransaction();
      return true;
    } catch (error) {
      queryRunner.rollbackTransaction();
      throw error;
    }
  }

  async updateArticleWithImage(
    id: number,
    dto: UpdateArticleWithImageDto,
    image: Express.Multer.File,
    user: UserInfoDto
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { email, roles } = user;
      let { title, subtitle, link, category, isPublic } = dto;
      let categoryId = 0;
      const foundUser = await this.userService.findUserbyEmail(email);
      if (!foundUser) {
        throw new NotFoundException('해당 계정이 존재하지 않습니다.');
      }
      if (!roles.includes('ADMIN')) {
        throw new UnauthorizedException('관리자 권한이 없습니다.');
      }
      const foundArticle = await this.findOneById(id);
      if (!foundArticle) {
        throw new NotFoundException('해당 아티클이 존재하지 않습니다.');
      }
      if (!title) {
        title = foundArticle.title;
      }
      if (!subtitle) {
        subtitle = foundArticle.subtitle;
      }
      if (!link) {
        link = foundArticle.link;
      }
      if (!isPublic) {
        isPublic = foundArticle.isPublic;
      }
      if (!category) {
        categoryId = foundArticle.categoryId;
      } else {
        const foundCategory = await this.findCategoryByName(category);
        if (!foundCategory) {
          throw new BadRequestException('해당 카테고리를 찾을 수 없습니다.');
        }
        categoryId = foundCategory.id;
      }
      const savedImage = await this.saveThumbnailImage(image);
      const savedthumbnail = await this.createThumbnail(
        savedImage,
        queryRunner
      );
      const savingArticle = {
        userId: foundArticle.userId,
        title,
        subtitle,
        link,
        thumbnailId: savedthumbnail.id,
        categoryId,
        isPublic,
        createdAt: foundArticle.createdAt,
      };

      const updatedData = await this.updateArticle(
        foundArticle.id,
        savingArticle,
        queryRunner
      );
      await queryRunner.commitTransaction();

      return true;
    } catch (error) {
      queryRunner.rollbackTransaction();
      throw error;
    } finally {
      queryRunner.release();
    }
  }

  async updateIsPublic(user: UserInfoDto, id: number, dto: UpdateIsPublicDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { email, roles } = user;
      const { isPublic } = dto;
      const foundUser = await this.userService.findUserbyEmail(email);
      if (!foundUser) {
        throw new NotFoundException('해당 계정이 존재하지 않습니다.');
      }
      if (!roles.includes('ADMIN')) {
        throw new UnauthorizedException('관리자 권한이 없습니다.');
      }
      const foundArticle = await this.findOneById(id);
      if (!foundArticle) {
        throw new NotFoundException('해당 아티클이 존재하지 않습니다.');
      }
      const newDto = {
        userId: foundArticle.userId,
        title: foundArticle.title,
        subtitle: foundArticle.subtitle,
        link: foundArticle.link,
        thumbnailId: foundArticle.thumbnailId,
        categoryId: foundArticle.categoryId,
        isPublic,
        createdAt: foundArticle.createdAt,
      };
      await this.updateArticle(id, newDto, queryRunner);
      await queryRunner.commitTransaction();

      return true;
    } catch (error) {
      queryRunner.rollbackTransaction();
      throw error;
    } finally {
      queryRunner.release();
    }
  }

  async remove(id: number, user: UserInfoDto) {
    try {
      const { email, roles } = user;
      const foundUser = await this.userService.findUserbyEmail(email);
      if (!foundUser) {
        throw new NotFoundException('해당 계정이 존재하지 않습니다.');
      }
      if (!roles.includes('ADMIN')) {
        throw new UnauthorizedException('관리자 권한이 없습니다.');
      }
      const foundArticle = await this.findOneById(id);
      if (!foundArticle) {
        throw new NotFoundException('해당 아티클이 존재하지 않습니다.');
      }
      await this.articleRepository.delete({ id });
      return true;
    } catch (error) {
      throw error;
    }
  }

  async findAllForUser(dto: SearchArticleQueryDto) {
    try {
      const { category, keyword, page, limit } = dto;
      let where: any = { isPublic: true };

      if (category) {
        const foundCategory =
          await this.categoryService.findOneByName(category);
        if (!foundCategory) {
          throw new NotFoundException('해당 카테고리가 존재하지 않습니다.');
        }
        where.categoryId = foundCategory.id;
      }

      if (keyword) {
        where.title = Like(`%${keyword}%`);
        where.subtitle = Like(`%${keyword}%`);
      }

      const articles = await this.articleRepository.find({
        where,
        relations: ['category', 'thumbnail'],
        skip: (page - 1) * limit,
        take: limit,
        order: { id: 'DESC' },
      });
      let data = [];
      articles.map((article) => {
        const newDate = this.filterDate(article.createdAt);
        const newData = {
          id: article.id,
          title: article.title,
          subtitle: article.subtitle,
          category: article.category.name,
          thumbnail: article.thumbnail.path,
          link: article.link,
          createdAt: newDate,
        };
        data.push(newData);
      });
      return data;
    } catch (error) {
      throw error;
    }
  }

  async findInMap() {
    try {
      let articles = await this.articleRepository.find({
        relations: ['category', 'thumbnail'],
        take: 2,
        order: { id: 'DESC' },
      });
      let data = [];
      articles.map((article) => {
        const newDate = this.filterDate(article.createdAt);
        const newData = {
          id: article.id,
          title: article.title,
          subtitle: article.subtitle,
          category: article.category.name,
          thumbnail: article.thumbnail.path,
          link: article.link,
          createdAt: newDate,
        };
        data.push(newData);
      });
      return data;
    } catch (error) {
      throw error;
    }
  }

  async findCategoriesUsing() {
    try {
      const categories = await this.categoryService.findUsed();
      return categories;
    } catch (error) {
      throw error;
    }
  }
}
