// Uji jalur render ASLI KolosalCut v1.4.3: drawTextOverlay dari kc-engine
// (dipakai semua mesin: kilat & Turbo WebCodecs) + bingkai judul
import { drawTextOverlay } from "../../src/lib/kc-engine/engine";
import * as tf from "../../src/lib/kc-engine/titleFrames";
(window as unknown as Record<string, unknown>).NovaDraw = { drawTextOverlay };
(window as unknown as Record<string, unknown>).NovaTitleFrames = tf;
