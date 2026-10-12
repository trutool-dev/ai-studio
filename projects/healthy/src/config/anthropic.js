const Anthropic = require('@anthropic-ai/sdk');

// Modelo especificado en el CLAUDE.md del agente IA
const MODEL = 'claude-sonnet-4-6';

// Configuración de tokens máximos para generación de planes completos
const MAX_TOKENS = 16000;

// Inicializa el cliente con la API key del entorno
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

module.exports = { anthropic, MODEL, MAX_TOKENS };
