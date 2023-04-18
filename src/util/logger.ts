import pino from 'pino';
import { Stage } from '../model/stage';

const stage = process.env.STAGE ?? Stage.LOCAL;

console.debug('stage', stage);
const loggerConfig = {
    name: 'VestBot',
    level: stage === Stage.LOCAL || stage === Stage.ALPHA ? 'debug' : 'info',
    ...(stage === Stage.LOCAL && {
        transport: {
            target: 'pino-pretty',
        },
    }),
};

export const logger = pino(loggerConfig);