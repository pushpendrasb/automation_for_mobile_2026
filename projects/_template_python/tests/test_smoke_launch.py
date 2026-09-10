"""
Minimal launch smoke — verifies Appium can start a session.
"""
from __future__ import annotations

import os

import pytest


@pytest.mark.smoke
def test_sm001_starts_session_and_reports_app_id(driver, platform: str) -> None:
    """SM-001: session starts; log active app id when possible."""
    driver.implicitly_wait(5)
    app_id = ""

    if platform == "ios":
        try:
            info = driver.execute_script("mobile: activeAppInfo")
            app_id = (info or {}).get("bundleId") or ""
        except Exception:
            app_id = os.getenv("IOS_BUNDLE_ID", "")
    else:
        try:
            app_id = driver.current_package or ""
        except Exception:
            app_id = os.getenv("ANDROID_APP_PACKAGE", "")

    print(f"[smoke] platform={platform} appId={app_id or '(unknown)'}")
    assert driver.session_id, "Appium session was not created"
