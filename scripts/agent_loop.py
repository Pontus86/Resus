#!/usr/bin/env python3
"""Avgränsad Claude Code ↔ Codex-loop för en låst arbetskopia."""

from __future__ import annotations

import argparse
import dataclasses
import hashlib
import json
import os
import re
import shutil
import signal
import subprocess
import sys
import tempfile
import threading
import time
from pathlib import Path
from string import Template
from typing import Any, Iterable


EXIT_OK = 0
EXIT_ROUNDS_EXHAUSTED = 10
EXIT_BLOCKED = 11
EXIT_HUMAN_REVIEW = 12
EXIT_SAFETY = 13
EXIT_AGENT_FAILED = 14
EXIT_MALFORMED = 15
EXIT_DIRTY = 16
EXIT_LOCKED = 17
EXIT_INTERRUPTED = 130

ACTIVE_ENV = "RESUS_AGENT_LOOP_ACTIVE"
MAX_TASK_BYTES = 200_000
MAX_REVIEW_BYTES = 200_000
TEST_STATUS_RE = re.compile(r"(?im)^TEST_STATUS:\s*(PASS|FAIL|NOT_RUN)\s*$")
FINDING_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$")
HANDOFF_HEADINGS = (
    "## Work completed",
    "## Files changed",
    "## Commands run",
    "## Test results",
    "## Remaining uncertainty",
)


class ControllerError(RuntimeError):
    def __init__(self, message: str, exit_code: int = EXIT_SAFETY):
        super().__init__(message)
        self.exit_code = exit_code


@dataclasses.dataclass(frozen=True)
class CommandResult:
    command: tuple[str, ...]
    returncode: int
    stdout: str
    stderr: str
    stdout_truncated: bool
    stderr_truncated: bool
    timed_out: bool
    duration_seconds: float


@dataclasses.dataclass(frozen=True)
class DiffMetrics:
    changed_files: int
    changed_lines: int


def read_text_bounded(path: Path, max_bytes: int) -> str:
    try:
        data = path.read_bytes()
    except OSError as exc:
        raise ControllerError(f"Kan inte läsa {path}: {exc}", EXIT_MALFORMED) from exc
    if len(data) > max_bytes:
        raise ControllerError(
            f"{path} är {len(data)} byte; gränsen är {max_bytes}.",
            EXIT_MALFORMED,
        )
    try:
        return data.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise ControllerError(f"{path} måste vara UTF-8.", EXIT_MALFORMED) from exc


def load_json(path: Path) -> Any:
    text = read_text_bounded(path, MAX_REVIEW_BYTES)
    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        raise ControllerError(f"Ogiltig JSON i {path}: {exc}", EXIT_MALFORMED) from exc


def atomic_write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    temp_path = Path(temporary)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as handle:
            handle.write(text)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp_path, path)
    except BaseException:
        temp_path.unlink(missing_ok=True)
        raise


def atomic_write_json(path: Path, value: Any) -> None:
    atomic_write_text(
        path,
        json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
    )


def _pid_is_alive(pid: int) -> bool:
    if pid <= 0:
        return False
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    return True


