/**
 * Test rápido de conectividad con Gemini.
 * Uso: npx tsx scripts/test-gemini.ts
 */

const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error('❌ Falta GOOGLE_AI_API_KEY o GEMINI_API_KEY en el entorno.');
  console.error('   Ejecutá: GEMINI_API_KEY=tu_key npx tsx scripts/test-gemini.ts');
  process.exit(1);
}

// Solo modelos actualmente soportados (Google descontinuó 1.x y algunos 2.0 sin versión)
// Orden: el que usa la API primero, luego alternativas
const MODELS_TO_TEST = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash-001'];

async function testModel(modelName: string) {
  console.log(`\n🔷 Probando modelo: ${modelName}`);
  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey!);
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 200,
      },
    });

    const prompt = `Respondé SOLO con JSON válido: {"status":"ok","modelo":"${modelName}","mensaje":"Gemini funcionando correctamente"}`;
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
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
