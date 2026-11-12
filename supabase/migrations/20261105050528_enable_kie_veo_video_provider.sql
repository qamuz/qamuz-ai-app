-- Activa Kie · Veo 3 como proveedor de video (usa la misma clave KIE_API_KEY). Afecta 1 fila.
UPDATE public.ai_providers
SET slug = 'kie-veo',
    name = 'Kie · Veo 3',
    secret_name = 'KIE_API_KEY',
    model = 'veo3_fast',
    is_active = true,
    is_default = true,
    notes = 'Videos cortos y videoclips con Veo 3'
WHERE slug = 'video-pendiente';