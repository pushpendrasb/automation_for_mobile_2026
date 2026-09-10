"""
Project metadata for __PROJECT_NAME__ Python Appium automation.
Placeholders are replaced by `npm run new-project` / setup wizard.
"""
from __future__ import annotations

import os
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent

PROJECT_ID = "__PROJECT_ID__"
DISPLAY_NAME = "__PROJECT_NAME__"
BUNDLE_ID = "__BUNDLE_ID__"
ANDROID_PACKAGE = "__ANDROID_PACKAGE__"
REPORT_BASE = "__REPORT_BASE__"

REPORTS_DIR = ROOT_DIR / "reports"
SCREENSHOTS_DIR = ROOT_DIR / "screenshots"


def env(key: str, default: str = "") -> str:
    """Read an environment variable with a default."""
    return os.getenv(key, default).strip()


def ios_capabilities() -> dict:
    """Appium capabilities for iOS (XCUITest)."""
    caps: dict = {
        "platformName": "iOS",
        "appium:automationName": "XCUITest",
        "appium:bundleId": env("IOS_BUNDLE_ID", BUNDLE_ID),
        "appium:noReset": True,
        "appium:newCommandTimeout": 300,
    }
    udid = env("IOS_DEVICE_UDID")
    if udid:
        caps["appium:udid"] = udid
    team = env("IOS_TEAM_ID")
    if team:
        caps["appium:xcodeOrgId"] = team
        caps["appium:xcodeSigningId"] = env(
            "IOS_XCODE_SIGNING_ID", "Apple Development"
        )
    name = env("IOS_DEVICE_NAME")
    if name:
        caps["appium:deviceName"] = name
    version = env("IOS_REAL_PLATFORM_VERSION") or env("IOS_PLATFORM_VERSION")
    if version:
        caps["appium:platformVersion"] = version
    app_path = env("IOS_APP_PATH")
    if app_path:
        caps["appium:app"] = app_path
    return caps


def android_capabilities() -> dict:
    """Appium capabilities for Android (UiAutomator2)."""
    caps: dict = {
        "platformName": "Android",
        "appium:automationName": "UiAutomator2",
        "appium:appPackage": env("ANDROID_APP_PACKAGE", ANDROID_PACKAGE),
        "appium:noReset": True,
        "appium:newCommandTimeout": 300,
    }
    device = env("ANDROID_DEVICE_ID")
    if device:
        caps["appium:udid"] = device
    activity = env("ANDROID_APP_ACTIVITY")
    if activity:
        caps["appium:appActivity"] = activity
    app_path = env("ANDROID_APP_PATH")
    if app_path:
        caps["appium:app"] = app_path
    return caps


def appium_server_url() -> str:
    """Appium base URL from .env."""
    host = env("APPIUM_HOST", "127.0.0.1")
    port = env("APPIUM_PORT", "4723")
    return f"http://{host}:{port}"
