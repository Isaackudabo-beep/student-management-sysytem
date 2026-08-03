// Purpose: Announcement create/list/read for admin notification center.
import type { AnnouncementAudience, Role } from "@prisma/client";
import { AppError, assertFound } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import type { AuthUser } from "../middleware/auth.js";

function audienceForRole(role: Role): AnnouncementAudience[] {
  if (role === "ADMIN") return ["ALL", "ADMINS", "STUDENTS", "TEACHERS"];
  if (role === "TEACHER") return ["ALL", "TEACHERS"];
  return ["ALL", "STUDENTS"];
}

export async function createAnnouncement(
  input: {
    title: string;
    body: string;
    audience: AnnouncementAudience;
    expiresAt?: string | null;
  },
  actor: AuthUser
) {
  return prisma.announcement.create({
    data: {
      title: input.title,
      body: input.body,
      audience: input.audience,
      createdById: actor.id,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    },
  });
}

export async function listAnnouncementsAdmin(params: { page: number; limit: number }) {
  const [total, data] = await Promise.all([
    prisma.announcement.count(),
    prisma.announcement.findMany({
      skip: (params.page - 1) * params.limit,
      take: params.limit,
      orderBy: { publishedAt: "desc" },
      include: {
        createdBy: { select: { id: true, fullName: true, email: true } },
        _count: { select: { reads: true } },
      },
    }),
  ]);

  return {
    data,
    meta: { total, page: params.page, limit: params.limit, pages: Math.ceil(total / params.limit) || 1 },
  };
}

export async function getInbox(actor: AuthUser) {
  const now = new Date();
  const announcements = await prisma.announcement.findMany({
    where: {
      audience: { in: audienceForRole(actor.role) },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: { publishedAt: "desc" },
    take: 50,
    include: {
      reads: { where: { userId: actor.id }, select: { id: true, readAt: true } },
      createdBy: { select: { fullName: true } },
    },
  });

  return announcements.map((a) => ({
    id: a.id,
    title: a.title,
    body: a.body,
    audience: a.audience,
    publishedAt: a.publishedAt,
    expiresAt: a.expiresAt,
    createdBy: a.createdBy.fullName,
    read: a.reads.length > 0,
    readAt: a.reads[0]?.readAt ?? null,
  }));
}

export async function markAnnouncementRead(announcementId: string, actor: AuthUser) {
  const announcement = assertFound(
    await prisma.announcement.findUnique({ where: { id: announcementId } }),
    "Announcement not found"
  );

  const allowed = audienceForRole(actor.role);
  if (!allowed.includes(announcement.audience)) {
    throw new AppError(403, "You cannot access this announcement");
  }

  await prisma.announcementRead.upsert({
    where: {
      userId_announcementId: { userId: actor.id, announcementId },
    },
    create: { userId: actor.id, announcementId },
    update: { readAt: new Date() },
  });

  return { message: "Marked as read" };
}

export async function deleteAnnouncement(id: string) {
  await assertFound(await prisma.announcement.findUnique({ where: { id } }), "Announcement not found");
  await prisma.announcement.delete({ where: { id } });
  return { message: "Announcement deleted" };
}
