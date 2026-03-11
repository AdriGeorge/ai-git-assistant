import OpenAI from "openai";
import { NextResponse } from "next/server";
import { parseCommitResponse } from "@/lib/commit-response";
import { buildCommitPrompt } from "@/lib/prompt";
import { validateDiff } from "@/lib/validate";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "Missing OPENAI_API_KEY on the server." },
      { status: 500 }
    );
  }

  try {
    const body = (await request.json()) as { diff?: string };
    const validation = validateDiff(body.diff ?? "");

    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL ?? "gpt-5-mini",
      input: buildCommitPrompt(validation.sanitizedDiff)
    });

    const result = parseCommitResponse(response.output_text, validation.sanitizedDiff);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate commit messages.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
