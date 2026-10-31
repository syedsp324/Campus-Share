import { expect, test } from "@playwright/test";

test("User and Owner tabs fill the matching demo accounts", async ({ page }) => {
  await page.goto("/login");

  const email = page.getByLabel("College email");
  const password = page.getByLabel("Password");

  await page.getByRole("tab", { name: "User" }).click();
  await expect(email).toHaveValue("demo.student@campusshare.test");
  await expect(password).not.toHaveValue("");

  await page.getByRole("tab", { name: "Owner" }).click();
  await expect(email).toHaveValue("demo.owner@campusshare.test");
  await expect(password).not.toHaveValue("");
});

test("User demo can sign in and reach the dashboard", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("tab", { name: "User" }).click();
  await page.getByRole("button", { name: /Continue to CampusShare/ }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: /Welcome back/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "My bookings" })).toBeVisible();
});

test("Owner demo can sign in and see the owner review route", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("tab", { name: "Owner" }).click();
  await page.getByRole("button", { name: /Continue to CampusShare/ }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: /Welcome back/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Requests" })).toBeVisible();
});

test("the old signup URL redirects to sign in", async ({ page }) => {
  await page.goto("/signup");

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});
