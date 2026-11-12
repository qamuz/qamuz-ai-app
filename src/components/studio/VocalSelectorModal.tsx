import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  Mic,
  Plus,
  Search,
  Sparkles,
  Trash2,
  User,
  UserPlus,
  Volume2,
  X } from
'lucide-react';
import { useI18n } from '@/hooks/useI18n';
import { useAuth } from '@/hooks/useAuth';
import { deleteVoicePersona, fetchVoicePersonas } from '@/lib/kie';

export interface VocalPersona {
  id: string;
  name: string;
  gender: 'male' | 'female' | 'any';
  genre: string;
  description: string;
  tags: string;
  accentColor: string;
  isCustom?: boolean;
  /** A real Suno persona created from one of the user's songs (its id is a voice_personas row). */
  isKie?: boolean;
}

// eslint-disable-next-line react-refresh/only-export-components
export const OFFICIAL_VOCAL_PERSONAS: VocalPersona[] = [
{
  id: 'bachata-tenor',
  name: 'Anthony “El Bachatero”',
  gender: 'male',
  genre: 'Bachata / Bolero',
  description: 'Voz tenor dominicana con sentimiento de amargue y agudos expresivos de requinto',
  tags: 'bachata, amargue, tenor, vibrato, dominicano',
  accentColor: 'from-amber-500 to-orange-600'
},
{
  id: 'urbano-dembow',
  name: 'Yovng Flow',
  gender: 'male',
  genre: 'Urbano / Dembow / Trap',
  description: 'Vocal callejero enérgico, fraseo rápido con presencia frontal y textura moderna',
  tags: 'dembow, trap, autotune, urbano, callejero',
  accentColor: 'from-cyan-500 to-blue-600'
},
{
  id: 'diva-sensual',
  name: 'Camila Sol',
  gender: 'female',
  genre: 'Pop Latino / R&B',
  description: 'Voz femenina aterciopelada, seductora y suave con aire en los coros',
  tags: 'sensual, female, velvet, pop latino, r&b',
  accentColor: 'from-purple-500 to-pink-600'
},
{
  id: 'baladista-romantico',
  name: 'Sebastián Luna',
  gender: 'male',
  genre: 'Balada / Pop',
  description: 'Voz cálida y emotiva para canciones de amor y desamor con dinámicas amplias',
  tags: 'balada, romantico, emotivo, calido',
  accentColor: 'from-emerald-500 to-teal-600'
},
{
  id: 'reina-tropical',
  name: 'Kenia del Caribe',
  gender: 'female',
  genre: 'Merengue / Salsa / Tropical',
  description: 'Voz femenina potente y festiva, llena de alegría y afinación caribeña',
  tags: 'tropical, fiesta, merengue, potente, caribe',
  accentColor: 'from-yellow-500 to-amber-600'
},
{
  id: 'indie-nocturno',
  name: 'Luna Gris',
  gender: 'female',
  genre: 'Indie / Lo-Fi / Chill',
  description: 'Voz íntima y susurrada cercana al micrófono, ideal para Lo-Fi y temas melancólicos',
  tags: 'whisper, indie, lo-fi, chill, melancolico',
  accentColor: 'from-indigo-500 to-blue-600'
}];


const STORAGE_KEY = 'qamuz:custom_vocal_personas:v1';

interface Props {
  isOpen: boolean;
  selected: VocalPersona | null;
  onClose: () => void;
  onSelect: (persona: VocalPersona | null) => void;
}

