export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/chat" && request.method === "POST") {
      try {
        const body = await request.json();

        const character = body.character || "Adrian";
        const message = body.message || "";

        if (!message.trim()) {
          return Response.json({ error: "Please enter a message." }, { status: 400 });
        }

        const prompt = `You are ${character}, a fictional storytelling companion in Afterhours AI. Be warm, creative, thoughtful and respectful. Keep conversations non-explicit and age-appropriate. Never claim to be a real person. The user's message is: ${message}`;

        const result = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
          messages: [{ role: "user", content: prompt }]
        });

        return Response.json({ reply: result.response || "Let's continue our story. Tell me more." });
      } catch (error) {
        return Response.json({ error: "The chat is unavailable right now. Please try again." }, { status: 500 });
      }
    }

    return env.ASSETS.fetch(request);
  }
};
