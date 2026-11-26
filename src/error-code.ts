/**
 * Puts the code of a message in the field `code` of the error (`error.code === 'E63'`), so that a program can tell errors
 * apart without reading the text (#2148). The build wraps each `new Error(text)` of src/ whose text has a code
 * (scripts/message-codes.mjs, `errorCodes`), in both builds. `name` stays `Error`. An error with no code is not changed.
 */
export function withCode<T extends Error>(error: T): T {
    const code = /^(?:\[map-jr-gl\] )?(?:\w+\(\): )?(E\d+) /.exec(error.message)?.[1];
    if (code) (error as T & {code?: string}).code = code;
    return error;
}
