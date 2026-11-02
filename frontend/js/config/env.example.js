// ============================================================
// NOVIQ AI LAB — Free API Keys Configuration
// ============================================================
// Copy this file to env.js and add your free API keys
// Get free keys from:
// - Groq: https://console.groq.com (free tier: 14,400 req/day)
// - Hugging Face: https://huggingface.co/settings/tokens (free tier: 30,000 req/month)
// - Cohere: https://dashboard.cohere.ai/api-keys (free tier: 100 req/min)
// - Together AI: https://api.together.xyz (free tier: $1 credit)
// ============================================================

window.ENV = {
  // Groq API - Best for chat (Llama-3, Mixtral, Gemma)
  // Free tier: 14,400 requests/day, 6,000 tokens/min
  GROQ_API_KEY: '',

  // Hugging Face Inference API - For vision, OCR, speech
  // Free tier: 30,000 requests/month
  HUGGINGFACE_API_KEY: '',

  // Cohere API - Alternative chat model
  // Free tier: 100 requests/minute
  COHERE_API_KEY: '',

  // Together AI - Vision + chat models
  // Free tier: $1 credit on signup
  TOGETHER_API_KEY: '',
};

// Auto-initialize AI API with keys
if (typeof NOVIQ_AI_API !== 'undefined') {
  NOVIQ_AI_API.init(window.ENV);
}