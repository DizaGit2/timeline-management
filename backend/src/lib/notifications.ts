import prisma from "./prisma";
import { sendEmail } from "./email";
import { NotificationType, Prisma } from "@prisma/client";

interface NotifyOptions {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  metadata?: Prisma.InputJsonValue;
  email?: string; // If provided, also send email
}

export async function createNotification(opts: NotifyOptions): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId: opts.userId,
        type: opts.type,
        title: opts.title,
        body: opts.body,
        metadata: opts.metadata ?? undefined,
      },
    });

    if (opts.email) {
      // Fire-and-forget email
      sendEmail(opts.email, opts.title, `<p>${opts.body}</p>`).catch(() => {});
    }
  } catch (error) {
    console.error("Failed to create notification:", error);
  }
}

export async function notifyShiftAssigned(
  shiftTitle: string,
  shiftDate: string,
  assignedUserIds: Array<{ userId: string; email?: string }>
): Promise<void> {
  const body = `You have been assigned to "${shiftTitle}" on ${shiftDate}.`;
  await Promise.all(
    assignedUserIds.map((u) =>
      createNotification({
        userId: u.userId,
        type: "SHIFT_ASSIGNED",
        title: "Shift Assignment",
        body,
        metadata: { shiftTitle, shiftDate } as Prisma.InputJsonValue,
        email: u.email,
      })
    )
  );
}

export async function notifyShiftUpdated(
  shiftTitle: string,
  shiftDate: string,
  changes: string,
  assignedUserIds: Array<{ userId: string; email?: string }>
): Promise<void> {
  const body = `"${shiftTitle}" on ${shiftDate} has been updated: ${changes}`;
  await Promise.all(
    assignedUserIds.map((u) =>
      createNotification({
        userId: u.userId,
        type: "SHIFT_UPDATED",
        title: "Shift Updated",
        body,
        metadata: { shiftTitle, shiftDate, changes } as Prisma.InputJsonValue,
        email: u.email,
      })
    )
  );
}

export async function notifyShiftRemoved(
  shiftTitle: string,
  shiftDate: string,
  userId: string,
  email?: string
): Promise<void> {
  const body = `You have been removed from "${shiftTitle}" on ${shiftDate}.`;
  await createNotification({
    userId,
    type: "SHIFT_REMOVED",
    title: "Shift Unassigned",
    body,
    metadata: { shiftTitle, shiftDate } as Prisma.InputJsonValue,
    email,
  });
}
