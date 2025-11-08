/*
  Warnings:

  - You are about to drop the column `location` on the `Room` table. All the data in the column will be lost.
  - You are about to drop the `Group` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `GroupSchedule` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `updatedAt` to the `Room` table without a default value. This is not possible if the table is not empty.
  - Made the column `capacity` on table `Room` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "public"."Group" DROP CONSTRAINT "Group_roomId_fkey";

-- DropForeignKey
ALTER TABLE "public"."GroupSchedule" DROP CONSTRAINT "GroupSchedule_groupId_fkey";

-- DropForeignKey
ALTER TABLE "public"."StudentProfile" DROP CONSTRAINT "StudentProfile_groupId_fkey";

-- AlterTable
ALTER TABLE "Room" DROP COLUMN "location",
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "capacity" SET NOT NULL,
ALTER COLUMN "capacity" DROP DEFAULT;

-- DropTable
DROP TABLE "public"."Group";

-- DropTable
DROP TABLE "public"."GroupSchedule";
