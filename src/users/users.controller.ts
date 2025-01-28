import { 
    Controller, 
    Get, 
    Post, 
    Body, 
    Patch, 
    Param, 
    Delete, 
    UseGuards 
  } from '@nestjs/common';
  import { UserService } from './users.service';
  import { CreateUserDto } from './dto/create-user.dto';
  import { UpdateUserDto } from './dto/update-user.dto';
import { AuthGuard } from '@nestjs/passport';
  
  @UseGuards(AuthGuard('jwt'))
  @Controller('users')
  export class UsersController {
    constructor(private readonly userService: UserService) {}
  
    @Post()
    create(@Body() createUserDto: CreateUserDto) {
      return this.userService.create(createUserDto);
    }
  
    @Get()
    findAll() {
      return this.userService.findAll();
    }
  
    @Get(':id')
    findOne(@Param('id') id: number) {
      return this.userService.find(id);
    }
  
    @Patch(':id')
    update(@Param('id') id: number, @Body() updateUserDto: UpdateUserDto) {
      return this.userService.update(id, updateUserDto);
    }
  
    @Delete(':id')
    delete(@Param('id') id: number) {
      return this.userService.delete(id);
    }
  }