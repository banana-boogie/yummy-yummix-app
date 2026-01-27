# Test Audio Files

This directory contains audio files for testing the AI Voice endpoint.

## Required Files

For complete voice testing, create these files:

| File | Description | Duration |
|------|-------------|----------|
| `test_silent.m4a` | Silent audio | 1 second |
| `test_phrase_en.m4a` | "Show me easy Italian recipes" | 2-3 seconds |
| `test_phrase_es.m4a` | "Buscar recetas mexicanas" | 2-3 seconds |

## Generating Test Audio

### Option 1: FFmpeg (Silent Audio)

```bash
# Generate 1 second of silent audio
ffmpeg -f lavfi -i anullsrc=r=44100:cl=mono -t 1 -q:a 9 -acodec libmp3lame test_silent.mp3

# Convert to m4a if needed
ffmpeg -i test_silent.mp3 -c:a aac test_silent.m4a
```

### Option 2: macOS say command

```bash
# Generate English phrase
say -v Samantha "Show me easy Italian recipes" -o test_phrase_en.aiff
ffmpeg -i test_phrase_en.aiff -c:a aac test_phrase_en.m4a

# Generate Spanish phrase
say -v Paulina "Buscar recetas mexicanas" -o test_phrase_es.aiff
ffmpeg -i test_phrase_es.aiff -c:a aac test_phrase_es.m4a
```

### Option 3: Record Manually

Use Voice Memos or any audio recording app to record the test phrases.

## Test Usage

The voice test script (`test-voice.sh`) will:
1. Check if test audio files exist
2. Fall back to generating silent audio with ffmpeg if available
3. Skip audio-dependent tests if no audio is available

```bash
# Run voice tests with auto-generated audio
./test-voice.sh "$JWT"

# Run voice tests with specific audio file
./test-voice.sh "$JWT" ./audio/test_phrase_en.m4a
```

## Notes

- The voice endpoint accepts audio in various formats (m4a, mp3, wav)
- Audio is sent as base64-encoded data
- Silent audio will result in empty/minimal transcription
- Real phrase audio tests transcription accuracy
