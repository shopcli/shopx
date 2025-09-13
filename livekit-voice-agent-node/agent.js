import { WorkerOptions, cli, defineAgent, voice, } from '@livekit/agents';
import * as cartesia from '@livekit/agents-plugin-cartesia';
import * as deepgram from '@livekit/agents-plugin-deepgram';
import * as livekit from '@livekit/agents-plugin-livekit';
import * as openai from '@livekit/agents-plugin-openai';
import * as silero from '@livekit/agents-plugin-silero';
import { BackgroundVoiceCancellation } from '@livekit/noise-cancellation-node';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
export default defineAgent({
    prewarm: async (proc) => {
        proc.userData.vad = await silero.VAD.load();
    },
    entry: async (ctx) => {
        const vad = ctx.proc.userData.vad;
        const assistant = new voice.Agent({
            instructions: 'You are a helpful voice AI assistant.',
        });
        const session = new voice.AgentSession({
            vad,
            stt: new deepgram.STT({ model: 'nova-3' }),
            llm: new openai.LLM({ model: 'gpt-4o-mini' }),
            tts: new cartesia.TTS({
                model: 'sonic-2',
                voice: 'f786b574-daa5-4673-aa0c-cbe3e8534c02'
            }),
            turnDetection: new livekit.turnDetector.MultilingualModel(),
        });
        await session.start({
            agent: assistant,
            room: ctx.room,
            inputOptions: {
                // For telephony applications, use `TelephonyBackgroundVoiceCancellation` for best results
                noiseCancellation: BackgroundVoiceCancellation(),
            },
        });
        await ctx.connect();
        const handle = session.generateReply({
            instructions: 'Greet the user and offer your assistance.',
        });
    },
});
cli.runApp(new WorkerOptions({ agent: fileURLToPath(import.meta.url) }));
//# sourceMappingURL=agent.js.map