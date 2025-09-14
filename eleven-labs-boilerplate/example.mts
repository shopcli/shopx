import { ElevenLabsClient, play } from '@elevenlabs/elevenlabs-js';
import 'dotenv/config';

const elevenlabs = new ElevenLabsClient();

const audio = await elevenlabs.textToSpeech.convert('yj30vwTGJxSHezdAGsv9', {
  text: 'Coffee order number three? At this rate, your blood type is going to change to Dark Roast. Should I start a caffeine intervention hotline?',
  modelId: 'eleven_multilingual_v2',
  outputFormat: 'mp3_44100_128',
});

await play(audio);
