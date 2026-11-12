import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Disc3, Flame, Music, Sparkles, Wand2, X, Zap } from 'lucide-react';
import { useI18n } from '@/hooks/useI18n';

interface MakeABeatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (beatPrompt: string, styleText: string, suggestedTitle: string) => void;
}

const GENRES = [
'Bachata',
'Merengue Mambo',
'Dembow Dominicano',
'Reggaeton',
'Trap Latino',
'Afrobeat',
'Drill',
'Boom Bap',
'Lo-Fi',
'Amapiano',
'R&B Contemporáneo',
'House',
'Synth Pop',
'Neo Soul',
'Pop Urbano'];


const DRUM_STYLES = [
{ id: 'dominican', label: 'Güira & Bongó Dominicano', bpm: 130 },
{ id: '808_heavy', label: '808 Sub-Bass & Hi-Hats Rápidos', bpm: 140 },
{ id: 'boom_bap', label: 'Batería Crunch Lo-Fi / Vinilo', bpm: 90 },
{ id: 'dembow', label: 'Ritmo Dembow Acelerado 120 BPM', bpm: 118 },
{ id: 'reggaeton', label: 'Pound Crotchet Clásico 4/4', bpm: 95 },
{ id: 'afrobeat', label: 'Polirritmia Africana & Shakers', bpm: 105 }];


const INSTRUMENTS = [
'Requinto Virtuoso',
'Guitarra Segunda (Rasgueo)',
'Piano Eléctrico Rhodes',
'Sintetizador Lead Analógico',
'Metales / Mambo Brass',
'Bajo 808 Distorsionado',
'Guitarra Acústica Nylon',
'Pads Etéreos y Reverberantes'];


const MOODS = [
'Bailable / Fiestero',
'Romántico / Sentimental',
'Oscuro & Melancólico',
'Energético & Agresivo',
'Relajado / Chillout',
'Sensual & Suave'];


