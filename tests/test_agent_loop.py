from __future__ import annotations

import argparse
import json
import os
import stat
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "scripts"))

import agent_loop  # noqa: E402


VALID_PASS = {"status": "PASS", "summary": "Allt ser bra ut.", "findings": []}
VALID_CHANGE = {
    "status": "CHANGES_REQUIRED",
    "summary": "Ett konkret fel återstår.",
    "findings": [
        {
            "id": "R1-MISSING-CHECK",
            "severity": "medium",
            "file": "product.txt",
            "line": 1,
            "problem": "Värdet är inte korrigerat.",
            "required_fix": "Skriv det korrigerade värdet.",
        }
    ],
}


def git(repo: Path, *args: str) -> str:
    result = subprocess.run(
        ["git", *args],
        cwd=repo,
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    return result.stdout.strip()


def write_executable(path: Path, body: str) -> None:
    path.write_text("#!/usr/bin/env python3\n" + body, encoding="utf-8")
    path.chmod(path.stat().st_mode | stat.S_IXUSR)


class TemporaryRepo:
    def __init__(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.path = Path(self.temporary.name) / "Resus-codex"
        self.path.mkdir()
        git(self.path, "init", "-b", "codex/work")
        git(self.path, "config", "user.email", "tests@example.invalid")
        git(self.path, "config", "user.name", "Agent Loop Tests")
        (self.path / ".gitignore").write_text(".agent-state/\n", encoding="utf-8")
        (self.path / "README.md").write_text("baseline\n", encoding="utf-8")
        git(self.path, "add", ".")
        git(self.path, "commit", "-m", "baseline")
        self.task = self.path / ".agent-state" / "task.md"
        self.task.parent.mkdir()
        self.task.write_text(
            "# Task\n\nUpdate product.txt safely.\n", encoding="utf-8"
        )
        self.config = Path(self.temporary.name) / "safety.json"
        self.config.write_text(
            json.dumps(
                {
                    "expected_workspace_name": "Resus-codex",
                    "expected_branch": "codex/work",
                    "runtime_dir": ".agent-state",
                    "max_changed_files": 20,
                    "max_diff_lines": 5000,
                    "diff_growth_ratio": 1.75,
                    "diff_growth_min_lines": 100,
                    "protected_paths": [
                        ".agents/",
                        ".agent-state/",
                        "scripts/agent_loop.py",
                        "tests/test_agent_loop.py",
                    ],
                    "sensitive_path_keywords": ["auth", "secret"],
                    "sensitive_diff_keywords": ["password", "api_key"],
                }
            ),
            encoding="utf-8",
        )

    def close(self) -> None:
        self.temporary.cleanup()

    def args(self, *extra: str) -> argparse.Namespace:
        values = [
            "--workspace",
            str(self.path),
            "--task",
            str(self.task),
            "--config",
            str(self.config),
            "--schema",
            str(REPO_ROOT / ".agents" / "review-schema.json"),
            "--claude-prompt",
            str(REPO_ROOT / ".agents" / "prompts" / "claude-implementer.txt"),
            "--codex-prompt",
            str(REPO_ROOT / ".agents" / "prompts" / "codex-reviewer.txt"),
            *extra,
        ]
        return agent_loop.build_parser().parse_args(values)


class ReviewValidationTests(unittest.TestCase):
    def test_valid_review(self) -> None:
        self.assertEqual(agent_loop.validate_review(VALID_PASS), VALID_PASS)
        self.assertEqual(agent_loop.validate_review(VALID_CHANGE), VALID_CHANGE)

    def test_pass_with_findings_is_rejected(self) -> None:
        invalid = dict(VALID_CHANGE, status="PASS")
        with self.assertRaises(ValueError):
            agent_loop.validate_review(invalid)

    def test_changes_required_without_findings_is_rejected(self) -> None:
        invalid = {
            "status": "CHANGES_REQUIRED",
            "summary": "Behöver ändras.",
            "findings": [],
        }
        with self.assertRaises(ValueError):
            agent_loop.validate_review(invalid)

    def test_unknown_properties_are_rejected(self) -> None:
        invalid = dict(VALID_PASS, extra=True)
        with self.assertRaises(ValueError):
            agent_loop.validate_review(invalid)

    def test_review_hash_is_stable_and_ignores_summary_wording(self) -> None:
        first = json.loads(json.dumps(VALID_CHANGE))
        second = json.loads(json.dumps(VALID_CHANGE))
        second["summary"] = "Annan kort sammanfattning."
        second["findings"][0]["problem"] = "  Värdet   är inte korrigerat. "
        self.assertEqual(
            agent_loop.normalized_review_hash(first),
            agent_loop.normalized_review_hash(second),
        )

    def test_duplicate_review_detection_uses_hash_membership(self) -> None:
        review_hash = agent_loop.normalized_review_hash(VALID_CHANGE)
        seen = {review_hash}
        self.assertIn(agent_loop.normalized_review_hash(VALID_CHANGE), seen)


class SafetyPrimitiveTests(unittest.TestCase):
    def test_round_limit_enforcement(self) -> None:
        self.assertFalse(agent_loop.round_limit_reached(1, 2))
        self.assertTrue(agent_loop.round_limit_reached(2, 2))

    def test_lock_acquisition_and_cleanup(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "loop.lock"
            with agent_loop.WorkspaceLock(path):
                self.assertTrue(path.exists())
                with self.assertRaises(agent_loop.ControllerError) as caught:
                    agent_loop.WorkspaceLock(path).acquire()
                self.assertEqual(caught.exception.exit_code, agent_loop.EXIT_LOCKED)
            self.assertFalse(path.exists())

    def test_stale_lock_is_recovered(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "loop.lock"
            path.write_text('{"pid": 99999999}', encoding="utf-8")
            with agent_loop.WorkspaceLock(path):
                self.assertTrue(path.exists())
            self.assertFalse(path.exists())

    def test_atomic_state_write(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "state.json"
            agent_loop.atomic_write_json(path, {"status": "ok", "round": 1})
            self.assertEqual(
                json.loads(path.read_text(encoding="utf-8")),
                {"status": "ok", "round": 1},
            )
            leftovers = list(path.parent.glob(".state.json.*"))
            self.assertEqual(leftovers, [])

    def test_missing_executable_handling(self) -> None:
        with self.assertRaises(agent_loop.ControllerError) as caught:
            agent_loop.resolve_executable("definitely-missing-agent-loop-test-bin")
        self.assertEqual(caught.exception.exit_code, agent_loop.EXIT_AGENT_FAILED)

    def test_timeout_handling(self) -> None:
        result = agent_loop.run_command(
            [sys.executable, "-c", "import time; time.sleep(5)"],
            REPO_ROOT,
            "",
            timeout_seconds=1,
            max_output_bytes=4096,
            env=os.environ.copy(),
        )
        self.assertTrue(result.timed_out)
        self.assertNotEqual(result.returncode, 0)

    def test_protected_file_detection(self) -> None:
        hits = agent_loop.protected_modifications(
            ["src/app.js", ".agents/review-schema.json", "scripts/agent_loop.py"],
            [".agents/", "scripts/agent_loop.py"],
        )
        self.assertEqual(
            hits, [".agents/review-schema.json", "scripts/agent_loop.py"]
        )

    def test_sensitive_file_and_keyword_detection(self) -> None:
        hits = agent_loop.detect_sensitive_changes(
            ["src/auth/session.js", "src/ui.js"],
            "+ const api_key = value",
            ["auth", "billing"],
            ["api_key", "password"],
        )
        self.assertEqual(
            hits,
            ["diff-keyword:api_key", "path:src/auth/session.js (auth)"],
        )

    def test_diff_growth_escalation(self) -> None:
        previous = agent_loop.DiffMetrics(2, 100)
        current = agent_loop.DiffMetrics(3, 220)
        self.assertTrue(agent_loop.diff_growth_exceeded(previous, current, 1.75, 100))
        self.assertFalse(
            agent_loop.diff_growth_exceeded(previous, agent_loop.DiffMetrics(3, 160), 1.75, 100)
        )

    def test_prompt_generation_excludes_old_transcripts(self) -> None:
        template = (
            "$task_text\nROUND=$round_number/$max_rounds\nFINDINGS=$findings_text"
        )
        prompt = agent_loop.render_claude_prompt(
            template,
            "Essential task",
            VALID_CHANGE["findings"],
            2,
            2,
        )
        self.assertIn("R1-MISSING-CHECK", prompt)
        self.assertNotIn("OLD TRANSCRIPT SECRET", prompt)


class WorkspaceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.repo = TemporaryRepo()

    def tearDown(self) -> None:
        self.repo.close()

    def test_dirty_worktree_protection(self) -> None:
        (self.repo.path / "dirty.txt").write_text("unrelated\n", encoding="utf-8")
        loop = agent_loop.AgentLoop(self.repo.args())
        with self.assertRaises(agent_loop.ControllerError) as caught:
            loop.prepare()
        self.assertEqual(caught.exception.exit_code, agent_loop.EXIT_DIRTY)

    def test_runtime_directory_must_remain_inside_workspace(self) -> None:
        config = json.loads(self.repo.config.read_text(encoding="utf-8"))
        config["runtime_dir"] = "../outside"
        self.repo.config.write_text(json.dumps(config), encoding="utf-8")
        loop = agent_loop.AgentLoop(self.repo.args())
        with self.assertRaises(agent_loop.ControllerError) as caught:
            loop.prepare()
        self.assertEqual(caught.exception.exit_code, agent_loop.EXIT_SAFETY)

    def test_configured_runtime_directory_is_used(self) -> None:
        config = json.loads(self.repo.config.read_text(encoding="utf-8"))
        config["runtime_dir"] = ".runtime-test"
        self.repo.config.write_text(json.dumps(config), encoding="utf-8")
        (self.repo.path / ".gitignore").write_text(
            ".agent-state/\n.runtime-test/\n", encoding="utf-8"
        )
        git(self.repo.path, "add", ".gitignore")
        git(self.repo.path, "commit", "-m", "ignore custom runtime")
        loop = agent_loop.AgentLoop(self.repo.args("--dry-run"))
        self.assertEqual(loop.run(), agent_loop.EXIT_OK)
        self.assertTrue((self.repo.path / ".runtime-test" / "state.json").is_file())

    def test_allow_dirty_is_explicit_but_does_not_disable_protection(self) -> None:
        (self.repo.path / "dirty.txt").write_text("acknowledged\n", encoding="utf-8")
        loop = agent_loop.AgentLoop(self.repo.args("--allow-dirty", "--dry-run"))
        self.assertEqual(loop.run(), agent_loop.EXIT_OK)
        state = json.loads(
            (self.repo.path / ".agent-state" / "state.json").read_text(encoding="utf-8")
        )
        self.assertEqual(state["status"], "dry_run")

    def test_dry_run_does_not_require_agent_executables_or_modify_source(self) -> None:
        args = self.repo.args(
            "--dry-run",
            "--claude-bin",
            "missing-claude",
            "--codex-bin",
            "missing-codex",
        )
        before = git(self.repo.path, "status", "--porcelain")
        self.assertEqual(agent_loop.AgentLoop(args).run(), agent_loop.EXIT_OK)
        after = git(self.repo.path, "status", "--porcelain")
        self.assertEqual(before, after)
        self.assertFalse(
            (self.repo.path / ".agent-state" / "agent-loop.lock").exists()
        )


class FakeExecutableIntegrationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.repo = TemporaryRepo()
        self.bin_dir = Path(self.repo.temporary.name) / "fake-bin"
        self.bin_dir.mkdir()
        self.claude = self.bin_dir / "fake-claude"
        self.codex = self.bin_dir / "fake-codex"

    def tearDown(self) -> None:
        self.repo.close()

    def write_fake_claude(self) -> None:
        write_executable(
            self.claude,
            """
import os
from pathlib import Path
_prompt = __import__("sys").stdin.read()
round_number = int(os.environ["AGENT_LOOP_ROUND"])
Path("product.txt").write_text(
    "implemented\\n" if round_number == 1 else "corrected\\n",
    encoding="utf-8",
)
print(\"\"\"## Work completed
Updated the fake product.
## Files changed
product.txt
## Commands run
fake targeted test
## Test results
TEST_STATUS: PASS
## Remaining uncertainty
None.
\"\"\")
""",
        )

    def write_fake_codex(self, changes_then_pass: bool) -> None:
        change_json = json.dumps(VALID_CHANGE)
        pass_json = json.dumps(VALID_PASS)
        write_executable(
            self.codex,
            f"""
import json
import os
import sys
_prompt = sys.stdin.read()
round_number = int(os.environ["AGENT_LOOP_ROUND"])
if {changes_then_pass!r} and round_number == 1:
    print({change_json!r})
else:
    print({pass_json!r})
""",
        )

    def run_loop(self, max_rounds: int = 2) -> int:
        args = self.repo.args(
            "--claude-bin",
            str(self.claude),
            "--codex-bin",
            str(self.codex),
            "--max-rounds",
            str(max_rounds),
            "--claude-timeout",
            "10",
            "--codex-timeout",
            "10",
        )
        return agent_loop.AgentLoop(args).run()

    def test_controller_stops_on_first_pass(self) -> None:
        self.write_fake_claude()
        self.write_fake_codex(changes_then_pass=False)
        self.assertEqual(self.run_loop(), agent_loop.EXIT_OK)
        state = json.loads(
            (self.repo.path / ".agent-state" / "state.json").read_text(encoding="utf-8")
        )
        self.assertEqual(state["status"], "pass")
        self.assertEqual(state["round"], 1)
        self.assertEqual(
            json.loads(
                (self.repo.path / ".agent-state" / "codex-review.json").read_text(
                    encoding="utf-8"
                )
            )["status"],
            "PASS",
        )

    def test_changes_then_pass_stops_after_round_two(self) -> None:
        self.write_fake_claude()
        self.write_fake_codex(changes_then_pass=True)
        self.assertEqual(self.run_loop(), agent_loop.EXIT_OK)
        state = json.loads(
            (self.repo.path / ".agent-state" / "state.json").read_text(encoding="utf-8")
        )
        self.assertEqual(state["status"], "pass")
        self.assertEqual(state["round"], 2)
        self.assertEqual(
            (self.repo.path / "product.txt").read_text(encoding="utf-8"),
            "corrected\n",
        )
        self.assertTrue(
            (self.repo.path / ".agent-state" / "logs" / "round-2-codex.log").exists()
        )


if __name__ == "__main__":
    unittest.main()
