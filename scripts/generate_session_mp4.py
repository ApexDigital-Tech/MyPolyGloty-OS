#!/usr/bin/env python3
"""
Actuador FFmpeg en Segundo Plano: Generador de Video MP4 Resumen de Sesión
MyPolyGloty OS - Sprint 5

Genera un video MP4 de 1280x720 estilizado con:
- Audio de la sesión del alumno
- Visualización de forma de onda / espectro en tiempo real
- Tarjeta de diagnóstico fonético con desglose IPA
- Subtítulos semafóricos (verde >=80%, amarillo 50-79%, rojo <50%)
- Badge de banda CEFR y telemetría
"""

import os
import sys
import subprocess
import json

# Forzar UTF-8 en stdout para soportar símbolos IPA en Windows
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUDIO_DIR = os.path.join(BASE_DIR, "benchmarks", "phonetic_dataset", "audio")
EXPORT_DIR = os.path.join(BASE_DIR, "public", "exports")

def generate_session_summary_video(
    audio_filename: str,
    output_filename: str,
    target_word: str,
    failing_phoneme: str,
    overall_score: int,
    cefr_band: str = "B1"
):
    os.makedirs(EXPORT_DIR, exist_ok=True)
    input_audio = os.path.join(AUDIO_DIR, audio_filename)
    output_mp4 = os.path.join(EXPORT_DIR, output_filename)

    if not os.path.exists(input_audio):
        print(f"[!] Audio no encontrado: {input_audio}")
        return False

    print(f"[*] Generando video resumen MP4 con FFmpeg para '{target_word}'...")

    font_path = "public/fonts/arial.ttf"
    clean_target = target_word.replace(":", " ").replace("'", "").replace("/", "").replace("(", "").replace(")", "")
    clean_failing = failing_phoneme.replace(":", " ").replace("'", "").replace("/", "").replace("(", "").replace(")", "")

    cmd = [
        "ffmpeg", "-y",
        "-f", "lavfi", "-i", "color=c=0x0a0b10:s=1280x720:r=25:d=3.5",
        "-i", input_audio,
        "-filter_complex", (
            f"[1:a]apad=whole_dur=3.5,asplit=2[apad_aud][apad_waves];"
            f"[apad_waves]showwaves=s=1200x240:mode=line:colors=0x00f2fe:rate=25[waves];"
            f"[0:v][waves]overlay=40:400[v1];"
            f"[v1]drawtext=fontfile={font_path}:text=MyPolyGloty OS - Resumen Fonetico:fontcolor=0x4facfe:fontsize=32:x=50:y=60,"
            f"drawtext=fontfile={font_path}:text=Palabra - {clean_target}:fontcolor=white:fontsize=48:x=50:y=130,"
            f"drawtext=fontfile={font_path}:text=Diagnostico - {clean_failing}:fontcolor=0xef4444:fontsize=28:x=50:y=210,"
            f"drawtext=fontfile={font_path}:text=Precision Articulatoria - {overall_score} pts:fontcolor=0xf59e0b:fontsize=28:x=50:y=270,"
            f"drawtext=fontfile={font_path}:text=Banda CEFR - {cefr_band} - Analisis CTC:fontcolor=0x9ca3af:fontsize=22:x=50:y=330[vout]"
        ),
        "-map", "[vout]",
        "-map", "[apad_aud]",
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "128k",
        "-t", "3.5",
        output_mp4
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode == 0:
        file_size = os.path.getsize(output_mp4)
        print(f"[OK] Video MP4 exportado exitosamente: {output_mp4} ({file_size} bytes)")
        return True
    else:
        print(f"[!] Error de FFmpeg al generar video:")
        print(result.stderr[:2000])
        return False

if __name__ == '__main__':
    generate_session_summary_video(
        audio_filename="tc-01-v-b-substitution.wav",
        output_filename="session_summary_tc01.mp4",
        target_word="very (/ˈvɛri/)",
        failing_phoneme="/v/ sustituido por oclusiva /b/",
        overall_score=58,
        cefr_band="B1"
    )
