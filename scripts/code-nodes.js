/**
 * n8n Code Node Scripts — SocioMAssist Bot
 * 
 * These are the JavaScript code snippets used inside n8n Code nodes.
 * Extracted here for version control and documentation.
 * In the actual workflow, each section lives inside its own Code node.
 */


// ═══════════════════════════════════════════════════════════════════════════════
// NODE: parseInput
// Purpose: Normalizes Telegram message into { text, chat_id } for downstream nodes.
//          Handles both fresh requests and loop-back from reviewPayLoad.
// ═══════════════════════════════════════════════════════════════════════════════

const text    = $json.text || $('telegramTrigger').item.json.message.text;
const chat_id = $json.chat_id || $('telegramTrigger').item.json.message.chat.id;

return [{
  json: {
    text,
    chat_id
  }
}];


// ═══════════════════════════════════════════════════════════════════════════════
// NODE: validateCharCount
// Purpose: Validates LLM output character count (max 500 for Telegram caption).
//          On failure, outputs { text } for generatePost retry loop.
// ═══════════════════════════════════════════════════════════════════════════════

const raw = $json.output?.[0]?.content?.[0]?.text;

if (!raw || typeof raw !== 'object') {
  return [{
    json: {
      valid: false,
      char_count: 0,
      text: "The previous output could not be parsed. Please regenerate the post. Return ONLY valid JSON with title, post, and scheduled_at. The post must be under 500 characters."
    }
  }];
}

const copy         = raw.post || '';
const title        = raw.title || '';
const scheduled_at = raw.scheduled_at || '';

if (!copy) {
  return [{
    json: {
      valid: false,
      char_count: 0,
      text: "The previous output had no post field. Please regenerate. Return ONLY valid JSON with title, post, and scheduled_at. The post must be under 500 characters."
    }
  }];
}

const charCount = copy.length;
const MAX = 500;

if (charCount <= MAX) {
  return [{
    json: {
      valid: true,
      char_count: charCount,
      title,
      post: copy,
      scheduled_at
    }
  }];
}

const feedback_text = `CHARACTER COUNT FIX — Do NOT treat this as a new post request.

PREVIOUS CONTENT (too long at ${charCount} characters, max is 500):
Title: "${title}"
Post: "${copy}"
Scheduled at: ${scheduled_at}

INSTRUCTIONS:
- Shorten the post to under 500 characters while preserving the key message
- Keep the same title unless it also needs shortening
- Keep the same scheduled_at: ${scheduled_at}
- Return the FULL revised JSON with title, post, and scheduled_at`;

return [{
  json: {
    valid: false,
    char_count: charCount,
    text: feedback_text
  }
}];


// ═══════════════════════════════════════════════════════════════════════════════
// NODE: storeSession
// Purpose: Centralizes validated data for downstream reference.
// ═══════════════════════════════════════════════════════════════════════════════

const validated = $('validateCharCount').item.json;
const chat_id_store = $('telegramTrigger').item.json.message.chat.id;

return [{
  json: {
    chat_id: chat_id_store,
    title:        validated.title,
    post:         validated.post,
    scheduled_at: validated.scheduled_at,
    char_count:   validated.char_count
  }
}];


// ═══════════════════════════════════════════════════════════════════════════════
// NODE: reviewPayLoad
// Purpose: Combines stored session data with user feedback from the decline form.
//          Outputs { text } that feeds back into generatePost for revision.
// ═══════════════════════════════════════════════════════════════════════════════

const session  = $('storeSession').item.json;
const feedback = $json.data?.text || $json.data || '';

const text = `REVISION REQUEST — Do NOT treat this as a new post request.

PREVIOUS CONTENT (user wants this revised):
Title: "${session.title}"
Post: "${session.post}"
Scheduled at: ${session.scheduled_at}

USER FEEDBACK:
"${feedback}"

INSTRUCTIONS:
- Revise the title and/or post based on the user's feedback above
- If the user provides a new schedule time, update scheduled_at accordingly (format: YYYY-MM-DD HH:mm)
- If no new time is mentioned, keep the same scheduled_at: ${session.scheduled_at}
- Keep the same topic/theme unless the user explicitly asks to change it
- The post must be strictly under 500 characters
- Return the FULL revised JSON with title, post, and scheduled_at`;

return [{ json: { text } }];
