"""User-scoped chat prompt and Skill assembly helpers."""

from __future__ import annotations

import re
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from pathlib import PurePath
from typing import cast

import yaml

DEFAULT_CHAT_PROMPT_LABEL = "Default system prompt"
DEFAULT_CHAT_PROMPT_CONTENT = (
    "You are a reliable assistant. Answer in clear English unless a technical term "
    "requires another language."
)
MAX_CHAT_PROMPT_CONTENT_LENGTH = 12000
MAX_CHAT_SKILL_BYTES = 65536
MAX_CHAT_SKILL_NAME_LENGTH = 64
MAX_CHAT_SKILL_DESCRIPTION_LENGTH = 1024
_SKILL_FRONTMATTER_PATTERN = re.compile(r"^---\s*\r?\n(.*?)\r?\n---\s*(?:\r?\n|$)", re.DOTALL)

MANDATORY_CHAT_SYSTEM_PROMPT = (
    "You are a helpful assistant. Use tools only when useful, cite knowledge sources, "
    "and never invent tool results. For CLS log queries, prefer SearchLog directly "
    "with explicit Region, TopicId, From, To, Query, and Limit values in milliseconds. "
    "Do not call time-conversion or topic-discovery helper tools unless required. "
    "Before any time-based query, call get_current_time first and use its returned "
    "timestamp."
)


@dataclass(frozen=True, slots=True)
class SelectedChatSkill:
    """A user-selected Skill available for progressive disclosure."""

    name: str
    description: str
    content: str


@dataclass(frozen=True, slots=True)
class ValidatedChatSkill:
    """Validated Agent Skills metadata and canonical Markdown content."""

    filename: str
    name: str
    description: str
    content: str


def build_chat_system_prompt(
    *,
    prompt_content: str,
    skills: Sequence[SelectedChatSkill] = (),
) -> str:
    """Build the system prompt passed into the LangChain Agent."""
    sections = [
        MANDATORY_CHAT_SYSTEM_PROMPT,
        "Selected system prompt:\n" + prompt_content.strip(),
    ]
    if skills:
        skill_catalog = "\n".join(
            f"- **{skill.name}**: {skill.description}" for skill in skills
        )
        sections.append(
            "\n".join(
                [
                    "## Available Skills",
                    skill_catalog,
                    (
                        "These are the only skills allowed in this session. When the user's task "
                        "matches a skill description, call `load_skill` with that skill's name "
                        "before answering from its full instructions. Do not guess or claim that "
                        "an uncalled skill is loaded."
                    ),
                ]
            )
        )
    return "\n\n".join(section for section in sections if section.strip())


def validate_chat_prompt_content(label: str, content: str) -> tuple[str, str]:
    """Normalize and validate user-owned prompt input."""
    normalized_label = label.strip()
    normalized_content = content.strip()
    if not normalized_label or not normalized_content:
        raise ValueError("The system prompt name and content are both required.")
    if len(normalized_label) > 160 or len(normalized_content) > MAX_CHAT_PROMPT_CONTENT_LENGTH:
        raise ValueError(
            "The system prompt name must be at most 160 characters, "
            "and the content at most 12000."
        )
    return normalized_label, normalized_content


def validate_skill_upload(filename: str | None, content: bytes) -> ValidatedChatSkill:
    """Validate an uploaded Markdown file against the Agent Skills metadata contract."""
    normalized_filename = PurePath(filename or "").name
    if normalized_filename != (filename or "") or normalized_filename != "SKILL.md":
        raise ValueError("The skill file name must be exactly SKILL.md.")
    if not content:
        raise ValueError("The skill file cannot be empty. Upload UTF-8 Markdown text.")
    if len(content) > MAX_CHAT_SKILL_BYTES:
        raise ValueError("A skill file cannot exceed 64 KB.")
    try:
        decoded = content.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise ValueError("The skill file must be UTF-8 Markdown text.") from exc
    normalized_content = decoded.strip()
    if not normalized_content:
        raise ValueError("The skill file cannot be empty. Write readable Markdown instructions.")
    match = _SKILL_FRONTMATTER_PATTERN.match(normalized_content)
    if match is None:
        raise ValueError(
            "SKILL.md must start with YAML frontmatter that includes name and description."
        )
    try:
        parsed_metadata: object = yaml.safe_load(match.group(1))
    except yaml.YAMLError as exc:
        raise ValueError("The SKILL.md YAML frontmatter is invalid.") from exc
    if not isinstance(parsed_metadata, Mapping):
        raise ValueError("The SKILL.md YAML frontmatter must be a key-value object.")
    metadata = cast(Mapping[object, object], parsed_metadata)
    name = metadata.get("name")
    description = metadata.get("description")
    if not isinstance(name, str) or not _is_valid_skill_name(name.strip()):
        raise ValueError(
            "Skill name must be 1-64 lowercase letters, digits, or single hyphens, "
            "and cannot start or end with a hyphen."
        )
    normalized_name = name.strip()
    if not isinstance(description, str) or not description.strip():
        raise ValueError(
            "Skill description is required and should describe the capability and when to use it."
        )
    normalized_description = description.strip()
    if len(normalized_description) > MAX_CHAT_SKILL_DESCRIPTION_LENGTH:
        raise ValueError("Skill description cannot exceed 1024 characters.")
    return ValidatedChatSkill(
        filename=normalized_filename,
        name=normalized_name,
        description=normalized_description,
        content=normalized_content,
    )


def _is_valid_skill_name(name: str) -> bool:
    if not name or len(name) > MAX_CHAT_SKILL_NAME_LENGTH:
        return False
    if name.startswith("-") or name.endswith("-") or "--" in name:
        return False
    return all(
        character == "-" or character.isdigit() or ("a" <= character <= "z")
        for character in name
    )
