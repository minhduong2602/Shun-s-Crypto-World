export function getAlertDeliveryBucket(
  alertId: string,
  cooldownMinutes: number,
  now: number,
  lastTriggeredAt: string | null,
  createdAt: string,
) {
  const parsedAnchor = Date.parse(lastTriggeredAt ?? createdAt);
  const anchor = Number.isFinite(parsedAnchor) ? parsedAnchor : now;
  const cooldownMs = Math.max(1, cooldownMinutes) * 60_000;
  const interval = Math.max(0, Math.floor((now - anchor) / cooldownMs));
  return `${alertId}:${anchor}:${interval}`;
}
