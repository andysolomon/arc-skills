# Speech and audio: source notes

Read on 2026-11-23. The requested URL is a phase overview, so this set uses that overview and three of its linked lessons. It is a selection of lessons, not a summary of all 17. Individual author and publication date were not identified on the pages read.

## 01 — Cover

Source: [Speech & Audio, Phase 06](https://aiengineeringfromscratch.com/phase/speech-and-audio), lesson list and voice-assistant capstone entry.

The mechanical module is an original illustrative metaphor, not a literal architecture. The footer credits the source; the series does not claim to be official course artwork.

Alt text: A vintage microphone sends a blue audio ribbon through exposed gears to a speaker. The headline reads “From sound to conversation.”

## 02 — Filter before downsampling

Source: [Audio Fundamentals](https://aiengineeringfromscratch.com/learn/speech-and-audio/audio-fundamentals), “The Concept” (Nyquist-Shannon) and “Exercises,” item 2.

The three schematic signals share a low-frequency component. They are synthetic illustrations, not measured audio or a numerical filter simulation.

Alt text: A signal containing slow and fast components passes through a low-pass filter. The slow component remains, then appears as fewer discrete samples.

## 03 — Turn-taking

Source: [Voice Activity Detection & Turn-Taking](https://aiengineeringfromscratch.com/learn/speech-and-audio/voice-activity-detection-turn-taking), “The Problem,” semantic turn detector, and “Pitfalls.”

No fixed silence threshold or model-performance claim is carried into the image.

Alt text: Two bursts of speech separated by a blue pause are bracketed as one utterance. Speech detection and deciding whether the speaker is finished are shown as different questions.

## 04 — Interruptions

Source: [Build a Voice Assistant Pipeline](https://aiengineeringfromscratch.com/learn/speech-and-audio/voice-assistant-pipeline), “The seven components,” item 7, and “Build It,” step 5.

This depicts a cascaded architecture, not every possible speech-to-speech system. The user-speaking event is the interruption trigger.

Alt text: Transcription feeds a language model, then speech synthesis. When the user speaks, a blue branch cancels generation and stops playback before returning to listening.
