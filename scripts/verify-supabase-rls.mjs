import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !publishableKey || !secretKey) {
  throw new Error("Supabase URL, publishable key, and secret key are required");
}

const options = {
  auth: {
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: false,
  },
};
const admin = createClient(url, secretKey, options);
const userA = createClient(url, publishableKey, options);
const userB = createClient(url, publishableKey, options);
const anonymous = createClient(url, publishableKey, options);
const createdUserIds = [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function requireSuccess(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}

async function selectRows(client, table, filters) {
  let query = client.from(table).select("*");
  for (const [column, value] of filters) query = query.eq(column, value);
  return requireSuccess(await query, `${table} select`);
}

async function createUser(label) {
  const suffix = crypto.randomUUID();
  const password = `OfferPilot!${suffix}Aa1`;
  const data = requireSuccess(
    await admin.auth.admin.createUser({
      email: `offerpilot-rls-${label}-${suffix}@example.com`,
      password,
      email_confirm: true,
    }),
    `create user ${label}`,
  );
  createdUserIds.push(data.user.id);
  return { user: data.user, password };
}

let failure;
try {
  const [credentialsA, credentialsB] = await Promise.all([
    createUser("a"),
    createUser("b"),
  ]);
  const accountA = credentialsA.user;
  const accountB = credentialsB.user;
  requireSuccess(
    await userA.auth.signInWithPassword({
      email: accountA.email,
      password: credentialsA.password,
    }),
    "sign in user A",
  );
  requireSuccess(
    await userB.auth.signInWithPassword({
      email: accountB.email,
      password: credentialsB.password,
    }),
    "sign in user B",
  );

  const problem = requireSuccess(
    await admin.from("algorithm_problems").select("id").limit(1).single(),
    "load algorithm problem",
  );
  const question = requireSuccess(
    await admin.from("knowledge_questions").select("id").limit(1).single(),
    "load knowledge question",
  );
  const ids = {
    algorithmAttempt: crypto.randomUUID(),
    knowledgeAttempt: crypto.randomUUID(),
    dailyTask: crypto.randomUUID(),
  };

  const rows = [
    ["algorithm_attempts", {
      id: ids.algorithmAttempt,
      user_id: accountA.id,
      problem_id: problem.id,
      started_at: new Date().toISOString(),
    }],
    ["user_algorithm_state", {
      user_id: accountA.id,
      problem_id: problem.id,
    }],
    ["knowledge_attempts", {
      id: ids.knowledgeAttempt,
      user_id: accountA.id,
      question_id: question.id,
      mode: "learn",
      self_rating: 2,
    }],
    ["user_knowledge_state", {
      user_id: accountA.id,
      question_id: question.id,
    }],
    ["daily_tasks", {
      id: ids.dailyTask,
      user_id: accountA.id,
      task_date: new Date().toISOString().slice(0, 10),
      task_type: "new",
      reason: "RLS verification",
      algorithm_problem_id: problem.id,
    }],
  ];
  for (const [table, row] of rows) {
    requireSuccess(await admin.from(table).insert(row), `${table} fixture insert`);
  }

  const ownedRows = [
    ["profiles", [["id", accountA.id]]],
    ["algorithm_attempts", [["id", ids.algorithmAttempt]]],
    ["user_algorithm_state", [["user_id", accountA.id], ["problem_id", problem.id]]],
    ["knowledge_attempts", [["id", ids.knowledgeAttempt]]],
    ["user_knowledge_state", [["user_id", accountA.id], ["question_id", question.id]]],
    ["daily_tasks", [["id", ids.dailyTask]]],
  ];
  for (const [table, filters] of ownedRows) {
    assert((await selectRows(userA, table, filters)).length === 1, `${table}: owner cannot read row`);
    assert((await selectRows(userB, table, filters)).length === 0, `${table}: other user can read row`);
  }

  const ownUpdate = requireSuccess(
    await userA.from("profiles").update({ display_name: "RLS owner" })
      .eq("id", accountA.id).select("id"),
    "owner profile update",
  );
  assert(ownUpdate.length === 1, "owner cannot update profile");

  const foreignUpdate = requireSuccess(
    await userB.from("profiles").update({ display_name: "RLS intruder" })
      .eq("id", accountA.id).select("id"),
    "foreign profile update",
  );
  assert(foreignUpdate.length === 0, "other user can update profile");

  const foreignDelete = requireSuccess(
    await userB.from("algorithm_attempts").delete()
      .eq("id", ids.algorithmAttempt).select("id"),
    "foreign attempt delete",
  );
  assert(foreignDelete.length === 0, "other user can delete attempt");
  assert(
    (await selectRows(admin, "algorithm_attempts", [["id", ids.algorithmAttempt]])).length === 1,
    "foreign delete removed owner row",
  );

  const forbiddenInsert = await userB.from("algorithm_attempts").insert({
    user_id: accountA.id,
    problem_id: problem.id,
    started_at: new Date().toISOString(),
  });
  assert(forbiddenInsert.error, "other user can insert a row for the owner");

  const anonymousCatalog = await anonymous.from("algorithm_problems").select("id").limit(1);
  assert(
    anonymousCatalog.error || anonymousCatalog.data.length === 0,
    "anonymous user can read public catalog",
  );
  const authenticatedCatalog = requireSuccess(
    await userA.from("algorithm_problems").select("id").limit(1),
    "authenticated catalog read",
  );
  assert(authenticatedCatalog.length === 1, "authenticated user cannot read public catalog");

  console.log("Supabase two-user RLS verification passed for 6 private tables and authenticated catalog access.");
} catch (error) {
  failure = error;
} finally {
  for (const userId of createdUserIds) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error && !failure) failure = new Error(`cleanup user failed: ${error.message}`);
  }
}

if (failure) throw failure;
console.log("Temporary RLS users and rows removed.");
