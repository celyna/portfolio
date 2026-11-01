import './style.css';
import { SigilScene } from './sigil-scene';

const canvas = document.querySelector<HTMLCanvasElement>('#sigils');
if (!canvas) throw new Error('Homepage canvas is missing');

const scene = new SigilScene(canvas);

// Avoid duplicate observers and animation loops during local development.
if (import.meta.hot) import.meta.hot.dispose(() => scene.destroy());
