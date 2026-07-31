import { test, expect } from "@mendix/run-e2e/fixtures";
import { waitForMendixApp } from "@mendix/run-e2e/mendix-helpers";
import AxeBuilder from "@axe-core/playwright";

// NOTE: The test project referenced by this widget's package.json ("testProject.branchName")
// is currently `datagrid-text-filter-web/data-widgets-3.0`, inherited from the single-term
// text filter widget. It does not yet contain a page with this widget (DatagridMultiTextFilter)
// placed in a Data Grid 2. Until a page such as `/p/multi-text-filter` is added to a dedicated
// test project branch, this spec cannot pass — see the widget's CHANGELOG/README for the
// documented gap. The selectors below follow the widget's actual rendered markup
// (see src/components/TermChipInput.tsx) so the spec is ready to run as soon as such a page exists.
test.describe("datagrid-multi-text-filter-web", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/p/multi-text-filter");
        await waitForMendixApp(page);
    });

    test.describe("multi term filtering", () => {
        test("filters rows by a pasted comma-separated list", async ({ page }) => {
            const filter = page.getByRole("textbox", { name: /search terms/i });
            await filter.click();
            // Typing the delimiter exercises the same code path as a paste.
            await filter.pressSequentially("Alfred,Bob,");

            const grid = page.locator(".mx-name-datagrid1");
            await expect(grid.locator(".tr")).toHaveCount(2);
        });

        test("removing a chip widens the result set", async ({ page }) => {
            const filter = page.getByRole("textbox", { name: /search terms/i });
            await filter.click();
            await filter.pressSequentially("Alfred,Bob,");

            const grid = page.locator(".mx-name-datagrid1");
            await expect(grid.locator(".tr")).toHaveCount(2);

            await page.getByRole("button", { name: /remove term Bob/i }).click();
            await expect(grid.locator(".tr")).toHaveCount(1);
        });

        test("clearing removes the filter entirely", async ({ page }) => {
            const filter = page.getByRole("textbox", { name: /search terms/i });
            await filter.click();
            await filter.pressSequentially("Alfred,");

            const grid = page.locator(".mx-name-datagrid1");
            const filteredCount = await grid.locator(".tr").count();

            await page.getByRole("button", { name: "Clear all terms" }).click();
            await expect(grid.locator(".tr")).not.toHaveCount(filteredCount);
        });
    });

    test.describe("a11y testing:", () => {
        test("checks accessibility violations", async ({ page }) => {
            const accessibilityScanResults = await new AxeBuilder({ page }).withTags(["wcag21aa"]).analyze();

            expect(accessibilityScanResults.violations).toEqual([]);
        });
    });
});
