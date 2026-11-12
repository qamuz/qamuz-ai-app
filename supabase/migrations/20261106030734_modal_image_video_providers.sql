-- Modal (Qamuz Vision API) becomes the image and video provider. Kie stays for music only.
-- Inserts 2 providers and turns off 2 old ones (openai-image, kie-veo).
INSERT INTO public.ai_providers (slug, name, kind, secret_name, model, is_active, is_default, credit_cost, notes) VALUES
 ('modal-image', 'Modal · Qamuz Vision', 'image', 'QAMUZ_SERVICE_TOKEN', 'qamuz-image-flux', true, true, 3, 'Covers and artwork with FLUX on Modal'),
 ('modal-video', 'Modal · Qamuz Video', 'video', 'QAMUZ_SERVICE_TOKEN', 'qamuz-video-svd', true, true, 20, 'Animated covers / short clips with Stable Video Diffusion on Modal')
ON CONFLICT (slug) DO UPDATE SET is_active = true, is_default = true, secret_name = EXCLUDED.secret_name, model = EXCLUDED.model;

UPDATE public.ai_providers SET is_active = false, is_default = false WHERE slug IN ('openai-image', 'kie-veo');