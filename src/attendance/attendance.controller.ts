import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { OpenSheetDto } from './dto/open-sheet.dto';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { QuerySheetDto } from './dto/query-sheet.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorator/roles.decorator';
import { Role } from '@prisma/client';

@Controller('attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AttendanceController {
  constructor(private readonly service: AttendanceService) {}

  @Post('open-sheet')
  @Roles(Role.TEACHER)
  open(@Body() dto: OpenSheetDto) {
    return this.service.openSheet(dto);
  }

  @Patch(':sheetId/mark')
  @Roles(Role.TEACHER)
  mark(
    @Param('sheetId') sheetId: string,
    @Body() dto: MarkAttendanceDto,
    @Req() req: any,
  ) {
    const userId = req.user?.sub as string;
    return this.service.mark(sheetId, dto, userId);
  }

  @Get('sheet/:sheetId')
  @Roles(Role.TEACHER)
  getOne(@Param('sheetId') sheetId: string) {
    return this.service.getSheet(sheetId);
  }

  @Get('sheets')
  @Roles(Role.TEACHER)
  list(@Query() q: QuerySheetDto) {
    return this.service.listSheets(q);
  }
}
