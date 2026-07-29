import { NextResponse } from "next/server";
import { isAdminEmail, requireAdminUser } from "@/lib/admin";
import {
  adjustCredits,
  findUserByEmail,
  findUserById,
  getAdminStats,
  listUsersForAdmin,
  updateUser,
  type PlanId,
} from "@/lib/db";

export const runtime = "nodejs";

type ActionBody = {
  action?:
    | "add_credits"
    | "set_credits"
    | "set_plan"
    | "lock"
    | "unlock"
    | "set_trial"
    | "set_note";
  userId?: string;
  email?: string;
  amount?: number;
  planId?: PlanId;
  reason?: string;
  freeVeronixUsed?: boolean;
  note?: string;
};

async function resolveTarget(body: ActionBody) {
  if (body.userId?.trim()) {
    const u = await findUserById(body.userId.trim());
    if (u) return u;
  }
  if (body.email?.trim()) {
    return findUserByEmail(body.email.trim().toLowerCase());
  }
  return null;
}

export async function GET(request: Request) {
  try {
    await requireAdminUser();
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") || "").trim().toLowerCase();

    const [stats, users] = await Promise.all([getAdminStats(), listUsersForAdmin()]);
    const filtered = q
      ? users.filter(
          (u) =>
            u.email.toLowerCase().includes(q) ||
            u.name.toLowerCase().includes(q) ||
            u.id.toLowerCase().includes(q),
        )
      : users;

    return NextResponse.json({
      ok: true,
      stats,
      users: filtered,
    });
  } catch (error) {
    const status = (error as { status?: number }).status || 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Admin denied" },
      { status },
    );
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdminUser();
    const body = (await request.json()) as ActionBody;
    const action = body.action;
    if (!action) {
      return NextResponse.json({ error: "action required" }, { status: 400 });
    }

    const target = await resolveTarget(body);
    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Never lock the owner admin from this panel.
    if (isAdminEmail(target.email) && action === "lock") {
      return NextResponse.json(
        { error: "لا يمكن قفل حساب المالك من اللوحة." },
        { status: 400 },
      );
    }

    if (action === "add_credits") {
      const amount = Math.floor(Number(body.amount) || 0);
      if (!amount || Math.abs(amount) > 2_000_000) {
        return NextResponse.json({ error: "amount invalid (max ±2M)" }, { status: 400 });
      }
      const updated = await adjustCredits(target.id, amount);
      return NextResponse.json({
        ok: true,
        email: updated.email,
        credits: updated.credits,
        by: admin.email,
      });
    }

    if (action === "set_credits") {
      const next = Math.max(0, Math.min(5_000_000, Math.floor(Number(body.amount) || 0)));
      const updated = await updateUser(target.id, { credits: next });
      return NextResponse.json({
        ok: true,
        email: updated.email,
        credits: updated.credits,
        by: admin.email,
      });
    }

    if (action === "set_plan") {
      const planId = body.planId;
      if (planId !== "free" && planId !== "mini" && planId !== "pro") {
        return NextResponse.json({ error: "Invalid planId" }, { status: 400 });
      }
      const updated = await updateUser(target.id, { planId });
      return NextResponse.json({
        ok: true,
        email: updated.email,
        planId: updated.planId,
        by: admin.email,
      });
    }

    if (action === "lock") {
      const updated = await updateUser(target.id, {
        locked: true,
        lockedReason: (body.reason || "تم إيقاف الحساب من الإدارة").trim().slice(0, 200),
        lockedAt: new Date().toISOString(),
      });
      return NextResponse.json({
        ok: true,
        email: updated.email,
        locked: true,
        lockedReason: updated.lockedReason,
        by: admin.email,
      });
    }

    if (action === "unlock") {
      const updated = await updateUser(target.id, {
        locked: false,
        lockedReason: "",
        lockedAt: "",
      });
      return NextResponse.json({
        ok: true,
        email: updated.email,
        locked: false,
        by: admin.email,
      });
    }

    if (action === "set_trial") {
      if (typeof body.freeVeronixUsed !== "boolean") {
        return NextResponse.json({ error: "freeVeronixUsed required" }, { status: 400 });
      }
      const updated = await updateUser(target.id, {
        freeVeronixUsed: body.freeVeronixUsed,
      });
      return NextResponse.json({
        ok: true,
        email: updated.email,
        freeVeronixUsed: Boolean(updated.freeVeronixUsed),
        by: admin.email,
      });
    }

    if (action === "set_note") {
      const updated = await updateUser(target.id, {
        adminNote: String(body.note || "").trim().slice(0, 500),
      });
      return NextResponse.json({
        ok: true,
        email: updated.email,
        adminNote: updated.adminNote || "",
        by: admin.email,
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    const status = (error as { status?: number }).status || 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Admin action failed" },
      { status },
    );
  }
}