export function VocalSelectorModal({ isOpen, selected, onClose, onSelect }: Props) {
  const { t } = useI18n();
  const [tab, setTab] = useState<'catalog' | 'custom' | 'designer'>('catalog');
  const [search, setSearch] = useState('');
  const [genderFilter, setGenderFilter] = useState<'all' | 'male' | 'female'>('all');
  const [customVoices, setCustomVoices] = useState<VocalPersona[]>([]);
  const [kieVoices, setKieVoices] = useState<VocalPersona[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    if (!isOpen || !user) return;
    void fetchVoicePersonas(user.id).then((rows) =>
    setKieVoices(rows.map((r) => ({
      id: r.id,
      name: r.name,
      gender: 'any',
      genre: 'Suno Persona',
      description: r.description ?? '',
      tags: 'persona, voz propia',
      accentColor: 'from-emerald-500 to-teal-600',
      isCustom: true,
      isKie: true
    })))
    );
  }, [isOpen, user]);

  // Designer Form State
  const [designName, setDesignName] = useState('');
  const [designGender, setDesignGender] = useState<'male' | 'female'>('female');
  const [designGenre, setDesignGenre] = useState('Bachata / Latino');
  const [designDesc, setDesignDesc] = useState('');
  const [designTags, setDesignTags] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as VocalPersona[];
        if (Array.isArray(parsed)) setCustomVoices(parsed);
      }
    } catch {

      // ignore
    }}, []);

  const saveCustomVoice = (voice: VocalPersona) => {
    const updated = [voice, ...customVoices.filter((v) => v.id !== voice.id)];
    setCustomVoices(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    }
  };

  const removeCustomVoice = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (kieVoices.some((v) => v.id === id)) {
      if (!user) return;
      void deleteVoicePersona(id, user.id).then((err) => {
        if (err) return;
        setKieVoices((list) => list.filter((v) => v.id !== id));
        if (selected?.id === id) onSelect(null);
      });
      return;
    }
    const updated = customVoices.filter((v) => v.id !== id);
    setCustomVoices(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    }
    if (selected?.id === id) {
      onSelect(null);
    }
  };

  const handleCreateCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!designName.trim()) return;

    const newVoice: VocalPersona = {
      id: `custom-${Date.now()}`,
      name: designName.trim(),
      gender: designGender,
      genre: designGenre.trim() || 'Latino',
      description: designDesc.trim() || `${designGender === 'male' ? 'Voz masculina' : 'Voz femenina'} personalizada`,
      tags: designTags.trim() || `${designGender}, personalizado, vocal`,
      accentColor: designGender === 'male' ? 'from-cyan-500 to-blue-600' : 'from-purple-500 to-pink-600',
      isCustom: true
    };

    saveCustomVoice(newVoice);
    onSelect(newVoice);
    setDesignName('');
    setDesignDesc('');
    setDesignTags('');
    setTab('custom');
    onClose();
  };

  if (!isOpen || typeof document === 'undefined') return null;

  const allVoices = tab === 'custom' ? [...kieVoices, ...customVoices] : OFFICIAL_VOCAL_PERSONAS;
  const filtered = allVoices.filter((v) => {
    if (genderFilter !== 'all' && v.gender !== genderFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return v.name.toLowerCase().includes(q) || v.genre.toLowerCase().includes(q) || v.description.toLowerCase().includes(q);
    }
    return true;
  });

  return createPortal(
    <div data-ev-id="ev_2fabdf6ffe" className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md animate-in fade-in" onClick={onClose}>
			<div data-ev-id="ev_vsm_stop" className="contents" onClick={(e) => e.stopPropagation()}>
			<div data-ev-id="ev_32fd413f62" className="relative flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0d141e] shadow-2xl max-h-[85vh]">
				{/* Top Glow Bar */}
				<div data-ev-id="ev_add9cbf01f" className="h-1 w-full bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-400" />

				{/* Header */}
				<div data-ev-id="ev_0025734397" className="flex items-start justify-between border-b border-white/5 p-6 pb-4">
					<div data-ev-id="ev_53f0a50999" className="flex items-center gap-3">
						<span data-ev-id="ev_c5de3f2840" className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/15 text-purple-400">
							<Mic className="h-5 w-5" />
						</span>
						<div data-ev-id="ev_f97f13af32">
							<h2 data-ev-id="ev_54f4d2e648" className="text-lg font-bold text-foreground">{t('Vocal Studio & Personas')}</h2>
							<p data-ev-id="ev_2efcb4f6dd" className="text-xs text-muted-foreground">
								{t('Elige una identidad vocal de artista o diseña la tuya propia')}
							</p>
						</div>
					</div>
					<button data-ev-id="ev_8d3f267cf7"
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-muted-foreground hover:bg-white/5 hover:text-foreground">
            
						<X className="h-5 w-5" />
					</button>
				</div>

				{/* Tabs */}
				<div data-ev-id="ev_0ab47fb05c" className="flex items-center justify-between border-b border-white/5 px-6">
					<div data-ev-id="ev_02bc8808c5" className="flex items-center gap-6">
						<button data-ev-id="ev_b605104139"
            type="button"
            onClick={() => setTab('catalog')}
            className={`border-b-2 py-3 text-xs font-bold transition-colors ${
            tab === 'catalog' ?
            'border-purple-400 text-purple-400' :
            'border-transparent text-muted-foreground hover:text-foreground'}`
            }>
              
							{t('Catálogo Oficial')} ({OFFICIAL_VOCAL_PERSONAS.length})
						</button>
						<button data-ev-id="ev_4139ba0ca6"
            type="button"
            onClick={() => setTab('custom')}
            className={`border-b-2 py-3 text-xs font-bold transition-colors ${
            tab === 'custom' ?
            'border-purple-400 text-purple-400' :
            'border-transparent text-muted-foreground hover:text-foreground'}`
            }>
              
							{t('Mis Voces')} ({customVoices.length + kieVoices.length})
						</button>
					</div>

					<button data-ev-id="ev_4d3efcd050"
          type="button"
          onClick={() => setTab('designer')}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
          tab === 'designer' ?
          'bg-purple-500 text-white' :
          'border border-purple-500/30 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20'}`
          }>
            
						<UserPlus className="h-3.5 w-3.5" />
						{t('Diseñar Nueva Voz')}
					</button>
				</div>

				{/* Body */}
				{tab === 'designer' ?
        <form data-ev-id="ev_0f992ca104" onSubmit={handleCreateCustom} className="flex flex-col gap-4 overflow-y-auto p-6">
						<div data-ev-id="ev_f466935e88">
							<label data-ev-id="ev_927f067a44" className="text-xs font-semibold text-muted-foreground">
								{t('Nombre del Artista / Voz')}
							</label>
							<input data-ev-id="ev_f7d9a5171b"
            type="text"
            required
            value={designName}
            onChange={(e) => setDesignName(e.target.value)}
            placeholder={t('Ej: David El Sensual, Kiara Bachata')}
            className="mt-1 w-full rounded-xl border border-white/10 bg-surface-2 px-3 py-2 text-sm text-foreground outline-none focus:border-purple-500/60" />
            
						</div>

						<div data-ev-id="ev_bbca922578" className="grid grid-cols-2 gap-4">
							<div data-ev-id="ev_3fa64a7e5b">
								<label data-ev-id="ev_c89dec100f" className="text-xs font-semibold text-muted-foreground">
									{t('Género Vocal')}
								</label>
								<div data-ev-id="ev_5c89cffabe" className="mt-1 flex rounded-xl border border-white/10 bg-surface-2 p-1">
									<button data-ev-id="ev_51941ea140"
                type="button"
                onClick={() => setDesignGender('female')}
                className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition-colors ${
                designGender === 'female' ?
                'bg-purple-500 text-white' :
                'text-muted-foreground hover:text-foreground'}`
                }>
                  
										{t('Femenina')}
									</button>
									<button data-ev-id="ev_4bc8309df0"
                type="button"
                onClick={() => setDesignGender('male')}
                className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition-colors ${
                designGender === 'male' ?
                'bg-purple-500 text-white' :
                'text-muted-foreground hover:text-foreground'}`
                }>
                  
										{t('Masculina')}
									</button>
								</div>
							</div>

							<div data-ev-id="ev_f1654d9e1d">
								<label data-ev-id="ev_6ef3fcb04f" className="text-xs font-semibold text-muted-foreground">
									{t('Género Musical Predilecto')}
								</label>
								<input data-ev-id="ev_b39c2e769a"
              type="text"
              value={designGenre}
              onChange={(e) => setDesignGenre(e.target.value)}
              placeholder="Bachata, Dembow, Pop"
              className="mt-1 w-full rounded-xl border border-white/10 bg-surface-2 px-3 py-2 text-xs text-foreground outline-none focus:border-purple-500/60" />
              
							</div>
						</div>

						<div data-ev-id="ev_81ccff2ae6">
							<label data-ev-id="ev_46c5080aff" className="text-xs font-semibold text-muted-foreground">
								{t('Descripción / Timbre Vocal')}
							</label>
							<textarea data-ev-id="ev_4057e8e735"
            rows={3}
            value={designDesc}
            onChange={(e) => setDesignDesc(e.target.value)}
            placeholder={t('Describe los matices: voz aguda con vibrato melódico, voz rasgada de calle, tono susurrado aterciopelado...')}
            className="mt-1 w-full rounded-xl border border-white/10 bg-surface-2 px-3 py-2 text-xs text-foreground outline-none focus:border-purple-500/60" />
            
						</div>

						<div data-ev-id="ev_3d2ec20fde">
							<label data-ev-id="ev_e59d6b3ba5" className="text-xs font-semibold text-muted-foreground">
								{t('Etiquetas de Control (Separadas por comas)')}
							</label>
							<input data-ev-id="ev_42dd94d3a2"
            type="text"
            value={designTags}
            onChange={(e) => setDesignTags(e.target.value)}
            placeholder={t('bachata, tenor, agudos brillantes, dominicano')}
            className="mt-1 w-full rounded-xl border border-white/10 bg-surface-2 px-3 py-2 text-xs text-foreground outline-none focus:border-purple-500/60" />
            
						</div>

						<div data-ev-id="ev_d0432f7c74" className="flex justify-end gap-2 pt-2">
							<button data-ev-id="ev_d976b56c97"
            type="button"
            onClick={() => setTab('catalog')}
            className="rounded-lg px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground">
              
								{t('Cancelar')}
							</button>
							<button data-ev-id="ev_99218b0e84"
            type="submit"
            disabled={!designName.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-purple-500/20 hover:from-purple-400 hover:to-pink-400 disabled:opacity-40">
              
								<Plus className="h-4 w-4" />
								{t('Guardar y Usar Voz')}
							</button>
						</div>
					</form> :

        <div data-ev-id="ev_e4cb21f00f" className="flex flex-1 flex-col overflow-hidden p-6">
						{/* Filter Toolbar */}
						<div data-ev-id="ev_0a98d72a55" className="flex items-center gap-3 pb-4">
							<div data-ev-id="ev_379ad9338f" className="flex flex-1 items-center gap-2 rounded-xl border border-white/5 bg-surface-2 px-3 py-2">
								<Search className="h-4 w-4 text-muted-foreground flex-none" />
								<input data-ev-id="ev_b89a5dfbfb"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('Buscar voz por nombre o género...')}
              className="w-full bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground" />
              
							</div>

							<div data-ev-id="ev_fb1ee10663" className="flex items-center gap-1 rounded-xl border border-white/5 bg-surface-2 p-1">
								{(['all', 'male', 'female'] as const).map((g) =>
              <button data-ev-id="ev_61848dc670"
              key={g}
              type="button"
              onClick={() => setGenderFilter(g)}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors ${
              genderFilter === g ?
              'bg-purple-500 text-white' :
              'text-muted-foreground hover:text-foreground'}`
              }>
                
										{g === 'all' ? t('Todas') : g === 'male' ? t('Hombres') : t('Mujeres')}
									</button>
              )}
							</div>
						</div>

						{/* Grid of Voices */}
						<div data-ev-id="ev_a037abc573" className="grid flex-1 grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
							{filtered.map((persona) => {
              const isSelected = selected?.id === persona.id;
              return (
                <div data-ev-id="ev_2786b5e54a"
                key={persona.id}
                onClick={() => {
                  onSelect(persona);
                  onClose();
                }}
                className={`group relative flex cursor-pointer flex-col gap-2 rounded-xl border p-4 transition-all ${
                isSelected ?
                'border-purple-400 bg-purple-950/25 shadow-lg shadow-purple-500/10' :
                'border-white/5 bg-surface-2 hover:border-purple-500/30 hover:bg-surface-3'}`
                }>
                  
										<div data-ev-id="ev_55d2c7b923" className="flex items-start justify-between">
											<div data-ev-id="ev_e5e9c42132" className="flex items-center gap-3">
												<span data-ev-id="ev_8d99802e53"
                      className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${persona.accentColor} text-white font-black text-sm shadow-md`}>
                        
													{persona.name.charAt(0)}
												</span>
												<div data-ev-id="ev_e7fb768eb3">
													<div data-ev-id="ev_26971c3f97" className="flex items-center gap-1.5">
														<p data-ev-id="ev_a7bd49af0c" className="font-bold text-sm text-foreground">{persona.name}</p>
														{isSelected &&
                          <span data-ev-id="ev_a6ff3c6a0f" className="flex h-4 w-4 items-center justify-center rounded-full bg-purple-500 text-white">
																<Check className="h-2.5 w-2.5 stroke-[3]" />
															</span>
                          }
													</div>
													<p data-ev-id="ev_0f59c154dd" className="text-[11px] font-semibold text-purple-400">
														{persona.genre} ·{' '}
														{persona.gender === 'male' ?
                          t('Voz Masculina') :
                          persona.gender === 'female' ?
                          t('Voz Femenina') :
                          t('Voz')}
													</p>
												</div>
											</div>

											{persona.isCustom &&
                    <button data-ev-id="ev_1f3b27b881"
                    type="button"
                    onClick={(e) => removeCustomVoice(persona.id, e)}
                    className="rounded-md p-1 text-muted-foreground opacity-0 hover:bg-destructive/20 hover:text-destructive group-hover:opacity-100 transition-opacity"
                    title={t('Eliminar voz personalizada')}>
                      
													<Trash2 className="h-3.5 w-3.5" />
												</button>
                    }
										</div>

										<p data-ev-id="ev_b849c47cf2" className="line-clamp-2 text-xs text-muted-foreground">
											{persona.description}
										</p>

										<div data-ev-id="ev_07e3cf7ab8" className="mt-auto flex flex-wrap gap-1 pt-1">
											{persona.tags.split(',').slice(0, 3).map((tag) =>
                    <span data-ev-id="ev_5940ed5fb0"
                    key={tag}
                    className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      
													#{tag.trim()}
												</span>
                    )}
										</div>
									</div>);

            })}

							{filtered.length === 0 &&
            <div data-ev-id="ev_f50622696d" className="col-span-2 flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
									<User className="h-8 w-8 opacity-40 mb-2" />
									<p data-ev-id="ev_75357de201" className="text-sm font-semibold">{t('No se encontraron voces')}</p>
									<p data-ev-id="ev_d3455fc4fb" className="text-xs mt-1">
										{tab === 'custom' ?
                t('Diseña tu primera voz personalizada con el botón de arriba.') :
                t('Intenta buscar con otros términos.')}
									</p>
								</div>
            }
						</div>
					</div>
        }

				{/* Footer */}
				<div data-ev-id="ev_04ca2c01b6" className="flex items-center justify-between border-t border-white/5 bg-[#090e15] px-6 py-4">
					{selected ?
          <button data-ev-id="ev_4f50d4e195"
          type="button"
          onClick={() => {
            onSelect(null);
            onClose();
          }}
          className="text-xs font-semibold text-muted-foreground hover:text-destructive">
            
							{t('Quitar selección de voz')}
						</button> :

          <div data-ev-id="ev_8808adfb14" />
          }

					<button data-ev-id="ev_4cfeec8666"
          type="button"
          onClick={onClose}
          className="rounded-lg bg-white/5 px-4 py-2 text-xs font-bold text-foreground hover:bg-white/10">
            
						{t('Cerrar')}
					</button>
				</div>
			</div>
			</div>
		</div>,
    document.body
  );

}