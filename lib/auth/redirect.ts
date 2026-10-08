export function safeAuthRedirect(path: string | null | undefined) {
  return path?.startsWith('/') && !path.startsWith('//') ? path : '/';
}
