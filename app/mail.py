"""Outbound notification mail, best effort.

Feedback is already committed before anything here runs, so every failure is
swallowed and logged: a dead mail server must not cost a player their message
or turn their submission into an error.

No part of a player's submission reaches a mail header. The subject is a fixed
string and the message goes in the body only, because a newline in a header
value lets the sender inject headers of their own.

Unset SMTP_USER disables sending, which is also what makes tests quiet.
"""

import asyncio
import logging
import os
import smtplib
from email.message import EmailMessage

log = logging.getLogger(__name__)

SMTP_HOST = os.environ.get("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASS = os.environ.get("SMTP_PASS", "")
FEEDBACK_TO = os.environ.get("FEEDBACK_TO", "")

SEND_TIMEOUT = 5


def _send(subject: str, body: str) -> None:
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = SMTP_USER
    message["To"] = FEEDBACK_TO
    message.set_content(body)
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=SEND_TIMEOUT) as smtp:
        smtp.starttls()
        smtp.login(SMTP_USER, SMTP_PASS)
        smtp.send_message(message)


async def notify(subject: str, body: str) -> bool:
    """Send a plain-text notification. Returns whether it went out."""
    if not (SMTP_USER and SMTP_PASS and FEEDBACK_TO):
        return False
    try:
        await asyncio.wait_for(asyncio.to_thread(_send, subject, body), SEND_TIMEOUT)
        return True
    except Exception:
        log.exception("feedback notification failed")
        return False
