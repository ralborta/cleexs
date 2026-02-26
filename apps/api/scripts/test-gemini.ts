/**
 * Test rápido de conectividad con Gemini.
 * Uso: npx tsx scripts/test-gemini.ts
 */

// Doc: GEMINI_API_KEY o GOOGLE_API_KEY (GOOGLE_API_KEY tiene prioridad si ambas están)
const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;

if (!apiKey) {
  console.error('❌ Falta GEMINI_API_KEY o GOOGLE_API_KEY en el entorno.');
  console.error('   Ejecutá: GEMINI_API_KEY=tu_key npx tsx scripts/test-gemini.ts');
  process.exit(1);
}

// Incluir gemini-3-flash-preview (doc actual de Google); luego alternativas
const MODELS_TO_TEST = ['gemini-3-flash-preview', 'gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash-001'];

async function testModel(modelName: string) {
  console.log(`\n🔷 Probando modelo: ${modelName}`);
  try {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: apiKey! });
    const response = await ai.models.generateContent({
      model: modelName,
      contents: `Respondé SOLO con JSON válido: {"status":"ok","modelo":"${modelName}","mensaje":"Gemini funcionando correctamente"}`,
      config: { temperature: 0.1, maxOutputTokens: 200 },
    });
    const text = (response.text ?? '').trim();
    console.log(`✅ Respuesta recibida: ${text}`);

    try {
      const parsed = JSON.parse(text);
      console.log(`✅ JSON parseado correctamente:`, parsed);
      return true;
    } catch {
      console.warn(`⚠️ Respuesta no es JSON válido. Texto crudo: ${text}`);
      return true;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`❌ Error con ${modelName}: ${msg}`);
    return false;
  }
}

async function main() {
  console.log(`🔑 API Key detectada: ${apiKey!.slice(0, 8)}...`);
  console.log(`📊 Probando ${MODELS_TO_TEST.length} modelos en un solo run...\n`);

  const ok: string[] = [];
  const fail: string[] = [];
  for (const model of MODELS_TO_TEST) {
    const success = await testModel(model);
    if (success) ok.push(model);
    else fail.push(model);
  }

  console.log('\n' + '─'.repeat(50));
  console.log(`✅ Funcionan: ${ok.length > 0 ? ok.join(', ') : 'ninguno'}`);
  if (fail.length > 0) console.log(`❌ Fallan: ${fail.join(', ')}`);
  console.log(`Total: ${ok.length}/${MODELS_TO_TEST.length} modelos OK.`);
}

main().catch(console.error);
