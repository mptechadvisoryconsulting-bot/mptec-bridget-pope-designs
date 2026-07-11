import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { messageSchema } from "@/lib/validation/message-schema";

export async function POST(request: Request) {
  const input = messageSchema.parse(await request.json());
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: input.conversationId,
      sender_id: input.senderId,
      body: input.body,
      attachment_file_id: input.attachmentFileId,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 400 });
  return NextResponse.json({ success: true, message: data }, { status: 201 });
}
