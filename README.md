# Nocturne Piano

A desktop virtual piano for Windows, modelled on onlinepianist.com's Virtual Piano, with the same sounds, sound engine, metronome, recorder, notepad and settings, plus extras.

## Run it

```bash
npm install        # first time only
npm start          # opens the app
```

- `npm run install-app` builds a standalone app in `dist/Nocturne Piano/` and adds **Nocturne Piano** shortcuts to the Desktop and the Start menu.
- `npm run pack` builds the same folder without adding shortcuts.
- `npm run installer` builds an NSIS setup `.exe` with electron-builder. It downloads its build tools the first time.

## What's inside

| Feature | Details |
| --- | --- |
| Sounds | 162 instruments. Entries 001–095 match the original list and use the same open-source samples: Salamander Grand Piano, plus the MusyngKite, FluidR3 and FatBoy soundfonts. Entries 096–162 are extras: real recorded studio instruments (harmonium, solo violin and cello, flutes, brass), world instruments, synth leads and pads, atmospheres, a drum kit, sound effects and a synth lab. |
| Sound engine | Reproduces the original signal chain: 5.5 kHz warm filter, 1.8 s room reverb at 15 %, 0.35 s key release, half-pedal release of 3 s (1.2 s for held tones), and the last 0.8 s of each sample faded out. The Concert Grand's samples are trimmed and level-matched to the original's measured values. |
| Sustain | Full pedal, half pedal or off, from the toolbar button or the Space bar, and a MIDI sustain pedal is supported. |
| Keyboard | Real, Full or Custom PC key layouts, octave shift, transpose, CDE or Do Re Mi labels, and a 5-octave Focus view or all 88 keys (Max). |
| MIDI | Connect any USB MIDI keyboard. Velocity sensitivity is optional. |
| Metronome | The original beep sound plus Click, Woodblock and Cowbell. Tempo runs 20–300 BPM with tap tempo, and there are 13 time signatures. Tempo and time signature change without stopping the beat. |
| Recorder | Four layered tracks with overdubbing and a count-in. Each track can be included in or left out of the mix. Exports to MP3, WAV or MIDI. |
| Songs | 32 public-domain songs, playable in Demo, Play Along (with scoring) or Practice mode (it waits for you). You can choose your hand and set the speed from 25 % to 150 %. Notes show as a letter strip (QWERTY or CDE) or as falling notes (Waterfall). You can import your own `.mid` files or note scripts. |
| Notepad | Paste & Play. Every key you play is written down, and you can paste note names (`C D E [C E G]`) or PC-key sheets (`[tu] y t`) and play them back at any tempo. |
| Look | Themes in six accent colours, a light show of glowing notes above the keys, full screen (F11), and a custom title bar. |

## Offline sounds

Every sound is saved in `sounds/` (about 430 MB), so the app works without internet. `npm run sounds` downloads anything that's missing.
In the installed app, sounds you use are also cached in `%APPDATA%/Nocturne Piano/sounds`.

## Shortcuts

| Action | Key |
| --- | --- |
| Sustain on/off | Space |
| Octave down/up | `[` `]` |
| Transpose down/up | `-` `=` |
| Previous/next sound | ← → |
| Close panel | Esc |
| Full screen | F11 |
| Play the notepad | Ctrl+Enter |

## Development

- `npm run dev` serves the interface at http://localhost:5178 so you can work on it in a normal browser.
- `npm run check-songs` checks that every bar of every built-in song adds up.
- `npm run icon` redraws `build/icon.png`.

## Credits and licences

- Salamander Grand Piano by Alexander Holm, CC-BY 3.0
- FluidR3_GM (CC-BY 3.0), MusyngKite (CC-BY-SA 3.0) and FatBoy soundfonts, via Benjamin Gleitzman's midi-js-soundfonts
- tonejs-instruments samples by Nicholaus Brosowsky, CC-BY 3.0
- lamejs (MP3 encoding) and @tonejs/midi (MIDI files)
- The songs are public-domain works, arranged for this app.
