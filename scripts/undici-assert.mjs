// Node's undici can throw an assertion (ERR_ASSERTION, "this.paused") from a socket event while it reads the body of a
// "Connection: close" response, and no `try` around the fetch catches it (#2289). The handler that `survive(tag)`
// installs logs that one error and lets the process go on; any other uncaught error is printed and ends the process
// with code 1. The caller must read the response again when its body did not arrive (see `fetchRetry` of scripts/site.mjs).
export function survive(tag) {
    process.on('uncaughtException', error => {
        if (error?.code === 'ERR_ASSERTION' && /this\.paused/.test(error.message)) console.warn(`[${tag}] an undici assertion from a socket event (#2289); going on`);
        else { console.error(error); process.exit(1); }
    });
}
