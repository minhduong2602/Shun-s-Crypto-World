export function isTelegramSendSuccessful(httpOk: boolean, responseBody: string): boolean {
  if (!httpOk) return false;

  try {
    const result: unknown = JSON.parse(responseBody);
    return typeof result === 'object' && result !== null && 'ok' in result && result.ok === true;
  } catch {
    return false;
  }
}
