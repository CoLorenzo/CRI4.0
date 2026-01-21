import { Router } from 'express';
import * as controllers from './controllers';

export const router = Router();

router.get('/docker-images', controllers.getDockerImages);
router.post('/docker-build', controllers.buildDockerImage);
router.post('/docker-inspect', controllers.getContainerInspect);
router.post('/docker-logs', controllers.getContainerLogs);
router.post('/simulate-attack', controllers.simulateAttack);
router.post('/run-simulation', controllers.runSimulation);
router.post('/stop-simulation', controllers.stopSimulation);

// SSE for logs
router.get('/logs', controllers.subscribeToLogs);
