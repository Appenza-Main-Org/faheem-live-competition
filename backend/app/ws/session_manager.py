"""
session_manager — WebSocket session lifecycle for Faheem Live.

Responsibilities:
- Accept and authenticate the WebSocket connection
- Create a SessionConfig (with unique session_id)
- Wire the audio queue between the browser receive-loop and LiveClient
- Send status / recap JSON frames at session open and close
- Clean up on disconnect

WebSocket message protocol:
  Browser → Server:
    binary frame                                                  : raw PCM audio (16 kHz, 16-bit, mono)
    text  "END"                                                   : graceful stop signal
    text  {"type":"text","text":"..."}                            : student text message
    text  {"type":"image","mimeType":"...","data":"...","caption":"..."} : base64 image

  Server → Browser:
    {"type": "status",  "value": "connected", "session_id": "..."}   on open
    {"type": "message", "role": "tutor",      "text": "..."}         text reply
    binary frame                                                      audio response
    {"type": "recap",   "data": {...}}                                on close
    {"type": "error",   "value": "..."}                               on failure
"""

import asyncio
import json
import logging

from fastapi import WebSocket, WebSocketDisconnect

from app.agents.tutor_agent import TutorAgent
from app.models.schemas import SessionConfig
from app.services.live_client import LiveClient

logger = logging.getLogger(__name__)


async def handle_session(websocket: WebSocket) -> None:
    """
    Entry point called by the FastAPI WebSocket route.
    Manages the full lifecycle of one tutoring session.
    """
    await websocket.accept()

    config = SessionConfig()
    logger.info("Session started: %s", config.session_id)

    await websocket.send_json(
        {
            "type": "status",
            "value": "connected",
            "session_id": config.session_id,
        }
    )

    # Audio queue: receive_loop puts chunks here; LiveClient drains it
    audio_queue: asyncio.Queue[bytes | None] = asyncio.Queue()

    agent = TutorAgent()
    client = LiveClient(agent=agent)

    # Conversation history for multi-turn text context
    # Format: [{"role": "user"|"model", "text": "..."}]
    chat_history: list[dict] = []

    # ── Callables passed to LiveClient ─────────────────────────────────────────

    async def receive_audio() -> bytes | None:
        return await audio_queue.get()

    async def send_audio(audio_bytes: bytes) -> None:
        try:
            await websocket.send_bytes(audio_bytes)
        except Exception as exc:
            logger.warning("Failed to send audio [%s]: %s", config.session_id, exc)

    # ── Browser receive loop ────────────────────────────────────────────────────

    async def handle_text_message(raw: str) -> None:
        """Handle a non-END text frame from the browser."""
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            return

        msg_type = data.get("type")

        if msg_type == "text":
            student_text = str(data.get("text", ""))
            logger.info("Text message [%s]: %s", config.session_id, student_text)

            reply = await client.generate_text_reply(
                user_text=student_text,
                system_prompt=agent.system_prompt,
                history=chat_history,
            )

            # Extend history so next turn has full context
            chat_history.append({"role": "user", "text": student_text})
            chat_history.append({"role": "model", "text": reply})

            await websocket.send_json(
                {"type": "message", "role": "tutor", "text": reply}
            )

        elif msg_type == "image":
            mime = str(data.get("mimeType", "image/*"))
            caption = str(data.get("caption", "")).strip()
            image_b64 = str(data.get("data", ""))
            logger.info(
                "Image message [%s]: mime=%s caption=%r",
                config.session_id,
                mime,
                caption,
            )

            reply = await client.generate_image_reply(
                image_b64=image_b64,
                mime_type=mime,
                caption=caption,
                system_prompt=agent.system_prompt,
                history=chat_history,
            )

            # Record image turn in history as text so future turns have context
            history_text = f"[Image sent] {caption}" if caption else "[Image sent]"
            chat_history.append({"role": "user", "text": history_text})
            chat_history.append({"role": "model", "text": reply})

            await websocket.send_json(
                {"type": "message", "role": "tutor", "text": reply}
            )

    async def receive_loop() -> None:
        try:
            while True:
                message = await websocket.receive()
                if "bytes" in message and message["bytes"]:
                    await audio_queue.put(message["bytes"])
                elif "text" in message:
                    if message["text"] == "END":
                        logger.info("END received [%s]", config.session_id)
                        await audio_queue.put(None)
                        break
                    else:
                        await handle_text_message(message["text"])
        except WebSocketDisconnect:
            logger.info("WebSocket disconnected [%s]", config.session_id)
            await audio_queue.put(None)
        except Exception as exc:
            logger.error("Receive loop error [%s]: %s", config.session_id, exc)
            await audio_queue.put(None)

    # ── Run both tasks concurrently ────────────────────────────────────────────

    receive_task = asyncio.create_task(receive_loop())
    bridge_task = asyncio.create_task(
        client.run(receive_audio=receive_audio, send_audio=send_audio, config=config)
    )

    await asyncio.gather(receive_task, bridge_task, return_exceptions=True)

    # ── Session recap ──────────────────────────────────────────────────────────

    recap = agent.build_recap(config)
    try:
        await websocket.send_json({"type": "recap", "data": recap.model_dump()})
    except Exception:
        # WebSocket may already be closed if the browser disconnected
        pass

    logger.info("Session ended: %s", config.session_id)
