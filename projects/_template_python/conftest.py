"""
Pytest + Appium session fixtures for __PROJECT_NAME__.
Loads .env, starts a driver per test session (platform from PYTEST_PLATFORM or --platform).
"""
from __future__ import annotations

import os
from pathlib import Path

import pytest
from appium import webdriver
from appium.options.android import UiAutomator2Options
from appium.options.ios import XCUITestOptions
from dotenv import load_dotenv

from project_config import (
    REPORTS_DIR,
    SCREENSHOTS_DIR,
    android_capabilities,
    appium_server_url,
    ios_capabilities,
)

ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT / ".env")

REPORTS_DIR.mkdir(parents=True, exist_ok=True)
SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)


def pytest_addoption(parser: pytest.Parser) -> None:
    """CLI: pytest --platform ios|android"""
    parser.addoption(
        "--platform",
        action="store",
        default=os.getenv("PYTEST_PLATFORM", "ios"),
        help="Target platform: ios or android (default: ios)",
    )


@pytest.fixture(scope="session")
def platform(pytestconfig: pytest.Config) -> str:
    """Resolved platform name."""
    value = str(pytestconfig.getoption("--platform") or "ios").lower()
    if value not in {"ios", "android"}:
        raise pytest.UsageError("--platform must be ios or android")
    return value


@pytest.fixture(scope="session")
def driver(platform: str):
    """
    One Appium session for the whole pytest run.
    Start Appium locally before running tests.
    """
    server = appium_server_url()
    if platform == "ios":
        options = XCUITestOptions().load_capabilities(ios_capabilities())
    else:
        options = UiAutomator2Options().load_capabilities(android_capabilities())

    drv = webdriver.Remote(command_executor=server, options=options)
    yield drv
    try:
        drv.quit()
    except Exception:
        pass


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_makereport(item: pytest.Item, call: pytest.CallInfo):
    """Save a screenshot on failure."""
    outcome = yield
    report = outcome.get_result()
    if report.when != "call" or not report.failed:
        return
    drv = item.funcargs.get("driver")
    if drv is None:
        return
    name = item.name.replace("/", "_").replace(" ", "_")
    path = SCREENSHOTS_DIR / f"{name}.png"
    try:
        drv.save_screenshot(str(path))
        print(f"\n[screenshot] {path}")
    except Exception as exc:
        print(f"\n[screenshot] failed: {exc}")