export function MakeABeatModal({ isOpen, onClose, onSubmit }: MakeABeatModalProps) {
  const { t } = useI18n();
  const [selectedGenres, setSelectedGenres] = useState<string[]>(['Bachata']);
  const [selectedDrum, setSelectedDrum] = useState(DRUM_STYLES[0].id);
  const [selectedInstruments, setSelectedInstruments] = useState<string[]>(['Requinto Virtuoso', 'Guitarra Segunda (Rasgueo)']);
  const [selectedMood, setSelectedMood] = useState(MOODS[0]);
  const [bpm, setBpm] = useState(130);
  const [customDetails, setCustomDetails] = useState('');

  if (!isOpen) return null;

  const toggleGenre = (genre: string) => {
    if (selectedGenres.includes(genre)) {
      if (selectedGenres.length > 1) {
        setSelectedGenres(selectedGenres.filter((g) => g !== genre));
      }
    } else {
      setSelectedGenres([...selectedGenres, genre]);
    }
  };

  const toggleInstrument = (inst: string) => {
    if (selectedInstruments.includes(inst)) {
      setSelectedInstruments(selectedInstruments.filter((i) => i !== inst));
    } else {
      setSelectedInstruments([...selectedInstruments, inst]);
    }
  };

  const handleDrumSelect = (drum: typeof DRUM_STYLES[0]) => {
    setSelectedDrum(drum.id);
    setBpm(drum.bpm);
  };

  const handleSubmit = () => {
    const drumObj = DRUM_STYLES.find((d) => d.id === selectedDrum) || DRUM_STYLES[0];
    const genreStr = selectedGenres.join(' / ');
    const instStr = selectedInstruments.length ? selectedInstruments.join(', ') : 'instrumentación completa';

    const promptParts: string[] = [
    `Instrumental beat estilo ${genreStr} a ${bpm} BPM`,
    `Ritmo de percusión: ${drumObj.label}`,
    `Instrumentos principales: ${instStr}`,
    `Ambiente y vibra: ${selectedMood}`];


    if (customDetails.trim()) {
      promptParts.push(customDetails.trim());
    }

    const fullPrompt = promptParts.join('. ') + '.';
    const styleTags = `${selectedGenres.join(', ')}, ${bpm} BPM, Instrumental, ${drumObj.label}`;
    const suggestedTitle = `Beat ${selectedGenres[0]} ${bpm} BPM`;

    onSubmit(fullPrompt, styleTags, suggestedTitle);
    onClose();
  };

  return createPortal(
    <div data-ev-id="ev_e2f675609e" className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
			<div data-ev-id="ev_4b6d7a4ede"
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.stopPropagation()}
      className="flex flex-col w-full max-w-2xl max-h-[88vh] overflow-hidden rounded-2xl border border-border bg-[#101720] shadow-2xl shadow-cyan-950/40 text-foreground">
        
				{/* Header */}
				<div data-ev-id="ev_cb252ce59c" className="flex items-center justify-between border-b border-border/80 bg-[#0b1016] px-6 py-4">
					<div data-ev-id="ev_544438c8e5" className="flex items-center gap-2.5">
						<div data-ev-id="ev_ad515b9754" className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
							<Disc3 className="w-4 h-4" />
						</div>
						<div data-ev-id="ev_2ee045ec47">
							<h2 data-ev-id="ev_f6b1039285" className="text-base font-bold text-foreground">{t('Crear un Beat Instrumental')}</h2>
							<p data-ev-id="ev_6ae3fa4efd" className="text-xs text-muted-foreground">{t('Configura ritmo, tempo y elementos para generar tu pista')}</p>
						</div>
					</div>
					<button data-ev-id="ev_3e51e64b78"
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-2 hover:text-foreground transition-colors">
            
						<X className="w-4 h-4" />
					</button>
				</div>

				{/* Body Content */}
				<div data-ev-id="ev_c46912601c" className="flex flex-col gap-5 p-6 overflow-y-auto max-h-[calc(88vh-130px)]">
					{/* Genre Selection */}
					<div data-ev-id="ev_246c416c6e">
						<label data-ev-id="ev_27622166fb" className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2.5">
							{t('Género o Fusión')}
						</label>
						<div data-ev-id="ev_b0031e966e" className="flex flex-wrap gap-2">
							{GENRES.map((genre) => {
                const active = selectedGenres.includes(genre);
                return (
                  <button data-ev-id="ev_10280e834a"
                  key={genre}
                  type="button"
                  onClick={() => toggleGenre(genre)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                  active ?
                  'bg-cyan-500 text-black border-cyan-400 font-bold shadow-sm shadow-cyan-500/30' :
                  'bg-surface-2 text-muted-foreground hover:bg-surface-3 hover:text-foreground border border-border/60'}`
                  }>
                    
										{t(genre)}
									</button>);

              })}
						</div>
					</div>

					{/* Drum & Percussion Base */}
					<div data-ev-id="ev_760794f3af">
						<div data-ev-id="ev_83538d70db" className="flex items-center justify-between mb-2">
							<label data-ev-id="ev_713f89704a" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
								{t('Base Rítmica & Percusión')}
							</label>
							<span data-ev-id="ev_538c27e20d" className="text-xs font-mono font-bold text-cyan-400">{bpm} BPM</span>
						</div>
						<div data-ev-id="ev_deb5169a39" className="grid grid-cols-1 sm:grid-cols-2 gap-2">
							{DRUM_STYLES.map((drum) => {
                const active = selectedDrum === drum.id;
                return (
                  <button data-ev-id="ev_2cce6f4062"
                  key={drum.id}
                  type="button"
                  onClick={() => handleDrumSelect(drum)}
                  className={`flex items-center justify-between rounded-xl p-3 text-left border text-xs font-medium transition-all ${
                  active ?
                  'border-cyan-500/70 bg-cyan-950/20 text-cyan-300 shadow-sm' :
                  'border-border/60 bg-[#0d141c] text-foreground hover:bg-[#121c27]'}`
                  }>
                    
										<span data-ev-id="ev_bf21191a41">{t(drum.label)}</span>
										<span data-ev-id="ev_5d4031b1d6" className="rounded bg-surface-3 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
											{drum.bpm} BPM
										</span>
									</button>);

              })}
						</div>
					</div>

					{/* Instruments */}
					<div data-ev-id="ev_7577cd5557">
						<label data-ev-id="ev_df91ceabcb" className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">
							{t('Instrumentos Destacados')}
						</label>
						<div data-ev-id="ev_1c52f584c3" className="flex flex-wrap gap-2">
							{INSTRUMENTS.map((inst) => {
                const active = selectedInstruments.includes(inst);
                return (
                  <button data-ev-id="ev_49d78672b1"
                  key={inst}
                  type="button"
                  onClick={() => toggleInstrument(inst)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition-all ${
                  active ?
                  'border-purple-500 bg-purple-500/20 text-purple-300 font-bold' :
                  'border-border/60 bg-surface-2 text-muted-foreground hover:text-foreground'}`
                  }>
                    
										{t(inst)}
									</button>);

              })}
						</div>
					</div>

					{/* Mood & Custom Notes */}
					<div data-ev-id="ev_0b7f1152cb" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<div data-ev-id="ev_0d320880ee">
							<label data-ev-id="ev_957a3ff02f" className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
								{t('Vibra / Estado de Ánimo')}
							</label>
							<select data-ev-id="ev_1f644d66c9"
              value={selectedMood}
              onChange={(e) => setSelectedMood(e.target.value)}
              className="w-full rounded-xl border border-border bg-[#0d141c] p-2.5 text-xs font-medium text-foreground focus:outline-none focus:border-cyan-500">
                
								{MOODS.map((m) =>
                <option data-ev-id="ev_2d117a8717" key={m} value={m} className="bg-[#0b1016]">
										{t(m)}
									</option>
                )}
							</select>
						</div>

						<div data-ev-id="ev_5dfb607e8c">
							<label data-ev-id="ev_d077af7609" className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
								{t('Detalles Adicionales (Opcional)')}
							</label>
							<input data-ev-id="ev_f877e536f5"
              type="text"
              value={customDetails}
              onChange={(e) => setCustomDetails(e.target.value)}
              placeholder={t('ej: intro con guitarra sola y corte en el mambo...')}
              className="w-full rounded-xl border border-border bg-[#0d141c] p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-cyan-500" />
              
						</div>
					</div>
				</div>

				{/* Footer Button */}
				<div data-ev-id="ev_6249aa99af" className="flex items-center justify-between border-t border-border/80 bg-[#0b1016] px-6 py-4">
					<button data-ev-id="ev_7b59e2107a"
          type="button"
          onClick={onClose}
          className="rounded-xl px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-surface-2 hover:text-foreground transition-colors">
            
						{t('Cancelar')}
					</button>
					<button data-ev-id="ev_e824b2e8a4"
          type="button"
          onClick={handleSubmit}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 px-5 py-2.5 text-xs font-bold text-black shadow-lg shadow-cyan-500/25 transition-all">
            
						<Wand2 className="w-3.5 h-3.5" />
						<span data-ev-id="ev_cc263c240e">{t('Aplicar Beat al Estudio')}</span>
					</button>
				</div>
			</div>
		</div>,
    document.body
  );
}