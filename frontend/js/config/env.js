/* ============================================================
   NOVIQ ENV CONFIG — Add your free API keys here
   ============================================================
   Get free API keys from:
   - Groq (Llama-3): https://console.groq.com/keys
   - Hugging Face: https://huggingface.co/settings/tokens
   - Cohere: https://dashboard.cohere.ai/api-keys
   - Together AI: https://api.together.xyz/settings/api-keys

   You can also set these via localStorage in the AI Lab page
   or as environment variables in your deployment platform.
   ============================================================ */

window.ENV = {
  GROQ_API_KEY: '',
  HUGGINGFACE_API_KEY: '',
  COHERE_API_KEY: '',
  TOGETHER_API_KEY: '',
};

/* ============================================================
   NOVIQ BACKEND API URL — single source of truth
   ------------------------------------------------------------
   '' (empty)  → same origin: site and API served together
                 (local dev via node server, or shared hosting
                 where the Node app serves everything)
   Custom URL  → frontend hosted separately from the backend:
                 window.NOVIQ_API_URL = 'https://api.yourdomain.com'
   ============================================================ */
window.NOVIQ_API_URL = window.NOVIQ_API_URL || '';

// Auto-load from localStorage if available (set via AI Lab config UI)
if (typeof localStorage !== 'undefined') {
  const localGroq = localStorage.getItem('noviq_groq_key');
  const localHF = localStorage.getItem('noviq_hf_key');
  if (localGroq) window.ENV.GROQ_API_KEY = localGroq;
  if (localHF) window.ENV.HUGGINGFACE_API_KEY = localHF;
}

console.log('[Noviq] ENV loaded. API keys configured:', 
  Object.entries(window.ENV).filter(([k, v]) => v).map(([k]) => k).join(', ') || 'none');