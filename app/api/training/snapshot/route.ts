import { NextResponse } from "next/server";

import { getLocalTrainingDatabase } from "../../../../lib/local-database";
import { isLocalDatabaseMode } from "../../../../lib/supabase/env";
import {
  loadCloudTrainingSnapshot,
  type CloudTrainingSnapshot,
} from "../../../../lib/supabase/training";
import {
  authenticatedTrainingContext,
  requestObject,
  trainingError,
  unauthorized,
} from "../_shared";

export async function GET() {
  try {
    if (isLocalDatabaseMode()) {
      const snapshot = getLocalTrainingDatabase().peekSnapshot();
      return NextResponse.json({ snapshot, needsImport: snapshot === null });
    }
    const context = await authenticatedTrainingContext();
    if (!context) return unauthorized();
    const snapshot = await loadCloudTrainingSnapshot(
      context.client,
      context.userId,
    );
    return NextResponse.json({ snapshot });
  } catch (error) {
    return trainingError(error);
  }
}

export async function PUT(request: Request) {
  try {
    if (!isLocalDatabaseMode()) return unauthorized();
    const body = await requestObject(request);
    const snapshot = getLocalTrainingDatabase().importSnapshot(
      body.snapshot as CloudTrainingSnapshot,
    );
    return NextResponse.json({ snapshot });
  } catch (error) {
    return trainingError(error);
  }
}
