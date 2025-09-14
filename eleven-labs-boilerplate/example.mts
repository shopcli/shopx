import {ElevenLabsClient, stream} from '@elevenlabs/elevenlabs-js';
import 'dotenv/config';

const elevenlabs = new ElevenLabsClient();

export async function speak(input: string) {
	const audio = await elevenlabs.textToSpeech.stream('yj30vwTGJxSHezdAGsv9', {
		text: input,
		modelId: 'eleven_multilingual_v2',
		outputFormat: 'mp3_44100_128',
	});
	await stream(audio);
}
