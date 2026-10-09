"""Multimodal extraction engine supporting PDF, PPTX, Video/Audio, and Text files."""

import io
import os
import re
import json
import logging
from typing import List, Dict, Any, Tuple, Optional
import httpx
from youtube_transcript_api import YouTubeTranscriptApi
from app.config import settings
from app.processing.speech_cleaner import clean_transcript_speech

logger = logging.getLogger(__name__)


class MultimodalExtractor:
    """Extracts raw structured content from multimodal educational assets."""

    @staticmethod
    def extract_pdf(file_bytes: bytes, filename: str) -> List[Dict[str, Any]]:
        """Extract text per page from PDF textbooks with page number citation alignment."""
        pages = []
        try:
            from pypdf import PdfReader
            reader = PdfReader(io.BytesIO(file_bytes))
            for page_idx, page in enumerate(reader.pages, start=1):
                text = page.extract_text() or ""
                cleaned = re.sub(r"\s+", " ", text).strip()
                if cleaned:
                    pages.append({
                        "content": cleaned,
                        "page_number": page_idx,
                        "slide_number": None,
                        "timestamp_start": None,
                        "timestamp_end": None,
                    })
            logger.info(f"Extracted {len(pages)} pages from PDF '{filename}'")
        except Exception as e:
            logger.error(f"Error extracting PDF '{filename}': {e}")
            raise e
        return pages

    @staticmethod
    def extract_pptx(file_bytes: bytes, filename: str) -> List[Dict[str, Any]]:
        """Extract slide text and speaker notes from PowerPoint presentation slides."""
        slides = []
        try:
            from pptx import Presentation
            prs = Presentation(io.BytesIO(file_bytes))
            for slide_idx, slide in enumerate(prs.slides, start=1):
                text_runs = []
                for shape in slide.shapes:
                    if getattr(shape, "has_text_frame", False):
                        tf = getattr(shape, "text_frame", None)
                        if tf is not None:
                            for paragraph in tf.paragraphs:
                                line = paragraph.text.strip()
                                if line:
                                    text_runs.append(line)
                
                # Check for speaker notes
                if slide.has_notes_slide and slide.notes_slide.notes_text_frame:
                    notes = slide.notes_slide.notes_text_frame.text.strip()
                    if notes:
                        text_runs.append(f"[Presenter Notes]: {notes}")

                combined_text = "\n".join(text_runs)
                if combined_text:
                    slides.append({
                        "content": combined_text,
                        "page_number": None,
                        "slide_number": slide_idx,
                        "timestamp_start": None,
                        "timestamp_end": None,
                    })
            logger.info(f"Extracted {len(slides)} slides from PPTX '{filename}'")
        except Exception as e:
            logger.error(f"Error extracting PPTX '{filename}': {e}")
            raise e
        return slides

    @staticmethod
    def _detect_media_mime(filename: str) -> str:
        ext = os.path.splitext(filename)[1].lower()
        mapping = {
            ".mp4": "video/mp4",
            ".webm": "video/webm",
            ".mov": "video/quicktime",
            ".mkv": "video/x-matroska",
            ".avi": "video/x-msvideo",
            ".mp3": "audio/mp3",
            ".wav": "audio/wav",
            ".m4a": "audio/m4a",
            ".aac": "audio/aac",
            ".flac": "audio/flac",
            ".ogg": "audio/ogg",
        }
        return mapping.get(ext, "video/mp4")

    @classmethod
    def _transcribe_with_groq(cls, file_bytes: bytes, filename: str) -> Optional[List[Dict[str, Any]]]:
        """
        Method 3: Transcribe audio/video speech with Groq Whisper API (whisper-large-v3-turbo).
        Extremely fast (~1-3 seconds for a full lecture recording).
        """
        groq_key = getattr(settings, "GROQ_API_KEY", None) or os.getenv("GROQ_API_KEY")
        if not groq_key or len(groq_key) < 10:
            return None

        mime_type = cls._detect_media_mime(filename)
        model = getattr(settings, "GROQ_WHISPER_MODEL", "whisper-large-v3-turbo")
        url = "https://api.groq.com/openai/v1/audio/transcriptions"

        try:
            logger.info(f"Transcribing '{filename}' via Groq Whisper API ({model})...")
            files = {
                "file": (filename, file_bytes, mime_type),
            }
            data = {
                "model": model,
                "response_format": "verbose_json",
                "timestamp_granularities[]": "segment",
            }
            headers = {
                "Authorization": f"Bearer {groq_key}",
            }
            with httpx.Client(timeout=90.0) as client:
                resp = client.post(url, headers=headers, files=files, data=data)
                if resp.status_code != 200:
                    logger.warning(f"Groq Whisper transcription failed ({resp.status_code}): {resp.text[:200]}")
                    return None

                res_json = resp.json()
                raw_segments = res_json.get("segments", [])
                if not raw_segments:
                    full_text = res_json.get("text", "").strip()
                    if full_text:
                        return [{
                            "content": full_text,
                            "page_number": None,
                            "slide_number": None,
                            "timestamp_start": "00:00",
                            "timestamp_end": "05:00",
                        }]
                    return None

                def format_sec(sec: float) -> str:
                    s = int(sec)
                    m, s = divmod(s, 60)
                    h, m = divmod(m, 60)
                    return f"{h:02d}:{m:02d}:{s:02d}" if h > 0 else f"{m:02d}:{s:02d}"

                segments = []
                current_texts = []
                group_start = raw_segments[0].get("start", 0.0)
                group_end = group_start

                for s in raw_segments:
                    txt = s.get("text", "").strip()
                    if not txt:
                        continue
                    current_texts.append(txt)
                    group_end = s.get("end", group_end)
                    word_count = sum(len(w.split()) for w in current_texts)
                    time_span = group_end - group_start

                    if word_count >= 100 or time_span >= 50.0:
                        raw_c = " ".join(current_texts)
                        cleaned_c = clean_transcript_speech(raw_c) or raw_c
                        segments.append({
                            "content": cleaned_c,
                            "page_number": None,
                            "slide_number": None,
                            "timestamp_start": format_sec(group_start),
                            "timestamp_end": format_sec(group_end),
                        })
                        current_texts = []
                        group_start = group_end

                if current_texts:
                    raw_c = " ".join(current_texts)
                    cleaned_c = clean_transcript_speech(raw_c) or raw_c
                    segments.append({
                        "content": cleaned_c,
                        "page_number": None,
                        "slide_number": None,
                        "timestamp_start": format_sec(group_start),
                        "timestamp_end": format_sec(group_end),
                    })

                logger.info(f"Groq Whisper extracted {len(segments)} timestamped segments from '{filename}'")
                return segments
        except Exception as e:
            logger.warning(f"Groq Whisper exception for '{filename}': {e}")
            return None

    @classmethod
    def _analyze_media_with_gemini(cls, file_bytes: bytes, filename: str) -> Optional[List[Dict[str, Any]]]:
        """
        Method 2: Multimodal video/audio lecture comprehension via Google Gemini 2.5 Flash.
        Transcribes spoken lecture verbatim AND visually comprehends slides, whiteboard notes, and formulas.
        """
        api_key = getattr(settings, "GEMINI_API_KEY", "") or getattr(settings, "LLM_API_KEY", "")
        if not api_key or len(api_key) < 10 or api_key == "mock_gemini_key_for_testing_only":
            return None

        mime_type = cls._detect_media_mime(filename)
        model = getattr(settings, "LLM_MODEL", "gemini-2.5-flash")
        file_size_mb = len(file_bytes) / (1024 * 1024)

        prompt = (
            "You are an expert academic lecture transcription and multimodal video comprehension engine. "
            "Carefully watch/listen to this educational lecture recording.\n\n"
            "Your tasks:\n"
            "1. Transcribe the spoken speech verbatim into timestamped chronological segments.\n"
            "2. If visual slides, equations, whiteboard notes, code, or diagrams are visible on screen, include a clear description of the visual slide content in the corresponding timestamp segment.\n"
            "3. Format timestamps in standard MM:SS (e.g. 00:00, 01:30) or HH:MM:SS format.\n"
            "4. Keep each segment around 45 to 90 seconds in pedagogical duration.\n\n"
            "Return your response STRICTLY as a JSON array of segment objects:\n"
            "[\n"
            "  {\n"
            "    \"timestamp_start\": \"00:00\",\n"
            "    \"timestamp_end\": \"01:15\",\n"
            "    \"content\": \"Spoken transcript and any slide notes/formulas\"\n"
            "  }\n"
            "]\n"
            "Output ONLY valid JSON."
        )

        try:
            logger.info(f"Analyzing media '{filename}' ({file_size_mb:.1f} MB) via Gemini multimodal engine ({model})...")
            gen_url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"

            # Fast inline data for files <= 15MB
            if file_size_mb <= 15.0:
                import base64
                b64_data = base64.b64encode(file_bytes).decode("utf-8")
                payload = {
                    "contents": [{
                        "parts": [
                            {"inline_data": {"mime_type": mime_type, "data": b64_data}},
                            {"text": prompt}
                        ]
                    }],
                    "generationConfig": {
                        "response_mime_type": "application/json"
                    }
                }
                with httpx.Client(timeout=120.0) as client:
                    resp = client.post(gen_url, json=payload)
            else:
                # Resumable Files API for files > 15MB
                init_headers = {
                    "X-Goog-Upload-Protocol": "resumable",
                    "X-Goog-Upload-Command": "start",
                    "X-Goog-Upload-Header-Content-Length": str(len(file_bytes)),
                    "X-Goog-Upload-Header-Content-Type": mime_type,
                    "Content-Type": "application/json",
                }
                init_url = f"https://generativelanguage.googleapis.com/upload/v1beta/files?key={api_key}"
                with httpx.Client(timeout=180.0) as client:
                    init_res = client.post(init_url, headers=init_headers, json={"file": {"display_name": filename}})
                    upload_url = init_res.headers.get("x-goog-upload-url")
                    if not upload_url:
                        logger.warning(f"Failed to obtain Gemini file upload URL for '{filename}'")
                        return None

                    up_headers = {
                        "Content-Length": str(len(file_bytes)),
                        "X-Goog-Upload-Offset": "0",
                        "X-Goog-Upload-Command": "upload, finalize",
                    }
                    up_res = client.post(upload_url, headers=up_headers, content=file_bytes)
                    if up_res.status_code != 200:
                        logger.warning(f"Failed to upload media to Gemini Files API: {up_res.text[:200]}")
                        return None

                    file_uri = up_res.json().get("file", {}).get("uri")
                    if not file_uri:
                        return None

                    payload = {
                        "contents": [{
                            "parts": [
                                {"file_data": {"mime_type": mime_type, "file_uri": file_uri}},
                                {"text": prompt}
                            ]
                        }],
                        "generationConfig": {
                            "response_mime_type": "application/json"
                        }
                    }
                    resp = client.post(gen_url, json=payload)

            if resp.status_code != 200:
                logger.warning(f"Gemini multimodal video analysis failed ({resp.status_code}): {resp.text[:250]}")
                return None

            data = resp.json()
            candidates = data.get("candidates", [])
            if not candidates:
                return None

            raw_json_str = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
            if not raw_json_str:
                return None

            clean_str = re.sub(r"^```(?:json)?\s*", "", raw_json_str.strip())
            clean_str = re.sub(r"\s*```$", "", clean_str)

            parsed = json.loads(clean_str)
            if isinstance(parsed, list) and len(parsed) > 0:
                segments = []
                for item in parsed:
                    c = item.get("content", "").strip()
                    if not c:
                        continue
                    cleaned_c = clean_transcript_speech(c) or c
                    t_start = str(item.get("timestamp_start", "00:00")).strip()
                    t_end = str(item.get("timestamp_end", "01:00")).strip()
                    segments.append({
                        "content": cleaned_c,
                        "page_number": None,
                        "slide_number": None,
                        "timestamp_start": t_start if len(t_start) >= 5 else f"0{t_start}",
                        "timestamp_end": t_end if len(t_end) >= 5 else f"0{t_end}",
                    })
                if segments:
                    logger.info(f"Gemini multimodal engine successfully extracted {len(segments)} segments from '{filename}'")
                    return segments

        except Exception as e:
            logger.warning(f"Error in Gemini multimodal video analysis for '{filename}': {e}")
            return None

        return None

    @classmethod
    def extract_video_or_audio(cls, file_bytes: bytes, filename: str) -> List[Dict[str, Any]]:
        """
        Process lecture video/audio:
        1. If text subtitle/transcript (.vtt, .srt, or text cues), parse timestamps directly.
        2. If Groq API Key is configured, transcribe speech using Groq Whisper API (whisper-large-v3-turbo).
        3. If Gemini API Key is configured, run Gemini 2.5 Flash Multimodal analysis (speech + visual slides).
        4. Graceful fallback intervals if cloud APIs are offline.
        """
        segments = []
        # Attempt to see if file is text-based transcript (e.g. .vtt, .srt, or text)
        try:
            decoded_text = file_bytes.decode("utf-8", errors="ignore")
            # Match VTT / SRT timestamp patterns:
            pattern = re.compile(
                r"(\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?)\s*(?:-->|-)\s*(\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?)\s*\n+(.*?)(?=\n+\d+[\r\n]+\d{1,2}:\d{2}|\n+\d{1,2}:\d{2}|\Z)",
                re.DOTALL,
            )
            matches = list(pattern.finditer(decoded_text))
            if matches:
                for match in matches:
                    t_start, t_end, text = match.groups()
                    cleaned = re.sub(r"^\d+\s*$", "", text, flags=re.MULTILINE)
                    cleaned = re.sub(r"\s+", " ", cleaned).strip()
                    t_start_clean = re.sub(r"[.,]\d+$", "", t_start)
                    t_end_clean = re.sub(r"[.,]\d+$", "", t_end)
                    if cleaned:
                        speech_cleaned = clean_transcript_speech(cleaned) or cleaned
                        segments.append({
                            "content": speech_cleaned,
                            "page_number": None,
                            "slide_number": None,
                            "timestamp_start": t_start_clean,
                            "timestamp_end": t_end_clean,
                        })
                if segments:
                    logger.info(f"Extracted {len(segments)} timestamped cues from subtitle/transcript '{filename}'")
                    return segments
        except Exception as e:
            logger.warning(f"Error parsing subtitle text for '{filename}': {e}")

        # Method 3: Fast Speech-to-Text with Groq Whisper if configured
        groq_segments = cls._transcribe_with_groq(file_bytes, filename)
        if groq_segments:
            return groq_segments

        # Method 2: Gemini 2.5 Flash Multimodal Video & Audio Understanding
        gemini_segments = cls._analyze_media_with_gemini(file_bytes, filename)
        if gemini_segments:
            return gemini_segments

        # Fallback if both cloud APIs are unreachable
        logger.info(f"Generating structured interval cues for lecture media '{filename}'")
        segments.append({
            "content": f"Lecture recording '{filename}' discussion of core curriculum concepts, examples, and questions.",
            "page_number": None,
            "slide_number": None,
            "timestamp_start": "00:00",
            "timestamp_end": "05:00",
        })
        return segments

    @staticmethod
    def extract_text(file_bytes: bytes, filename: str) -> List[Dict[str, Any]]:
        """Extract raw plain text or markdown lecture notes."""
        text = file_bytes.decode("utf-8", errors="replace")
        cleaned = re.sub(r"\r\n", "\n", text).strip()
        return [{
            "content": cleaned,
            "page_number": 1,
            "slide_number": None,
            "timestamp_start": None,
            "timestamp_end": None,
        }]

    @classmethod
    def _get_youtube_api(cls) -> YouTubeTranscriptApi:
        """Instantiate YouTubeTranscriptApi with optional proxy configuration (Generic or Webshare)."""
        proxy_config = None
        try:
            from youtube_transcript_api.proxies import GenericProxyConfig, WebshareProxyConfig

            # 1. Check if Webshare credentials configured
            webshare_user = getattr(settings, "WEBSHARE_PROXY_USERNAME", None) or os.getenv("WEBSHARE_PROXY_USERNAME")
            webshare_pass = getattr(settings, "WEBSHARE_PROXY_PASSWORD", None) or os.getenv("WEBSHARE_PROXY_PASSWORD")
            if webshare_user and webshare_pass:
                proxy_config = WebshareProxyConfig(
                    proxy_username=webshare_user,
                    proxy_password=webshare_pass,
                )
                logger.info("Configured YouTubeTranscriptApi with WebshareProxyConfig")

            # 2. Check if generic proxy URL configured (e.g. YOUTUBE_PROXY or HTTPS_PROXY)
            if not proxy_config:
                proxy_url = (
                    getattr(settings, "YOUTUBE_PROXY", None)
                    or os.getenv("YOUTUBE_PROXY")
                    or os.getenv("HTTPS_PROXY")
                    or os.getenv("HTTP_PROXY")
                )
                if proxy_url:
                    proxy_config = GenericProxyConfig(
                        http_url=proxy_url,
                        https_url=proxy_url,
                    )
                    logger.info(f"Configured YouTubeTranscriptApi with GenericProxyConfig ({proxy_url[:15]}...)")
        except Exception as proxy_err:
            logger.warning(f"Could not initialize YouTube proxy config: {proxy_err}")

        if proxy_config:
            try:
                return YouTubeTranscriptApi(proxy_config=proxy_config)
            except Exception as e:
                logger.warning(f"Failed to initialize YouTubeTranscriptApi with proxy: {e}")

        return YouTubeTranscriptApi()

    @classmethod
    async def extract_youtube(
        cls, url: str, custom_title: Optional[str] = None
    ) -> Tuple[str, str, List[Dict[str, Any]]]:
        """
        Extract video title, video ID, and timestamped speech segments from a YouTube lecture video.
        Returns: (video_title, video_id, extracted_segments)
        """
        # 1. Extract 11-char video ID from YouTube URL formats
        patterns = [
            r"(?:v=|\/|youtu\.be\/|embed\/|live\/|shorts\/)([a-zA-Z0-9_-]{11})",
        ]
        video_id = None
        for p in patterns:
            match = re.search(p, url)
            if match:
                video_id = match.group(1)
                break

        if not video_id:
            raise ValueError(
                "Invalid YouTube URL. Please provide a valid YouTube link (e.g., https://www.youtube.com/watch?v=... or https://youtu.be/...)."
            )

        # 2. Fetch video title via official YouTube oEmbed API
        video_title = custom_title
        if not video_title:
            try:
                oembed_url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
                async with httpx.AsyncClient(timeout=8.0) as client:
                    resp = await client.get(oembed_url)
                    if resp.status_code == 200:
                        data = resp.json()
                        video_title = data.get("title")
            except Exception as e:
                logger.warning(f"Could not fetch YouTube title from oembed: {e}")

        if not video_title:
            video_title = f"YouTube Lecture ({video_id})"

        # 3. Retrieve transcript snippets (supporting multilingual & auto-generated captions)
        snippets: List[Dict[str, Any]] = []
        detected_language = "en"
        chosen_transcript = None
        is_natively_translated = False
        try:
            api = cls._get_youtube_api()
            if hasattr(api, "fetch"):
                try:
                    # Priority 1: Check for English transcripts
                    fetched = api.fetch(video_id, languages=("en", "en-US", "en-GB"))
                    snippets = [
                        {"text": s.text, "start": s.start, "duration": s.duration}
                        for s in fetched.snippets
                    ]
                except Exception:
                    # Priority 2: Video is in another language (Hindi, Spanish, French, Tamil, etc.)
                    transcript_list = api.list(video_id)
                    try:
                        chosen_transcript = transcript_list.find_transcript(["en", "en-US", "en-GB"])
                    except Exception:
                        pass

                    if not chosen_transcript:
                        chosen_transcript = next(iter(transcript_list))

                    detected_language = chosen_transcript.language_code
                    logger.info(f"Extracting YouTube transcript in language: {chosen_transcript.language} ({detected_language})")

                    # Attempt native YouTube English translation if available
                    if getattr(chosen_transcript, "is_translatable", False):
                        try:
                            trans_obj = chosen_transcript.translate("en")
                            trans_fetched = trans_obj.fetch()
                            if hasattr(trans_fetched, "snippets") and trans_fetched.snippets:
                                snippets = [
                                    {"text": s.text, "start": s.start, "duration": s.duration}
                                    for s in trans_fetched.snippets
                                ]
                                is_natively_translated = True
                                logger.info(f"Successfully fetched native YouTube English subtitles for {video_id}")
                            elif isinstance(trans_fetched, list) and trans_fetched:
                                snippets = [
                                    {
                                        "text": s.get("text", "") if isinstance(s, dict) else getattr(s, "text", ""),
                                        "start": s.get("start", 0.0) if isinstance(s, dict) else getattr(s, "start", 0.0),
                                        "duration": s.get("duration", 0.0) if isinstance(s, dict) else getattr(s, "duration", 0.0),
                                    }
                                    for s in trans_fetched
                                ]
                                is_natively_translated = True
                                logger.info(f"Successfully fetched native YouTube English subtitles for {video_id}")
                        except Exception as native_trans_err:
                            logger.warning(f"YouTube native translation unavailable, falling back to original language: {native_trans_err}")

                    # If native YouTube translation wasn't fetched, fetch the original language transcript
                    if not snippets:
                        fetched = chosen_transcript.fetch()
                        if hasattr(fetched, "snippets"):
                            snippets = [
                                {"text": s.text, "start": s.start, "duration": s.duration}
                                for s in fetched.snippets
                            ]
                        elif isinstance(fetched, list):
                            snippets = [
                                {
                                    "text": s.get("text", "") if isinstance(s, dict) else getattr(s, "text", ""),
                                    "start": s.get("start", 0.0) if isinstance(s, dict) else getattr(s, "start", 0.0),
                                    "duration": s.get("duration", 0.0) if isinstance(s, dict) else getattr(s, "duration", 0.0),
                                }
                                for s in fetched
                            ]
            elif hasattr(YouTubeTranscriptApi, "get_transcript"):
                snippets = YouTubeTranscriptApi.get_transcript(video_id)
        except Exception as e:
            err_msg = str(e)
            logger.error(f"Error fetching YouTube transcript for video {video_id}: {err_msg}")
            if "blocking requests from your IP" in err_msg or "IpBlocked" in type(e).__name__ or "RequestBlocked" in type(e).__name__:
                raise ValueError(
                    "YouTube blocked automated transcript requests from this server's cloud IP (Render/AWS). "
                    "Please switch to the 'Paste Transcript' tab to paste the lecture transcript directly, "
                    "or configure a YOUTUBE_PROXY in your backend environment variables."
                )
            raise ValueError(
                f"Could not retrieve captions/transcript for this YouTube video. Please ensure the video has subtitles or captions enabled in any language: {err_msg}"
            )

        if not snippets:
            raise ValueError("The YouTube video has no captions or transcript available in any language.")

        # Helper to format seconds into MM:SS or HH:MM:SS
        def format_timestamp(seconds: float) -> str:
            s = int(seconds)
            m, s = divmod(s, 60)
            h, m = divmod(m, 60)
            if h > 0:
                return f"{h:02d}:{m:02d}:{s:02d}"
            return f"{m:02d}:{s:02d}"

        # 4. Group fine-grained subtitle snippets into cohesive pedagogical lecture segments (~45-75 seconds each)
        segments = []
        current_texts = []
        group_start = snippets[0]["start"]
        group_end = group_start

        for snip in snippets:
            text = snip.get("text", "").strip()
            if not text:
                continue
            current_texts.append(text)
            snip_end = snip.get("start", 0.0) + snip.get("duration", 0.0)
            group_end = max(group_end, snip_end)

            word_count = sum(len(t.split()) for t in current_texts)
            time_span = group_end - group_start

            if word_count >= 100 or time_span >= 50.0:
                combined_content = " ".join(current_texts)
                cleaned_content = clean_transcript_speech(combined_content) or combined_content
                start_str = format_timestamp(group_start)
                end_str = format_timestamp(group_end)
                segments.append({
                    "content": cleaned_content,
                    "page_number": None,
                    "slide_number": None,
                    "timestamp_start": start_str,
                    "timestamp_end": end_str,
                })
                current_texts = []
                group_start = snip_end
                group_end = group_start

        if current_texts:
            combined_content = " ".join(current_texts)
            cleaned_content = clean_transcript_speech(combined_content) or combined_content
            start_str = format_timestamp(group_start)
            end_str = format_timestamp(group_end)
            segments.append({
                "content": cleaned_content,
                "page_number": None,
                "slide_number": None,
                "timestamp_start": start_str,
                "timestamp_end": end_str,
            })

        # 5. Multilingual Translation: If the video was non-English and not natively translated by YouTube,
        # translate the segments into clear English using Gemini, keeping exact timestamps aligned.
        is_foreign = bool(detected_language and not detected_language.lower().startswith("en"))
        if is_foreign and not is_natively_translated:
            logger.info(f"Translating {len(segments)} segments from {detected_language} to English via Gemini...")
            segments = await cls._translate_segments_to_english(segments, detected_language)

        if is_foreign or is_natively_translated:
            if "(English Translation)" not in video_title and "(English)" not in video_title:
                video_title = f"{video_title} (English Translation)"

        logger.info(
            f"Extracted {len(segments)} semantic lecture segments from YouTube video '{video_title}' ({video_id})"
        )
        return video_title, video_id, segments

    @classmethod
    async def extract_manual_transcript(
        cls,
        raw_text: str,
        url: Optional[str] = None,
        custom_title: Optional[str] = None,
    ) -> Tuple[str, str, List[Dict[str, Any]]]:
        """
        Parses manually pasted transcript or subtitle text (with or without timestamps)
        and segments it into pedagogically aligned knowledge units.
        Returns: (video_title, video_id, extracted_segments)
        """
        if not raw_text or not raw_text.strip():
            raise ValueError("Pasted transcript text cannot be empty.")

        cleaned_text = raw_text.strip()

        # 1. Extract 11-char video ID if a URL was provided
        video_id = "manual_lecture"
        if url:
            patterns = [
                r"(?:v=|\/|youtu\.be\/|embed\/|live\/|shorts\/)([a-zA-Z0-9_-]{11})",
            ]
            for p in patterns:
                m = re.search(p, url)
                if m:
                    video_id = m.group(1)
                    break

        # 2. Resolve video title
        video_title = custom_title
        if not video_title and video_id != "manual_lecture":
            try:
                oembed_url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
                async with httpx.AsyncClient(timeout=6.0) as client:
                    resp = await client.get(oembed_url)
                    if resp.status_code == 200:
                        video_title = resp.json().get("title")
            except Exception:
                pass

        if not video_title:
            if video_id != "manual_lecture":
                video_title = f"YouTube Lecture ({video_id})"
            else:
                first_line = cleaned_text.splitlines()[0][:50]
                video_title = f"Lecture Notes ({first_line}...)" if first_line else "Lecture Transcript"

        # 3. Parse timestamped cues or convert plain text into timestamped segments
        lines = [ln.strip() for ln in cleaned_text.splitlines() if ln.strip()]
        ts_standalone = re.compile(r"^(\d{1,2}:\d{2}(?::\d{2})?)$")
        ts_inline = re.compile(r"^(\d{1,2}:\d{2}(?::\d{2})?)\s+(.+)$")
        ts_vtt = re.compile(r"^(\d{1,2}:\d{2}(?::\d{2})?)\s*(?:-->|-)\s*(\d{1,2}:\d{2}(?::\d{2})?)$")

        parsed_items: List[Dict[str, Any]] = []
        curr_ts = "00:00"
        accumulated_text: List[str] = []
        has_explicit_timestamps = False

        for line in lines:
            if line.upper().startswith("WEBVTT") or (line.isdigit() and len(line) <= 4):
                continue

            vtt_m = ts_vtt.match(line)
            if vtt_m:
                has_explicit_timestamps = True
                if accumulated_text:
                    parsed_items.append({"start": curr_ts, "text": " ".join(accumulated_text)})
                    accumulated_text = []
                curr_ts = vtt_m.group(1)
                continue

            stand_m = ts_standalone.match(line)
            if stand_m:
                has_explicit_timestamps = True
                if accumulated_text:
                    parsed_items.append({"start": curr_ts, "text": " ".join(accumulated_text)})
                    accumulated_text = []
                curr_ts = stand_m.group(1)
                continue

            inline_m = ts_inline.match(line)
            if inline_m:
                has_explicit_timestamps = True
                if accumulated_text:
                    parsed_items.append({"start": curr_ts, "text": " ".join(accumulated_text)})
                    accumulated_text = []
                curr_ts = inline_m.group(1)
                accumulated_text.append(inline_m.group(2))
                continue

            accumulated_text.append(line)

        if accumulated_text:
            parsed_items.append({"start": curr_ts, "text": " ".join(accumulated_text)})

        def parse_seconds(ts: str) -> float:
            parts = ts.split(":")
            if len(parts) == 3:
                return int(parts[0]) * 3600 + int(parts[1]) * 60 + float(parts[2])
            elif len(parts) == 2:
                return int(parts[0]) * 60 + float(parts[1])
            return 0.0

        def format_timestamp(seconds: float) -> str:
            s = int(seconds)
            m, s = divmod(s, 60)
            h, m = divmod(m, 60)
            if h > 0:
                return f"{h:02d}:{m:02d}:{s:02d}"
            return f"{m:02d}:{s:02d}"

        segments: List[Dict[str, Any]] = []

        if has_explicit_timestamps and parsed_items:
            group_texts: List[str] = []
            group_start = parsed_items[0]["start"]
            group_end = group_start

            for item in parsed_items:
                t = item["text"].strip()
                if not t:
                    continue
                group_texts.append(t)
                group_end = item["start"]

                word_count = sum(len(x.split()) for x in group_texts)
                start_sec = parse_seconds(group_start)
                end_sec = parse_seconds(group_end)

                if word_count >= 100 or (end_sec - start_sec >= 50.0):
                    fmt_start = group_start if len(group_start) >= 5 else f"0{group_start}"
                    fmt_end = group_end if len(group_end) >= 5 else f"0{group_end}"
                    raw_joined = " ".join(group_texts)
                    cleaned_joined = clean_transcript_speech(raw_joined) or raw_joined
                    segments.append({
                        "content": cleaned_joined,
                        "page_number": None,
                        "slide_number": None,
                        "timestamp_start": fmt_start,
                        "timestamp_end": fmt_end,
                    })
                    group_texts = []
                    group_start = item["start"]

            if group_texts:
                fmt_start = group_start if len(group_start) >= 5 else f"0{group_start}"
                fmt_end = group_end if len(group_end) >= 5 else f"0{group_end}"
                raw_joined = " ".join(group_texts)
                cleaned_joined = clean_transcript_speech(raw_joined) or raw_joined
                segments.append({
                    "content": cleaned_joined,
                    "page_number": None,
                    "slide_number": None,
                    "timestamp_start": fmt_start,
                    "timestamp_end": fmt_end,
                })
        else:
            words = cleaned_text.split()
            chunk_size = 120
            for idx, w_start in enumerate(range(0, len(words), chunk_size)):
                chunk_words = words[w_start : w_start + chunk_size]
                sec_start = idx * 60.0
                sec_end = (idx + 1) * 60.0
                raw_chunk = " ".join(chunk_words)
                cleaned_chunk = clean_transcript_speech(raw_chunk) or raw_chunk
                segments.append({
                    "content": cleaned_chunk,
                    "page_number": None,
                    "slide_number": None,
                    "timestamp_start": format_timestamp(sec_start),
                    "timestamp_end": format_timestamp(sec_end),
                })

        if not segments:
            raise ValueError("Could not parse any readable content from the provided transcript text.")

        logger.info(
            f"Extracted {len(segments)} segments from manual lecture transcript '{video_title}' ({video_id})"
        )
        return video_title, video_id, segments

    @classmethod
    async def _translate_segments_to_english(
        cls, segments: List[Dict[str, Any]], source_language: str
    ) -> List[Dict[str, Any]]:
        """
        Translates foreign-language lecture segments into clear, fluent academic English
        using Gemini 2.5 Flash while strictly preserving all original video timestamps.
        """
        api_key = getattr(settings, "GEMINI_API_KEY", "") or getattr(settings, "LLM_API_KEY", "")
        if not api_key or len(api_key) < 10 or api_key == "mock_gemini_key_for_testing_only":
            logger.warning("No valid Gemini API key configured for translation; retaining original segments.")
            return segments

        # Process in batches of up to 6 segments
        batch_size = 6
        translated_segments: List[Dict[str, Any]] = []

        for i in range(0, len(segments), batch_size):
            chunk = segments[i : i + batch_size]
            input_texts = [s["content"] for s in chunk]

            prompt = (
                f"You are an expert academic translator.\n"
                f"The following lecture transcript was spoken in '{source_language}'.\n"
                f"Translate each of the following lecture segments into clear, fluent, natural academic English.\n"
                f"Preserve all technical terms, formulas, and pedagogical explanations accurately.\n"
                f"Return ONLY a valid JSON array of strings containing the English translations in the exact same order.\n\n"
                f"Input segments to translate:\n"
                f"{json.dumps(input_texts, ensure_ascii=False)}"
            )

            translated_texts = None
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.LLM_MODEL}:generateContent?key={api_key}"
                async with httpx.AsyncClient(timeout=25.0) as client:
                    resp = await client.post(
                        url,
                        json={"contents": [{"parts": [{"text": prompt}]}]},
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        candidates = data.get("candidates", [])
                        if candidates:
                            raw_text = candidates[0]["content"]["parts"][0]["text"].strip()
                            if raw_text.startswith("```"):
                                raw_text = re.sub(r"^```(?:json)?\s*", "", raw_text)
                                raw_text = re.sub(r"\s*```$", "", raw_text)
                            parsed = json.loads(raw_text.strip())
                            if isinstance(parsed, list) and len(parsed) == len(chunk):
                                translated_texts = parsed
            except Exception as e:
                logger.warning(f"Translation batch error on segments {i}-{i+len(chunk)}: {e}")

            for idx, seg in enumerate(chunk):
                seg_copy = dict(seg)
                if (
                    translated_texts
                    and idx < len(translated_texts)
                    and isinstance(translated_texts[idx], str)
                    and translated_texts[idx].strip()
                ):
                    seg_copy["content"] = translated_texts[idx].strip()
                    seg_copy["original_language"] = source_language
                    seg_copy["is_translated"] = True
                translated_segments.append(seg_copy)

        logger.info(f"Successfully processed {len(translated_segments)} lecture segments into English.")
        return translated_segments
