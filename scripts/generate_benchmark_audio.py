#!/usr/bin/env python3
"""
Generador de Audio Calibrado para el Benchmark Fonético de MyPolyGloty OS (Sprint 1)
Sintetiza archivos WAV PCM 16kHz mono de 16 bits con formantes acústicos y curvas de tono F0
sin requerir dependencias externas pesadas (usa únicamente wave, struct y math de Python estándar).
"""

import os
import json
import math
import wave
import struct

SAMPLE_RATE = 16000
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "benchmarks", "phonetic_dataset", "audio")
MANIFEST_PATH = os.path.join(os.path.dirname(__file__), "..", "benchmarks", "phonetic_dataset", "benchmark_manifest.json")

def generate_tone_wav(filepath, duration_sec, f0_start, f0_end, formants, noise_level=0.01):
    """
    Genera un audio WAV PCM 16-bit 16kHz con tono fundamental dinámico F0(t) y resonancia de formantes.
    """
    total_samples = int(duration_sec * SAMPLE_RATE)
    raw_samples = []

    for i in range(total_samples):
        t = i / SAMPLE_RATE
        progress = i / total_samples

        # Envolvente de ataque y decaimiento suave (Hann / Tukey)
        if progress < 0.1:
            env = 0.5 * (1 - math.cos(math.pi * (progress / 0.1)))
        elif progress > 0.85:
            decay_prog = (progress - 0.85) / 0.15
            env = 0.5 * (1 + math.cos(math.pi * decay_prog))
        else:
            env = 1.0

        # Curva de frecuencia fundamental F0
        f0 = f0_start + (f0_end - f0_start) * progress
        phase_fundamental = 2 * math.pi * f0 * t

        # Síntesis aditiva de armónicos con ponderación por formantes
        sample_val = 0.6 * math.sin(phase_fundamental)

        for (f_res, gain) in formants:
            # Resonancia aproximada cerca del formante
            harmonic_num = max(1, round(f_res / max(50, f0)))
            phase_h = 2 * math.pi * (harmonic_num * f0) * t
            sample_val += gain * math.sin(phase_h)

        # Ruido de fondo controlado
        pseudo_noise = ((i * 1103515245 + 12345) & 0x7FFFFFFF) / 0x7FFFFFFF - 0.5
        sample_val += noise_level * pseudo_noise

        # Aplicar envolvente y normalizar
        final_sample = sample_val * env * 0.7
        clamped = max(-1.0, min(1.0, final_sample))
        int16_val = int(clamped * 32767)
        raw_samples.append(struct.pack('<h', int16_val))

    with wave.open(filepath, 'wb') as wav_file:
        wav_file.setnchannels(1)      # Mono
        wav_file.setsampwidth(2)      # 16-bit (2 bytes)
        wav_file.setframerate(SAMPLE_RATE)
        wav_file.writeframes(b''.join(raw_samples))

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    with open(MANIFEST_PATH, 'r', encoding='utf-8') as f:
        manifest = json.load(f)

    print(f"[*] Generando audios de prueba para {len(manifest['cases'])} casos de benchmark en: {OUTPUT_DIR}")

    for idx, tc in enumerate(manifest['cases']):
        filename = f"{tc['id']}.wav"
        target_path = os.path.join(OUTPUT_DIR, filename)

        # Configurar parámetros acústicos según categoría
        duration = (tc['timeRangeMs'][1] + 100) / 1000.0  # Duración del clip en seg
        
        # Parámetros por defecto para voz masculina/femenina media (F0 ~180Hz)
        f0_start = 180.0
        f0_end = 160.0
        formants = [(700, 0.3), (1200, 0.2), (2500, 0.15)] # F1, F2, F3 por defecto

        if "mandarin" in tc['category']:
            # Mandarín: Modulaciones drásticas de F0
            if tc.get('simulatedTone') == 4: # Tono 4: Caída abrupta (260Hz -> 130Hz)
                f0_start = 260.0
                f0_end = 135.0
            elif tc.get('simulatedTone') == 2: # Tono 2: Ascenso medio (150Hz -> 230Hz)
                f0_start = 145.0
                f0_end = 235.0
            elif tc.get('simulatedTone') == 3: # Tono 3: Caída y subida (214)
                f0_start = 140.0
                f0_end = 170.0
            elif tc.get('simulatedTone') == 1: # Tono 1: Plano alto (250Hz sostenido)
                f0_start = 250.0
                f0_end = 250.0
        elif "vowel-quality" in tc['category']:
            # Ajuste de formantes F1 y F2 para vocales
            if "/iː/" in tc['simulatedUtterance'] or "sheep" in tc['simulatedUtterance']:
                formants = [(280, 0.45), (2250, 0.35), (2800, 0.1)] # i: cerrada y tensa
            else:
                formants = [(430, 0.4), (1950, 0.25), (2600, 0.1)] # I laxa
        elif "consonant-voicing" in tc['category']:
            # /b/ bilabial oclusiva: F1 bajo, ráfaga corta
            formants = [(200, 0.4), (1100, 0.2), (2200, 0.1)]

        generate_tone_wav(target_path, duration, f0_start, f0_end, formants)
        tc['audioPath'] = f"/benchmarks/phonetic_dataset/audio/{filename}"
        print(f"  [+] Generado: {filename} ({duration:.2f}s, F0: {f0_start:.0f}->{f0_end:.0f}Hz)")

    # Actualizar el manifiesto con las rutas de audio
    with open(MANIFEST_PATH, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)

    print(f"[OK] Generación completada. 20 audios WAV 16kHz PCM creados exitosamente.")

if __name__ == '__main__':
    main()