class WorkspaceLock:
    """O_EXCL ger ett litet portabelt lås utan externa paket."""

    def __init__(self, path: Path):
        self.path = path
        self.acquired = False

    def acquire(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "pid": os.getpid(),
            "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
        for attempt in range(2):
            try:
                fd = os.open(self.path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            except FileExistsError:
                try:
                    existing = json.loads(self.path.read_text(encoding="utf-8"))
                    pid = int(existing.get("pid", -1))
                except (OSError, ValueError, TypeError, json.JSONDecodeError):
                    pid = -1
                if attempt == 0 and not _pid_is_alive(pid):
                    self.path.unlink(missing_ok=True)
                    continue
                raise ControllerError(
                    f"Arbetsytan är RÖD: agentloopen är redan låst av PID {pid}.",
                    EXIT_LOCKED,
                )
            else:
                with os.fdopen(fd, "w", encoding="utf-8") as handle:
                    json.dump(payload, handle)
                    handle.flush()
                    os.fsync(handle.fileno())
                self.acquired = True
                return

    def release(self) -> None:
        if self.acquired:
            self.path.unlink(missing_ok=True)
            self.acquired = False

    def __enter__(self) -> "WorkspaceLock":
        self.acquire()
        return self

    def __exit__(self, _exc_type: Any, _exc: Any, _tb: Any) -> None:
        self.release()


def validate_review(review: Any) -> dict[str, Any]:
    if not isinstance(review, dict):
        raise ValueError("Review måste vara ett JSON-objekt.")
    allowed_top = {"status", "summary", "findings"}
    if set(review) != allowed_top:
        unknown = sorted(set(review) - allowed_top)
        missing = sorted(allowed_top - set(review))
        raise ValueError(f"Fel top-level properties; okända={unknown}, saknade={missing}.")
    status = review["status"]
    if status not in {"PASS", "CHANGES_REQUIRED", "BLOCKED"}:
        raise ValueError("status måste vara PASS, CHANGES_REQUIRED eller BLOCKED.")
    summary = review["summary"]
    if not isinstance(summary, str) or not summary.strip() or len(summary) > 1000:
        raise ValueError("summary måste vara en 1–1000 tecken lång sträng.")
    findings = review["findings"]
    if not isinstance(findings, list) or len(findings) > 50:
        raise ValueError("findings måste vara en lista med högst 50 poster.")
    if status == "PASS" and findings:
        raise ValueError("PASS kräver tom findings-lista.")
    if status == "CHANGES_REQUIRED" and not findings:
        raise ValueError("CHANGES_REQUIRED kräver minst ett fynd.")

    allowed_finding = {"id", "severity", "file", "line", "problem", "required_fix"}
    seen_ids: set[str] = set()
    for index, finding in enumerate(findings):
        if not isinstance(finding, dict) or set(finding) != allowed_finding:
            raise ValueError(f"Fynd {index} har fel properties.")
        finding_id = finding["id"]
        if not isinstance(finding_id, str) or not FINDING_ID_RE.fullmatch(finding_id):
            raise ValueError(f"Fynd {index} har ogiltigt id.")
        if finding_id in seen_ids:
            raise ValueError(f"Duplicerat finding-id: {finding_id}.")
        seen_ids.add(finding_id)
        if finding["severity"] not in {"critical", "high", "medium", "low"}:
            raise ValueError(f"Fynd {finding_id} har ogiltig severity.")
        file_name = finding["file"]
        if (
            not isinstance(file_name, str)
            or not file_name.strip()
            or len(file_name) > 500
            or Path(file_name).is_absolute()
            or ".." in Path(file_name).parts
        ):
            raise ValueError(f"Fynd {finding_id} måste använda en säker relativ filsökväg.")
        line = finding["line"]
        if line is not None and (
            isinstance(line, bool) or not isinstance(line, int) or line < 1
        ):
            raise ValueError(f"Fynd {finding_id} har ogiltig line.")
        for field in ("problem", "required_fix"):
            value = finding[field]
            if not isinstance(value, str) or not value.strip() or len(value) > 2000:
                raise ValueError(f"Fynd {finding_id} har ogiltigt {field}.")
    return review


def _normalized_text(value: str) -> str:
    return " ".join(value.split()).strip()


def normalized_review_hash(review: dict[str, Any]) -> str:
    findings = [
        {
            "id": finding["id"],
            "severity": finding["severity"],
            "file": finding["file"],
            "line": finding["line"],
            "problem": _normalized_text(finding["problem"]),
            "required_fix": _normalized_text(finding["required_fix"]),
        }
        for finding in review["findings"]
    ]
    findings.sort(key=lambda item: item["id"])
    normalized: dict[str, Any] = {"status": review["status"], "findings": findings}
    if review["status"] == "BLOCKED" and not findings:
        normalized["summary"] = _normalized_text(review["summary"])
    encoded = json.dumps(normalized, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(encoded).hexdigest()


def round_limit_reached(round_number: int, max_rounds: int) -> bool:
    return round_number >= max_rounds


def diff_growth_exceeded(
    previous: DiffMetrics,
    current: DiffMetrics,
    ratio: float,
    minimum_growth_lines: int,
) -> bool:
    growth = current.changed_lines - previous.changed_lines
    if growth < minimum_growth_lines:
        return False
    baseline = max(previous.changed_lines, 1)
    return current.changed_lines / baseline > ratio


def _matches_path_rule(path: str, rule: str) -> bool:
    normalized = path.replace("\\", "/").lstrip("./")
    rule = rule.replace("\\", "/").lstrip("./")
    return normalized.startswith(rule) if rule.endswith("/") else normalized == rule


def protected_modifications(paths: Iterable[str], rules: Iterable[str]) -> list[str]:
    return sorted(
        path for path in paths if any(_matches_path_rule(path, rule) for rule in rules)
    )


def detect_sensitive_changes(
    paths: Iterable[str],
    diff_text: str,
    path_keywords: Iterable[str],
    diff_keywords: Iterable[str],
) -> list[str]:
    hits: set[str] = set()
    for path in paths:
        lower_path = path.lower()
        for keyword in path_keywords:
            if keyword.lower() in lower_path:
                hits.add(f"path:{path} ({keyword})")
    lower_diff = diff_text.lower()
    for keyword in diff_keywords:
        if keyword.lower() in lower_diff:
            hits.add(f"diff-keyword:{keyword}")
    return sorted(hits)


def render_claude_prompt(
    template_text: str,
    task_text: str,
    findings: list[dict[str, Any]],
    round_number: int,
    max_rounds: int,
) -> str:
    findings_text = (
        "None. This is the first implementation round."
        if not findings
        else json.dumps(findings, ensure_ascii=False, indent=2, sort_keys=True)
    )
    return Template(template_text).substitute(
        round_number=round_number,
        max_rounds=max_rounds,
        task_text=task_text.strip(),
        findings_text=findings_text,
    )


def render_codex_prompt(
    template_text: str,
    task_text: str,
    handoff_text: str,
) -> str:
    return Template(template_text).substitute(
        task_text=task_text.strip(),
        handoff_text=handoff_text.strip(),
    )


def parse_test_status(handoff: str) -> str:
    match = TEST_STATUS_RE.search(handoff)
    if not match:
        raise ControllerError(
            "Claude-handoff saknar TEST_STATUS: PASS | FAIL | NOT_RUN.",
            EXIT_MALFORMED,
        )
    return match.group(1)


def validate_handoff(handoff: str) -> str:
    if not handoff.strip():
        raise ControllerError("Claude returnerade en tom handoff.", EXIT_MALFORMED)
    missing = [heading for heading in HANDOFF_HEADINGS if heading not in handoff]
    if missing:
        raise ControllerError(
            f"Claude-handoff saknar rubriker: {', '.join(missing)}.",
            EXIT_MALFORMED,
        )
    return parse_test_status(handoff)


def resolve_executable(name: str) -> str:
    candidate = Path(name).expanduser()
    if candidate.parent != Path(".") or os.sep in name:
        if candidate.is_file() and os.access(candidate, os.X_OK):
            return str(candidate.resolve())
        raise ControllerError(
            f"Executable finns inte eller är inte körbar: {name}",
            EXIT_AGENT_FAILED,
        )
    resolved = shutil.which(name)
    if not resolved:
        raise ControllerError(
            f"Hittar inte executable '{name}'. Installera den eller använd rätt --*-bin.",
            EXIT_AGENT_FAILED,
        )
    return str(Path(resolved).resolve())


def build_claude_command(executable: str) -> list[str]:
    # Alla Claude-specifika flaggor hålls här så versionsändringar blir lokala.
    return [
        executable,
        "-p",
        "--output-format",
        "text",
        "--max-turns",
        "30",
        "--permission-mode",
        "acceptEdits",
        "--disallowedTools",
        (
            "Bash(git commit:*),Bash(git push:*),Bash(git merge:*),"
            "Bash(git rebase:*),Bash(git reset:*),Bash(git clean:*),"
            "Bash(claude:*),Bash(codex:*)"
        ),
    ]


def build_codex_command(
    executable: str,
    workspace: Path,
    schema_path: Path,
) -> list[str]:
    # Codex 0.146: globala sandboxflaggor före `exec`, execflaggor efter.
    return [
        executable,
        "--ask-for-approval",
        "never",
        "--sandbox",
        "read-only",
        "exec",
        "--ephemeral",
        "--output-schema",
        str(schema_path),
        "--cd",
        str(workspace),
        "-",
    ]


def _drain_stream(stream: Any, maximum: int, target: dict[str, Any], key: str) -> None:
    captured = bytearray()
    total = 0
    while True:
        chunk = stream.read(65_536)
        if not chunk:
            break
        total += len(chunk)
        if len(captured) < maximum:
            captured.extend(chunk[: maximum - len(captured)])
    target[key] = bytes(captured)
    target[f"{key}_truncated"] = total > maximum


def _terminate_process(proc: subprocess.Popen[bytes]) -> None:
    try:
        if os.name == "posix":
            os.killpg(proc.pid, signal.SIGTERM)
        else:
            proc.terminate()
        proc.wait(timeout=3)
    except (ProcessLookupError, subprocess.TimeoutExpired):
        try:
            if os.name == "posix":
                os.killpg(proc.pid, signal.SIGKILL)
            else:
                proc.kill()
        except ProcessLookupError:
            pass


def run_command(
    command: list[str],
    cwd: Path,
    prompt: str,
    timeout_seconds: int,
    max_output_bytes: int,
    env: dict[str, str],
) -> CommandResult:
    started = time.monotonic()
    try:
        proc = subprocess.Popen(
            command,
            cwd=cwd,
            env=env,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            shell=False,
            start_new_session=(os.name == "posix"),
        )
    except OSError as exc:
        raise ControllerError(
            f"Kunde inte starta {command[0]}: {exc}",
            EXIT_AGENT_FAILED,
        ) from exc
    assert proc.stdin and proc.stdout and proc.stderr
    captured: dict[str, Any] = {}
    out_thread = threading.Thread(
        target=_drain_stream,
        args=(proc.stdout, max_output_bytes, captured, "stdout"),
        daemon=True,
    )
    err_thread = threading.Thread(
        target=_drain_stream,
        args=(proc.stderr, max_output_bytes, captured, "stderr"),
        daemon=True,
    )
    out_thread.start()
    err_thread.start()
    try:
        proc.stdin.write(prompt.encode("utf-8"))
        proc.stdin.close()
    except BrokenPipeError:
        pass
    timed_out = False
    try:
        returncode = proc.wait(timeout=timeout_seconds)
    except subprocess.TimeoutExpired:
        timed_out = True
        _terminate_process(proc)
        returncode = proc.returncode if proc.returncode is not None else -1
    out_thread.join(timeout=5)
    err_thread.join(timeout=5)
    proc.stdout.close()
    proc.stderr.close()
    stdout = captured.get("stdout", b"").decode("utf-8", errors="replace")
    stderr = captured.get("stderr", b"").decode("utf-8", errors="replace")
    return CommandResult(
        command=tuple(command),
        returncode=returncode,
        stdout=stdout,
        stderr=stderr,
        stdout_truncated=bool(captured.get("stdout_truncated", False)),
        stderr_truncated=bool(captured.get("stderr_truncated", False)),
        timed_out=timed_out,
        duration_seconds=time.monotonic() - started,
    )


def _git(workspace: Path, *args: str, maximum: int = 5_000_000) -> bytes:
    try:
        result = subprocess.run(
            ["git", *args],
            cwd=workspace,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=30,
            check=False,
            shell=False,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise ControllerError(f"Git-kontroll misslyckades: {exc}") from exc
    if result.returncode != 0:
        message = result.stderr.decode("utf-8", errors="replace").strip()
        raise ControllerError(f"git {' '.join(args)} misslyckades: {message}")
    if len(result.stdout) > maximum:
        raise ControllerError(f"git {' '.join(args)} överskred outputgränsen.")
    return result.stdout


def git_root(workspace: Path) -> Path:
    return Path(
        _git(workspace, "rev-parse", "--show-toplevel").decode().strip()
    ).resolve()


def git_branch(workspace: Path) -> str:
    return _git(workspace, "branch", "--show-current").decode().strip()


def git_head(workspace: Path) -> str:
    return _git(workspace, "rev-parse", "HEAD").decode().strip()


def changed_paths(workspace: Path) -> set[str]:
    tracked = _git(workspace, "diff", "--name-only", "-z", "HEAD").split(b"\0")
    untracked = _git(
        workspace,
        "ls-files",
        "--others",
        "--exclude-standard",
        "-z",
    ).split(b"\0")
    paths: set[str] = set()
    for raw in tracked + untracked:
        if raw:
            paths.add(raw.decode("utf-8", errors="surrogateescape"))
    return paths


def diff_metrics(workspace: Path, paths: Iterable[str]) -> DiffMetrics:
    numstat = _git(workspace, "diff", "--numstat", "HEAD").decode(
        "utf-8", errors="replace"
    )
    changed_lines = 0
    tracked_paths: set[str] = set()
    for row in numstat.splitlines():
        fields = row.split("\t", 2)
        if len(fields) != 3:
            continue
        added, removed, path = fields
        tracked_paths.add(path)
        if added.isdigit():
            changed_lines += int(added)
        if removed.isdigit():
            changed_lines += int(removed)
    for relative in set(paths) - tracked_paths:
        path = workspace / relative
        if path.is_file():
            try:
                data = path.read_bytes()
            except OSError:
                continue
            changed_lines += data.count(b"\n") + (1 if data and not data.endswith(b"\n") else 0)
    return DiffMetrics(changed_files=len(set(paths)), changed_lines=changed_lines)


def current_diff_text(workspace: Path, paths: Iterable[str], maximum: int) -> str:
    chunks = [
        _git(
            workspace,
            "diff",
            "--no-ext-diff",
            "--unified=0",
            "HEAD",
            maximum=maximum,
        )
    ]
    remaining = maximum - len(chunks[0])
    tracked = set(
        part.decode("utf-8", errors="surrogateescape")
        for part in _git(workspace, "diff", "--name-only", "-z", "HEAD").split(b"\0")
        if part
    )
    for relative in sorted(set(paths) - tracked):
        if remaining <= 0:
            break
        path = workspace / relative
        if not path.is_file():
            continue
        try:
            data = path.read_bytes()[:remaining]
        except OSError:
            continue
        chunks.append(f"\n+++ untracked/{relative}\n".encode() + data)
        remaining -= len(chunks[-1])
    return b"".join(chunks)[:maximum].decode("utf-8", errors="replace")


def create_blocker_directory(runtime_dir: Path) -> tuple[Path, Path]:
    blocker = runtime_dir / "blocked-bin"
    blocker.mkdir(parents=True, exist_ok=True)
    attempt_log = runtime_dir / "nested-agent-attempt.log"
    attempt_log.unlink(missing_ok=True)
    script = (
        "#!/bin/sh\n"
        'printf "%s\\n" "$0 $*" >> "$AGENT_LOOP_NESTED_LOG"\n'
        'printf "Nested agent launch blocked by agent_loop.py\\n" >&2\n'
        "exit 97\n"
    )
    for name in ("claude", "codex", "agent_loop.py"):
        path = blocker / name
        path.write_text(script, encoding="utf-8")
        path.chmod(0o700)
    return blocker, attempt_log


def _safe_command_for_display(command: Iterable[str]) -> str:
    return " ".join(command)


class AgentLoop:
    def __init__(self, args: argparse.Namespace):
        self.args = args
        self.workspace = Path(args.workspace).expanduser().resolve()
        self.script_root = Path(__file__).resolve().parents[1]
        self.config_path = Path(args.config).expanduser().resolve()
        self.schema_path = Path(args.schema).expanduser().resolve()
        self.claude_template_path = Path(args.claude_prompt).expanduser().resolve()
        self.codex_template_path = Path(args.codex_prompt).expanduser().resolve()
        self.config: dict[str, Any] = {}
        self.runtime_dir = self.workspace / ".agent-state"
        self.state_path = self.runtime_dir / "state.json"
        self.handoff_path = self.runtime_dir / "claude-handoff.md"
        self.review_path = self.runtime_dir / "codex-review.json"
        self.log_dir = self.runtime_dir / "logs"
        self.state: dict[str, Any] = {}

    def progress(self, color: str, message: str) -> None:
        print(f"[{color}] {message}", flush=True)

    def verbose(self, message: str) -> None:
        if self.args.verbose:
            self.progress("BLUE", message)

    def configure_runtime_dir(self) -> None:
        configured = self.config.get("runtime_dir", ".agent-state")
        if not isinstance(configured, str) or not configured.strip():
            raise ControllerError("runtime_dir måste vara en relativ sökväg.")
        relative = Path(configured)
        if relative.is_absolute() or ".." in relative.parts:
            raise ControllerError("runtime_dir måste ligga inom workspace.")
        runtime_dir = (self.workspace / relative).resolve()
        try:
            runtime_dir.relative_to(self.workspace)
        except ValueError as exc:
            raise ControllerError("runtime_dir måste ligga inom workspace.") from exc
        self.runtime_dir = runtime_dir
        self.state_path = runtime_dir / "state.json"
        self.handoff_path = runtime_dir / "claude-handoff.md"
        self.review_path = runtime_dir / "codex-review.json"
        self.log_dir = runtime_dir / "logs"

    def protected_patterns(self) -> list[str]:
        patterns = list(self.config.get("protected_paths", []))
        runtime_pattern = self.runtime_dir.relative_to(self.workspace).as_posix().rstrip("/") + "/"
        if runtime_pattern not in patterns:
            patterns.append(runtime_pattern)
        return patterns

    def save_state(self, **updates: Any) -> None:
        self.state.update(updates)
        atomic_write_json(self.state_path, self.state)

    def prepare(self) -> tuple[str, str, str]:
        if os.environ.get(ACTIVE_ENV):
            raise ControllerError(
                "Rekursiv agent_loop-körning blockerad av miljömarkör.",
                EXIT_SAFETY,
            )
        if not self.workspace.is_dir():
            raise ControllerError(f"Workspace saknas: {self.workspace}")
        root = git_root(self.workspace)
        if root != self.workspace:
            raise ControllerError(
                f"--workspace måste vara Git-roten ({root}), inte {self.workspace}."
            )
        self.config = load_json(self.config_path)
        self.configure_runtime_dir()
        expected_name = self.config.get("expected_workspace_name")
        if expected_name and self.workspace.name != expected_name:
            raise ControllerError(
                f"Fel workspace: väntade {expected_name}, fick {self.workspace.name}."
            )
        branch = git_branch(self.workspace)
        expected_branch = self.config.get("expected_branch")
        if expected_branch and branch != expected_branch:
            raise ControllerError(
                f"Fel branch: väntade {expected_branch}, fick {branch}."
            )
        task_path = Path(self.args.task).expanduser()
        if not task_path.is_absolute():
            task_path = (self.workspace / task_path).resolve()
        task_text = read_text_bounded(task_path, MAX_TASK_BYTES)
        if not task_text.strip():
            raise ControllerError("Task-filen är tom.", EXIT_MALFORMED)
        schema_text = read_text_bounded(self.schema_path, MAX_REVIEW_BYTES)
        json.loads(schema_text)
        claude_template = read_text_bounded(self.claude_template_path, MAX_TASK_BYTES)
        codex_template = read_text_bounded(self.codex_template_path, MAX_TASK_BYTES)

        initial_paths = changed_paths(self.workspace)
        protected = protected_modifications(initial_paths, self.protected_patterns())
        if protected:
            raise ControllerError(
                "Skyddade orkestratorfiler är redan ändrade: " + ", ".join(protected),
                EXIT_SAFETY,
            )
        if initial_paths and not self.args.allow_dirty:
            raise ControllerError(
                "Arbetsytan är inte ren: "
                + ", ".join(sorted(initial_paths))
                + ". Använd --allow-dirty endast efter manuell granskning.",
                EXIT_DIRTY,
            )
        return task_text, claude_template, codex_template

    def write_log(self, round_number: int, agent: str, result: CommandResult) -> None:
        self.log_dir.mkdir(parents=True, exist_ok=True)
        header = (
            f"command: {_safe_command_for_display(result.command)}\n"
            f"returncode: {result.returncode}\n"
            f"timed_out: {result.timed_out}\n"
            f"duration_seconds: {result.duration_seconds:.3f}\n"
            f"stdout_truncated: {result.stdout_truncated}\n"
            f"stderr_truncated: {result.stderr_truncated}\n"
        )
        atomic_write_text(
            self.log_dir / f"round-{round_number}-{agent}.log",
            header
            + "\n--- stdout ---\n"
            + result.stdout
            + "\n--- stderr ---\n"
            + result.stderr,
        )

    def check_agent_result(
        self,
        result: CommandResult,
        agent: str,
        attempt_log: Path,
    ) -> None:
        if attempt_log.exists() and attempt_log.stat().st_size:
            raise ControllerError(
                f"{agent} försökte starta en annan agentprocess. Se {attempt_log}.",
                EXIT_SAFETY,
            )
        if result.timed_out:
            raise ControllerError(
                f"{agent} överskred timeout och stoppades.",
                EXIT_AGENT_FAILED,
            )
        if result.stdout_truncated or result.stderr_truncated:
            raise ControllerError(
                f"{agent} överskred outputgränsen; fullfölj inte med ofullständig handoff.",
                EXIT_AGENT_FAILED,
            )
        if result.returncode != 0:
            detail = result.stderr.strip().splitlines()[-1:] or ["ingen stderr"]
            raise ControllerError(
                f"{agent} avslutades med kod {result.returncode}: {detail[0]}",
                EXIT_AGENT_FAILED,
            )

    def inspect_workspace(self) -> tuple[set[str], DiffMetrics, list[str], str]:
        paths = changed_paths(self.workspace)
        protected = protected_modifications(paths, self.protected_patterns())
        if protected:
            raise ControllerError(
                "Agenten ändrade skyddade filer: " + ", ".join(protected),
                EXIT_SAFETY,
            )
        metrics = diff_metrics(self.workspace, paths)
        if metrics.changed_files > int(self.config["max_changed_files"]):
            raise ControllerError(
                f"Diffen omfattar {metrics.changed_files} filer; gränsen är "
                f"{self.config['max_changed_files']}.",
                EXIT_HUMAN_REVIEW,
            )
        if metrics.changed_lines > int(self.config["max_diff_lines"]):
            raise ControllerError(
                f"Diffen omfattar {metrics.changed_lines} rader; gränsen är "
                f"{self.config['max_diff_lines']}.",
                EXIT_HUMAN_REVIEW,
            )
        diff_text = current_diff_text(
            self.workspace, paths, int(self.args.max_output_bytes)
        )
        sensitive = detect_sensitive_changes(
            paths,
            diff_text,
            self.config.get("sensitive_path_keywords", []),
            self.config.get("sensitive_diff_keywords", []),
        )
        return paths, metrics, sensitive, diff_text

    def run(self) -> int:
        task_text, claude_template, codex_template = self.prepare()
        lock = WorkspaceLock(self.runtime_dir / "agent-loop.lock")
        with lock:
            self.runtime_dir.mkdir(parents=True, exist_ok=True)
            blocker_dir, attempt_log = create_blocker_directory(self.runtime_dir)
            base_env = os.environ.copy()
            base_env[ACTIVE_ENV] = "1"
            base_env["AGENT_LOOP_NESTED_LOG"] = str(attempt_log)
            base_env["PATH"] = str(blocker_dir) + os.pathsep + base_env.get("PATH", "")
            self.state = {
                "version": 1,
                "status": "starting",
                "workspace": str(self.workspace),
                "branch": git_branch(self.workspace),
                "head": git_head(self.workspace),
                "task_sha256": hashlib.sha256(task_text.encode()).hexdigest(),
                "max_rounds": self.args.max_rounds,
                "round": 0,
                "started_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            }
            self.save_state()

            if self.args.dry_run:
                claude_display = build_claude_command(self.args.claude_bin)
                codex_display = build_codex_command(
                    self.args.codex_bin, self.workspace, self.schema_path
                )
                self.progress("BLUE", "DRY RUN: inga agenter startas och inga källfiler ändras.")
                print("Claude:", _safe_command_for_display(claude_display))
                print("Codex:", _safe_command_for_display(codex_display))
                self.save_state(status="dry_run", finished_at=time.time())
                return EXIT_OK

            claude_bin = resolve_executable(self.args.claude_bin)
            codex_bin = resolve_executable(self.args.codex_bin)
            claude_command = build_claude_command(claude_bin)
            codex_command = build_codex_command(
                codex_bin, self.workspace, self.schema_path
            )
            self.verbose(
                "Claude-kommando: " + _safe_command_for_display(claude_command)
            )
            self.verbose(
                "Codex-kommando: " + _safe_command_for_display(codex_command)
            )
            unresolved: list[dict[str, Any]] = []
            review_hashes: set[str] = set()
            previous_finding_ids: set[str] = set()
            previous_metrics: DiffMetrics | None = None
            previous_test_status: str | None = None
            sensitive_hits: set[str] = set()

            for round_number in range(1, self.args.max_rounds + 1):
                self.progress(
                    "YELLOW",
                    f"Runda {round_number}/{self.args.max_rounds}: Claude arbetar. "
                    "Rör inte Resus-codex.",
                )
                self.save_state(status="claude_running", round=round_number)
                claude_prompt = render_claude_prompt(
                    claude_template,
                    task_text,
                    unresolved,
                    round_number,
                    self.args.max_rounds,
                )
                env = dict(base_env)
                env["AGENT_LOOP_ROUND"] = str(round_number)
                result = run_command(
                    claude_command,
                    self.workspace,
                    claude_prompt,
                    self.args.claude_timeout,
                    self.args.max_output_bytes,
                    env,
                )
                self.write_log(round_number, "claude", result)
                self.check_agent_result(result, "Claude", attempt_log)
                handoff = result.stdout.strip()
                test_status = validate_handoff(handoff)
                if previous_test_status == "PASS" and test_status != "PASS":
                    raise ControllerError(
                        f"Tester regresserade från PASS till {test_status} i runda "
                        f"{round_number}.",
                        EXIT_HUMAN_REVIEW,
                    )
                previous_test_status = test_status
                atomic_write_text(self.handoff_path, handoff + "\n")
                if not self.handoff_path.is_file() or not self.handoff_path.stat().st_size:
                    raise ControllerError("Claude-handoff kunde inte sparas.", EXIT_MALFORMED)

                paths, metrics, sensitive, _diff_text = self.inspect_workspace()
                sensitive_hits.update(sensitive)
                self.verbose(
                    f"Diff efter Claude: {metrics.changed_files} filer, "
                    f"{metrics.changed_lines} ändrade rader."
                )
                if sensitive:
                    self.verbose(
                        "Känslighetsregler träffade: " + ", ".join(sensitive)
                    )
                self.save_state(
                    status="codex_running",
                    changed_files=sorted(paths),
                    diff_metrics=dataclasses.asdict(metrics),
                    test_status=test_status,
                    sensitive_hits=sorted(sensitive_hits),
                )
                self.progress(
                    "YELLOW",
                    f"Runda {round_number}/{self.args.max_rounds}: Codex granskar read-only.",
                )
                codex_prompt = render_codex_prompt(codex_template, task_text, handoff)
                attempt_log.unlink(missing_ok=True)
                result = run_command(
                    codex_command,
                    self.workspace,
                    codex_prompt,
                    self.args.codex_timeout,
                    self.args.max_output_bytes,
                    env,
                )
                self.write_log(round_number, "codex", result)
                self.check_agent_result(result, "Codex", attempt_log)
                # Read-only-sandboxen är primärbarriären; denna efterkontroll fångar även
                # felkonfigurerade eller framtida CLI-versioner som ändå lyckas skriva.
                codex_paths, codex_metrics, codex_sensitive, _codex_diff = (
                    self.inspect_workspace()
                )
                sensitive_hits.update(codex_sensitive)
                if codex_paths != paths or codex_metrics != metrics:
                    raise ControllerError(
                        "Arbetskopian ändrades under Codex read-only-review.",
                        EXIT_SAFETY,
                    )
                try:
                    parsed_review = json.loads(result.stdout)
                    review = validate_review(parsed_review)
                except (json.JSONDecodeError, ValueError) as exc:
                    raise ControllerError(
                        f"Codex-review är inte giltig schema-JSON: {exc}",
                        EXIT_MALFORMED,
                    ) from exc
                atomic_write_json(self.review_path, review)
                if not self.review_path.is_file():
                    raise ControllerError("Codex-review kunde inte sparas.", EXIT_MALFORMED)

                review_hash = normalized_review_hash(review)
                if review_hash in review_hashes:
                    raise ControllerError(
                        "Identisk review återkom. Loopen stoppas för mänsklig bedömning.",
                        EXIT_HUMAN_REVIEW,
                    )
                review_hashes.add(review_hash)
                current_ids = {item["id"] for item in review["findings"]}
                repeated_ids = current_ids & previous_finding_ids
                if repeated_ids:
                    raise ControllerError(
                        "Samma fynd kvarstår över två reviews: "
                        + ", ".join(sorted(repeated_ids)),
                        EXIT_HUMAN_REVIEW,
                    )
                self.save_state(
                    status="reviewed",
                    review_status=review["status"],
                    review_hash=review_hash,
                    finding_ids=sorted(current_ids),
                )

                if review["status"] == "BLOCKED":
                    self.progress("RED", "Codex rapporterade BLOCKED. Människa krävs.")
                    self.save_state(status="blocked", finished_at=time.time())
                    return EXIT_BLOCKED
                if review["status"] == "PASS":
                    if sensitive_hits:
                        self.progress(
                            "RED",
                            "Review PASS, men känsliga filer/nyckelord kräver mänskligt godkännande.",
                        )
                        self.save_state(
                            status="human_review_sensitive", finished_at=time.time()
                        )
                        return EXIT_HUMAN_REVIEW
                    self.progress(
                        "GREEN",
                        "PASS. Agentloopen är klar; granska diffen innan commit.",
                    )
                    self.save_state(status="pass", finished_at=time.time())
                    return EXIT_OK

                if previous_metrics and diff_growth_exceeded(
                    previous_metrics,
                    metrics,
                    float(self.config["diff_growth_ratio"]),
                    int(self.config["diff_growth_min_lines"]),
                ):
                    raise ControllerError(
                        "Diffen växte kraftigt utan PASS. Mänsklig granskning krävs.",
                        EXIT_HUMAN_REVIEW,
                    )
                if round_limit_reached(round_number, self.args.max_rounds):
                    self.progress("RED", "Maxrundor nådda med olösta fynd.")
                    self.save_state(
                        status="rounds_exhausted", finished_at=time.time()
                    )
                    return EXIT_ROUNDS_EXHAUSTED
                unresolved = review["findings"]
                previous_finding_ids = current_ids
                previous_metrics = metrics

            raise AssertionError("Rundloopen avslutades utan resultat.")


def build_parser() -> argparse.ArgumentParser:
    script_root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(
        description=(
            "Kör Claude som implementerare och Codex som read-only-granskare i högst "
            "ett litet antal låsta rundor. Verktyget committar eller pushar aldrig."
        )
    )
    parser.add_argument("--task", required=True, help="Sökväg till Markdown-taskfil.")
    parser.add_argument(
        "--workspace",
        default=".",
        help="Ren Git-arbetsyta; normalt /Users/Pontus/Documents/Projekt/Resus-codex.",
    )
    parser.add_argument("--claude-bin", default="claude", help="Claude Code executable.")
    parser.add_argument("--codex-bin", default="codex", help="Codex executable.")
    parser.add_argument("--max-rounds", type=int, default=2, choices=range(1, 6))
    parser.add_argument("--claude-timeout", type=int, default=1800)
    parser.add_argument("--codex-timeout", type=int, default=900)
    parser.add_argument("--max-output-bytes", type=int, default=1_000_000)
    parser.add_argument(
        "--allow-dirty",
        action="store_true",
        help="Tillåt uttryckligen en redan smutsig arbetsyta; övriga skydd gäller.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validera och visa kommandon utan att starta agenter.",
    )
    parser.add_argument("--verbose", action="store_true", help="Visa mer controllerstatus.")
    parser.add_argument(
        "--config",
        default=str(script_root / ".agents" / "safety-rules.json"),
        help="Säkerhetsregler i JSON.",
    )
    parser.add_argument(
        "--schema",
        default=str(script_root / ".agents" / "review-schema.json"),
        help="JSON-schema för Codex-review.",
    )
    parser.add_argument(
        "--claude-prompt",
        default=str(script_root / ".agents" / "prompts" / "claude-implementer.txt"),
    )
    parser.add_argument(
        "--codex-prompt",
        default=str(script_root / ".agents" / "prompts" / "codex-reviewer.txt"),
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if args.claude_timeout <= 0 or args.codex_timeout <= 0:
        parser.error("Timeout måste vara positiv.")
    if args.max_output_bytes < 1024:
        parser.error("--max-output-bytes måste vara minst 1024.")
    try:
        return AgentLoop(args).run()
    except KeyboardInterrupt:
        print("[RED] Avbruten. Inga filer återställs automatiskt; granska Git-diffen.", file=sys.stderr)
        return EXIT_INTERRUPTED
    except ControllerError as exc:
        print(f"[RED] {exc}", file=sys.stderr)
        return exc.exit_code


if __name__ == "__main__":
    raise SystemExit(main())
