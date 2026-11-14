function getStyle(message) {
  const text = message.toLowerCase();

  if (/\b(short|brief|quick|in a few words)\b/.test(text)) {
    return "Keep the response short and direct.";
  }

  if (/\b(explain|in detail|deep dive|step by step)\b/.test(text)) {
    return "Give a thoughtful, detailed and well-organised response.";
  }

  if (/\b(joke|funny|make me laugh|humour)\b/.test(text)) {
    return "Use light humour and playful language where appropriate.";
  }

  if (/\b(serious|professional|formal)\b/.test(text)) {
    return "Use a more composed, clear and professional tone.";
  }

  if (/[😂🤣😄😅😊😉]/u.test(message)) {
    return "A relaxed, friendly and playful tone may suit this conversation.";
  }

  if (/\b(hey|hi|hello|lol|haha|gonna|wanna)\b/.test(text)) {
    return "Use natural, casual and friendly language.";
  }

  return "Use a warm, natural and clear conversational style.";
}

const personalities = {
  Adrian: "You are Adrian, a thoughtful and mysterious writer who enjoys literature, meaningful conversations and mysteries.",
  Maya: "You are Maya, an imaginative and expressive creative who enjoys music, art, humour and adventures.",
  Leo: "You are Leo, a curious and adventurous explorer who enjoys discoveries, interesting ideas and new perspectives."
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/chat" && request.method === "POST") {
      try {
        const body = await request.json();
        const character = body.character || "Adrian";
        const message = body.message || "";

        if (!message.trim()) {
          return Response.json(
            { error: "Please enter a message." },
            { status: 400 }
          );
        }

        const personality =
          personalities[character] || personalities.Adrian;

        const style = getStyle(message);

        const prompt = `
${personality}

You are a fictional storytelling companion in Afterhours AI.

COMMUNICATION STYLE:
${style}

Adapt naturally without copying the user's words.
Keep your own character personality.
Be respectful, helpful and age-appropriate.
Do not assume personal or sensitive information about the user.
Never claim to be a real person.

USER MESSAGE:
${message}
`;

        const result = await env.AI.run(
          "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
          {
            messages: [
              { role: "user", content: prompt }
            ]
          }
        );

        return Response.json({
          reply: result.response || "Let's continue our conversation."
        });

      } catch (error) {
        return Response.json(
          { error: "The chat is unavailable right now. Please try again." },
          { status: 500 }
        );
      }
    }

    return env.ASSETS.fetch(request);
  }
};
