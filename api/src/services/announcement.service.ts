// Purpose: Announcements / notifications — targeting, inbox, unread, system auto-notify.
import type { AnnouncementAudience, Prisma, Role } from "@prisma/client";
import { AppError, assertFound } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import type { AuthUser } from "../middleware/auth.js";

function baseAudienceForRole(role: Role): AnnouncementAudience[] {
  if (role === "ADMIN") return ["ALL", "ADMINS", "STUDENTS", "TEACHERS"];
  if (role === "TEACHER") return ["ALL", "TEACHERS"];
  return ["ALL", "STUDENTS"];
}

export async function createAnnouncement(
  input: {
    title: string;
    body: string;
    audience: AnnouncementAudience;
    targetClassId?: string | null;
    targetUserId?: string | null;
    expiresAt?: string | null;
  },
  actor: AuthUser
) {
  if (input.audience === "CLASS" && !input.targetClassId) {
    throw new AppError(400, "targetClassId is required when audience is CLASS");
  }
  if (input.audience === "USER" && !input.targetUserId) {
    throw new AppError(400, "targetUserId is required when audience is USER");
  }
  if (input.targetClassId) {
    await assertFound(
      await prisma.schoolClass.findUnique({ where: { id: input.targetClassId } }),
      "Class not found"
    );
  }
  if (input.targetUserId) {
    await assertFound(await prisma.user.findUnique({ where: { id: input.targetUserId } }), "User not found");
  }

  try {
    return await prisma.announcement.create({
      data: {
        title: input.title,
        body: input.body,
        audience: input.audience,
        createdById: actor.id,
        targetClassId: input.targetClassId ?? null,
        targetUserId: input.targetUserId ?? null,
        expiresAt:
          input.expiresAt && !Number.isNaN(Date.parse(input.expiresAt))
            ? new Date(input.expiresAt)
            : null,
      },
    });
  } catch {
    if (input.audience === "CLASS" || input.audience === "USER") {
      throw new AppError(503, "Notification targeting is not ready yet. Retry after migrations finish.");
    }
    return prisma.announcement.create({
      data: {
        title: input.title,
        body: input.body,
        audience: input.audience,
        createdById: actor.id,
        expiresAt:
          input.expiresAt && !Number.isNaN(Date.parse(input.expiresAt))
            ? new Date(input.expiresAt)
            : null,
      },
    });
  }
}

/** Internal helper for auto-notifications (results published, promotion, etc.). */
export async function createSystemAnnouncement(input: {
  title: string;
  body: string;
  audience: AnnouncementAudience;
  createdById: string;
  targetClassId?: string | null;
  targetUserId?: string | null;
}) {
  try {
    return await prisma.announcement.create({
      data: {
        title: input.title,
        body: input.body,
        audience: input.audience,
        createdById: input.createdById,
        targetClassId: input.targetClassId ?? null,
        targetUserId: input.targetUserId ?? null,
      },
    });
  } catch {
    return prisma.announcement.create({
      data: {
        title: input.title,
        body: input.body,
        audience:
          input.audience === "CLASS" || input.audience === "USER" ? "ALL" : input.audience,
        createdById: input.createdById,
      },
    });
  }
}

export async function listAnnouncementsAdmin(params: { page: number; limit: number }) {
  const [total, data] = await Promise.all([
    prisma.announcement.count(),
    prisma.announcement.findMany({
      skip: (params.page - 1) * params.limit,
      take: params.limit,
      orderBy: { publishedAt: "desc" },
      select: {
        id: true,
        title: true,
        body: true,
        audience: true,
        publishedAt: true,
        expiresAt: true,
        createdBy: { select: { id: true, fullName: true, email: true } },
        _count: { select: { reads: true } },
      },
    }),
  ]);

  return {
    data: data.map((row) => ({ ...row, targetClass: null, targetUser: null })),
    meta: { total, page: params.page, limit: params.limit, pages: Math.ceil(total / params.limit) || 1 },
  };
}

async function visibleWhereLegacy(actor: AuthUser): Promise<Prisma.AnnouncementWhereInput> {
  const now = new Date();
  return {
    audience: { in: baseAudienceForRole(actor.role) },
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
  };
}

async function visibleWhereTargeted(actor: AuthUser): Promise<Prisma.AnnouncementWhereInput> {
  const now = new Date();
  const notExpired = { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] };

  const or: Prisma.AnnouncementWhereInput[] = [
    { audience: { in: baseAudienceForRole(actor.role) } },
    { audience: "USER", targetUserId: actor.id },
  ];

  if (actor.role === "STUDENT" && actor.studentId) {
    const student = await prisma.student.findUnique({
      where: { id: actor.studentId },
      select: { classId: true },
    });
    if (student) {
      or.push({ audience: "CLASS", targetClassId: student.classId });
    }
  }

  if (actor.role === "ADMIN") {
    or.push({ audience: "CLASS" }, { audience: "USER" });
  }

  return { AND: [notExpired, { OR: or }] };
}

export async function getInbox(actor: AuthUser) {
  const mapRow = (a: {
    id: string;
    title: string;
    body: string;
    audience: string;
    publishedAt: Date;
    expiresAt: Date | null;
    createdBy: { fullName: string };
    reads: Array<{ id: string; readAt: Date }>;
    targetClass?: { name: string } | null;
    targetUser?: { fullName: string } | null;
  }) => ({
    id: a.id,
    title: a.title,
    body: a.body,
    audience: a.audience,
    targetClass: a.targetClass?.name ?? null,
    targetUser: a.targetUser?.fullName ?? null,
    publishedAt: a.publishedAt,
    expiresAt: a.expiresAt,
    createdBy: a.createdBy.fullName,
    read: a.reads.length > 0,
    readAt: a.reads[0]?.readAt ?? null,
  });

  try {
    const where = await visibleWhereTargeted(actor);
    const announcements = await prisma.announcement.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      take: 100,
      select: {
        id: true,
        title: true,
        body: true,
        audience: true,
        publishedAt: true,
        expiresAt: true,
        createdBy: { select: { fullName: true } },
        reads: { where: { userId: actor.id }, select: { id: true, readAt: true } },
        targetClass: { select: { name: true } },
        targetUser: { select: { fullName: true } },
      },
    });
    return announcements.map(mapRow);
  } catch (err) {
    // Older DBs without targeting columns/enums — still return core announcements.
    console.warn("getInbox targeted query failed; using legacy inbox", err);
    const where = await visibleWhereLegacy(actor);
    const announcements = await prisma.announcement.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      take: 100,
      select: {
        id: true,
        title: true,
        body: true,
        audience: true,
        publishedAt: true,
        expiresAt: true,
        createdBy: { select: { fullName: true } },
        reads: { where: { userId: actor.id }, select: { id: true, readAt: true } },
      },
    });
    return announcements.map((a) => mapRow({ ...a, targetClass: null, targetUser: null }));
  }
}

export async function getUnreadCount(actor: AuthUser) {
  const inbox = await getInbox(actor);
  return inbox.filter((n) => !n.read).length;
}

export async function markRead(announcementId: string, actor: AuthUser) {
  await assertFound(
    await prisma.announcement.findUnique({
      where: { id: announcementId },
      select: { id: true },
    }),
    "Announcement not found"
  );

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
  await assertFound(
    await prisma.announcement.findUnique({ where: { id }, select: { id: true } }),
    "Announcement not found"
  );
  await prisma.announcement.delete({ where: { id } });
  return { message: "Announcement deleted" };
}
