import asyncio
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.gemini import run_gemini_bridge

logger = logging.getLogger(__name__)
router = APIRouter()


@router.websocket("/session")
async def session_ws(websocket: WebSocket):
    """
    WebSocket endpoint: /api/session

    Protocol:
    - Client sends binary frames: raw PCM audio (16kHz, 16-bit, mono)
    - Client sends text frame "END" to signal it is done speaking
    - Server sends binary frames: raw PCM audio (24kHz, 16-bit, mono) from Gemini
    - Server sends text frame {"type": "status", "value": "connected"} on open
    - Server sends text frame {"type": "error", "value": "..."} on failure
    """
    await websocket.accept()
    logger.info("WebSocket connection accepted")

    await websocket.send_json({"type": "status", "value": "connected"})

    # Queue for browser->Gemini audio
    audio_queue: asyncio.Queue[bytes | None] = asyncio.Queue()

    async def receive_from_browser() -> bytes | None:
        return await audio_queue.get()

    async def send_to_browser(audio_bytes: bytes) -> None:
        try:
            await websocket.send_bytes(audio_bytes)
        except Exception as exc:
            logger.warning("Failed to send audio to browser: %s", exc)

    async def receive_loop():
        try:
            while True:
                message = await websocket.receive()
                if "bytes" in message and message["bytes"]:
                    await audio_queue.put(message["bytes"])
                elif "text" in message:
                    if message["text"] == "END":
                        logger.info("Browser sent END signal")
                        await audio_queue.put(None)
                        break
        except WebSocketDisconnect:
            logger.info("WebSocket disconnected")
            await audio_queue.put(None)
        except Exception as exc:
            logger.error("Receive loop error: %s", exc)
            await audio_queue.put(None)

    receive_task = asyncio.create_task(receive_loop())
    bridge_task = asyncio.create_task(
        run_gemini_bridge(receive_from_browser, send_to_browser)
    )

    await asyncio.gather(receive_task, bridge_task, return_exceptions=True)
    logger.info("Session complete")
