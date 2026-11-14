const personalities = {
  Adrian: "You are Adrian, a thoughtful and mysterious writer who enjoys literature, meaningful conversations and mysteries.",
  Maya: "You are Maya, an imaginative and expressive creative who enjoys music, art, humour and adventures.",
  Leo: "You are Leo, a curious and adventurous explorer who enjoys discoveries, interesting ideas and new perspectives."
};

function getStyle(message) {
  const text = message.toLowerCase();

  if (/\b(short|brief|quick)\b/.test(text))
    return "Keep the response short and direct.";

  if (/\b(explain|in detail|deep dive|step by step)\b/.test(text))
    return "Give a thoughtful, detailed response.";

  if (/\b(joke|funny|make me laugh|humour)\b/.test(text))
    return "Use light humour and playful language.";

  if (/\b(serious|professional|formal)\b/.test(text))
    return "Use a composed and professional tone.";

  if (/\b(hey|hi|hello|lol|haha|gonna|wanna)\b/.test(text))
    return "Use natural, casual and friendly language.";

  return "Use a warm, natural conversational style.";
}

function json(data, status = 200, cookie = null) {
  const headers = { "Content-Type": "application/json" };

  if (cookie) headers["Set-Cookie"] = cookie;

  return new Response(JSON.stringify(data), {
    status,
    headers
  });
}

async function getVisitor(request, env) {
  const cookies = request.headers.get("Cookie") || "";
  const match = cookies.match(/(?:^|;\s*)afterhours_id=([a-f0-9-]+)/i);

  let visitorId = match ? match[1] : null;
  let cookie = null;

  if (!visitorId) {
    visitorId = crypto.randomUUID();

    cookie = `afterhours_id=${visitorId}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=31536000`;
  }

  await env.DB.prepare(`
    INSERT OR IGNORE INTO user_profiles (visitor_id)
    VALUES (?)
  `).bind(visitorId).run();

  const profile = await env.DB.prepare(`
    SELECT memory_enabled, display_name
    FROM user_profiles
    WHERE visitor_id = ?
  `).bind(visitorId).first();

  return { visitorId, cookie, profile };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      try {
        const { visitorId, cookie, profile } =
          await getVisitor(request, env);

        if (url.pathname === "/api/session" && request.method === "GET") {
          return json({
            memoryEnabled: profile.memory_enabled === 1,
            displayName: profile.display_name || null
          }, 200, cookie);
        }

        if (url.pathname === "/api/memory/settings" && request.method === "POST") {
          const body = await request.json();

          if (typeof body.enabled !== "boolean") {
            return json({ error: "Invalid memory setting." }, 400, cookie);
          }

          await env.DB.prepare(`
            UPDATE user_profiles
            SET memory_enabled = ?, updated_at = CURRENT_TIMESTAMP
            WHERE visitor_id = ?
          `).bind(body.enabled ? 1 : 0, visitorId).run();

          return json({
            success: true,
            memoryEnabled: body.enabled
          }, 200, cookie);
        }

        if (url.pathname === "/api/memory" && request.method === "GET") {
          if (profile.memory_enabled !== 1) {
            return json({ memories: [], memoryEnabled: false }, 200, cookie);
          }

          const result = await env.DB.prepare(`
            SELECT id, category, memory_text, created_at
            FROM user_memories
            WHERE visitor_id = ?
            ORDER BY id DESC
            LIMIT 50
          `).bind(visitorId).all();

          return json({
            memories: result.results || [],
            memoryEnabled: true
          }, 200, cookie);
        }

        if (url.pathname === "/api/memory" && request.method === "POST") {
          if (profile.memory_enabled !== 1) {
            return json({ error: "Please enable memory first." }, 403, cookie);
          }

          const body = await request.json();
          const category = String(body.category || "general");
          const memory = String(body.memory_text || "").trim();

          const allowed = ["general", "food", "hobby", "interest"];

          if (!allowed.includes(category) || !memory || memory.length > 240) {
            return json({ error: "Please provide a valid memory of up to 240 characters." }, 400, cookie);
          }

          await env.DB.prepare(`
            INSERT INTO user_memories (visitor_id, category, memory_text)
            VALUES (?, ?, ?)
          `).bind(visitorId, category, memory).run();

          return json({ success: true }, 200, cookie);
        }

        if (url.pathname === "/api/memory" && request.method === "DELETE") {
          await env.DB.prepare(`
            DELETE FROM user_memories WHERE visitor_id = ?
          `).bind(visitorId).run();

          return json({ success: true, message: "Saved memories cleared." }, 200, cookie);
        }

        if (url.pathname === "/api/chat" && request.method === "POST") {
          const body = await request.json();
          const character = body.character || "Adrian";
          const message = String(body.message || "").trim();

          if (!message || message.length > 2000) {
            return json({ error: "Please enter a message of up to 2000 characters." }, 400, cookie);
          }

          const personality = personalities[character] || personalities.Adrian;
          let memoryContext = "No saved memories are available.";

          if (profile.memory_enabled === 1) {
            const result = await env.DB.prepare(`
              SELECT category, memory_text
              FROM user_memories
              WHERE visitor_id = ?
              ORDER BY id DESC
              LIMIT 20
            `).bind(visitorId).all();

            if (result.results && result.results.length) {
              memoryContext = result.results.map(item =>
                `${item.category}: ${item.memory_text}`
              ).join("\n");
            }
          }

          const prompt = `
${personality}

You are a fictional AI storytelling companion in Afterhours AI.

COMMUNICATION STYLE:
${getStyle(message)}

APPROVED USER MEMORIES:
${memoryContext}

Use saved memories only when relevant.
Never invent memories or claim to remember something that is not listed.
If memory is unavailable, be honest.
Keep your own personality.
Be respectful, helpful and age-appropriate.
Never claim to be a real person.

USER MESSAGE:
${message}
`;

          const result = await env.AI.run(
            "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
            {
              messages: [{ role: "user", content: prompt }]
            }
          );

          return json({
            reply: result.response || "Let's continue our conversation."
          }, 200, cookie);
        }

        return json({ error: "API endpoint not found." }, 404, cookie);

      } catch (error) {
        return json({
          error: "Something went wrong. Please try again."
        }, 500);
      }
    }

    return env.ASSETS.fetch(request);
  }
};
