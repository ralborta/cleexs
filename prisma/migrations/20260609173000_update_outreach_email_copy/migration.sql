-- Versión final aprobada del cold outreach.
-- No nombra la empresa que hizo el análisis y completa la consulta del rubro con {{industryQuery}}.
UPDATE "outreach_templates"
SET
  "subject" = 'ChatGPT elige a un competidor tuyo',
  "body" = E'Hola,\n\nPreguntamos a ChatGPT: "¿quién me recomendás para {{industryQuery}}?" Aparece un competidor tuyo entre los primeros. Vos no estás.\n\nYa que le hicimos el reporte a ellos, también te armamos uno para vos de cómo te ve la IA. El Cleexs Score dio oportunidades de mejora — y se arregla con 3 cambios muy concretos.\n\n¿Querés que te mande el diagnóstico completo? Es gratis. Respondeme este mail y te lo mando.\n\nGonzalo — Fundador, Cleexs',
  "use_ai" = false,
  "updated_at" = CURRENT_TIMESTAMP
WHERE "key" = 'default';
