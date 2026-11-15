// A time limit for the checks of a browser suite (test/interact.mjs, test/host.mjs). The suites are long scripts in
// which each check() reports a result, so the limit is the time between two results. When no check reports within
// the limit, the watchdog prints a failure that names the last check that finished, and it closes the open pages. A
// Playwright call that waits on a closed page rejects, so the `catch` of that part of the suite reports it and the
// suite moves on, instead of running into the job timeout with no output (#421). CHECK_TIMEOUT sets the limit in
// seconds; the default is 120.
export function watchdog(browser, onTimeout) {
    const limit = (Number(process.env.CHECK_TIMEOUT) || 120) * 1000;
    let last = '(the start of the suite)', timer;
    const arm = () => {
        clearTimeout(timer);
        timer = setTimeout(async () => {
            onTimeout(`no check finished within ${limit / 1000} s after "${last}"; the pages are closed and the suite moves on`);
            for (const context of browser.contexts()) for (const page of context.pages()) await page.close().catch(() => {});
            arm();
        }, limit);
        timer.unref(); // (the timer does not keep the process alive at the end of the suite)
    };
    arm();
    return name => { last = name; arm(); };
}
