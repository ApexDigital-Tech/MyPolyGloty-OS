#!/usr/bin/env python3
"""
Test del Actuador FFmpeg en Segundo Plano - MyPolyGloty OS (Sprint 1)
Valida que FFmpeg 9.0.2 aísle milimétricamente el fonema o sílaba errónea
utilizando las marcas de tiempo [startMs, endMs] calculadas por el motor fonético.
"""

import os
import subprocess

AUDIO_DIR = os.path.join(os.path.dirname(__file__), "..", "benchmarks", "phonetic_dataset", "audio")
CLIPS_DIR = os.path.join(os.path.dirname(__file__), "..", "benchmarks", "phonetic_dataset", "clips")

def extract_failing_clip(wav_name, start_ms, end_ms, output_name):
    os.makedirs(CLIPS_DIR, exist_ok=True)
    input_wav = os.path.join(AUDIO_DIR, wav_name)
    output_wav = os.path.join(CLIPS_DIR, output_name)

    start_sec = start_ms / 1000.0
    end_sec = end_ms / 1000.0
    duration_sec = (end_ms - start_ms) / 1000.0

    # Comando FFmpeg preciso: -ss antes de -i para seek rápido o después para seek a nivel de muestra
    cmd = [
        "ffmpeg", "-y",
        "-ss", f"{start_sec:.3f}",
        "-i", input_wav,
        "-t", f"{duration_sec:.3f}",
        "-c:a", "pcm_s16le",
        "-ar", "16000",
        "-ac", "1",
        output_wav
    ]

    print(f"[*] Ejecutando actuador FFmpeg: {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.returncode == 0:
        file_size = os.path.getsize(output_wav)
        print(f"[OK] Clip de error aislado con éxito: {output_name} ({file_size} bytes, {duration_sec*1000:.0f}ms)")
        return True
    else:
        print(f"[ERROR] FFmpeg falló: {result.stderr}")
        return False

if __name__ == '__main__':
    # Caso de prueba tc-01 (/v/ vs /b/ en 'very', fallo en [20ms, 140ms])
    extract_failing_clip("tc-01-v-b-substitution.wav", 20, 140, "tc-01-isolated-error.wav")
    # Caso de prueba tc-15 (Mandarín Tono 1 vs Tono 4, fallo en [60ms, 320ms])
    extract_failing_clip("tc-15-mandarin-tone1-to-tone4.wav", 60, 320, "tc-15-isolated-tone-error.wav")
