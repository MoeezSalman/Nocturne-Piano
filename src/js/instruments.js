// The sound catalog. Entries 1–95 mirror onlinepianist.com's Virtual Piano list, in the same order
// and using the same open-source sample sets. Everything after that is extra.
//
// Sources (all openly licensed):
//   salamander  Salamander Grand Piano by Alexander Holm (CC-BY 3.0), via tonejs.github.io
//   gm          midi-js-soundfonts by Benjamin Gleitzman: FluidR3_GM (CC-BY 3.0),
//               MusyngKite (CC-BY-SA 3.0) and FatBoy, via gleitz.github.io
//   studio      tonejs-instruments by Nicholaus Brosowsky (samples CC-BY 3.0)
//   synth       generated live by synth.js, no samples

export const FL = 'FluidR3_GM';
export const MK = 'MusyngKite';
export const FB = 'FatBoy';

const SAL_NAMES = ['C', 'Cs', 'D', 'Ds', 'E', 'F', 'Fs', 'G', 'Gs', 'A', 'As', 'B'];
export const SALAMANDER_ROOTS = Array.from({ length: 30 }, (_, i) => 21 + i * 3); // A0, C1, D#1 … C8
export const salamanderName = (midi) => `${SAL_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;

const gm = (bank, name, fmt = 'ogg') => ({ type: 'gm', bank, name, fmt });
const studio = (name, notes) => ({ type: 'studio', name, notes: notes.split(' ') });
const synth = (kind) => ({ type: 'synth', kind });

// Note lists available for each tonejs-instruments sample folder.
const OCTAVE_NAMES = ['C', 'Cs', 'D', 'Ds', 'E', 'F', 'Fs', 'G', 'Gs', 'A', 'As', 'B'];
const PIANO_NOTES = [];
for (let o = 1; o <= 7; o++) for (const n of OCTAVE_NAMES) PIANO_NOTES.push(`${n}${o}`);
PIANO_NOTES.push('C8');

const P = (id, label, short, group, src, extra = {}) => ({ id, label, short, group, src, ...extra });
const S = { sustained: true }; // held tones: shorter half-pedal release, like the original

export const PRESETS = [
  // ——— Piano ———
  P('grand_piano', 'Concert Grand Piano', 'Concert Grand', 'Piano', { type: 'salamander' }),
  P('piano', 'Grand Piano 1', 'Grand Piano 1', 'Piano', studio('piano', PIANO_NOTES.join(' '))),
  P('grand_piano2_mk', 'Grand Piano 2', 'Grand Piano 2', 'Piano', gm(MK, 'acoustic_grand_piano')),
  P('grand_piano2_fb', 'Grand Piano 3', 'Grand Piano 3', 'Piano', gm(FB, 'acoustic_grand_piano')),
  P('grand_piano2', 'Grand Piano 4', 'Grand Piano 4', 'Piano', gm(FL, 'acoustic_grand_piano')),
  P('bright_acoustic_piano_fb', 'Bright Piano', 'Bright Piano', 'Piano', gm(FB, 'bright_acoustic_piano')),
  P('honkytonk_mk', 'Honky-tonk', 'Honky-tonk', 'Piano', gm(MK, 'honkytonk_piano')),
  // ——— Electric Piano ———
  P('electric_grand_mk', 'Electric Grand', 'Elec. Grand', 'Electric Piano', gm(MK, 'electric_grand_piano')),
  P('electric1', 'Electric Piano 1', 'Electric 1', 'Electric Piano', gm(FL, 'electric_piano_1')),
  P('electric1_mk', 'Electric Piano 2', 'Electric 2', 'Electric Piano', gm(MK, 'electric_piano_1')),
  P('electric2', 'Electric Piano 3', 'Electric 3', 'Electric Piano', gm(FL, 'electric_piano_2')),
  P('electric2_mk', 'Electric Piano 4', 'Electric 4', 'Electric Piano', gm(MK, 'electric_piano_2')),
  // ——— Keys ———
  P('harpsichord', 'Harpsichord', 'Harpsi.', 'Keys', gm(FL, 'harpsichord')),
  P('clavinet_mk', 'Clavinet', 'Clavinet', 'Keys', gm(MK, 'clavinet')),
  P('celesta', 'Celesta', 'Celesta', 'Keys', gm(FL, 'celesta')),
  P('glockenspiel_mk', 'Glockenspiel', 'Glocken.', 'Keys', gm(MK, 'glockenspiel')),
  P('music_box', 'Music Box', 'Music Box', 'Keys', gm(FL, 'music_box')),
  P('vibraphone', 'Vibraphone', 'Vibraphone', 'Keys', gm(FL, 'vibraphone')),
  P('marimba_fb', 'Marimba', 'Marimba', 'Keys', gm(FB, 'marimba')),
  P('xylophone', 'Xylophone', 'Xylophone', 'Keys', gm(FL, 'xylophone')),
  P('tubular_bells_mk', 'Tubular Bells', 'Tub. Bells', 'Keys', gm(MK, 'tubular_bells')),
  P('dulcimer_fb', 'Dulcimer', 'Dulcimer', 'Keys', gm(FB, 'dulcimer')),
  // ——— Organ ———
  P('drawbar_organ_fb', 'Drawbar Organ', 'Organ 1', 'Organ', gm(FB, 'drawbar_organ'), S),
  P('percussive_organ_fb', 'Percussive Organ', 'Organ 2', 'Organ', gm(FB, 'percussive_organ'), S),
  P('rock_organ_fb', 'Rock Organ', 'Organ 3', 'Organ', gm(FB, 'rock_organ'), S),
  P('church_organ_fb', 'Church Organ', 'Organ 4', 'Organ', gm(FB, 'church_organ'), S),
  P('reed_organ_fb', 'Reed Organ', 'Organ 5', 'Organ', gm(FB, 'reed_organ'), S),
  P('accordion_fb', 'Accordion', 'Accordion', 'Organ', gm(FB, 'accordion'), S),
  P('harmonica_fb', 'Harmonica', 'Harmonica', 'Organ', gm(FB, 'harmonica'), S),
  P('tango_accordion', 'Tango Accordion', 'Tango Acc.', 'Organ', gm(FL, 'tango_accordion'), S),
  // ——— Guitar ———
  P('guitar_nylon_fb', 'Nylon Guitar', 'Guitar 1', 'Guitar', gm(FB, 'acoustic_guitar_nylon')),
  P('guitar_steel_fb', 'Steel Guitar', 'Guitar 2', 'Guitar', gm(FB, 'acoustic_guitar_steel')),
  P('guitar_jazz_fb', 'Jazz Guitar', 'Guitar 3', 'Guitar', gm(FB, 'electric_guitar_jazz')),
  P('guitar_clean_mk', 'Clean Electric', 'Guitar 4', 'Guitar', gm(MK, 'electric_guitar_clean')),
  P('electric_guitar_muted', 'Muted Guitar', 'Guitar 5', 'Guitar', gm(FL, 'electric_guitar_muted')),
  P('overdriven_guitar_mk', 'Overdrive Guitar', 'Guitar 6', 'Guitar', gm(MK, 'overdriven_guitar')),
  P('distortion_guitar_fb', 'Distortion Guitar', 'Guitar 7', 'Guitar', gm(FB, 'distortion_guitar')),
  P('guitar_harmonics_fb', 'Guitar Harmonics', 'Harmonics', 'Guitar', gm(FB, 'guitar_harmonics')),
  P('banjo', 'Banjo', 'Banjo', 'Guitar', gm(FL, 'banjo', 'mp3')),
  // ——— Bass ———
  P('acoustic_bass_mk', 'Acoustic Bass', 'Bass 1', 'Bass', gm(MK, 'acoustic_bass')),
  P('electric_bass_finger_fb', 'Electric Bass', 'Bass 2', 'Bass', gm(FB, 'electric_bass_finger')),
  P('electric_bass_pick_mk', 'Pick Bass', 'Bass 3', 'Bass', gm(MK, 'electric_bass_pick')),
  P('fretless_bass_mk', 'Fretless Bass', 'Fretless', 'Bass', gm(MK, 'fretless_bass')),
  P('slap_bass_1_fb', 'Slap Bass 1', 'Slap 1', 'Bass', gm(FB, 'slap_bass_1')),
  P('slap_bass_2_mk', 'Slap Bass 2', 'Slap 2', 'Bass', gm(MK, 'slap_bass_2')),
  P('synth_bass_1_mk', 'Synth Bass 1', 'Syn Bass 1', 'Bass', gm(MK, 'synth_bass_1')),
  P('synth_bass_2_mk', 'Synth Bass 2', 'Syn Bass 2', 'Bass', gm(MK, 'synth_bass_2')),
  // ——— Strings ———
  P('violin_fb', 'Violin', 'Violin', 'Strings', gm(FB, 'violin'), S),
  P('viola_fb', 'Viola', 'Viola', 'Strings', gm(FB, 'viola'), S),
  P('cello', 'Cello', 'Cello', 'Strings', gm(FL, 'cello'), S),
  P('contrabass_mk', 'Contrabass', 'Contrabass', 'Strings', gm(MK, 'contrabass'), S),
  P('tremolo_strings_mk', 'Tremolo Strings', 'Tremolo', 'Strings', gm(MK, 'tremolo_strings'), S),
  P('pizzicato_strings', 'Pizzicato Strings', 'Pizzicato', 'Strings', gm(FL, 'pizzicato_strings')),
  P('orchestral_harp_fb', 'Orchestral Harp', 'Harp', 'Strings', gm(FB, 'orchestral_harp')),
  P('timpani_mk', 'Timpani', 'Timpani', 'Strings', gm(MK, 'timpani')),
  P('string_ensemble_1_mk', 'String Ensemble', 'Strings 1', 'Strings', gm(MK, 'string_ensemble_1'), S),
  P('string_ensemble_2_mk', 'Slow Strings', 'Strings 2', 'Strings', gm(MK, 'string_ensemble_2'), S),
  P('synth_strings_1', 'Synth Strings 1', 'Syn Str 1', 'Strings', gm(FL, 'synth_strings_1'), S),
  P('synth_strings_2_mk', 'Synth Strings 2', 'Syn Str 2', 'Strings', gm(MK, 'synth_strings_2'), S),
  P('sitar', 'Sitar', 'Sitar', 'Strings', gm(FL, 'sitar', 'mp3')),
  // ——— Voice ———
  P('choir_aahs_mk', 'Choir Aahs', 'Choir', 'Voice', gm(MK, 'choir_aahs'), S),
  P('voice_oohs_fb', 'Voice Oohs', 'Oohs', 'Voice', gm(FB, 'voice_oohs'), S),
  P('synth_choir_mk', 'Synth Voice', 'Syn Voice', 'Voice', gm(MK, 'synth_choir'), S),
  P('orchestra_hit_mk', 'Orchestra Hit', 'Orch. Hit', 'Voice', gm(MK, 'orchestra_hit')),
  // ——— Brass ———
  P('trumpet_fb', 'Trumpet', 'Trumpet', 'Brass', gm(FB, 'trumpet'), S),
  P('trombone_fb', 'Trombone', 'Trombone', 'Brass', gm(FB, 'trombone'), S),
  P('tuba_mk', 'Tuba', 'Tuba', 'Brass', gm(MK, 'tuba'), S),
  P('muted_trumpet_fb', 'Muted Trumpet', 'Mute Tpt.', 'Brass', gm(FB, 'muted_trumpet'), S),
  P('french_horn', 'French Horn', 'Fr. Horn', 'Brass', gm(FL, 'french_horn'), S),
  P('brass_section_fb', 'Brass Section', 'Brass', 'Brass', gm(FB, 'brass_section'), S),
  P('synth_brass_1_fb', 'Synth Brass 1', 'Syn Brs 1', 'Brass', gm(FB, 'synth_brass_1'), S),
  P('synth_brass_2_mk', 'Synth Brass 2', 'Syn Brs 2', 'Brass', gm(MK, 'synth_brass_2'), S),
  // ——— Wind ———
  P('soprano_sax_fb', 'Soprano Sax', 'Sop. Sax', 'Wind', gm(FB, 'soprano_sax'), S),
  P('alto_sax_fb', 'Alto Saxophone', 'Alto Sax', 'Wind', gm(FB, 'alto_sax'), S),
  P('tenor_sax_mk', 'Tenor Saxophone', 'Tenor Sax', 'Wind', gm(MK, 'tenor_sax'), S),
  P('baritone_sax_mk', 'Baritone Sax', 'Bari Sax', 'Wind', gm(MK, 'baritone_sax'), S),
  P('oboe_fb', 'Oboe', 'Oboe', 'Wind', gm(FB, 'oboe'), S),
  P('english_horn', 'English Horn', 'Eng. Horn', 'Wind', gm(FL, 'english_horn'), S),
  P('bassoon', 'Bassoon', 'Bassoon', 'Wind', gm(FL, 'bassoon'), S),
  P('clarinet_fb', 'Clarinet', 'Clarinet', 'Wind', gm(FB, 'clarinet'), S),
  P('piccolo_fb', 'Piccolo', 'Piccolo', 'Wind', gm(FB, 'piccolo'), S),
  P('flute_fb', 'Flute', 'Flute', 'Wind', gm(FB, 'flute'), S),
  P('recorder_fb', 'Recorder', 'Recorder', 'Wind', gm(FB, 'recorder'), S),
  P('pan_flute_fb', 'Pan Flute', 'Pan Flute', 'Wind', gm(FB, 'pan_flute'), S),
  P('blown_bottle_fb', 'Blown Bottle', 'Bottle', 'Wind', gm(FB, 'blown_bottle'), S),
  P('shakuhachi_fb', 'Shakuhachi', 'Shakuhachi', 'Wind', gm(FB, 'shakuhachi'), S),
  P('whistle_mk', 'Whistle', 'Whistle', 'Wind', gm(MK, 'whistle'), S),
  P('ocarina_fb', 'Ocarina', 'Ocarina', 'Wind', gm(FB, 'ocarina'), S),
  // ——— Synth ———
  P('lead_1_square_fb', 'Square Lead', 'Square', 'Synth', gm(FB, 'lead_1_square'), S),
  P('lead_2_sawtooth_fb', 'Synth Lead', 'Saw Lead', 'Synth', gm(FB, 'lead_2_sawtooth'), S),
  P('pad_2_warm_fb', 'Warm Pad', 'Warm Pad', 'Synth', gm(FB, 'pad_2_warm'), S),
  P('pad_7_halo_fb', 'Halo Pad', 'Halo Pad', 'Synth', gm(FB, 'pad_7_halo'), S),
  // ——— Percussion ———
  P('tinkle_bell_fb', 'Tinkle Bell', 'Tinkle Bell', 'Percussion', gm(FB, 'tinkle_bell')),
  P('steel_drums_fb', 'Steel Drums', 'Steel Drm', 'Percussion', gm(FB, 'steel_drums')),
  P('taiko_drum_fb', 'Taiko Drum', 'Taiko', 'Percussion', gm(FB, 'taiko_drum')),

  // ════════ Extra sounds ════════
  // ——— Studio: real recorded instruments ———
  P('studio_harmonium', 'Harmonium', 'Harmonium', 'Studio', studio('harmonium', 'C2 Cs2 D2 Ds2 E2 F2 Fs2 G2 Gs2 A2 As2 B2 C3 Cs3 D3 Ds3 E3 F3 Fs3 G3 Gs3 A3 As3 B3 C4 Cs4 D4 Ds4 E4 F4 G4 Gs4 A4 As4 B4 C5 Cs5 D5'), S),
  P('studio_violin', 'Solo Violin', 'Solo Violin', 'Studio', studio('violin', 'G3 A3 C4 E4 G4 A4 C5 E5 G5 A5 C6 E6 G6 A6 C7'), S),
  P('studio_cello', 'Solo Cello', 'Solo Cello', 'Studio', studio('cello', 'C2 D2 Ds2 E2 F2 G2 Gs2 A2 As2 B2 C3 Cs3 D3 Ds3 E3 F3 Fs3 G3 Gs3 A3 As3 B3 C4 Cs4 D4 Ds4 E4 F4 Fs4 G4 Gs4 A4 B4 C5'), S),
  P('studio_contrabass', 'Double Bass', 'Dbl. Bass', 'Studio', studio('contrabass', 'Fs1 G1 As1 C2 D2 E2 Fs2 Gs2 A2 Cs3 E3 Gs3 B3'), S),
  P('studio_harp', 'Concert Harp', 'Harp II', 'Studio', studio('harp', 'E1 G1 B1 D2 F2 A2 C3 E3 G3 B3 D4 F4 A4 C5 E5 G5 B5 D6 F6 A6 B6 D7 F7')),
  P('studio_guitar_nylon', 'Classical Guitar', 'Classical', 'Studio', studio('guitar-nylon', 'B1 D2 E2 Fs2 Gs2 A2 B2 Cs3 D3 E3 Fs3 G3 A3 B3 Cs4 Ds4 E4 Fs4 Gs4 A4 B4 Cs5 D5 E5 Fs5 G5 Gs5 A5 As5')),
  P('studio_guitar_acoustic', 'Acoustic Guitar', 'Acoustic', 'Studio', studio('guitar-acoustic', 'D2 Ds2 E2 F2 Fs2 G2 Gs2 A2 As2 B2 C3 Cs3 D3 Ds3 E3 F3 Fs3 G3 Gs3 A3 As3 B3 C4 Cs4 D4 Ds4 E4 F4 Fs4 G4 Gs4 A4 As4 B4 C5 Cs5 D5')),
  P('studio_guitar_electric', 'Electric Guitar', 'E. Guitar', 'Studio', studio('guitar-electric', 'Cs2 E2 Fs2 A2 C3 Ds3 Fs3 A3 C4 Ds4 Fs4 A4 C5 Ds5 Fs5 A5 C6')),
  P('studio_bass_electric', 'Studio Bass', 'Studio Bass', 'Studio', studio('bass-electric', 'Cs1 E1 G1 As1 Cs2 E2 G2 As2 Cs3 E3 G3 As3 Cs4 E4 G4 As4 Cs5')),
  P('studio_flute', 'Concert Flute', 'Con. Flute', 'Studio', studio('flute', 'C4 E4 A4 C5 E5 A5 C6 E6 A6 C7'), S),
  P('studio_clarinet', 'Studio Clarinet', 'Clarinet II', 'Studio', studio('clarinet', 'D3 F3 As3 D4 F4 As4 D5 F5 As5 D6 Fs6'), S),
  P('studio_saxophone', 'Studio Saxophone', 'Sax II', 'Studio', studio('saxophone', 'Cs3 D3 Ds3 E3 F3 Fs3 G3 Gs3 As3 B3 C4 Cs4 D4 Ds4 E4 F4 Fs4 G4 Gs4 A4 As4 B4 C5 Cs5 D5 Ds5 E5 F5 Fs5 G5 Gs5 A5'), S),
  P('studio_bassoon', 'Studio Bassoon', 'Bassoon II', 'Studio', studio('bassoon', 'G2 A2 C3 G3 A3 C4 E4 G4 A4 C5'), S),
  P('studio_trumpet', 'Studio Trumpet', 'Trumpet II', 'Studio', studio('trumpet', 'F3 A3 C4 Ds4 F4 G4 As4 D5 F5 A5 C6'), S),
  P('studio_french_horn', 'Studio French Horn', 'Horn II', 'Studio', studio('french-horn', 'A1 C2 Ds2 G2 D3 F3 A3 C4 D5 F5'), S),
  P('studio_trombone', 'Studio Trombone', 'Trombone II', 'Studio', studio('trombone', 'As1 Cs2 Ds2 F2 Gs2 As2 C3 D3 Ds3 F3 Gs3 As3 C4 Cs4 D4 Ds4 F4'), S),
  P('studio_tuba', 'Studio Tuba', 'Tuba II', 'Studio', studio('tuba', 'F1 As1 Ds2 F2 As2 D3 F3 As3 D4'), S),
  P('studio_organ', 'Pipe Organ', 'Pipe Organ', 'Studio', studio('organ', 'C1 Ds1 Fs1 A1 C2 Ds2 Fs2 A2 C3 Ds3 Fs3 A3 C4 Ds4 Fs4 A4 C5 Ds5 Fs5 A5 C6'), S),
  P('studio_xylophone', 'Studio Xylophone', 'Xylo II', 'Studio', studio('xylophone', 'G4 C5 G5 C6 G6 C7 G7 C8')),
  // ——— World ———
  P('koto_fb', 'Koto', 'Koto', 'World', gm(FB, 'koto')),
  P('shamisen_fb', 'Shamisen', 'Shamisen', 'World', gm(FB, 'shamisen')),
  P('kalimba_fb', 'Kalimba', 'Kalimba', 'World', gm(FB, 'kalimba')),
  P('sitar_mk', 'Sitar (Deep)', 'Sitar II', 'World', gm(MK, 'sitar')),
  P('bagpipe_fb', 'Bagpipe', 'Bagpipe', 'World', gm(FB, 'bagpipe'), S),
  P('fiddle_fb', 'Fiddle', 'Fiddle', 'World', gm(FB, 'fiddle'), S),
  P('shanai_fb', 'Shehnai', 'Shehnai', 'World', gm(FB, 'shanai'), S),
  // ——— Synth Leads ———
  P('lead_3_calliope_fb', 'Calliope Lead', 'Calliope', 'Synth Leads', gm(FB, 'lead_3_calliope'), S),
  P('lead_4_chiff_fb', 'Chiff Lead', 'Chiff', 'Synth Leads', gm(FB, 'lead_4_chiff'), S),
  P('lead_5_charang_fb', 'Charang Lead', 'Charang', 'Synth Leads', gm(FB, 'lead_5_charang'), S),
  P('lead_6_voice_fb', 'Voice Lead', 'Voice Lead', 'Synth Leads', gm(FB, 'lead_6_voice'), S),
  P('lead_7_fifths_fb', 'Fifths Lead', 'Fifths', 'Synth Leads', gm(FB, 'lead_7_fifths'), S),
  P('lead_8_bass_lead_fb', 'Bass + Lead', 'Bass+Lead', 'Synth Leads', gm(FB, 'lead_8_bass__lead'), S),
  // ——— Pads ———
  P('pad_1_new_age_fb', 'New Age Pad', 'New Age', 'Pads', gm(FB, 'pad_1_new_age'), S),
  P('pad_3_polysynth_fb', 'Polysynth Pad', 'Polysynth', 'Pads', gm(FB, 'pad_3_polysynth'), S),
  P('pad_4_choir_fb', 'Choir Pad', 'Choir Pad', 'Pads', gm(FB, 'pad_4_choir'), S),
  P('pad_5_bowed_fb', 'Bowed Pad', 'Bowed', 'Pads', gm(FB, 'pad_5_bowed'), S),
  P('pad_6_metallic_fb', 'Metallic Pad', 'Metallic', 'Pads', gm(FB, 'pad_6_metallic'), S),
  P('pad_8_sweep_fb', 'Sweep Pad', 'Sweep', 'Pads', gm(FB, 'pad_8_sweep'), S),
  // ——— Atmosphere ———
  P('fx_1_rain_fb', 'Rain', 'Rain', 'Atmosphere', gm(FB, 'fx_1_rain'), S),
  P('fx_2_soundtrack_fb', 'Soundtrack', 'Soundtrack', 'Atmosphere', gm(FB, 'fx_2_soundtrack'), S),
  P('fx_3_crystal_fb', 'Crystal', 'Crystal', 'Atmosphere', gm(FB, 'fx_3_crystal')),
  P('fx_4_atmosphere_fb', 'Atmosphere', 'Atmos.', 'Atmosphere', gm(FB, 'fx_4_atmosphere')),
  P('fx_5_brightness_fb', 'Brightness', 'Brightness', 'Atmosphere', gm(FB, 'fx_5_brightness'), S),
  P('fx_6_goblins_fb', 'Goblins', 'Goblins', 'Atmosphere', gm(FB, 'fx_6_goblins'), S),
  P('fx_7_echoes_fb', 'Echoes', 'Echoes', 'Atmosphere', gm(FB, 'fx_7_echoes'), S),
  P('fx_8_scifi_fb', 'Sci-Fi', 'Sci-Fi', 'Atmosphere', gm(FB, 'fx_8_scifi'), S),
  // ——— Percussion+ ———
  P('synth_drums', 'Drum Kit', 'Drum Kit', 'Drums & Perc', synth('drums')),
  P('agogo_fb', 'Agogo', 'Agogo', 'Drums & Perc', gm(FB, 'agogo')),
  P('woodblock_fb', 'Woodblock', 'Woodblock', 'Drums & Perc', gm(FB, 'woodblock')),
  P('melodic_tom_fb', 'Melodic Tom', 'Mel. Tom', 'Drums & Perc', gm(FB, 'melodic_tom')),
  P('synth_drum_fb', 'Synth Drum', 'Syn Drum', 'Drums & Perc', gm(FB, 'synth_drum')),
  P('reverse_cymbal_fb', 'Reverse Cymbal', 'Rev. Cym.', 'Drums & Perc', gm(FB, 'reverse_cymbal')),
  // ——— Synth Lab (generated, no download) ———
  P('synth_fm_epiano', 'FM Electric Piano', 'FM E.Piano', 'Synth Lab', synth('fm_epiano')),
  P('synth_fm_bell', 'FM Crystal Bell', 'FM Bell', 'Synth Lab', synth('fm_bell')),
  P('synth_pluck', 'String Pluck', 'Pluck', 'Synth Lab', synth('pluck')),
  P('synth_chip', '8-Bit Chiptune', '8-Bit', 'Synth Lab', synth('chip'), S),
  P('synth_supersaw', 'Supersaw', 'Supersaw', 'Synth Lab', synth('supersaw'), S),
  P('synth_glass_pad', 'Glass Pad', 'Glass Pad', 'Synth Lab', synth('glass_pad'), S),
  P('synth_sub_bass', 'Sub Bass', 'Sub Bass', 'Synth Lab', synth('sub_bass'), S),
  P('synth_theremin', 'Theremin', 'Theremin', 'Synth Lab', synth('theremin'), S),
  // ——— Sound FX ———
  P('bird_tweet_fb', 'Bird Tweet', 'Birds', 'Sound FX', gm(FB, 'bird_tweet')),
  P('seashore_fb', 'Seashore', 'Seashore', 'Sound FX', gm(FB, 'seashore'), S),
  P('applause_fb', 'Applause', 'Applause', 'Sound FX', gm(FB, 'applause'), S),
  P('telephone_ring_fb', 'Telephone', 'Telephone', 'Sound FX', gm(FB, 'telephone_ring')),
  P('helicopter_fb', 'Helicopter', 'Helicopter', 'Sound FX', gm(FB, 'helicopter'), S),
  P('breath_noise_fb', 'Breath', 'Breath', 'Sound FX', gm(FB, 'breath_noise')),
  P('guitar_fret_noise_fb', 'Fret Noise', 'Fret Noise', 'Sound FX', gm(FB, 'guitar_fret_noise')),
];

PRESETS.forEach((p, i) => {
  p.number = i + 1;
  p.extra = i >= 95;
});

export const PRESET_BY_ID = new Map(PRESETS.map((p) => [p.id, p]));
export const GROUPS = [...new Set(PRESETS.map((p) => p.group))];
export const DEFAULT_PRESET = 'grand_piano';

/** Relative paths (under /sounds) of every file a preset needs. */
export function soundFiles(preset) {
  const src = preset.src;
  switch (src.type) {
    case 'salamander':
      return SALAMANDER_ROOTS.map((m) => `salamander/${salamanderName(m)}.mp3`);
    case 'gm':
      return [`gm/${src.bank}/${src.name}-${src.fmt}.js`];
    case 'studio':
      return src.notes.map((n) => `studio/${src.name}/${n}.mp3`);
    default:
      return [];
  }
}
