"""Placeholder page object — replace locators with your app's UI."""
from __future__ import annotations

from appium.webdriver.webdriver import WebDriver


class HomePage:
    """Home / landing screen helpers."""

    def __init__(self, driver: WebDriver) -> None:
        self.driver = driver

    def is_displayed(self) -> bool:
        """Return True when home is visible (replace with a real locator)."""
        return True
