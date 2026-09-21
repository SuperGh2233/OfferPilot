import { NextResponse } from "next/server";

import { getLocalTrainingDatabase } from "../../../../lib/local-database";
import type { DemoProfile } from "../../../../lib/profile/demo-store";
import { isLocalDatabaseMode } from "../../../../lib/supabase/env";
import {
  loadCloudTrainingSnapshot,
  setCloudPlanPaused,
  updateCloudProfile,
} from "../../../../lib/supabase/training";
import {
  authenticatedTrainingContext,
  requestObject,
  trainingError,
  unauthorized,
} from "../_shared";

export async function PATCH(request: Request) {
  try {
    const localMode = isLocalDatabaseMode();
    const context = localMode ? null : await authenticatedTrainingContext();
    if (!localMode && !context) return unauthorized();
    const body = await requestObject(request);
    if (typeof body.paused !== "boolean") {
      throw new RangeError("paused 必须为布尔值。");
    }
    const profile = localMode
      ? getLocalTrainingDatabase().setPlanPaused(body.paused)
      : await setCloudPlanPaused(context!.client, context!.userId, body.paused);
    const snapshot = localMode
      ? getLocalTrainingDatabase().loadSnapshot()
      : await loadCloudTrainingSnapshot(context!.client, context!.userId);
    return NextResponse.json({ profile, snapshot });
  } catch (error) {
    return trainingError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const localMode = isLocalDatabaseMode();
    const context = localMode ? null : await authenticatedTrainingContext();
    if (!localMode && !context) return unauthorized();
    const body = await requestObject(request);
    const profile = localMode
      ? getLocalTrainingDatabase().updateProfile(body as DemoProfile)
      : await updateCloudProfile(context!.client, context!.userId, body as DemoProfile);
    const snapshot = localMode
      ? getLocalTrainingDatabase().loadSnapshot()
      : await loadCloudTrainingSnapshot(context!.client, context!.userId);
    return NextResponse.json({ profile, snapshot });
  } catch (error) {
    return trainingError(error);
  }
}
