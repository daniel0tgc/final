// AI Service for handling real AI model API calls
export interface AIServiceConfig {
  openaiApiKey?: string;
  anthropicApiKey?: string;
  huggingfaceApiKey?: string;
  googleApiKey?: string;
}

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AIResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export class AIService {
  private static config: AIServiceConfig = {};
  private static initialized = false;

  /**
   * Initialize the AI service with stored API keys
   */
  static init(): void {
    if (this.initialized) return;

    try {
      // Load API settings from localStorage
      const storedSettings = localStorage.getItem("apiSettings");
      if (storedSettings) {
        const apiSettings = JSON.parse(storedSettings);
        this.config = {
          openaiApiKey: apiSettings.openaiApiKey,
          anthropicApiKey: apiSettings.anthropicApiKey,
          huggingfaceApiKey: apiSettings.huggingfaceApiKey,
          googleApiKey: apiSettings.googleApiKey,
        };
      }
      this.initialized = true;
    } catch (error) {
      console.error("Failed to initialize AI Service:", error);
      this.initialized = true;
    }
  }

  /**
   * Update API configuration
   */
  static updateConfig(config: AIServiceConfig): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get the best available API key for a given model
   */
  private static getApiKeyForModel(model: string): string | null {
    const modelLower = model.toLowerCase();

    if (modelLower.includes("gpt") || modelLower.includes("openai")) {
      const key = this.config.openaiApiKey;
      return key && key.trim() !== "" && !key.includes("••") ? key : null;
    }

    if (modelLower.includes("claude") || modelLower.includes("anthropic")) {
      const key = this.config.anthropicApiKey;
      return key && key.trim() !== "" && !key.includes("••") ? key : null;
    }

    if (modelLower.includes("huggingface") || modelLower.includes("hf")) {
      const key = this.config.huggingfaceApiKey;
      return key && key.trim() !== "" && !key.includes("••") ? key : null;
    }

    if (modelLower.includes("google") || modelLower.includes("gemini")) {
      const key = this.config.googleApiKey;
      return key && key.trim() !== "" && !key.includes("••") ? key : null;
    }

    // Default to OpenAI if no specific match
    const key = this.config.openaiApiKey;
    return key && key.trim() !== "" && !key.includes("••") ? key : null;
  }

  /**
   * Generate a response using the appropriate AI model
   */
  static async generateResponse(
    messages: AIMessage[],
    model: string = "gpt-4",
    options: {
      temperature?: number;
      maxTokens?: number;
    } = {}
  ): Promise<AIResponse> {
    this.init();

    const apiKey = this.getApiKeyForModel(model);
    if (!apiKey) {
      throw new Error(`No API key available for model: ${model}`);
    }

    const modelLower = model.toLowerCase();

    try {
      if (modelLower.includes("gpt") || modelLower.includes("openai")) {
        return await this.callOpenAI(messages, model, apiKey, options);
      }

      if (modelLower.includes("claude") || modelLower.includes("anthropic")) {
        return await this.callAnthropic(messages, model, apiKey, options);
      }

      if (modelLower.includes("huggingface") || modelLower.includes("hf")) {
        return await this.callHuggingFace(messages, model, apiKey, options);
      }

      if (modelLower.includes("google") || modelLower.includes("gemini")) {
        return await this.callGoogleAI(messages, model, apiKey, options);
      }

      // Default to OpenAI
      return await this.callOpenAI(messages, model, apiKey, options);
    } catch (error) {
      console.error("AI API call failed:", error);
      throw new Error(
        `Failed to generate response: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Call OpenAI API
   */
  private static async callOpenAI(
    messages: AIMessage[],
    model: string,
    apiKey: string,
    options: { temperature?: number; maxTokens?: number } = {}
  ): Promise<AIResponse> {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 1000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `OpenAI API error: ${response.status} - ${
          errorData.error?.message || response.statusText
        }`
      );
    }

    const data = await response.json();

    return {
      content: data.choices[0]?.message?.content || "",
      model: data.model,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
    };
  }

  /**
   * Call Anthropic API
   */
  private static async callAnthropic(
    messages: AIMessage[],
    model: string,
    apiKey: string,
    options: { temperature?: number; maxTokens?: number } = {}
  ): Promise<AIResponse> {
    // Convert messages to Anthropic format
    const systemMessage =
      messages.find((m) => m.role === "system")?.content || "";
    const userMessages = messages.filter(
      (m) => m.role === "user" || m.role === "assistant"
    );

    const anthropicMessages = userMessages.map((msg) => ({
      role: msg.role === "user" ? "user" : "assistant",
      content: msg.content,
    }));

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: model,
        messages: anthropicMessages,
        system: systemMessage,
        max_tokens: options.maxTokens ?? 1000,
        temperature: options.temperature ?? 0.7,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Anthropic API error: ${response.status} - ${
          errorData.error?.message || response.statusText
        }`
      );
    }

    const data = await response.json();

    return {
      content: data.content[0]?.text || "",
      model: data.model,
      usage: data.usage
        ? {
            promptTokens: data.usage.input_tokens,
            completionTokens: data.usage.output_tokens,
            totalTokens: data.usage.input_tokens + data.usage.output_tokens,
          }
        : undefined,
    };
  }

  /**
   * Call Hugging Face API
   */
  private static async callHuggingFace(
    messages: AIMessage[],
    model: string,
    apiKey: string,
    options: { temperature?: number; maxTokens?: number } = {}
  ): Promise<AIResponse> {
    // Convert messages to text format for Hugging Face
    const prompt =
      messages.map((msg) => `${msg.role}: ${msg.content}`).join("\n") +
      "\nassistant:";

    const response = await fetch(
      `https://api-inference.huggingface.co/models/${model}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            max_new_tokens: options.maxTokens ?? 1000,
            temperature: options.temperature ?? 0.7,
            return_full_text: false,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(
        `Hugging Face API error: ${response.status} - ${response.statusText}`
      );
    }

    const data = await response.json();

    return {
      content: Array.isArray(data)
        ? data[0]?.generated_text || ""
        : data.generated_text || "",
      model: model,
    };
  }

  /**
   * Call Google AI API
   */
  private static async callGoogleAI(
    messages: AIMessage[],
    model: string,
    apiKey: string,
    options: { temperature?: number; maxTokens?: number } = {}
  ): Promise<AIResponse> {
    // Convert messages to Google AI format
    const googleMessages = messages.map((msg) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }],
    }));

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: googleMessages,
          generationConfig: {
            temperature: options.temperature ?? 0.7,
            maxOutputTokens: options.maxTokens ?? 1000,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Google AI API error: ${response.status} - ${
          errorData.error?.message || response.statusText
        }`
      );
    }

    const data = await response.json();

    return {
      content: data.candidates?.[0]?.content?.parts?.[0]?.text || "",
      model: model,
    };
  }

  /**
   * Check if API keys are configured
   */
  static hasValidApiKeys(): boolean {
    this.init();
    return !!(
      (this.config.openaiApiKey &&
        this.config.openaiApiKey.trim() !== "" &&
        !this.config.openaiApiKey.includes("••")) ||
      (this.config.anthropicApiKey &&
        this.config.anthropicApiKey.trim() !== "" &&
        !this.config.anthropicApiKey.includes("••")) ||
      (this.config.huggingfaceApiKey &&
        this.config.huggingfaceApiKey.trim() !== "" &&
        !this.config.huggingfaceApiKey.includes("••")) ||
      (this.config.googleApiKey &&
        this.config.googleApiKey.trim() !== "" &&
        !this.config.googleApiKey.includes("••"))
    );
  }

  /**
   * Get available models based on configured API keys
   */
  static getAvailableModels(): string[] {
    this.init();
    const models: string[] = [];

    if (
      this.config.openaiApiKey &&
      this.config.openaiApiKey.trim() !== "" &&
      !this.config.openaiApiKey.includes("••")
    ) {
      models.push("gpt-4", "gpt-4-turbo", "gpt-3.5-turbo");
    }

    if (
      this.config.anthropicApiKey &&
      this.config.anthropicApiKey.trim() !== "" &&
      !this.config.anthropicApiKey.includes("••")
    ) {
      models.push(
        "claude-3-opus-20240229",
        "claude-3-sonnet-20240229",
        "claude-3-haiku-20240307"
      );
    }

    if (
      this.config.huggingfaceApiKey &&
      this.config.huggingfaceApiKey.trim() !== "" &&
      !this.config.huggingfaceApiKey.includes("••")
    ) {
      models.push(
        "meta-llama/Llama-2-70b-chat-hf",
        "microsoft/DialoGPT-medium"
      );
    }

    if (
      this.config.googleApiKey &&
      this.config.googleApiKey.trim() !== "" &&
      !this.config.googleApiKey.includes("••")
    ) {
      models.push("gemini-2.5-pro", "gemini-2.5-flash");
    }

    return models;
  }
}
