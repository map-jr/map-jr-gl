// Two guards for a browser suite (test/interact.mjs, test/host.mjs) against checks that go missing without a FAIL line
// (#1044).
//
// 1. An error that no `catch` of the suite takes (a `page.evaluate` that throws in a part of the suite with no `try`)
//    prints FAIL with its message and ends the run with exit code 1, instead of a stack trace with no FAIL line.
// 2. The suite counts its results (PASS, FAIL and SKIP). A `page.evaluate` that throws inside a `try` prints one FAIL
//    and skips every check after it in that part, so `tally` fails the run when the count is below the floor that the
//    suite gives for the renderers that it ran. A floor is a lower bound with a margin for the checks that other
//    browsers leave out, so a new check needs no change of it. Raise it when the suite grows by about a tenth.
export function guard(onFail) {
    let count = 0;
    const fatal = error => { console.log(`FAIL  the suite stopped: ${String(error?.message ?? error).split('\n')[0]}`); process.exit(1); };
    process.on('uncaughtException', fatal);
    process.on('unhandledRejection', fatal);
    return {
        counted: () => { count++; },
        /** At the end of the suite: fails the run when fewer than `floor` results were printed. */
        tally: floor => {
            console.log(`${count} results (the floor for this run is ${floor})`);
            if (count < floor) onFail(`only ${count} results, where this run has at least ${floor}: a check stopped the part of the suite after it (see the FAIL above)`);
        },
    };
}
