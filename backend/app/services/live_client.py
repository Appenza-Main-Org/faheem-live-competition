"""
LiveClient — clean wrapper around the Gemini Live API.

Design goals:
- Audio path  : run(receive_audio, send_audio, config)   — Gemini Live API
- Text path   : generate_text_reply(user_text, ...)      — standard text API
- Stub mode (GEMINI_STUB=true) lets the full pipeline be tested locally
  without any API calls or credentials
- google.genai imports are deferred so the module is always importable
- Tool call dispatch is delegated to TutorAgent
"""

import asyncio
import base64
import logging

from app.config import get_settings
from app.models.schemas import SessionConfig

logger = logging.getLogger(__name__)
settings = get_settings()


class LiveClient:
    """
    Bridges a browser WebSocket audio stream with the Gemini Live API.

    Usage:
        client = LiveClient(agent=tutor_agent)
        await client.run(receive_audio=..., send_audio=..., config=session_config)
    """

    def __init__(self, agent) -> None:
        self._agent = agent
        self._stub = settings.gemini_stub

    # ── Public interface ───────────────────────────────────────────────────────

    async def run(
        self,
        receive_audio,   # async () -> bytes | None   (None signals end-of-stream)
        send_audio,      # async (bytes) -> None
        config: SessionConfig,
    ) -> None:
        """
        Open a Gemini Live session and bridge audio bidirectionally until the
        browser disconnects (receive_audio returns None).
        """
        if self._stub:
            await self._run_stub(receive_audio, send_audio, config)
        else:
            await self._run_live(receive_audio, send_audio, config)

    # ── Live mode ──────────────────────────────────────────────────────────────

    async def _run_live(
        self,
        receive_audio,
        send_audio,
        config: SessionConfig,
    ) -> None:
        """Real Gemini Live connection. Imports google.genai lazily."""
        from google import genai
        from google.genai import types

        live_config = self._agent.build_live_config()
        client = genai.Client(api_key=settings.gemini_api_key)

        async with client.aio.live.connect(
            model=settings.gemini_model,
            config=live_config,
        ) as session:
            logger.info("Gemini Live session opened [%s]", config.session_id)

            upstream_task = asyncio.create_task(
                self._upstream(session, receive_audio, config)
            )
            downstream_task = asyncio.create_task(
                self._downstream(session, send_audio, config)
            )

            # Upstream exits when browser sends None (disconnect or END).
            # Cancel downstream so the async-for loop on session.receive() stops.
            await upstream_task
            downstream_task.cancel()
            try:
                await downstream_task
            except asyncio.CancelledError:
                pass

        logger.info("Gemini Live session closed [%s]", config.session_id)

    async def _upstream(self, session, receive_audio, config: SessionConfig) -> None:
        """Forward browser PCM chunks to Gemini."""
        from google.genai import types

        try:
            while True:
                chunk = await receive_audio()
                if chunk is None:
                    logger.info("End-of-stream [%s]", config.session_id)
                    break
                await session.send_realtime_input(
                    audio=types.Blob(
                        data=chunk,
                        mime_type="audio/pcm;rate=16000",
                    )
                )
        except Exception as exc:
            logger.error("Upstream error [%s]: %s", config.session_id, exc)

    async def _downstream(self, session, send_audio, config: SessionConfig) -> None:
        """Forward Gemini responses (audio + tool calls) to the browser."""
        from google.genai import types

        try:
            async for response in session.receive():
                # ── Tool call ──────────────────────────────────────────────────
                if response.tool_call:
                    results = await self._agent.dispatch_tool_calls(
                        response.tool_call
                    )
                    await session.send_tool_response(
                        function_responses=[
                            types.FunctionResponse(
                                name=r["name"], response=r["result"]
                            )
                            for r in results
                        ]
                    )
                    continue

                # ── Audio output ───────────────────────────────────────────────
                if (
                    response.server_content
                    and response.server_content.model_turn
                ):
                    for part in response.server_content.model_turn.parts:
                        if part.inline_data and part.inline_data.data:
                            await send_audio(part.inline_data.data)

        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.error("Downstream error [%s]: %s", config.session_id, exc)

    # ── Text reply (non-Live, standard generate API) ───────────────────────────

    async def generate_text_reply(
        self,
        user_text: str,
        system_prompt: str,
        history: list[dict],
    ) -> str:
        """
        Generate a single Faheem text reply using the standard Gemini text API.

        Intentionally separate from the Live audio path so text-only round trips
        don't require opening a full Live session.

        Args:
            user_text:     The student's latest message.
            system_prompt: Faheem's system prompt (from TutorAgent.system_prompt).
            history:       Prior turns as [{"role": "user"|"model", "text": "..."}].
                           Grows across the session for multi-turn context.

        Returns:
            Gemini's text reply string, or a fallback on error.
        """
        if self._stub:
            return f"[Stub] You said: {user_text}"
        return await self._call_text_api(user_text, system_prompt, history)

    async def _call_text_api(
        self,
        user_text: str,
        system_prompt: str,
        history: list[dict],
    ) -> str:
        """Non-streaming Gemini text generation. Imports google.genai lazily."""
        from google import genai
        from google.genai import types

        gai_client = genai.Client(api_key=settings.gemini_api_key)

        # Build conversation contents from accumulated history
        contents = [
            types.Content(
                role=entry["role"],
                parts=[types.Part(text=entry["text"])],
            )
            for entry in history
        ]
        # Append the new user turn
        contents.append(
            types.Content(role="user", parts=[types.Part(text=user_text)])
        )

        try:
            response = await gai_client.aio.models.generate_content(
                model=settings.gemini_text_model,
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                ),
            )
            return response.text or ""
        except Exception as exc:
            logger.error("Text API error: %s", exc)
            return "Sorry, I ran into a problem. Please try again."

    # ── Image reply (multimodal, standard generate API) ───────────────────────

    async def generate_image_reply(
        self,
        image_b64: str,
        mime_type: str,
        caption: str,
        system_prompt: str,
        history: list[dict],
    ) -> str:
        """
        Generate a Faheem reply for an uploaded image using the Gemini multimodal API.

        Args:
            image_b64:     Base64-encoded image data (no data-URL prefix).
            mime_type:     MIME type (e.g. "image/png", "image/jpeg").
            caption:       Optional student caption / question about the image.
            system_prompt: Faheem's system prompt.
            history:       Prior text turns for conversational context.

        Returns:
            Gemini's text reply string, or a fallback on error.
        """
        if self._stub:
            return (
                f"[Stub] I see your image! — أرى صورتك! "
                f"{'You wrote: ' + caption + ' — ' if caption else ''}"
                "What would you like to learn from it?"
            )
        return await self._call_image_api(image_b64, mime_type, caption, system_prompt, history)

    async def _call_image_api(
        self,
        image_b64: str,
        mime_type: str,
        caption: str,
        system_prompt: str,
        history: list[dict],
    ) -> str:
        """Non-streaming Gemini multimodal generation. Imports google.genai lazily."""
        from google import genai
        from google.genai import types

        gai_client = genai.Client(api_key=settings.gemini_api_key)

        # Build conversation history from prior text turns
        contents = [
            types.Content(
                role=entry["role"],
                parts=[types.Part(text=entry["text"])],
            )
            for entry in history
        ]

        # Build the new user turn: image part + optional caption text
        try:
            image_bytes = base64.b64decode(image_b64)
        except Exception as exc:
            logger.error("Failed to decode image base64: %s", exc)
            return "Sorry, I couldn't read that image. Please try again."

        user_parts = [
            types.Part(
                inline_data=types.Blob(data=image_bytes, mime_type=mime_type)
            )
        ]
        if caption:
            user_parts.append(types.Part(text=caption))

        contents.append(types.Content(role="user", parts=user_parts))

        try:
            response = await gai_client.aio.models.generate_content(
                model=settings.gemini_text_model,
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                ),
            )
            return response.text or ""
        except Exception as exc:
            logger.error("Image API error: %s", exc)
            return "Sorry, I had trouble analysing that image. Please try again."

    # ── Stub mode ──────────────────────────────────────────────────────────────

    async def _run_stub(
        self,
        receive_audio,
        send_audio,
        config: SessionConfig,
    ) -> None:
        """
        Stub mode: drains incoming audio and echoes silence back.

        Lets the entire pipeline (WebSocket → queue → client → WebSocket) be
        exercised end-to-end without a real Gemini API key.

        Set GEMINI_STUB=true in backend/.env to enable.
        """
        logger.warning(
            "LiveClient running in STUB mode — no Gemini API calls [%s]",
            config.session_id,
        )
        while True:
            chunk = await receive_audio()
            if chunk is None:
                break
            # Echo the same number of zero bytes so the browser audio pipeline
            # can be verified without real audio content.
            await send_audio(b"\x00" * len(chunk))
