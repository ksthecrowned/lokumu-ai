export class LLM {
  constructor(private endpoint: string) { }

  async ask(messages: any[]) {
    const res = await fetch(this.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.LLM_MODEL || "qwen2.5-coder:1.5b",
        messages,
        stream: false,
        temperature: 0.1,
      }),
    });

    const raw = await res.text();

    const data = JSON.parse(raw);

    return (
      data?.message?.content ??
      data?.response ??
      ""
    );
  }
}
